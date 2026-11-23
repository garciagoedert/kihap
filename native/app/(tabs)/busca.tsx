import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import {
  Search,
  X,
  ChevronRight,
  Calendar as CalendarIcon,
  ArrowRight,
  Trophy,
  Sparkles,
  Target,
  BookOpen,
  Video,
  Users,
  MapPin,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../src/services/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import StoriesBar from '../../src/components/StoriesBar';
import Emoji from '../../src/components/Emoji';
import { useStories } from '../../src/hooks/useStories';
import {
  getCurrentMonthKey,
  getEffectiveKihapcoins,
  normalizeUnitDisplay,
  normalizeUnitKey,
} from '../../src/utils/engagement';

type DiscoverFilter = 'tudo' | 'comunidade' | 'tatame' | 'eventos' | 'loja';

const DISCOVER_FILTERS: { id: DiscoverFilter; label: string }[] = [
  { id: 'tudo', label: 'Tudo' },
  { id: 'comunidade', label: 'Comunidade' },
  { id: 'tatame', label: 'Tatame' },
  { id: 'eventos', label: 'Eventos' },
  { id: 'loja', label: 'Loja' },
];

const ACHIEVEMENT_REACTIONS = [
  { key: 'clap', emoji: '👏' },
  { key: 'kihap', emoji: '🥋' },
  { key: 'fire', emoji: '🔥' },
];

function getLocalTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeEventDateISO(dateVal?: any): string {
  if (!dateVal) return '';
  if (typeof dateVal?.toDate === 'function') {
    const dt: Date = dateVal.toDate();
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  if (typeof dateVal?.seconds === 'number') {
    const dt = new Date(dateVal.seconds * 1000);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  if (dateVal instanceof Date) {
    return `${dateVal.getFullYear()}-${String(dateVal.getMonth() + 1).padStart(2, '0')}-${String(dateVal.getDate()).padStart(2, '0')}`;
  }
  const str = String(dateVal).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }
  return '';
}

function formatDateBR(dateVal?: any): string {
  if (!dateVal) return '';
  const iso = normalizeEventDateISO(dateVal);
  if (iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  return String(dateVal).trim();
}

function formatRelativeTime(createdAt: any): string {
  if (!createdAt) return 'Agora';
  try {
    const ms =
      typeof createdAt.toMillis === 'function'
        ? createdAt.toMillis()
        : createdAt.seconds
          ? createdAt.seconds * 1000
          : new Date(createdAt).getTime();
    const diffMins = Math.floor((Date.now() - ms) / 60000);
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  } catch {
    return '';
  }
}

const SEARCH_TITLE_PREFIXES = new Set([
  'mr',
  'ms',
  'mrs',
  'miss',
  'sr',
  'sra',
  'prof',
  'profa',
  'professor',
  'professora',
  'master',
  'mestre',
  'mestra',
  'gm',
  'dr',
  'dra',
  'inst',
  'instrutor',
  'instrutora',
]);

function normalizeSearchText(str?: string): string {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export default function BuscaScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, userData } = useAuth();
  const defaultProfileImg = require('../../assets/images/default-profile.png');

  const { groups: storyGroups, highlights, seenStoryIds, markStorySeen } = useStories();

  const scrollRef = useRef<ScrollView>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<DiscoverFilter>('tudo');
  const [refreshing, setRefreshing] = useState(false);

  // Content data
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [allTatame, setAllTatame] = useState<any[]>([]);
  const [allPeers, setAllPeers] = useState<any[]>([]);
  const [peersLoading, setPeersLoading] = useState(false);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [copaStandings, setCopaStandings] = useState<any[]>([]);

  const myCoins = getEffectiveKihapcoins(userData);
  const myUnitSlug = normalizeUnitKey(
    userData?.unitId || userData?.unidadeId || userData?.unit || userData?.unidade || ''
  );

  const fetchPeers = async () => {
    if (!user?.uid) return;
    setPeersLoading(true);
    try {
      const peersSnap = await getDocs(collection(db, 'users'));
      const uList = peersSnap.docs
        .map((d) => {
          const data = d.data() || {};
          const rawDisplayName = String(
            data.name || data.nome || data.displayName || data.fullName || data.apelido || ''
          ).trim();
          const belt = data.belt || data.graduacao || '';
          const unit = data.unidade || data.unit || data.unitId || '';
          const searchName = normalizeSearchText(
            [data.name, data.nome, data.displayName, data.fullName, data.apelido]
              .filter(Boolean)
              .join(' ')
          );
          const searchAll = normalizeSearchText(
            [
              data.name,
              data.nome,
              data.displayName,
              data.fullName,
              data.apelido,
              belt,
              unit,
              normalizeUnitDisplay(unit),
            ]
              .filter(Boolean)
              .join(' ')
          );
          return {
            uid: d.id,
            name: data.name,
            nome: data.nome,
            displayName: data.displayName,
            fullName: data.fullName,
            apelido: data.apelido,
            belt: data.belt,
            graduacao: data.graduacao,
            unidade: data.unidade,
            unit: data.unit,
            unitId: data.unitId,
            photoURL: data.photoURL,
            profilePicture: data.profilePicture,
            avatar: data.avatar,
            isInstructor: Boolean(data.isInstructor),
            isAdmin: Boolean(data.isAdmin),
            socialPrivacy: data.socialPrivacy,
            _rawDisplayName: rawDisplayName,
            _searchName: searchName,
            _searchAll: searchAll,
          };
        })
        .filter(
          (u) =>
            u.socialPrivacy !== 'private' &&
            u.uid !== user?.uid &&
            u._rawDisplayName.length > 0 &&
            u._searchName.length > 0
        );
      setAllPeers(uList);
    } catch (err) {
      console.warn('[Descobrir] Aviso ao carregar usuários:', err);
    } finally {
      setPeersLoading(false);
    }
  };

  const fetchContent = async () => {
    void fetchPeers();
    try {
      const monthKey = getCurrentMonthKey();
      const [productsRes, eventsRes, tatameRes, copaCacheRes] = await Promise.allSettled([
        getDocs(query(collection(db, 'products'), where('visible', '==', true))),
        getDocs(query(collection(db, 'events'), orderBy('date', 'asc'))),
        getDocs(query(collection(db, 'tatame_conteudos'), orderBy('createdAt', 'desc'), limit(20))),
        getDoc(doc(db, 'copa_unidades_snapshots', monthKey)),
      ]);

      if (productsRes.status === 'fulfilled') {
        const pList = productsRes.value.docs.map((d) => ({ id: d.id, ...d.data() }));
        pList.sort((a: any, b: any) => {
          const ordA = typeof a.order === 'number' ? a.order : 99999;
          const ordB = typeof b.order === 'number' ? b.order : 99999;
          return ordA - ordB;
        });
        setAllProducts(pList);
      }

      if (eventsRes.status === 'fulfilled') {
        const eList = eventsRes.value.docs.map((d) => ({ id: d.id, ...d.data() }));
        eList.sort((a: any, b: any) =>
          normalizeEventDateISO(a.date).localeCompare(normalizeEventDateISO(b.date))
        );
        setAllEvents(eList);
      }

      if (tatameRes.status === 'fulfilled') {
        const tList = tatameRes.value.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllTatame(tList);
      }

      let loadedCopa = false;
      if (copaCacheRes.status === 'fulfilled' && copaCacheRes.value.exists()) {
        const cData = copaCacheRes.value.data();
        if (Array.isArray(cData?.standings)) {
          setCopaStandings(cData.standings);
          loadedCopa = true;
        }
      }

      if (!loadedCopa && user?.uid) {
        try {
          const getCopaFn = httpsCallable(functions, 'getCopaUnidades');
          const res: any = await getCopaFn({});
          if (Array.isArray(res?.data?.standings)) {
            setCopaStandings(res.data.standings);
          }
        } catch (err) {
          console.warn('[Descobrir] Aviso ao carregar Copa das Unidades:', err);
        }
      }
    } catch (error) {
      console.error('Error loading discover content:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, [user?.uid]);

  // Listen to users that current user follows
  useEffect(() => {
    if (!user?.uid) return;
    const fQ = query(collection(db, 'follows'), where('followerId', '==', user.uid));
    const unsub = onSnapshot(fQ, (snap) => {
      setFollowingIds(snap.docs.map((d) => d.data()?.followingId).filter(Boolean));
    });
    return () => unsub();
  }, [user?.uid]);

  // Real-time community achievements feed
  useEffect(() => {
    if (!user?.uid) return;
    const achQ = query(
      collection(db, 'achievements_feed'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const unsub = onSnapshot(
      achQ,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAchievements(list);
      },
      (err) => console.warn('[Descobrir] Achievements feed error:', err)
    );
    return () => unsub();
  }, [user?.uid]);

  const visibleAchievements = useMemo(() => {
    return achievements
      .filter((a) => {
        if (!myUnitSlug || myUnitSlug === 'staff') return true;
        return (
          a.userId === user?.uid ||
          a.unitId === myUnitSlug ||
          followingIds.includes(a.userId)
        );
      })
      .slice(0, 8);
  }, [achievements, myUnitSlug, followingIds, user?.uid]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchContent();
  };

  const handleReactAchievement = async (itemId: string, rxKey: string) => {
    if (!user?.uid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const target = achievements.find((a) => a.id === itemId);
    const currentList: string[] = Array.isArray(target?.reactions?.[rxKey])
      ? target.reactions[rxKey]
      : [];
    const alreadyReacted = currentList.includes(user.uid);

    try {
      await updateDoc(doc(db, 'achievements_feed', itemId), {
        [`reactions.${rxKey}`]: alreadyReacted ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch (err) {
      console.warn('[Descobrir] Erro ao reagir conquista:', err);
    }
  };

  const resolveAvatarSource = (photoURL?: string) => {
    if (
      !photoURL ||
      photoURL.includes('default-profile.svg') ||
      photoURL.includes('default-profile.png')
    ) {
      return defaultProfileImg;
    }
    return { uri: photoURL.startsWith('/') ? `https://kihap.com.br${photoURL}` : photoURL };
  };

  const hasSearchText = searchQuery.trim().length > 0;
  const normTerm = useMemo(() => normalizeSearchText(searchQuery), [searchQuery]);
  const searchTokens = useMemo(
    () => (normTerm ? normTerm.split(' ').filter(Boolean) : []),
    [normTerm]
  );
  const coreSearchTokens = useMemo(
    () => searchTokens.filter((t) => !SEARCH_TITLE_PREFIXES.has(t)),
    [searchTokens]
  );

  const filteredProducts = useMemo(() => {
    if (!hasSearchText) return allProducts;
    if (searchTokens.length === 0) return [];
    return allProducts.filter((p) => {
      const hay = normalizeSearchText(
        [p.name, p.category, p.description].filter(Boolean).join(' ')
      );
      return searchTokens.every((t) => hay.includes(t));
    });
  }, [allProducts, hasSearchText, searchTokens]);

  const upcomingEvents = useMemo(() => {
    const todayStr = getLocalTodayStr();
    return allEvents
      .filter((e) => {
        const iso = normalizeEventDateISO(e.date);
        return Boolean(iso) && iso >= todayStr;
      })
      .sort((a, b) => normalizeEventDateISO(a.date).localeCompare(normalizeEventDateISO(b.date)));
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    const todayStr = getLocalTodayStr();
    if (!hasSearchText) return upcomingEvents;
    if (searchTokens.length === 0) return [];
    const matches = allEvents.filter((e) => {
      const hay = normalizeSearchText(
        [e.title, e.name, e.description, e.location, e.address].filter(Boolean).join(' ')
      );
      return searchTokens.every((t) => hay.includes(t));
    });
    const upcoming = matches
      .filter((e) => {
        const iso = normalizeEventDateISO(e.date);
        return Boolean(iso) && iso >= todayStr;
      })
      .sort((a, b) => normalizeEventDateISO(a.date).localeCompare(normalizeEventDateISO(b.date)));
    const past = matches
      .filter((e) => {
        const iso = normalizeEventDateISO(e.date);
        return !iso || iso < todayStr;
      })
      .sort((a, b) => normalizeEventDateISO(b.date).localeCompare(normalizeEventDateISO(a.date)));
    return [...upcoming, ...past];
  }, [allEvents, upcomingEvents, hasSearchText, searchTokens]);

  const filteredTatame = useMemo(() => {
    if (!hasSearchText) return allTatame;
    if (searchTokens.length === 0) return [];
    return allTatame.filter((t) => {
      const hay = normalizeSearchText([t.title, t.author].filter(Boolean).join(' '));
      return searchTokens.every((t) => hay.includes(t));
    });
  }, [allTatame, hasSearchText, searchTokens]);

  const filteredPeers = useMemo(() => {
    if (!hasSearchText) return allPeers;
    if (searchTokens.length === 0) return [];
    const matched = allPeers.filter((u) => {
      const matchesAll = searchTokens.every((t) => (u._searchAll || '').includes(t));
      const matchesCore =
        coreSearchTokens.length > 0 &&
        coreSearchTokens.every((t) => (u._searchName || '').includes(t));
      return matchesAll || matchesCore;
    });

    const getMatchRank = (u: any) => {
      if ((u._searchName || '').includes(normTerm)) return 0;
      if (searchTokens.every((t) => (u._searchAll || '').includes(t))) return 1;
      return 2;
    };

    return matched.sort((a, b) => {
      const rankDiff = getMatchRank(a) - getMatchRank(b);
      if (rankDiff !== 0) return rankDiff;
      const staffDiff =
        (b.isInstructor || b.isAdmin ? 1 : 0) - (a.isInstructor || a.isAdmin ? 1 : 0);
      if (staffDiff !== 0) return staffDiff;
      return (a._rawDisplayName || '').localeCompare(b._rawDisplayName || '', 'pt-BR');
    });
  }, [allPeers, hasSearchText, normTerm, searchTokens, coreSearchTokens]);

  const searchResults = useMemo(() => {
    if (!hasSearchText) return [];
    const list: any[] = [];
    if (activeFilter === 'tudo' || activeFilter === 'comunidade') {
      filteredPeers.slice(0, 30).forEach((u) => list.push({ ...u, id: u.uid, _type: 'peer' }));
    }
    if (activeFilter === 'tudo' || activeFilter === 'tatame') {
      filteredTatame.slice(0, 15).forEach((t) => list.push({ ...t, _type: 'tatame' }));
    }
    if (activeFilter === 'tudo' || activeFilter === 'eventos') {
      filteredEvents.slice(0, 15).forEach((e) => list.push({ ...e, _type: 'event' }));
    }
    if (activeFilter === 'tudo' || activeFilter === 'loja') {
      filteredProducts.slice(0, 20).forEach((p) => list.push({ ...p, _type: 'product' }));
    }
    return list;
  }, [hasSearchText, activeFilter, filteredPeers, filteredTatame, filteredEvents, filteredProducts]);

  const renderSearchResultItem = ({ item }: { item: any }) => {
    if (item._type === 'peer') {
      const name =
        item.name || item.nome || item.displayName || item.fullName || item.apelido || 'Aluno Kihap';
      const unit = normalizeUnitDisplay(item.unidade || item.unit || item.unitId);
      const belt = item.belt || item.graduacao || 'Aluno Kihap';
      return (
        <TouchableOpacity
          onPress={() => router.push(`/user/${item.uid}`)}
          activeOpacity={0.8}
          className="bg-white dark:bg-[#151517] rounded-2xl p-3.5 mb-3 border border-gray-100 dark:border-white/5 flex-row items-center justify-between shadow-sm"
        >
          <View className="flex-row items-center flex-1 mr-3">
            <Image
              source={resolveAvatarSource(item.photoURL || item.profilePicture || item.avatar)}
              className="w-12 h-12 rounded-full bg-gray-100 dark:bg-black"
            />
            <View className="ml-3 flex-1">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-500">
                {belt}
              </Text>
              <Text className="font-bold text-[14px] text-gray-900 dark:text-white" numberOfLines={1}>
                {name}
              </Text>
              <View className="flex-row items-center mt-0.5">
                <MapPin size={10} color="#9ca3af" />
                <Text className="text-[11px] text-gray-400 ml-1" numberOfLines={1}>
                  {unit}
                </Text>
              </View>
            </View>
          </View>
          <ChevronRight size={18} color={isDark ? '#666' : '#bbb'} />
        </TouchableOpacity>
      );
    }

    if (item._type === 'tatame') {
      return (
        <TouchableOpacity
          onPress={() => router.push(`/user/tatame/${item.id}`)}
          activeOpacity={0.8}
          className="bg-white dark:bg-[#151517] rounded-2xl p-3.5 mb-3 border border-gray-100 dark:border-white/5 flex-row items-center justify-between shadow-sm"
        >
          <View className="flex-row items-center flex-1 mr-3">
            <View className="w-14 h-14 rounded-xl bg-yellow-500/10 items-center justify-center border border-yellow-500/20">
              {item.youtubeUrl ? (
                <Video size={22} color="#eab308" />
              ) : (
                <BookOpen size={22} color="#eab308" />
              )}
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-0.5">
                Tatame Kihap
              </Text>
              <Text className="font-bold text-[14px] text-gray-900 dark:text-white leading-snug" numberOfLines={1}>
                {item.title}
              </Text>
              <Text className="text-[11px] text-gray-400 mt-0.5" numberOfLines={1}>
                {item.author || 'Equipe Kihap'}
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={isDark ? '#666' : '#bbb'} />
        </TouchableOpacity>
      );
    }

    if (item._type === 'product') {
      const isAvailable = item.available !== false;
      const price = (item.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      return (
        <TouchableOpacity
          key={item.id}
          onPress={() => isAvailable && router.push({ pathname: '/store/[id]', params: { id: item.id } })}
          activeOpacity={0.8}
          className={`bg-white dark:bg-[#151517] rounded-2xl p-3.5 mb-3 border border-gray-100 dark:border-white/5 flex-row items-center justify-between shadow-sm ${!isAvailable ? 'opacity-60' : ''}`}
        >
          <View className="flex-row items-center flex-1 mr-3">
            <View className="relative">
              <Image
                source={{ uri: item.imageUrl || 'https://via.placeholder.com/200' }}
                className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-black"
                resizeMode="cover"
              />
              {!isAvailable && (
                <View className="absolute inset-0 bg-black/40 items-center justify-center rounded-xl">
                  <View className="bg-red-600 px-1.5 py-0.5 rounded shadow border border-white/30 -rotate-6">
                    <Text className="text-white text-[7px] font-black uppercase tracking-tighter">ESGOTADO</Text>
                  </View>
                </View>
              )}
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
                {item.category || 'Loja Kihap'}
              </Text>
              <Text className="font-bold text-[14px] text-gray-900 dark:text-white leading-snug" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="text-[13px] font-black text-gray-900 dark:text-white mt-1">
                {price}
              </Text>
            </View>
          </View>
          {isAvailable ? (
            <View className="bg-yellow-500 px-3.5 py-1.5 rounded-lg shadow-sm">
              <Text className="text-[11px] font-black text-black">Ver</Text>
            </View>
          ) : (
            <View className="bg-gray-100 dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/5">
              <Text className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase">Esgotado</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }

    if (item._type === 'event') {
      return (
        <TouchableOpacity
          key={item.id}
          onPress={() => router.push('/calendario')}
          activeOpacity={0.8}
          className="bg-white dark:bg-[#151517] rounded-2xl p-3.5 mb-3 border border-gray-100 dark:border-white/5 flex-row items-center justify-between shadow-sm"
        >
          <View className="flex-row items-center flex-1 mr-3">
            <View className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-white/5 items-center justify-center border border-gray-200 dark:border-white/5">
              <CalendarIcon size={22} color={isDark ? '#fff' : '#111'} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-500 mb-0.5">
                {item.date ? formatDateBR(item.date) : 'Evento Kihap'}
              </Text>
              <Text className="font-bold text-[14px] text-gray-900 dark:text-white leading-snug" numberOfLines={1}>
                {item.title || item.name}
              </Text>
              <Text className="text-[11px] text-gray-400 mt-0.5" numberOfLines={1}>
                {item.location || item.address || 'Kihap'}
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={isDark ? '#666' : '#bbb'} />
        </TouchableOpacity>
      );
    }

    return null;
  };

  const showCommunity = activeFilter === 'tudo' || activeFilter === 'comunidade';
  const showTatame = activeFilter === 'tudo' || activeFilter === 'tatame';
  const showLoja = activeFilter === 'tudo' || activeFilter === 'loja';
  const showEventos = activeFilter === 'tudo' || activeFilter === 'eventos';

  const hasStories = storyGroups.length > 0 || highlights.length > 0;

  return (
    <View style={{ flex: 1, paddingTop: insets.top }} className="flex-1 bg-[#f8f9fa] dark:bg-[#000000]">
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header with Title, Search & Filter Chips */}
      <View className="px-5 pt-3 pb-2">
        <View className="flex-row items-center justify-between mb-3">
          <Text
            style={{ fontFamily: 'NeueMachina-Ultrabold' }}
            className="text-2xl text-gray-900 dark:text-white tracking-tight"
          >
            Descobrir
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/clube-coins')}
            className="flex-row items-center bg-yellow-500/15 border border-yellow-500/35 px-3 py-1 rounded-full"
          >
            <Sparkles size={13} color="#eab308" style={{ marginRight: 5 }} />
            <Text
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-xs text-yellow-600 dark:text-yellow-400"
            >
              {myCoins} Coins
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Input Bar */}
        <View className="flex-row items-center bg-gray-200/60 dark:bg-[#1c1c1e] px-3.5 py-2.5 rounded-xl border border-transparent mb-3">
          <Search size={16} color="#8e8e93" />
          <TextInput
            placeholder="Buscar colegas, tatame, eventos ou loja..."
            placeholderTextColor="#8e8e93"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
            className="flex-1 ml-2.5 text-[14px] text-gray-900 dark:text-white p-0 font-medium"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} className="p-0.5">
              <X size={15} color="#8e8e93" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pb-1">
          {DISCOVER_FILTERS.map((f) => {
            const isActive = activeFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setActiveFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-full mr-2 border ${
                  isActive
                    ? 'bg-black dark:bg-yellow-500 border-black dark:border-yellow-500'
                    : 'bg-white dark:bg-[#151517] border-gray-200 dark:border-white/10'
                }`}
              >
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className={`text-[10px] uppercase tracking-wider ${
                    isActive
                      ? 'text-white dark:text-black'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Search Results View */}
      {searchQuery.trim().length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => `${item._type}-${item.id}`}
          renderItem={renderSearchResultItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            peersLoading ? (
              <View className="items-center justify-center py-16 flex-row gap-2.5">
                <ActivityIndicator size="small" color="#eab308" />
                <Text className="text-gray-400 dark:text-gray-500 text-sm font-medium">
                  Buscando...
                </Text>
              </View>
            ) : (
              <View className="items-center justify-center py-16">
                <Text className="text-gray-400 dark:text-gray-500 text-sm font-medium">
                  Nenhum resultado encontrado para "{searchQuery}"
                </Text>
              </View>
            )
          }
        />
      ) : (
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#eab308"
            />
          }
        >
          {/* 1. STORIES BAR (EXCLUSIVO DO DESCOBRIR) */}
          {showCommunity && hasStories && (
            <View className="mt-2 mb-5">
              <View className="flex-row items-center justify-between px-5 mb-2.5">
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Stories da Escola
                </Text>
              </View>
              <StoriesBar
                groups={storyGroups}
                highlights={highlights}
                seenStoryIds={seenStoryIds}
                onStorySeen={markStorySeen}
                contentPadding={20}
              />
            </View>
          )}

          {/* 2. ATALHOS SOCIAIS: MISSÕES & CLUBE DE COINS */}
          {showCommunity && (
            <View className="px-5 mb-6 flex-row gap-3">
              <TouchableOpacity
                onPress={() => router.push('/missoes')}
                activeOpacity={0.85}
                className="flex-1 bg-white dark:bg-[#151517] p-4 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="w-9 h-9 rounded-xl bg-yellow-500/15 items-center justify-center">
                    <Target size={18} color="#eab308" />
                  </View>
                  <View className="bg-yellow-500 px-2 py-0.5 rounded-full">
                    <Text className="text-[9px] font-black text-black uppercase">Semana</Text>
                  </View>
                </View>
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-xs text-gray-900 dark:text-white uppercase"
                >
                  Missões & Quiz
                </Text>
                <Text className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Ganhe +55 Kihapcoins
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/clube-coins')}
                activeOpacity={0.85}
                className="flex-1 bg-white dark:bg-[#151517] p-4 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="w-9 h-9 rounded-xl bg-amber-500/15 items-center justify-center">
                    <Sparkles size={18} color="#f59e0b" />
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Text
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-xs text-[#eab308]"
                    >
                      {myCoins}
                    </Text>
                    <Emoji symbol="⚡" size={13} />
                  </View>
                </View>
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-xs text-gray-900 dark:text-white uppercase"
                >
                  Clube de Coins
                </Text>
                <Text className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Escudos, cupons e mais
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 3. MINI PLACAR — COPA DAS UNIDADES */}
          {showCommunity && copaStandings.length > 0 && (
            <View className="px-5 mb-6">
              <View className="bg-white dark:bg-[#151517] p-4 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <View className="w-8 h-8 rounded-xl bg-yellow-500/15 items-center justify-center mr-2.5">
                      <Trophy size={16} color="#eab308" />
                    </View>
                    <View>
                      <Text
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-xs text-gray-900 dark:text-white uppercase tracking-tight"
                      >
                        Copa das Unidades
                      </Text>
                      <Text className="text-[10px] text-gray-400">
                        Toda aula soma pontos para sua unidade
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({ pathname: '/(tabs)/notificacoes', params: { subTab: 'copa' } })
                    }
                  >
                    <Text className="text-[11px] font-bold text-yellow-600 dark:text-yellow-400">
                      Ver placar
                    </Text>
                  </TouchableOpacity>
                </View>

                {copaStandings.slice(0, 3).map((unit, idx) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  const isMyUnit = unit.unitId === myUnitSlug;
                  return (
                    <View
                      key={unit.unitId}
                      className={`flex-row items-center justify-between px-3 py-2 rounded-2xl mb-1.5 ${
                        isMyUnit
                          ? 'bg-yellow-500/15 border border-yellow-500/30'
                          : 'bg-gray-50 dark:bg-white/5'
                      }`}
                    >
                      <View className="flex-row items-center flex-1 mr-2">
                        <Emoji symbol={medals[idx]} size={18} style={{ marginRight: 10 }} />
                        <Text
                          style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                          className="text-xs text-gray-900 dark:text-white uppercase"
                          numberOfLines={1}
                        >
                          {unit.unitName}
                        </Text>
                        {isMyUnit && (
                          <View className="bg-yellow-500 px-1.5 py-0.5 rounded-full ml-2">
                            <Text className="text-[8px] font-black text-black uppercase">Sua</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-xs font-black text-yellow-600 dark:text-yellow-400">
                        {unit.score} pts
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* 4. MURAL DE CONQUISTAS DA COMUNIDADE */}
          {showCommunity && (
            <View className="px-5 mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-sm text-gray-900 dark:text-white uppercase tracking-tight"
                >
                  Mural de Conquistas
                </Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/notificacoes')}>
                  <Text className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    Ranking
                  </Text>
                </TouchableOpacity>
              </View>

              {visibleAchievements.length === 0 ? (
                <View className="bg-white dark:bg-[#151517] p-4 rounded-2xl border border-gray-100 dark:border-white/5 items-center">
                  <Text className="text-xs text-gray-400 text-center">
                    Os marcos de ofensiva, testes físicos e missões da sua unidade aparecerão aqui!
                  </Text>
                </View>
              ) : (
                visibleAchievements.map((item) => {
                  const reactionsMap = item.reactions || {};
                  return (
                    <View
                      key={item.id}
                      className="bg-white dark:bg-[#151517] p-4 rounded-2xl border border-gray-100 dark:border-white/5 mb-3 shadow-sm"
                    >
                      <TouchableOpacity
                        onPress={() => item.userId && router.push(`/user/${item.userId}`)}
                        activeOpacity={0.8}
                        className="flex-row items-center mb-2.5"
                      >
                        <Image
                          source={resolveAvatarSource(item.userPhotoURL)}
                          className="w-10 h-10 rounded-full border border-yellow-500/30 mr-3"
                        />
                        <View className="flex-1">
                          <Text className="font-bold text-[13px] text-gray-900 dark:text-white" numberOfLines={1}>
                            {item.userName}
                          </Text>
                          <Text className="text-[10px] text-gray-400 uppercase font-bold">
                            {item.userBelt || 'Aluno Kihap'} • {normalizeUnitDisplay(item.unitId)}
                          </Text>
                        </View>
                        <Text className="text-[10px] font-bold text-gray-400">
                          {formatRelativeTime(item.createdAt)}
                        </Text>
                      </TouchableOpacity>

                      <View className="bg-gray-50 dark:bg-white/5 px-3.5 py-2.5 rounded-xl flex-row items-center justify-between mb-3">
                        <View className="flex-row items-center flex-1 mr-2">
                          <Emoji symbol={item.icon || '🏆'} size={20} style={{ marginRight: 10 }} />
                          <View className="flex-1">
                            <Text className="font-bold text-xs text-gray-900 dark:text-white">
                              {item.title}
                            </Text>
                            <Text className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {item.subtitle}
                            </Text>
                          </View>
                        </View>
                        {!!item.metricValue && (
                          <View className="bg-yellow-500/15 px-2.5 py-1 rounded-lg border border-yellow-500/30">
                            <Text className="text-[11px] font-black text-yellow-600 dark:text-yellow-400">
                              {item.metricValue}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View className="flex-row items-center gap-2">
                        {ACHIEVEMENT_REACTIONS.map((rx) => {
                          const arr: string[] = Array.isArray(reactionsMap[rx.key])
                            ? reactionsMap[rx.key]
                            : [];
                          const active = Boolean(user?.uid && arr.includes(user.uid));
                          return (
                            <TouchableOpacity
                              key={rx.key}
                              onPress={() => handleReactAchievement(item.id, rx.key)}
                              className={`flex-row items-center px-3 py-1.5 rounded-full border ${
                                active
                                  ? 'bg-yellow-500/15 border-yellow-500/40'
                                  : 'bg-gray-50 dark:bg-white/5 border-transparent'
                              }`}
                            >
                              <Emoji symbol={rx.emoji} size={14} />
                              {arr.length > 0 && (
                                <Text
                                  className={`ml-1 text-[11px] font-bold ${
                                    active ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400'
                                  }`}
                                >
                                  {arr.length}
                                </Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* 5. KIHAP LITTLES EM CASA */}
          {showCommunity && (
            <View className="px-5 mb-6">
              <TouchableOpacity
                onPress={() => router.push('/littles')}
                activeOpacity={0.88}
                className="bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-2xl flex-row items-center justify-between"
              >
                <View className="flex-row items-center flex-1 mr-3">
                  <View className="w-11 h-11 rounded-2xl bg-emerald-500/20 items-center justify-center mr-3">
                    <Emoji symbol="🐼" size={24} />
                  </View>
                  <View className="flex-1">
                    <Text
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-xs text-gray-900 dark:text-white uppercase"
                    >
                      Kihap Littles em Casa
                    </Text>
                    <Text className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5">
                      Missões pai + filho com figurinhas e +15 Coins por semana!
                    </Text>
                  </View>
                </View>
                <ChevronRight size={18} color="#10b981" />
              </TouchableOpacity>
            </View>
          )}

          {/* 6. CARROSSEL TATAME */}
          {showTatame && allTatame.length > 0 && (
            <View className="mb-7">
              <View className="flex-row items-center justify-between px-5 mb-3">
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-sm text-gray-900 dark:text-white uppercase tracking-tight"
                >
                  Tatame & Conteúdos
                </Text>
                <TouchableOpacity onPress={() => router.push('/tatame')}>
                  <Text className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    Ver tudo
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20 }}
              >
                {allTatame.slice(0, 8).map((article) => (
                  <TouchableOpacity
                    key={article.id}
                    onPress={() => router.push(`/user/tatame/${article.id}`)}
                    activeOpacity={0.85}
                    style={{ width: 210 }}
                    className="mr-3 bg-white dark:bg-[#151517] rounded-2xl overflow-hidden border border-gray-100 dark:border-white/5 shadow-sm"
                  >
                    <View className="w-full h-28 bg-gray-100 dark:bg-black relative items-center justify-center">
                      {article.heroImageUrl && article.heroImageUrl.startsWith('http') ? (
                        <Image
                          source={{ uri: article.heroImageUrl }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <BookOpen size={28} color="#eab308" />
                      )}
                      {article.youtubeUrl && (
                        <View className="absolute top-2 right-2 bg-red-600 px-2 py-0.5 rounded-md flex-row items-center">
                          <Video size={10} color="#fff" />
                          <Text className="text-white text-[8px] font-black uppercase ml-1">Vídeo</Text>
                        </View>
                      )}
                    </View>
                    <View className="p-3">
                      <Text className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">
                        Tatame Kihap
                      </Text>
                      <Text
                        className="font-bold text-xs text-gray-900 dark:text-white mt-0.5 leading-snug h-8"
                        numberOfLines={2}
                      >
                        {article.title}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 7. HERO EDITORIAL BANNER (LOJA OFICIAL) */}
          {showLoja && (
            <View className="px-5 mt-1 mb-6">
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/store')}
                activeOpacity={0.9}
                className="h-52 rounded-3xl overflow-hidden shadow-lg border border-black/10 dark:border-white/10 relative justify-end bg-black"
              >
                <ExpoImage
                  source={{ uri: 'https://kihap.com.br/imgs/todosjuntos.jpeg' }}
                  placeholder={require('../../assets/images/todosjuntos.png')}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
                <LinearGradient
                  colors={['rgba(0,0,0,0.98)', 'rgba(0,0,0,0.88)', 'rgba(0,0,0,0.4)', 'transparent']}
                  locations={[0, 0.45, 0.7, 1]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <LinearGradient
                  colors={['rgba(0,0,0,0.2)', 'transparent', 'rgba(0,0,0,0.7)']}
                  locations={[0, 0.4, 1]}
                  style={StyleSheet.absoluteFillObject}
                />
                <View className="relative z-10 p-5">
                  <View className="flex-row items-center mb-2">
                    <View className="bg-yellow-500 px-2.5 py-0.5 rounded-full">
                      <Text
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-black text-[10px] uppercase tracking-wider"
                      >
                        Loja Oficial Kihap
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-2xl text-white uppercase tracking-tight leading-tight"
                  >
                    Equipamentos & Uniformes
                  </Text>
                  <Text className="text-gray-300 text-xs mt-1 font-medium leading-relaxed" numberOfLines={2}>
                    Doboks oficiais, armas e proteções certificadas.
                  </Text>
                  <View className="flex-row items-center mt-3">
                    <Text className="text-yellow-400 text-xs font-bold mr-1">
                      Conhecer a Loja
                    </Text>
                    <ArrowRight size={14} color="#facc15" />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* 8. SECTION: LOJA OFICIAL */}
          {showLoja && allProducts.length > 0 && (
            <View className="mb-7">
              <View className="flex-row items-center justify-between px-5 mb-3">
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-sm text-gray-900 dark:text-white uppercase tracking-tight"
                >
                  Loja Oficial
                </Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/store')}>
                  <Text className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    Ir para loja
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20 }}
              >
                {allProducts.slice(0, 10).map((product) => {
                  const isAvailable = product.available !== false;
                  const price = (product.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  return (
                    <TouchableOpacity
                      key={product.id}
                      onPress={() => isAvailable && router.push({ pathname: '/store/[id]', params: { id: product.id } })}
                      activeOpacity={0.8}
                      style={{ width: 145 }}
                      className={`mr-3 bg-white dark:bg-[#151517] rounded-2xl overflow-hidden border border-gray-100 dark:border-white/5 shadow-sm ${!isAvailable ? 'opacity-60' : ''}`}
                    >
                      <View className="relative">
                        <Image
                          source={{ uri: product.imageUrl || 'https://via.placeholder.com/200' }}
                          className="w-full aspect-square bg-gray-50 dark:bg-black"
                          resizeMode="cover"
                        />
                        {product.category && (
                          <View className="absolute top-2 left-2">
                            <View className="bg-yellow-500 px-1.5 py-0.5 rounded-md shadow-lg">
                              <Text className="text-black text-[7px] font-black uppercase tracking-widest">{product.category}</Text>
                            </View>
                          </View>
                        )}
                        {!isAvailable && (
                          <View className="absolute inset-0 bg-black/40 items-center justify-center p-1 backdrop-blur-[2px]">
                            <View className="bg-red-600 px-2.5 py-0.5 rounded shadow-2xl border-2 border-white/30 -rotate-6">
                              <Text className="text-white text-[8px] font-black uppercase tracking-tighter">ESGOTADO</Text>
                            </View>
                          </View>
                        )}
                      </View>
                      <View className="p-3">
                        <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-wider" numberOfLines={1}>
                          {product.category || 'Oficial'}
                        </Text>
                        <Text className="font-bold text-[12px] text-gray-900 dark:text-white leading-tight mt-0.5 h-7" numberOfLines={2}>
                          {product.name}
                        </Text>
                        <Text className="text-xs font-black text-gray-900 dark:text-white mt-1.5">
                          {price}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* 9. SECTION: PRÓXIMOS EVENTOS & CALENDÁRIO */}
          {showEventos && (upcomingEvents.length > 0 || activeFilter === 'eventos') && (
            <View className="px-5 mb-7">
              <View className="flex-row items-center justify-between mb-3">
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-sm text-gray-900 dark:text-white uppercase tracking-tight"
                >
                  Próximos Eventos & Exames
                </Text>
                <TouchableOpacity onPress={() => router.push('/calendario')}>
                  <Text className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    Ver calendário
                  </Text>
                </TouchableOpacity>
              </View>

              {upcomingEvents.length === 0 ? (
                <View className="bg-white dark:bg-[#151517] p-4 rounded-2xl border border-gray-100 dark:border-white/5 items-center">
                  <Text className="text-xs text-gray-400 text-center">
                    Nenhum próximo evento agendado no momento.
                  </Text>
                </View>
              ) : (
                upcomingEvents.slice(0, 5).map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    onPress={() => router.push('/calendario')}
                    activeOpacity={0.8}
                    className="bg-white dark:bg-[#151517] p-3.5 rounded-2xl border border-gray-100 dark:border-white/5 mb-2.5 flex-row items-center justify-between shadow-sm"
                  >
                    <View className="flex-row items-center flex-1 mr-3">
                      <View className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/5 items-center justify-center border border-gray-200/80 dark:border-white/5 mr-3">
                        <CalendarIcon size={20} color={isDark ? '#fff' : '#000'} />
                      </View>
                      <View className="flex-1">
                        <Text className="font-bold text-sm text-gray-900 dark:text-white leading-tight" numberOfLines={1}>
                          {event.title || event.name}
                        </Text>
                        <View className="flex-row items-center mt-1">
                          {event.date && (
                            <Text className="text-[11px] text-yellow-600 dark:text-yellow-500 font-bold mr-2">{formatDateBR(event.date)}</Text>
                          )}
                          {event.location && (
                            <Text className="text-[11px] text-gray-400 truncate flex-1" numberOfLines={1}>
                              • {event.location}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                    <ChevronRight size={16} color={isDark ? '#666' : '#bbb'} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* 10. Quick info card about calendar */}
          {showEventos && (
            <View className="px-5 mb-6">
              <TouchableOpacity
                onPress={() => router.push('/calendario')}
                activeOpacity={0.8}
                className="bg-yellow-500/10 dark:bg-yellow-500/5 border border-yellow-500/20 p-4 rounded-2xl flex-row items-center justify-between"
              >
                <View className="flex-1 mr-3">
                  <Text className="font-bold text-sm text-gray-900 dark:text-white">
                    Fique por dentro das datas
                  </Text>
                  <Text className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    Consulte exames de graduação, seminários e eventos do ano.
                  </Text>
                </View>
                <View className="bg-yellow-500 px-3 py-1.5 rounded-lg">
                  <Text className="text-xs font-black text-black">Acessar</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
