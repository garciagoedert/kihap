import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import {
  ArrowLeft,
  Award,
  Check,
  Flame,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { db, functions } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import {
  AVATAR_FRAMES,
  getEffectiveKihapcoins,
  getLocalDateStr,
  normalizeUnitDisplay,
} from '../utils/engagement';
import {
  getPhysicalTestScore,
  subscribeUserPhysicalTests,
} from '../utils/physicalTests';
import Emoji from './Emoji';

function getCreatedAtMillis(val: any): number {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.seconds === 'number') return val.seconds * 1000;
  const parsed = new Date(val).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatPhysicalDate(val: any): string {
  if (!val) return 'Não informada';
  try {
    if (typeof val.toDate === 'function') {
      return val.toDate().toLocaleDateString('pt-BR');
    }
    if (typeof val.seconds === 'number') {
      return new Date(val.seconds * 1000).toLocaleDateString('pt-BR');
    }
    const dt = new Date(val);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString('pt-BR');
    }
  } catch {
    // ignore
  }
  return String(val);
}

export default function PublicProfileView() {
  const { id } = useLocalSearchParams();
  const targetUid = Array.isArray(id) ? id[0] : id;
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, userData: currentUserData } = useAuth();

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Social states
  const [loadingChat, setLoadingChat] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followsMe, setFollowsMe] = useState(false);
  const [followDocIds, setFollowDocIds] = useState<string[]>([]);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [sendingCheer, setSendingCheer] = useState(false);
  const [cheerSent, setCheerSent] = useState(false);

  // Badges, activity & physical test states
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [physicalTest, setPhysicalTest] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(true);
  const [recentAchievements, setRecentAchievements] = useState<any[]>([]);

  const fetchUserData = async (isRefresh = false) => {
    if (!targetUid) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!isRefresh) setLoading(true);
    try {
      const docSnap = await getDoc(doc(db, 'users', targetUid));
      if (docSnap.exists()) {
        setUserData({ uid: docSnap.id, ...docSnap.data() });
      } else {
        setUserData(null);
      }
    } catch (error) {
      console.error('Error fetching public profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCheerAndActivity = async () => {
    if (!targetUid || !user?.uid) return;
    try {
      const cheerDocId = `${user.uid}_${targetUid}_${getLocalDateStr()}`;
      const [cheerSnap, achSnap] = await Promise.allSettled([
        user.uid !== targetUid
          ? getDoc(doc(db, 'kihap_cheers', cheerDocId))
          : Promise.resolve(null),
        getDocs(
          query(
            collection(db, 'achievements_feed'),
            where('userId', '==', targetUid),
            limit(10)
          )
        ),
      ]);

      if (cheerSnap.status === 'fulfilled' && cheerSnap.value && cheerSnap.value.exists()) {
        setCheerSent(true);
      } else if (user.uid !== targetUid) {
        setCheerSent(false);
      }

      if (achSnap.status === 'fulfilled') {
        const list = achSnap.value.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => getCreatedAtMillis(b.createdAt) - getCreatedAtMillis(a.createdAt))
          .slice(0, 4);
        setRecentAchievements(list);
      }
    } catch (err) {
      console.warn('[PublicProfile] Cheer/Activity check warning:', err);
    }
  };

  useEffect(() => {
    if (targetUid) {
      fetchUserData();
    }
  }, [targetUid]);

  useEffect(() => {
    fetchCheerAndActivity();
  }, [targetUid, user?.uid]);

  // Follower / Following counters
  useEffect(() => {
    if (!targetUid) return;

    const followersQ = query(collection(db, 'follows'), where('followingId', '==', targetUid));
    const unsubscribeFollowers = onSnapshot(
      followersQ,
      (snap) => {
        const uniqueFollowers = new Set<string>();
        snap.docs.forEach((d) => {
          const fid = d.data()?.followerId;
          if (typeof fid === 'string' && fid.length > 0) uniqueFollowers.add(fid);
        });
        setFollowersCount(uniqueFollowers.size);
      },
      (err) => console.error('Error fetching followers:', err)
    );

    const followingQ = query(collection(db, 'follows'), where('followerId', '==', targetUid));
    const unsubscribeFollowing = onSnapshot(
      followingQ,
      (snap) => {
        const uniqueFollowing: string[] = [];
        const seen = new Set<string>();
        snap.docs.forEach((d) => {
          const tid = d.data()?.followingId;
          if (typeof tid === 'string' && tid.length > 0 && !seen.has(tid)) {
            seen.add(tid);
            uniqueFollowing.push(tid);
          }
        });
        setFollowingCount(uniqueFollowing.length);
        setFollowsMe(
          Boolean(user?.uid && targetUid !== user.uid && uniqueFollowing.includes(user.uid))
        );
      },
      (err) => console.error('Error fetching following:', err)
    );

    return () => {
      unsubscribeFollowers();
      unsubscribeFollowing();
    };
  }, [targetUid, user?.uid]);

  // Current user follow relation
  useEffect(() => {
    if (!user?.uid || !targetUid) return;

    const q = query(
      collection(db, 'follows'),
      where('followerId', '==', user.uid),
      where('followingId', '==', targetUid)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setIsFollowing(true);
        setFollowDocIds(snap.docs.map((d) => d.id));
      } else {
        setIsFollowing(false);
        setFollowDocIds([]);
      }
    });

    return () => unsubscribe();
  }, [user?.uid, targetUid]);

  // Badges catalog
  useEffect(() => {
    const badgesCol = collection(db, 'badges');
    const unsubscribe = onSnapshot(
      badgesCol,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        list.sort((a: any, b: any) => {
          const orderA = a.order !== undefined && a.order !== null ? Number(a.order) : 9999;
          const orderB = b.order !== undefined && b.order !== null ? Number(b.order) : 9999;
          return orderA - orderB || (a.name || '').localeCompare(b.name || '');
        });
        setAllBadges(list);
        setBadgesLoading(false);
      },
      (error) => {
        console.error('Error fetching badges:', error);
        setBadgesLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Latest physical test
  useEffect(() => {
    const evoId = userData?.evoMemberId ?? userData?.matricula ?? null;
    if (!targetUid && !evoId) {
      setPhysicalTest(null);
      setTestLoading(false);
      return;
    }

    const canReadSubcollection = Boolean(
      user?.uid &&
        targetUid &&
        (user.uid === targetUid ||
          currentUserData?.isAdmin === true ||
          currentUserData?.isAdmin === 'true' ||
          currentUserData?.isInstructor === true ||
          currentUserData?.isInstructor === 'true' ||
          currentUserData?.isAdministrativo === true ||
          currentUserData?.isAdministrativo === 'true')
    );

    setTestLoading(true);
    return subscribeUserPhysicalTests(
      {
        uid: targetUid,
        evoMemberId: evoId,
        includeUserSubcollection: canReadSubcollection,
      },
      (tests) => {
        setPhysicalTest(tests.length > 0 ? tests[0] : null);
        setTestLoading(false);
      }
    );
  }, [
    targetUid,
    userData?.evoMemberId,
    userData?.matricula,
    user?.uid,
    currentUserData?.isAdmin,
    currentUserData?.isInstructor,
    currentUserData?.isAdministrativo,
  ]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUserData(true);
    fetchCheerAndActivity();
  };

  const handleFollowToggle = async () => {
    if (!user?.uid) {
      Alert.alert('Erro', 'Você precisa estar logado para seguir usuários.');
      return;
    }
    if (!targetUid || user.uid === targetUid) {
      Alert.alert('Erro', 'Você não pode seguir a si mesmo.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setLoadingFollow(true);
    try {
      if (isFollowing && followDocIds.length > 0) {
        await Promise.all(followDocIds.map((docId) => deleteDoc(doc(db, 'follows', docId))));
      } else {
        await addDoc(collection(db, 'follows'), {
          followerId: user.uid,
          followingId: targetUid,
          createdAt: serverTimestamp(),
        });

        const followerName =
          currentUserData?.name ||
          currentUserData?.nome ||
          user.displayName ||
          'Um colega da Kihap';

        await addDoc(collection(db, 'notifications'), {
          userId: targetUid,
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
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      Alert.alert('Erro', 'Não foi possível processar a ação social.');
    } finally {
      setLoadingFollow(false);
    }
  };

  const handleStartChat = async () => {
    if (!user?.uid) {
      Alert.alert('Erro', 'Você precisa estar logado para iniciar uma conversa.');
      return;
    }
    if (!targetUid || user.uid === targetUid) {
      Alert.alert('Erro', 'Você não pode conversar com você mesmo.');
      return;
    }

    setLoadingChat(true);
    try {
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('isGroup', '==', false),
        where('members', 'array-contains', user.uid)
      );

      const querySnapshot = await getDocs(q);
      let existingChatId: string | null = null;

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.members && data.members.includes(targetUid)) {
          existingChatId = docSnap.id;
        }
      });

      if (existingChatId) {
        router.push(`/chat/${existingChatId}`);
      } else {
        const newChatRef = await addDoc(chatsRef, {
          isGroup: false,
          members: [user.uid, targetUid],
          lastMessage: {
            text: 'Conversa iniciada',
            timestamp: serverTimestamp(),
          },
          unreadCount: {
            [user.uid.replace(/\./g, '_')]: 0,
            [String(targetUid).replace(/\./g, '_')]: 0,
          },
          createdAt: serverTimestamp(),
        });

        router.push(`/chat/${newChatRef.id}`);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Erro', 'Não foi possível iniciar a conversa.');
    } finally {
      setLoadingChat(false);
    }
  };

  const handleSendKihap = async () => {
    if (!user?.uid || !targetUid || user.uid === targetUid || sendingCheer || cheerSent) return;
    setSendingCheer(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const cheerFn = httpsCallable(functions, 'sendKihapCheer');
      await cheerFn({ receiverUid: targetUid, kind: 'kihap' });
      setCheerSent(true);
      setUserData((prev: any) =>
        prev ? { ...prev, kihapsReceived: (Number(prev.kihapsReceived) || 0) + 1 } : prev
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      Alert.alert('Aviso', err?.message || 'Não foi possível enviar o Kihap agora.');
    } finally {
      setSendingCheer(false);
    }
  };

  const defaultProfileImg = require('../../assets/images/default-profile.png');

  if (loading) {
    return (
      <View className="flex-1 bg-[#f8f9fa] dark:bg-[#050505] items-center justify-center">
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color="#eab308" />
      </View>
    );
  }

  if (!userData) {
    return (
      <View className="flex-1 bg-[#f8f9fa] dark:bg-[#050505] items-center justify-center p-6">
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Text className="text-gray-500 dark:text-gray-400 font-bold text-center">
          Usuário não encontrado.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 bg-[#eab308] px-6 py-3 rounded-2xl"
        >
          <Text
            style={{ fontFamily: 'NeueMachina-Ultrabold' }}
            className="text-black text-xs uppercase tracking-wider"
          >
            Voltar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName =
    userData.name ||
    userData.nome ||
    userData.displayName ||
    userData.fullName ||
    userData.apelido ||
    'Aluno Kihap';

  const photoURL =
    userData.photoURL || userData.profilePicture || userData.photoUrl || userData.avatar;
  const photoSource =
    !photoURL ||
    photoURL.includes('default-profile.svg') ||
    photoURL.includes('default-profile.png')
      ? defaultProfileImg
      : { uri: photoURL.startsWith('/') ? `https://kihap.com.br${photoURL}` : photoURL };

  const rawUnit = userData.unidade || userData.unit || userData.unitId || userData.unidadeId || '';
  const unitLabel = rawUnit ? normalizeUnitDisplay(rawUnit) : 'Kihap';
  const beltLabel =
    userData.belt || userData.graduacao || userData.graduation || 'Membro Kihap';
  const roleLabel = userData.isInstructor
    ? 'Instrutor'
    : userData.isAdmin
      ? 'Equipe Kihap'
      : null;

  const currentStreak = Number(userData.currentStreak || 0);
  const longestStreak = Number(userData.longestStreak || 0);
  const effectiveCoins = getEffectiveKihapcoins(userData);
  const kihapsCount = Number(userData.kihapsReceived || 0);
  const earnedBadgesList = allBadges.filter((b) =>
    (userData.earnedBadges || []).includes(b.id)
  );
  const frameMeta = AVATAR_FRAMES[userData.avatarFrame || 'none'] || AVATAR_FRAMES.none;
  const isOwnProfile = Boolean(user?.uid && targetUid && user.uid === targetUid);
  const isMutualFriend = isFollowing && followsMe;

  const subtleCardShadow = isDark
    ? undefined
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      };

  return (
    <View className="flex-1 bg-[#f8f9fa] dark:bg-[#050505]">
      <StatusBar style="light" />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 84 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#eab308"
          />
        }
      >
        {/* 1. HERO PASSAPORTE MARCIAL (BLACK & GOLD) */}
        <LinearGradient
          colors={['#09090b', '#141418', '#1f1a0d']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 20,
            paddingBottom: 22,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
          }}
        >
          {/* Top Navigation Bar */}
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.8}
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderColor: 'rgba(255,255,255,0.16)',
              }}
              className="w-10 h-10 rounded-full items-center justify-center border"
              accessibilityLabel="Voltar"
            >
              <ArrowLeft size={20} color="#ffffff" />
            </TouchableOpacity>

            <Text
              style={{ fontFamily: 'NeueMachina-Ultrabold', color: 'rgba(250, 204, 21, 0.9)' }}
              className="text-[10px] uppercase tracking-[2.5px]"
            >
              Passaporte Marcial
            </Text>

            {roleLabel ? (
              <View
                style={{
                  backgroundColor: 'rgba(234, 179, 8, 0.16)',
                  borderColor: 'rgba(234, 179, 8, 0.35)',
                }}
                className="flex-row items-center px-2.5 py-1 rounded-full border gap-1"
              >
                <ShieldCheck size={12} color="#eab308" />
                <Text className="text-[9px] font-black text-yellow-400 uppercase tracking-wider">
                  {roleLabel}
                </Text>
              </View>
            ) : (
              <View className="w-10" />
            )}
          </View>

          {/* Avatar + Name + Belt & Unit */}
          <View className="items-center">
            <View className="relative">
              <View
                style={{
                  width: 104,
                  height: 104,
                  borderRadius: 52,
                  borderWidth: frameMeta.id !== 'none' ? 3.5 : 3,
                  borderColor: frameMeta.id !== 'none' ? frameMeta.ringColor : '#eab308',
                  overflow: 'hidden',
                  backgroundColor: '#18181b',
                }}
              >
                <Image source={photoSource} className="w-full h-full" resizeMode="cover" />
              </View>

              {frameMeta.badgeIcon ? (
                <View
                  style={{
                    backgroundColor: '#141418',
                    borderColor: 'rgba(234, 179, 8, 0.65)',
                  }}
                  className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full items-center justify-center border"
                >
                  <Emoji symbol={frameMeta.badgeIcon} size={14} />
                </View>
              ) : roleLabel ? (
                <View className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-[#eab308] border-2 border-[#09090b] items-center justify-center">
                  <ShieldCheck size={14} color="#000" />
                </View>
              ) : null}
            </View>

            <Text
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-2xl text-white text-center mt-4 px-2"
              numberOfLines={2}
            >
              {displayName}
            </Text>

            <View className="flex-row items-center justify-center flex-wrap gap-2 mt-2.5">
              <View className="bg-[#eab308] px-3.5 py-1 rounded-full">
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-[10px] text-black uppercase tracking-wider"
                >
                  {beltLabel}
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderColor: 'rgba(255,255,255,0.14)',
                }}
                className="flex-row items-center px-3 py-1 rounded-full border"
              >
                <MapPin size={11} color="#eab308" />
                <Text className="text-[11px] font-bold text-gray-200 ml-1 uppercase tracking-tight">
                  {unitLabel}
                </Text>
              </View>
            </View>

            {!!userData.bio && (
              <Text className="text-xs text-gray-400 text-center mt-3 px-4 leading-relaxed">
                {userData.bio}
              </Text>
            )}
          </View>

          {/* Integrated Footer Strip: Seguidores | Seguindo | Kihaps */}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.1)',
              marginTop: 20,
              paddingTop: 16,
            }}
            className="flex-row items-center"
          >
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/conexoes',
                  params: { uid: targetUid, tab: 'seguidores', name: displayName },
                })
              }
              activeOpacity={0.75}
              className="flex-1 items-center"
              accessibilityLabel={`Ver seguidores de ${displayName}`}
            >
              <Text
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-xl text-white"
              >
                {followersCount}
              </Text>
              <Text className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                Seguidores
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/conexoes',
                  params: { uid: targetUid, tab: 'seguindo', name: displayName },
                })
              }
              activeOpacity={0.75}
              style={{
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
              }}
              className="flex-1 items-center"
              accessibilityLabel={`Ver quem ${displayName} segue`}
            >
              <Text
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-xl text-white"
              >
                {followingCount}
              </Text>
              <Text className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                Seguindo
              </Text>
            </TouchableOpacity>

            <View className="flex-1 items-center">
              <View className="flex-row items-center gap-1">
                <Emoji symbol="🥋" size={14} />
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-xl text-yellow-400"
                >
                  {kihapsCount}
                </Text>
              </View>
              <Text className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                Kihaps
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* 2. BARRA DE AÇÕES */}
        {!isOwnProfile && (
          <View className="px-5 mt-4 flex-row gap-2.5">
            <TouchableOpacity
              onPress={handleFollowToggle}
              disabled={loadingFollow}
              activeOpacity={0.85}
              style={subtleCardShadow}
              className={`flex-1 py-3.5 rounded-2xl flex-row items-center justify-center gap-1.5 ${
                isMutualFriend
                  ? 'bg-white dark:bg-[#18181b] border border-yellow-500/50'
                  : isFollowing
                    ? 'bg-white dark:bg-[#18181b] border border-gray-200 dark:border-white/15'
                    : 'bg-black dark:bg-white'
              }`}
            >
              {loadingFollow ? (
                <ActivityIndicator
                  size="small"
                  color={isFollowing ? (isDark ? '#fff' : '#111827') : isDark ? '#000' : '#fff'}
                />
              ) : (
                <>
                  {isMutualFriend ? (
                    <Users size={14} color="#eab308" />
                  ) : isFollowing ? (
                    <UserCheck size={14} color={isDark ? '#e4e4e7' : '#111827'} />
                  ) : (
                    <UserPlus size={14} color={isDark ? '#000' : '#fff'} />
                  )}
                  <Text
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className={`text-[10px] uppercase tracking-wider ${
                      isFollowing ? 'text-gray-900 dark:text-white' : 'text-white dark:text-black'
                    }`}
                  >
                    {isMutualFriend ? 'Amigos' : isFollowing ? 'Seguindo' : followsMe ? 'Seguir de volta' : 'Seguir'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSendKihap}
              disabled={sendingCheer || cheerSent}
              activeOpacity={0.85}
              style={
                cheerSent
                  ? {
                      backgroundColor: 'rgba(16, 185, 129, 0.14)',
                      borderWidth: 1,
                      borderColor: 'rgba(16, 185, 129, 0.4)',
                    }
                  : subtleCardShadow
              }
              className={`flex-1 py-3.5 rounded-2xl flex-row items-center justify-center gap-1.5 ${
                cheerSent ? '' : 'bg-[#eab308]'
              }`}
            >
              {sendingCheer ? (
                <ActivityIndicator size="small" color="#000" />
              ) : cheerSent ? (
                <>
                  <Check size={14} color="#10b981" strokeWidth={2.8} />
                  <Text
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-[10px] uppercase tracking-wider text-emerald-500"
                  >
                    Kihap!
                  </Text>
                </>
              ) : (
                <>
                  <Emoji symbol="🥋" size={14} />
                  <Text
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-[10px] uppercase tracking-wider text-black"
                  >
                    Dar Kihap
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleStartChat}
              disabled={loadingChat}
              activeOpacity={0.85}
              style={subtleCardShadow}
              className="flex-1 py-3.5 rounded-2xl flex-row items-center justify-center gap-1.5 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10"
            >
              {loadingChat ? (
                <ActivityIndicator size="small" color={isDark ? '#fff' : '#111827'} />
              ) : (
                <>
                  <MessageCircle size={14} color={isDark ? '#fff' : '#111827'} />
                  <Text
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-[10px] uppercase tracking-wider text-gray-900 dark:text-white"
                  >
                    Chat
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 3. GRADE DE 4 MÉTRICAS MARCIAIS */}
        <View className="px-5 mt-4 flex-row gap-2">
          {/* Ofensiva */}
          <View
            style={subtleCardShadow}
            className="flex-1 bg-white dark:bg-[#141414] p-3 rounded-2xl border border-gray-200/80 dark:border-white/10 items-center"
          >
            <View
              style={{ backgroundColor: 'rgba(249, 115, 22, 0.12)' }}
              className="w-8 h-8 rounded-xl items-center justify-center mb-1.5"
            >
              <Flame size={16} color="#f97316" />
            </View>
            <Text
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-lg text-gray-900 dark:text-white leading-tight"
            >
              {currentStreak}d
            </Text>
            <Text
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-[8px] uppercase tracking-widest text-gray-400 text-center mt-0.5"
            >
              Ofensiva
            </Text>
          </View>

          {/* Emblemas */}
          <View
            style={subtleCardShadow}
            className="flex-1 bg-white dark:bg-[#141414] p-3 rounded-2xl border border-gray-200/80 dark:border-white/10 items-center"
          >
            <View
              style={{ backgroundColor: 'rgba(234, 179, 8, 0.12)' }}
              className="w-8 h-8 rounded-xl items-center justify-center mb-1.5"
            >
              <Award size={16} color="#eab308" />
            </View>
            <Text
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-lg text-gray-900 dark:text-white leading-tight"
            >
              {earnedBadgesList.length}
            </Text>
            <Text
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-[8px] uppercase tracking-widest text-gray-400 text-center mt-0.5"
            >
              Emblemas
            </Text>
          </View>

          {/* Teste Físico */}
          <View
            style={subtleCardShadow}
            className="flex-1 bg-white dark:bg-[#141414] p-3 rounded-2xl border border-gray-200/80 dark:border-white/10 items-center"
          >
            <View
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}
              className="w-8 h-8 rounded-xl items-center justify-center mb-1.5"
            >
              <Trophy size={16} color="#ef4444" />
            </View>
            <Text
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-lg text-gray-900 dark:text-white leading-tight"
            >
              {getPhysicalTestScore(physicalTest) ?? '--'}
            </Text>
            <Text
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-[8px] uppercase tracking-widest text-gray-400 text-center mt-0.5"
            >
              Teste Fís.
            </Text>
          </View>

          {/* Coins */}
          <View
            style={subtleCardShadow}
            className="flex-1 bg-white dark:bg-[#141414] p-3 rounded-2xl border border-yellow-500/30 items-center"
          >
            <View
              style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)' }}
              className="w-8 h-8 rounded-xl items-center justify-center mb-1.5"
            >
              <Sparkles size={16} color="#f59e0b" />
            </View>
            <Text
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-lg text-[#eab308] leading-tight"
            >
              {effectiveCoins}
            </Text>
            <Text
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-[8px] uppercase tracking-widest text-gray-400 text-center mt-0.5"
            >
              Coins
            </Text>
          </View>
        </View>

        {/* 4. CARD CONQUISTAS */}
        <View className="px-5 mt-4">
          <View
            style={subtleCardShadow}
            className="bg-white dark:bg-[#141414] p-4 rounded-3xl border border-gray-200/80 dark:border-white/10"
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <View
                  style={{ backgroundColor: 'rgba(234, 179, 8, 0.12)' }}
                  className="w-8 h-8 rounded-xl items-center justify-center mr-2.5"
                >
                  <Award size={16} color="#eab308" />
                </View>
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-sm text-gray-900 dark:text-white uppercase tracking-tight"
                >
                  Conquistas
                </Text>
              </View>

              <View className="bg-gray-100 dark:bg-white/10 px-2.5 py-1 rounded-full">
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-[9px] text-gray-600 dark:text-gray-300 uppercase"
                >
                  {earnedBadgesList.length}{' '}
                  {earnedBadgesList.length === 1 ? 'emblema' : 'emblemas'}
                </Text>
              </View>
            </View>

            {badgesLoading ? (
              <View className="py-3 items-center">
                <ActivityIndicator size="small" color="#eab308" />
              </View>
            ) : earnedBadgesList.length > 0 ? (
              <View className="flex-row flex-wrap mt-1">
                {earnedBadgesList.map((badge) => {
                  let badgeImage = badge.imageUrl || '';
                  if (badgeImage && badgeImage.startsWith('/')) {
                    badgeImage = `https://kihap.com.br${badgeImage}`;
                  }
                  return (
                    <TouchableOpacity
                      key={badge.id}
                      onPress={() => router.push(`/emblema/${badge.id}`)}
                      activeOpacity={0.85}
                      className="w-1/4 items-center mb-3 px-1"
                    >
                      <View
                        style={{
                          backgroundColor: 'rgba(234, 179, 8, 0.1)',
                          borderColor: 'rgba(234, 179, 8, 0.28)',
                        }}
                        className="w-14 h-14 rounded-2xl items-center justify-center border mb-1.5 overflow-hidden"
                      >
                        {badgeImage ? (
                          <Image
                            source={{ uri: badgeImage }}
                            className="w-full h-full"
                            resizeMode="contain"
                          />
                        ) : (
                          <Award size={24} color="#eab308" />
                        )}
                      </View>
                      <Text
                        numberOfLines={1}
                        className="text-[10px] font-bold text-gray-700 dark:text-gray-300 text-center"
                      >
                        {badge.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View className="flex-row items-center gap-2.5 bg-gray-50 dark:bg-white/5 px-3.5 py-2.5 rounded-2xl">
                <View
                  style={{ backgroundColor: 'rgba(234, 179, 8, 0.12)' }}
                  className="w-7 h-7 rounded-full items-center justify-center"
                >
                  <Award size={14} color="#eab308" />
                </View>
                <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex-1">
                  Nenhum emblema conquistado ainda.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 5. ATIVIDADE RECENTE (OMITIDA SE VAZIA) */}
        {recentAchievements.length > 0 && (
          <View className="px-5 mt-4">
            <View
              style={subtleCardShadow}
              className="bg-white dark:bg-[#141414] p-4 rounded-3xl border border-gray-200/80 dark:border-white/10"
            >
              <Text
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-sm text-gray-900 dark:text-white uppercase tracking-tight mb-3"
              >
                Atividade Recente
              </Text>

              <View className="gap-2">
                {recentAchievements.map((item) => (
                  <View
                    key={item.id}
                    className="bg-gray-50 dark:bg-white/5 px-3.5 py-2.5 rounded-2xl flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center flex-1 mr-2">
                      <View className="mr-2.5">
                        <Emoji symbol={item.icon || '🏆'} size={18} />
                      </View>
                      <View className="flex-1">
                        <Text
                          className="font-bold text-xs text-gray-900 dark:text-white"
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        {!!item.subtitle && (
                          <Text
                            className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5"
                            numberOfLines={1}
                          >
                            {item.subtitle}
                          </Text>
                        )}
                      </View>
                    </View>

                    {!!item.metricValue && (
                      <View
                        style={{
                          backgroundColor: 'rgba(234, 179, 8, 0.14)',
                          borderColor: 'rgba(234, 179, 8, 0.3)',
                        }}
                        className="px-2.5 py-1 rounded-lg border"
                      >
                        <Text className="text-[10px] font-black text-yellow-600 dark:text-yellow-400">
                          {item.metricValue}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* 6. ÚLTIMO TESTE FÍSICO */}
        <View className="px-5 mt-4">
          <View
            style={subtleCardShadow}
            className="bg-white dark:bg-[#141414] p-4 rounded-3xl border border-gray-200/80 dark:border-white/10"
          >
            {testLoading ? (
              <View className="flex-row items-center justify-between py-1">
                <View className="flex-row items-center">
                  <View
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}
                    className="w-8 h-8 rounded-xl items-center justify-center mr-2.5"
                  >
                    <Trophy size={16} color="#ef4444" />
                  </View>
                  <Text
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-sm text-gray-900 dark:text-white uppercase tracking-tight"
                  >
                    Último Teste Físico
                  </Text>
                </View>
                <ActivityIndicator size="small" color="#ef4444" />
              </View>
            ) : physicalTest ? (
              <View>
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <View
                      style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}
                      className="w-8 h-8 rounded-xl items-center justify-center mr-2.5"
                    >
                      <Trophy size={16} color="#ef4444" />
                    </View>
                    <Text
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-sm text-gray-900 dark:text-white uppercase tracking-tight"
                    >
                      Último Teste Físico
                    </Text>
                  </View>

                  {longestStreak > 0 && (
                    <View
                      style={{ backgroundColor: 'rgba(249, 115, 22, 0.12)' }}
                      className="px-2.5 py-1 rounded-full"
                    >
                      <Text className="text-[10px] font-black text-orange-500 uppercase">
                        Recorde: {longestStreak}d
                      </Text>
                    </View>
                  )}
                </View>

                <View className="bg-gray-50 dark:bg-white/5 px-4 py-3.5 rounded-2xl flex-row items-center justify-between">
                  <View>
                    <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
                      Data de Realização
                    </Text>
                    <Text className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      {formatPhysicalDate(physicalTest.date)}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      borderColor: 'rgba(239, 68, 68, 0.25)',
                    }}
                    className="px-4 py-2 rounded-2xl border items-center"
                  >
                    <Text className="text-red-500 text-[9px] font-black uppercase tracking-wider">
                      Pontuação
                    </Text>
                    <Text
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-2xl text-red-500 leading-tight mt-0.5"
                    >
                      {getPhysicalTestScore(physicalTest) ?? '--'}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}
                    className="w-8 h-8 rounded-xl items-center justify-center mr-2.5"
                  >
                    <Trophy size={16} color="#ef4444" />
                  </View>
                  <Text
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-sm text-gray-900 dark:text-white uppercase tracking-tight"
                  >
                    Último Teste Físico
                  </Text>
                </View>
                <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500">
                  Sem registro ainda
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
