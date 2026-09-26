import React, { useEffect, useState, useRef } from 'react';
import { View, FlatList, Text, ActivityIndicator, RefreshControl, Image, TouchableOpacity, Modal, ScrollView, Dimensions, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, orderBy, limit, getDocs, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useAuth } from '../../src/context/AuthContext';
import FeedCard from '../../src/components/FeedCard';
import StoriesBar from '../../src/components/StoriesBar';
import BannerCarousel from '../../src/components/BannerCarousel';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { Menu, X, Home, Layout, MessageSquare, BookOpen, UserCheck, Activity, ShoppingBag, CreditCard, Star, LogOut, Calendar, Clock, Send } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export function normalizeUnitSlug(val: any): string {
  if (!val || typeof val !== 'string') return '';
  return val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^kihap\s*-\s*/i, '')
    .replace(/^kihap\s+/i, '')
    .replace(/^unidade\s+/i, '')
    .replace(/\s*\(.*\)\s*/g, '')
    .trim()
    .replace(/[\s_]+/g, '-');
}

export function getUserUnitSlugs(userData: any): string[] {
  if (!userData) return [];
  const rawUnits: any[] = [
    userData.unitId,
    userData.unidade,
    userData.unit,
    userData.branchName,
  ];
  if (Array.isArray(userData.units)) rawUnits.push(...userData.units);
  if (Array.isArray(userData.unidades)) rawUnits.push(...userData.unidades);
  
  const slugs = rawUnits.map(normalizeUnitSlug).filter(Boolean);
  return Array.from(new Set(slugs));
}

export function isTargetForUser(
  item: { targetUnit?: string; targetUnits?: string[]; targetStudents?: string[]; authorId?: string },
  userId: string,
  userUnitSlugs: string[]
): boolean {
  // If targeted to specific students
  if (Array.isArray(item.targetStudents) && item.targetStudents.length > 0) {
    if (item.targetStudents.includes(userId)) return true;
    if (!item.targetUnit && (!item.targetUnits || item.targetUnits.length === 0)) {
      return false;
    }
  }

  // Check targetUnit
  const targetUnitSlug = normalizeUnitSlug(item.targetUnit);
  if (!targetUnitSlug || targetUnitSlug === 'all' || targetUnitSlug === 'todas') {
    if (!item.targetStudents || item.targetStudents.length === 0) {
      return true;
    }
  }

  if (targetUnitSlug && userUnitSlugs.includes(targetUnitSlug)) {
    return true;
  }

  // Check targetUnits array if present
  if (Array.isArray(item.targetUnits) && item.targetUnits.length > 0) {
    const targetSlugs = item.targetUnits.map(normalizeUnitSlug);
    if (targetSlugs.includes('all') || targetSlugs.includes('todas')) {
      return true;
    }
    if (targetSlugs.some(slug => userUnitSlugs.includes(slug))) {
      return true;
    }
  }

  return false;
}

export default function FeedScreen() {
  const { user, userData, linkedProfiles, switchProfile, signOut } = useAuth();
  const [isSwitching, setIsSwitching] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Mapping real data with robust fallbacks and URL normalization
  const displayName = userData?.name || userData?.nome || userData?.displayName || 'Aluno';
  
  const formatShortName = (fullName: string): string => {
    if (!fullName) return 'Aluno';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return parts[0];

    const titles = ['mr.', 'mr', 'mrs.', 'mrs', 'ms.', 'ms', 'dr.', 'dr', 'dra.', 'dra', 'prof.', 'prof', 'mestre', 'instrutor', 'instrutora'];
    const firstLower = parts[0].toLowerCase();

    if (titles.includes(firstLower) || parts[0].length <= 2) {
      return `${parts[0]} ${parts[1]}`;
    }

    if (parts.length === 2) {
      return `${parts[0]} ${parts[1]}`;
    }

    return `${parts[0]} ${parts[parts.length - 1]}`;
  };

  const shortName = formatShortName(displayName);
  
  let rawPhoto = userData?.photoURL || userData?.profilePicture || userData?.photoUrl || userData?.avatar;
  if (rawPhoto && rawPhoto.startsWith('/')) {
    rawPhoto = `https://kihap.com.br${rawPhoto}`;
  }
  const defaultProfileImg = require('../../assets/images/default-profile.png');
  const displayPhoto = rawPhoto && !rawPhoto.includes('default-profile.svg') ? { uri: rawPhoto } : defaultProfileImg;
  
  const rawUnitName = userData?.unidade || userData?.unit || userData?.branchName || userData?.unitId;
  const displayUnit = rawUnitName 
    ? (typeof rawUnitName === 'string' && rawUnitName.includes('-') 
        ? rawUnitName.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) 
        : String(rawUnitName)) 
    : 'Kihap Member';

  useEffect(() => {
    let unsubscribeFeed: any = null;
    let unsubscribeBanners: any = null;

    const startDataFlow = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      const userUnitSlugs = getUserUnitSlugs(userData);

      // 1. Fetch Stories (Static)
      try {
        const now = new Date();
        const storiesQ = query(
          collection(db, 'stories'), 
          where('expiresAt', '>=', now),
          orderBy('expiresAt', 'asc')
        );
        const storiesSnap = await getDocs(storiesQ);
        
        const storyBatchUnitsMap = new Map<string, Set<string>>();
        const rawStories: any[] = [];
        storiesSnap.forEach(docSnap => {
          const story: any = { id: docSnap.id, ...docSnap.data() };
          rawStories.push(story);
          if (story.batchId && story.targetUnit) {
            if (!storyBatchUnitsMap.has(story.batchId)) {
              storyBatchUnitsMap.set(story.batchId, new Set<string>());
            }
            storyBatchUnitsMap.get(story.batchId)!.add(story.targetUnit);
          }
        });

        const allStories: any[] = [];
        const seenStoryBatches = new Set<string>();
        rawStories.forEach(story => {
          if (story.batchId && storyBatchUnitsMap.has(story.batchId)) {
            const batchUnits = Array.from(storyBatchUnitsMap.get(story.batchId)!);
            if (!story.targetUnits || story.targetUnits.length === 0) {
              story.targetUnits = batchUnits;
            }
          }

          if (story.batchId) {
            if (seenStoryBatches.has(story.batchId)) return;
            seenStoryBatches.add(story.batchId);
          }

          const isAuthor = story.authorId === user.uid;
          const isTargeted = isTargetForUser(story, user.uid, userUnitSlugs);
          if (isAuthor || isTargeted) allStories.push(story);
        });

        const groupedStories = allStories.reduce((acc, story) => {
          if (!acc[story.authorId]) {
            acc[story.authorId] = {
              authorId: story.authorId,
              authorName: story.authorName,
              authorPhotoURL: story.authorPhotoURL,
              stories: []
            };
          }
          acc[story.authorId].stories.push(story);
          return acc;
        }, {});
        setStories(Object.values(groupedStories));
      } catch (err) {
        console.error("Feed: Stories error:", err);
      }

      // 2. Subscribe to Feed (Real-time)
      const feedQ = query(collection(db, 'feed'), orderBy('createdAt', 'desc'), limit(50));
      unsubscribeFeed = onSnapshot(feedQ, (feedSnap) => {
        const postBatchUnitsMap = new Map<string, Set<string>>();
        const rawPosts: any[] = [];
        
        feedSnap.forEach(docSnap => {
          const post: any = { id: docSnap.id, ...docSnap.data() };
          rawPosts.push(post);
          if (post.batchId && post.targetUnit) {
            if (!postBatchUnitsMap.has(post.batchId)) {
              postBatchUnitsMap.set(post.batchId, new Set<string>());
            }
            postBatchUnitsMap.get(post.batchId)!.add(post.targetUnit);
          }
        });

        const filteredPosts: any[] = [];
        const seenBatches = new Set<string>();

        rawPosts.forEach(post => {
          if (post.batchId && postBatchUnitsMap.has(post.batchId)) {
            const batchUnits = Array.from(postBatchUnitsMap.get(post.batchId)!);
            if (!post.targetUnits || post.targetUnits.length === 0) {
              post.targetUnits = batchUnits;
            }
          }

          if (post.batchId) {
            if (seenBatches.has(post.batchId)) return;
            seenBatches.add(post.batchId);
          }

          const isAuthor = post.authorId === user.uid;
          const isTargeted = isTargetForUser(post, user.uid, userUnitSlugs);

          if (isAuthor || isTargeted) filteredPosts.push(post);
        });

        setPosts(filteredPosts);
        setLoading(false);
        setRefreshing(false);
      }, (err) => {
        console.error("Feed: Snapshot error:", err);
        setLoading(false);
        setRefreshing(false);
      });

      // 3. Subscribe to Banners (Real-time) - Sem orderBy para não exigir índice composto no Firestore
      const bannersQ = query(collection(db, 'banners'), where('active', '==', true));
      unsubscribeBanners = onSnapshot(bannersQ, (snap) => {
        const bannerBatchUnitsMap = new Map<string, Set<string>>();
        const rawBanners: any[] = [];
        
        snap.forEach(d => {
          const b: any = { id: d.id, ...d.data() };
          rawBanners.push(b);
          if (b.batchId && b.targetUnit) {
            if (!bannerBatchUnitsMap.has(b.batchId)) {
              bannerBatchUnitsMap.set(b.batchId, new Set<string>());
            }
            bannerBatchUnitsMap.get(b.batchId)!.add(b.targetUnit);
          }
        });

        const bList: any[] = [];
        const seenBannerBatches = new Set<string>();

        rawBanners.forEach(b => {
          if (b.batchId && bannerBatchUnitsMap.has(b.batchId)) {
            const batchUnits = Array.from(bannerBatchUnitsMap.get(b.batchId)!);
            if (!b.targetUnits || b.targetUnits.length === 0) {
              b.targetUnits = batchUnits;
            }
          }

          if (b.batchId) {
            if (seenBannerBatches.has(b.batchId)) return;
            seenBannerBatches.add(b.batchId);
          }

          const isTargeted = isTargetForUser(b, user.uid, userUnitSlugs);
          const isPlacementOk = !b.placement || b.placement === 'feed' || b.placement === 'all';
          if (isTargeted && isPlacementOk) {
            bList.push(b);
          }
        });

        // Ordenação client-side por createdAt decrescente
        bList.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (new Date(a.createdAt || 0)).getTime());
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (new Date(b.createdAt || 0)).getTime());
          return timeB - timeA;
        });
        setBanners(bList);
      }, (err) => {
        console.error("Feed: Banners snapshot error:", err);
      });

      return () => {
        if (unsubscribeFeed) unsubscribeFeed();
        if (unsubscribeBanners) unsubscribeBanners();
      };
    };

    const cleanup = startDataFlow();

    return () => {
      if (cleanup && typeof cleanup.then === 'function') {
        cleanup.then((fn: any) => fn && fn());
      }
      if (unsubscribeFeed) unsubscribeFeed();
    };
  }, [user, userData]);
  const handleSwitchProfile = async (uid: string) => {
    setIsSwitching(true);
    setSidebarOpen(false);
    try {
      await switchProfile(uid);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao alternar perfil: " + (err.message || err));
    } finally {
      setIsSwitching(false);
    }
  };
  const onRefresh = () => {
    setRefreshing(true);
    // Real-time listener will already have latest data, but we can restart flow if needed
    // Actually, just for the stories which are static:
    if (user) {
      setRefreshing(false); // Snapshots are instant
    }
  };

  const SidebarItem = ({ icon: Icon, label, onPress, color = isDark ? '#fff' : '#333' }: any) => (
    <TouchableOpacity 
      onPress={onPress}
      className="flex-row items-center px-4 py-3.5 mb-1 rounded-xl active:bg-gray-100 dark:active:bg-white/5"
    >
      <Icon size={20} color={color} />
      <Text className="ml-4 text-[15px] font-bold text-gray-700 dark:text-gray-200">{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-gray-50 dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Fixed Header */}
      <View 
        style={{ paddingTop: insets.top || 50 }}
        className="bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-lg border-b border-gray-100 dark:border-white/5 z-50"
      >
        <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
          <View className="w-10">
            <TouchableOpacity onPress={() => setSidebarOpen(true)} className="p-2 -ml-2">
              <Menu size={24} color={isDark ? '#fff' : '#333'} />
            </TouchableOpacity>
          </View>
          <View className="flex-1 items-center justify-center">
            <Image 
              source={{ uri: 'https://kihap.com.br/imgs/favicon.png' }} 
              className="h-9 w-9 mt-1"
              resizeMode="contain"
              style={{ tintColor: isDark ? '#ffffff' : '#000000' }}
            />
          </View>
          <View className="w-10 items-end">
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/chat')} 
              className="p-2 -mr-2"
              activeOpacity={0.7}
            >
              <Send size={22} color={isDark ? '#fff' : '#333'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <FlatList
        className="flex-1"
        style={{ flex: 1 }}
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FeedCard post={item} />}
        ListHeaderComponent={
          <View className="bg-transparent pt-4">
            {stories.length > 0 && (
              <View className="py-4 mb-2">
                <StoriesBar groups={stories} onPress={(group) => console.log('Story pressed', group)} />
              </View>
            )}

            {/* Banners em Destaque no Topo do Feed - Carrossel Horizontal Deslizável */}
            <BannerCarousel banners={banners} />

            {/* Respiro extra se não houver stories nem banners */}
            {stories.length === 0 && banners.length === 0 && <View className="h-4" />}
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor="#eab308"
            colors={["#eab308"]}
            progressViewOffset={insets.top + 60}
          />
        }
      />

      <Modal
        visible={isSidebarOpen}
        animationType="none"
        transparent={true}
        onRequestClose={() => setSidebarOpen(false)}
      >
        <View className="flex-1 flex-row">
            <View className="w-72 bg-white dark:bg-[#1a1a1a] h-full shadow-2xl">
            <View className="flex-1">
              <View style={{ paddingTop: insets.top }}>
                <View className="p-6 border-b border-gray-100 dark:border-white/5 flex-row items-center">
                  <Image source={displayPhoto} className="w-12 h-12 rounded-full border-2 border-yellow-500/20" />
                  <View className="ml-3">
                    <Text className="text-base font-black text-gray-900 dark:text-white" numberOfLines={1}>{shortName}</Text>
                    <Text className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{displayUnit}</Text>
                  </View>
                </View>
                {linkedProfiles && linkedProfiles.length > 0 && (
                  <View className="px-6 py-4 border-b border-gray-100 dark:border-white/5">
                    <Text className="text-[9px] font-black text-gray-400 uppercase tracking-[2px] mb-3">Família / Alternar Perfil</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                      {linkedProfiles.map((profile) => {
                        const profName = formatShortName(profile.name || profile.nome || 'Dependente');
                        let profPhoto = profile.photoURL || profile.profilePicture || profile.photoUrl || profile.avatar;
                        if (profPhoto && profPhoto.startsWith('/')) {
                          profPhoto = `https://kihap.com.br${profPhoto}`;
                        }
                        const profPhotoSource = profPhoto && !profPhoto.includes('default-profile.svg') ? { uri: profPhoto } : defaultProfileImg;
                        
                        return (
                          <TouchableOpacity 
                            key={profile.uid} 
                            onPress={() => handleSwitchProfile(profile.uid)}
                            className="items-center mr-4"
                          >
                            <Image source={profPhotoSource} className="w-10 h-10 rounded-full border border-gray-200 dark:border-white/10" />
                            <Text className="text-[10px] font-bold text-gray-700 dark:text-gray-300 mt-1" numberOfLines={1}>
                              {profName}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              <ScrollView className="flex-1 p-4">
                <SidebarItem icon={Home} label="Início" onPress={() => setSidebarOpen(false)} />
                <SidebarItem icon={Clock} label="Horários" onPress={() => { setSidebarOpen(false); router.push('/atividades'); }} />
                <SidebarItem icon={Calendar} label="Calendário" onPress={() => { setSidebarOpen(false); router.push('/calendario'); }} />
                <SidebarItem icon={ShoppingBag} label="Loja" onPress={() => { setSidebarOpen(false); router.push('/(tabs)/store'); }} />
                <SidebarItem icon={Layout} label="Meus Pedidos" onPress={() => { setSidebarOpen(false); router.push('/pedidos'); }} />
              </ScrollView>

              <View className="p-6 border-t border-gray-100 dark:border-white/5">
                <TouchableOpacity 
                  onPress={() => { setSidebarOpen(false); signOut?.(); }}
                  className="flex-row items-center p-4 bg-red-500/10 rounded-2xl"
                >
                  <LogOut size={20} color="#ef4444" />
                  <View style={{ width: 12 }} />
                  <Text className="text-red-500 font-bold uppercase tracking-widest text-[10px]">Sair da Conta</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <TouchableOpacity activeOpacity={1} onPress={() => setSidebarOpen(false)} className="flex-1 bg-black/40" />
        </View>
      </Modal>

      {(loading || isSwitching) && !refreshing && (
        <View className="absolute inset-0 items-center justify-center bg-gray-50/80 dark:bg-[#050505]/80 z-[9999]">
          <ActivityIndicator size="large" color="#eab308" />
          {isSwitching && (
            <Text className="text-gray-500 dark:text-gray-450 font-bold mt-4 text-[10px] uppercase tracking-widest">
              Alternando perfil...
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
