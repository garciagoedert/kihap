import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../src/services/firebase';
import { useAuth } from '../src/context/AuthContext';
import { AVATAR_FRAMES, normalizeUnitDisplay } from '../src/utils/engagement';

type TabKey = 'amigos' | 'seguidores' | 'seguindo';

interface ConnectionUser {
  uid: string;
  name: string;
  belt: string;
  unit: string;
  photoSource: any;
  avatarFrame: string;
  isInstructor: boolean;
  isAdmin: boolean;
}

const DEFAULT_AVATAR = require('../assets/images/default-profile.png');

function normalizeSearchText(value?: string): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,'"´`~^°ºª\-_/()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBeltName(beltStr?: string): string {
  if (!beltStr) return '';
  const trimmed = beltStr.trim();
  const m = trimmed.match(/^(\d+)(?:º|o)?\s*Dan\s*(?:Preta)?$/i);
  if (m) return `Preta ${m[1]}º Dan`;
  const m2 = trimmed.match(/^Preta\s*(\d+)(?:º|o)?\s*Dan$/i);
  if (m2) return `Preta ${m2[1]}º Dan`;
  return trimmed;
}

function resolvePhotoSource(userData: any): any {
  let raw =
    userData?.photoURL ||
    userData?.profilePicture ||
    userData?.photoUrl ||
    userData?.avatar ||
    '';
  if (typeof raw !== 'string') raw = '';
  raw = raw.trim();
  if (!raw || raw.includes('default-profile.svg') || raw.includes('default-profile.png')) {
    return DEFAULT_AVATAR;
  }
  const uri = raw.startsWith('/') ? `https://kihap.com.br${raw}` : raw;
  return { uri };
}

function getMillis(val: any): number {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.seconds === 'number') return val.seconds * 1000;
  const parsed = new Date(val).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function mapUserDocToConnection(uid: string, data: any): ConnectionUser {
  const name =
    data?.name ||
    data?.nome ||
    data?.displayName ||
    data?.fullName ||
    data?.apelido ||
    'Aluno Kihap';
  const rawBelt =
    data?.belt || data?.graduacao || data?.graduation || data?.userGraduacao || '';
  const belt = normalizeBeltName(rawBelt) || 'Membro Kihap';
  const rawUnit =
    data?.unidade ||
    data?.unit ||
    data?.unitName ||
    data?.unidadeNome ||
    data?.unitId ||
    data?.unidadeId ||
    '';
  const unit = rawUnit ? normalizeUnitDisplay(rawUnit) : 'Kihap';
  const isInstructor = data?.isInstructor === true || data?.isInstructor === 'true';
  const isAdmin = data?.isAdmin === true || data?.isAdmin === 'true';

  return {
    uid,
    name: String(name),
    belt,
    unit,
    photoSource: resolvePhotoSource(data),
    avatarFrame: data?.avatarFrame || 'none',
    isInstructor,
    isAdmin,
  };
}

export default function ConexoesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, userData: currentUserData } = useAuth();

  const params = useLocalSearchParams<{ uid?: string; tab?: string; name?: string }>();
  const paramUid = Array.isArray(params.uid) ? params.uid[0] : params.uid;
  const paramTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const paramName = Array.isArray(params.name) ? params.name[0] : params.name;

  const targetUid = paramUid || user?.uid || '';
  const isOwnConnections = Boolean(user?.uid && targetUid === user.uid);

  const resolveInitialTab = useCallback(
    (rawTab?: string): TabKey => {
      if (rawTab === 'amigos' || rawTab === 'seguidores' || rawTab === 'seguindo') {
        return rawTab;
      }
      return isOwnConnections ? 'amigos' : 'seguidores';
    },
    [isOwnConnections]
  );

  const [activeTab, setActiveTab] = useState<TabKey>(() => resolveInitialTab(paramTab));
  const [searchQuery, setSearchQuery] = useState('');

  const [targetFollowerIds, setTargetFollowerIds] = useState<string[]>([]);
  const [targetFollowingIds, setTargetFollowingIds] = useState<string[]>([]);
  const [followersReady, setFollowersReady] = useState(false);
  const [followingReady, setFollowingReady] = useState(false);

  const [myFollowingDocs, setMyFollowingDocs] = useState<Record<string, string[]>>({});
  const [myFollowerSet, setMyFollowerSet] = useState<Set<string>>(() => new Set());
  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({});

  const profileCacheRef = useRef<Record<string, ConnectionUser | null>>({});
  const [profilesMap, setProfilesMap] = useState<Record<string, ConnectionUser | null>>({});
  const [hydratingProfiles, setHydratingProfiles] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    setActiveTab(resolveInitialTab(paramTab));
  }, [paramTab, targetUid, resolveInitialTab]);

  // Listen to targetUid's followers and following in real time
  useEffect(() => {
    if (!targetUid) {
      setTargetFollowerIds([]);
      setTargetFollowingIds([]);
      setFollowersReady(true);
      setFollowingReady(true);
      return;
    }

    setFollowersReady(false);
    setFollowingReady(false);

    const followersQ = query(
      collection(db, 'follows'),
      where('followingId', '==', targetUid)
    );
    const unsubFollowers = onSnapshot(
      followersQ,
      (snap) => {
        const latestByUid = new Map<string, number>();
        snap.docs.forEach((d) => {
          const data = d.data();
          const fid = data?.followerId;
          if (!fid || typeof fid !== 'string') return;
          const ms = getMillis(data.createdAt);
          const prev = latestByUid.get(fid) ?? -1;
          if (ms >= prev) {
            latestByUid.set(fid, ms);
          }
        });
        const sortedIds = Array.from(latestByUid.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([uid]) => uid);

        setTargetFollowerIds(sortedIds);
        if (isOwnConnections) {
          setMyFollowerSet(new Set(sortedIds));
        }
        setFollowersReady(true);
      },
      (err) => {
        console.error('[Conexoes] Error listening followers:', err);
        setFollowersReady(true);
      }
    );

    const followingQ = query(
      collection(db, 'follows'),
      where('followerId', '==', targetUid)
    );
    const unsubFollowing = onSnapshot(
      followingQ,
      (snap) => {
        const latestByUid = new Map<string, number>();
        const docIdsMap: Record<string, string[]> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          const tid = data?.followingId;
          if (!tid || typeof tid !== 'string') return;
          if (!docIdsMap[tid]) docIdsMap[tid] = [];
          docIdsMap[tid].push(d.id);

          const ms = getMillis(data.createdAt);
          const prev = latestByUid.get(tid) ?? -1;
          if (ms >= prev) {
            latestByUid.set(tid, ms);
          }
        });
        const sortedIds = Array.from(latestByUid.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([uid]) => uid);

        setTargetFollowingIds(sortedIds);
        if (isOwnConnections) {
          setMyFollowingDocs(docIdsMap);
        }
        setFollowingReady(true);
      },
      (err) => {
        console.error('[Conexoes] Error listening following:', err);
        setFollowingReady(true);
      }
    );

    return () => {
      unsubFollowers();
      unsubFollowing();
    };
  }, [targetUid, isOwnConnections]);

  // Listen to logged-in user's own follow graph when viewing another user's connections
  useEffect(() => {
    if (!user?.uid || isOwnConnections) return;

    const myFollowingQ = query(
      collection(db, 'follows'),
      where('followerId', '==', user.uid)
    );
    const unsubMyFollowing = onSnapshot(
      myFollowingQ,
      (snap) => {
        const docIdsMap: Record<string, string[]> = {};
        snap.docs.forEach((d) => {
          const tid = d.data()?.followingId;
          if (!tid || typeof tid !== 'string') return;
          if (!docIdsMap[tid]) docIdsMap[tid] = [];
          docIdsMap[tid].push(d.id);
        });
        setMyFollowingDocs(docIdsMap);
      },
      (err) => console.error('[Conexoes] Error listening own following:', err)
    );

    const myFollowersQ = query(
      collection(db, 'follows'),
      where('followingId', '==', user.uid)
    );
    const unsubMyFollowers = onSnapshot(
      myFollowersQ,
      (snap) => {
        const ids = new Set<string>();
        snap.docs.forEach((d) => {
          const fid = d.data()?.followerId;
          if (fid && typeof fid === 'string') ids.add(fid);
        });
        setMyFollowerSet(ids);
      },
      (err) => console.error('[Conexoes] Error listening own followers:', err)
    );

    return () => {
      unsubMyFollowing();
      unsubMyFollowers();
    };
  }, [user?.uid, isOwnConnections]);

  const allTargetIds = useMemo(
    () => Array.from(new Set([...targetFollowerIds, ...targetFollowingIds])),
    [targetFollowerIds, targetFollowingIds]
  );

  // Hydrate missing user profiles (cached by UID)
  useEffect(() => {
    let cancelled = false;
    const missingIds = allTargetIds.filter(
      (uid) => !Object.prototype.hasOwnProperty.call(profileCacheRef.current, uid)
    );

    if (missingIds.length === 0) {
      setHydratingProfiles(false);
      setRefreshing(false);
      return;
    }

    setHydratingProfiles(true);
    Promise.allSettled(
      missingIds.map(async (uid) => {
        const snap = await getDoc(doc(db, 'users', uid));
        return { uid, snap };
      })
    ).then((results) => {
      if (cancelled) return;
      results.forEach((res) => {
        if (res.status === 'fulfilled') {
          const { uid, snap } = res.value;
          profileCacheRef.current[uid] = snap.exists()
            ? mapUserDocToConnection(uid, snap.data())
            : null;
        }
      });
      setProfilesMap({ ...profileCacheRef.current });
      setHydratingProfiles(false);
      setRefreshing(false);
    });

    return () => {
      cancelled = true;
    };
  }, [allTargetIds, refreshNonce]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    profileCacheRef.current = {};
    setRefreshNonce((prev) => prev + 1);
    if (allTargetIds.length === 0) {
      setRefreshing(false);
    }
  }, [allTargetIds.length]);

  const targetFollowerSet = useMemo(() => new Set(targetFollowerIds), [targetFollowerIds]);

  const amigosIds = useMemo(
    () => targetFollowingIds.filter((uid) => targetFollowerSet.has(uid)),
    [targetFollowingIds, targetFollowerSet]
  );

  const getEffectiveCount = useCallback(
    (ids: string[]) => ids.filter((uid) => profilesMap[uid] !== null).length,
    [profilesMap]
  );

  const amigosList = useMemo(
    () =>
      amigosIds
        .map((uid) => profilesMap[uid])
        .filter((u): u is ConnectionUser => Boolean(u)),
    [amigosIds, profilesMap]
  );

  const seguidoresList = useMemo(
    () =>
      targetFollowerIds
        .map((uid) => profilesMap[uid])
        .filter((u): u is ConnectionUser => Boolean(u)),
    [targetFollowerIds, profilesMap]
  );

  const seguindoList = useMemo(
    () =>
      targetFollowingIds
        .map((uid) => profilesMap[uid])
        .filter((u): u is ConnectionUser => Boolean(u)),
    [targetFollowingIds, profilesMap]
  );

  const counts = useMemo(
    () => ({
      amigos: getEffectiveCount(amigosIds),
      seguidores: getEffectiveCount(targetFollowerIds),
      seguindo: getEffectiveCount(targetFollowingIds),
    }),
    [amigosIds, targetFollowerIds, targetFollowingIds, getEffectiveCount]
  );

  const activeList = useMemo(() => {
    if (activeTab === 'amigos') return amigosList;
    if (activeTab === 'seguidores') return seguidoresList;
    return seguindoList;
  }, [activeTab, amigosList, seguidoresList, seguindoList]);

  const filteredList = useMemo(() => {
    const qNorm = normalizeSearchText(searchQuery);
    if (!qNorm) return activeList;
    return activeList.filter((item) => {
      const hay = normalizeSearchText(`${item.name} ${item.belt} ${item.unit}`);
      return hay.includes(qNorm);
    });
  }, [activeList, searchQuery]);

  const executeUnfollow = useCallback(async (target: ConnectionUser, docIds: string[]) => {
    setPendingMap((prev) => ({ ...prev, [target.uid]: true }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await Promise.all(docIds.map((docId) => deleteDoc(doc(db, 'follows', docId))));
    } catch (err) {
      console.error('[Conexoes] Error unfollowing:', err);
      Alert.alert('Erro', 'Não foi possível deixar de seguir este colega.');
    } finally {
      setPendingMap((prev) => ({ ...prev, [target.uid]: false }));
    }
  }, []);

  const handleToggleFollow = useCallback(
    async (target: ConnectionUser) => {
      if (!user?.uid || target.uid === user.uid || pendingMap[target.uid]) return;

      const existingDocIds = myFollowingDocs[target.uid] || [];
      if (existingDocIds.length > 0) {
        Alert.alert(
          'Deixar de seguir?',
          `Deseja deixar de seguir ${target.name}?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Deixar de seguir',
              style: 'destructive',
              onPress: () => executeUnfollow(target, existingDocIds),
            },
          ]
        );
        return;
      }

      setPendingMap((prev) => ({ ...prev, [target.uid]: true }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      try {
        await addDoc(collection(db, 'follows'), {
          followerId: user.uid,
          followingId: target.uid,
          createdAt: serverTimestamp(),
        });

        const followerName =
          currentUserData?.name ||
          currentUserData?.nome ||
          user.displayName ||
          'Um colega da Kihap';

        await addDoc(collection(db, 'notifications'), {
          userId: target.uid,
          title: 'Novo Seguidor',
          message: `${followerName} começou a te seguir!`,
          type: 'social',
          link: `/members/perfil-publico.html?id=${user.uid}`,
          icon:
            currentUserData?.photoURL ||
            currentUserData?.profilePicture ||
            user.photoURL ||
            '/imgs/kobe.png',
          createdAt: serverTimestamp(),
          read: false,
        });
      } catch (err) {
        console.error('[Conexoes] Error following:', err);
        Alert.alert('Erro', 'Não foi possível seguir este colega.');
      } finally {
        setPendingMap((prev) => ({ ...prev, [target.uid]: false }));
      }
    },
    [user, currentUserData, myFollowingDocs, pendingMap, executeUnfollow]
  );

  const handleOpenProfile = useCallback(
    (uid: string) => {
      if (user?.uid && uid === user.uid) {
        router.push('/(tabs)/perfil');
        return;
      }
      router.push(`/user/${uid}`);
    },
    [router, user?.uid]
  );

  const palette = useMemo(
    () => ({
      bg: isDark ? '#050505' : '#f8f9fa',
      surface: isDark ? '#141414' : '#ffffff',
      subtle: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
      border: isDark ? 'rgba(255,255,255,0.09)' : '#e5e7eb',
      text: isDark ? '#ffffff' : '#111827',
      muted: isDark ? '#9ca3af' : '#6b7280',
      headerBtn: isDark ? 'rgba(255,255,255,0.08)' : '#ffffff',
      activeTabBg: isDark ? '#eab308' : '#111827',
      activeTabText: isDark ? '#000000' : '#ffffff',
      activeCountBg: isDark ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.18)',
      inactiveCountBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.08)',
    }),
    [isDark]
  );

  const isLoadingInitial =
    !followersReady ||
    !followingReady ||
    (hydratingProfiles && activeList.length === 0 && allTargetIds.length > 0);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'amigos', label: 'Amigos', count: counts.amigos },
    { key: 'seguidores', label: 'Seguidores', count: counts.seguidores },
    { key: 'seguindo', label: 'Seguindo', count: counts.seguindo },
  ];

  const renderUserRow = useCallback(
    ({ item }: { item: ConnectionUser }) => {
      const isSelf = Boolean(user?.uid && item.uid === user.uid);
      const iFollow = (myFollowingDocs[item.uid] || []).length > 0;
      const followsMe = myFollowerSet.has(item.uid);
      const isMutual = iFollow && followsMe;
      const isPending = Boolean(pendingMap[item.uid]);
      const frameMeta = AVATAR_FRAMES[item.avatarFrame || 'none'] || AVATAR_FRAMES.none;

      let btnLabel = 'Seguir';
      let btnBg = isDark ? '#ffffff' : '#111827';
      let btnText = isDark ? '#000000' : '#ffffff';
      let btnBorder = 'transparent';

      if (isMutual) {
        btnLabel = 'Amigos';
        btnBg = isDark ? 'rgba(234, 179, 8, 0.14)' : 'rgba(234, 179, 8, 0.16)';
        btnText = isDark ? '#facc15' : '#92400e';
        btnBorder = 'rgba(234, 179, 8, 0.42)';
      } else if (iFollow) {
        btnLabel = 'Seguindo';
        btnBg = palette.subtle;
        btnText = palette.text;
        btnBorder = palette.border;
      } else if (followsMe) {
        btnLabel = 'Seguir de volta';
        btnBg = '#eab308';
        btnText = '#000000';
        btnBorder = '#eab308';
      }

      return (
        <View
          style={[
            styles.rowCard,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <TouchableOpacity
            onPress={() => handleOpenProfile(item.uid)}
            activeOpacity={0.78}
            style={styles.rowMainTouch}
          >
            <View style={styles.avatarWrapper}>
              <View
                style={[
                  styles.avatarRing,
                  {
                    borderColor:
                      frameMeta.id !== 'none' ? frameMeta.ringColor : palette.border,
                    borderWidth: frameMeta.id !== 'none' ? 2.5 : 1.5,
                    backgroundColor: isDark ? '#1f2937' : '#e5e7eb',
                  },
                ]}
              >
                <Image
                  source={item.photoSource}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              </View>
              {item.isInstructor && (
                <View style={styles.instructorBadge}>
                  <ShieldCheck size={10} color="#000" strokeWidth={2.6} />
                </View>
              )}
            </View>

            <View style={styles.rowInfo}>
              <View style={styles.nameRow}>
                <Text
                  numberOfLines={1}
                  style={[styles.userName, { color: palette.text }]}
                >
                  {item.name}
                </Text>

                {!isSelf && isMutual && activeTab !== 'amigos' && (
                  <View style={styles.mutualPill}>
                    <Text style={styles.mutualPillText}>Amigo</Text>
                  </View>
                )}

                {!isSelf && !iFollow && followsMe && (
                  <View
                    style={[
                      styles.followsYouPill,
                      { backgroundColor: palette.subtle, borderColor: palette.border },
                    ]}
                  >
                    <Text style={[styles.followsYouPillText, { color: palette.muted }]}>
                      Segue você
                    </Text>
                  </View>
                )}
              </View>

              <Text
                numberOfLines={1}
                style={[styles.userMeta, { color: palette.muted }]}
              >
                {item.belt} • {item.unit}
              </Text>
            </View>
          </TouchableOpacity>

          {isSelf ? (
            <View
              style={[
                styles.selfBadge,
                { backgroundColor: palette.subtle, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.selfBadgeText, { color: palette.muted }]}>Você</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => handleToggleFollow(item)}
              disabled={isPending}
              activeOpacity={0.8}
              style={[
                styles.actionBtn,
                { backgroundColor: btnBg, borderColor: btnBorder },
              ]}
            >
              {isPending ? (
                <ActivityIndicator size="small" color={btnText} />
              ) : (
                <>
                  {isMutual ? (
                    <Users size={12} color={btnText} />
                  ) : iFollow ? (
                    <UserCheck size={12} color={btnText} />
                  ) : (
                    <UserPlus size={12} color={btnText} />
                  )}
                  <Text style={[styles.actionBtnText, { color: btnText }]}>
                    {btnLabel}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [
      user?.uid,
      myFollowingDocs,
      myFollowerSet,
      pendingMap,
      isDark,
      palette,
      activeTab,
      handleOpenProfile,
      handleToggleFollow,
    ]
  );

  const renderEmptyState = () => {
    if (isLoadingInitial) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#eab308" />
          <Text style={[styles.emptySubtitle, { color: palette.muted, marginTop: 12 }]}>
            Carregando conexões...
          </Text>
        </View>
      );
    }

    if (searchQuery.trim().length > 0) {
      return (
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconCircle,
              { backgroundColor: palette.subtle, borderColor: palette.border },
            ]}
          >
            <Search size={24} color={palette.muted} />
          </View>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>
            Nenhum colega encontrado
          </Text>
          <Text style={[styles.emptySubtitle, { color: palette.muted }]}>
            Não encontramos conexões para "{searchQuery.trim()}".
          </Text>
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={[
              styles.secondaryCtaBtn,
              { backgroundColor: palette.subtle, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.secondaryCtaText, { color: palette.text }]}>
              Limpar filtro
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (activeTab === 'amigos') {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircleGold}>
            <Users size={26} color="#eab308" />
          </View>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>
            Nenhum amigo mútuo ainda
          </Text>
          <Text style={[styles.emptySubtitle, { color: palette.muted }]}>
            {isOwnConnections
              ? 'Amigos são colegas que seguem você e que você também segue de volta.'
              : 'Aqui aparecem os colegas que se seguem mutuamente.'}
          </Text>
          {isOwnConnections && counts.seguidores > 0 && (
            <TouchableOpacity
              onPress={() => setActiveTab('seguidores')}
              style={styles.primaryCtaBtn}
            >
              <Text style={styles.primaryCtaText}>Ver quem te segue</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/busca')}
            style={[
              isOwnConnections && counts.seguidores > 0
                ? styles.secondaryCtaBtn
                : styles.primaryCtaBtn,
              isOwnConnections && counts.seguidores > 0
                ? { backgroundColor: palette.subtle, borderColor: palette.border }
                : undefined,
            ]}
          >
            <Text
              style={
                isOwnConnections && counts.seguidores > 0
                  ? [styles.secondaryCtaText, { color: palette.text }]
                  : styles.primaryCtaText
              }
            >
              Buscar colegas no Descobrir
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    const isSeguidores = activeTab === 'seguidores';
    return (
      <View style={styles.emptyContainer}>
        <View
          style={[
            styles.emptyIconCircle,
            { backgroundColor: palette.subtle, borderColor: palette.border },
          ]}
        >
          <Users size={24} color={palette.muted} />
        </View>
        <Text style={[styles.emptyTitle, { color: palette.text }]}>
          {isSeguidores
            ? isOwnConnections
              ? 'Você ainda não tem seguidores'
              : 'Nenhum seguidor ainda'
            : isOwnConnections
              ? 'Você ainda não segue ninguém'
              : 'Não segue ninguém ainda'}
        </Text>
        <Text style={[styles.emptySubtitle, { color: palette.muted }]}>
          {isSeguidores
            ? 'Interaja na comunidade e nos eventos da unidade para se conectar com outros alunos e instrutores.'
            : 'Encontre colegas, instrutores e alunos da sua unidade na aba Descobrir.'}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/busca')}
          style={styles.primaryCtaBtn}
        >
          <Text style={styles.primaryCtaText}>Buscar colegas no Descobrir</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Top Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, borderBottomColor: palette.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.75}
          style={[
            styles.iconCircleBtn,
            { backgroundColor: palette.headerBtn, borderColor: palette.border },
          ]}
          accessibilityLabel="Voltar"
        >
          <ArrowLeft size={20} color={palette.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: palette.text }]}>
            {isOwnConnections ? 'Minhas Conexões' : 'Conexões'}
          </Text>
          {!isOwnConnections && !!paramName && (
            <Text numberOfLines={1} style={[styles.headerSubtitle, { color: palette.muted }]}>
              {paramName}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(tabs)/busca')}
          activeOpacity={0.75}
          style={[
            styles.iconCircleBtn,
            { backgroundColor: palette.headerBtn, borderColor: palette.border },
          ]}
          accessibilityLabel="Encontrar colegas"
        >
          <UserPlus size={18} color="#eab308" />
        </TouchableOpacity>
      </View>

      {/* 3-Tab Segmented Selector */}
      <View style={styles.controlsSection}>
        <View
          style={[
            styles.segmentedBar,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => {
                  if (activeTab !== tab.key) {
                    Haptics.selectionAsync().catch(() => {});
                    setActiveTab(tab.key);
                  }
                }}
                activeOpacity={0.85}
                style={[
                  styles.segmentItem,
                  isActive ? { backgroundColor: palette.activeTabBg } : undefined,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.segmentLabel,
                    { color: isActive ? palette.activeTabText : palette.muted },
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.segmentCountPill,
                    {
                      backgroundColor: isActive
                        ? palette.activeCountBg
                        : palette.inactiveCountBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentCountText,
                      { color: isActive ? palette.activeTabText : palette.text },
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 'amigos' && (
          <Text style={[styles.tabHelperText, { color: palette.muted }]}>
            {isOwnConnections
              ? 'Colegas que seguem você e que você também segue de volta.'
              : 'Colegas que se seguem mutuamente.'}
          </Text>
        )}

        {/* Search Input */}
        <View
          style={[
            styles.searchBox,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Search size={16} color={palette.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Filtrar por nome, faixa ou unidade..."
            placeholderTextColor={palette.muted}
            style={[styles.searchInput, { color: palette.text }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Limpar busca"
            >
              <X size={16} color={palette.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Connections List */}
      <FlatList
        data={filteredList}
        keyExtractor={(item) => item.uid}
        renderItem={renderUserRow}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 20 },
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#eab308"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  iconCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  controlsSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  segmentedBar: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 12,
    gap: 5,
  },
  segmentLabel: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  segmentCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 999,
  },
  segmentCountText: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 10,
  },
  tabHelperText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 8,
    marginLeft: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
    marginTop: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: 0,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
    gap: 10,
  },
  rowMainTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  instructorBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#eab308',
    borderWidth: 1.5,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  userName: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 14,
    flexShrink: 1,
  },
  mutualPill: {
    backgroundColor: 'rgba(234, 179, 8, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 999,
  },
  mutualPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ca8a04',
    textTransform: 'uppercase',
  },
  followsYouPill: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 999,
  },
  followsYouPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  userMeta: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 3,
  },
  selfBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  selfBadgeText: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    minWidth: 92,
  },
  actionBtnText: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyIconCircleGold: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(234, 179, 8, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
  },
  primaryCtaBtn: {
    marginTop: 18,
    backgroundColor: '#eab308',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryCtaText: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 11,
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryCtaBtn: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryCtaText: {
    fontFamily: 'NeueMachina-Ultrabold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
