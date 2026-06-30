import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, ActivityIndicator, RefreshControl, Image, TouchableOpacity, Modal, ScrollView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, orderBy, limit, getDocs, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useAuth } from '../../src/context/AuthContext';
import FeedCard from '../../src/components/FeedCard';
import StoriesBar from '../../src/components/StoriesBar';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { Menu, X, Home, Layout, MessageSquare, BookOpen, UserCheck, Activity, ShoppingBag, CreditCard, Star, LogOut, Calendar, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function FeedScreen() {
  const { user, userData, linkedProfiles, switchProfile, signOut } = useAuth();
  const [isSwitching, setIsSwitching] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Mapping real data with robust fallbacks and URL normalization
  const displayName = userData?.name || userData?.nome || userData?.displayName || 'Aluno';
  const firstName = displayName.split(' ')[0];
  
  let rawPhoto = userData?.photoURL || userData?.profilePicture || userData?.photoUrl || userData?.avatar;
  if (rawPhoto && rawPhoto.startsWith('/')) {
    rawPhoto = `https://kihap.com.br${rawPhoto}`;
  }
  const defaultProfileImg = require('../../assets/images/default-profile.png');
  const displayPhoto = rawPhoto && !rawPhoto.includes('default-profile.svg') ? { uri: rawPhoto } : defaultProfileImg;
  
  const displayUnit = userData?.unidade || userData?.unit || 'Kihap Member';

  useEffect(() => {
    let unsubscribeFeed: any = null;

    const startDataFlow = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      const userUnit = userData?.unidade || userData?.unit || '';

      // 1. Fetch Stories (Static)
      try {
        const now = new Date();
        const storiesQ = query(
          collection(db, 'stories'), 
          where('expiresAt', '>=', now),
          orderBy('expiresAt', 'asc')
        );
        const storiesSnap = await getDocs(storiesQ);
        const allStories: any[] = [];
        storiesSnap.forEach(docSnap => {
          const story = { id: docSnap.id, ...docSnap.data() };
          const isForMe = story.targetStudents?.includes(user.uid);
          const isForMyUnit = story.targetUnit === 'all' || story.targetUnit === userUnit;
          const isAuthor = story.authorId === user.uid;
          if (isForMe || isForMyUnit || isAuthor) allStories.push(story);
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
        const filteredPosts: any[] = [];
        feedSnap.forEach(docSnap => {
          const post = { id: docSnap.id, ...docSnap.data() };
          const isAuthor = post.authorId === user.uid;
          const isForMe = post.targetStudents?.includes(user.uid);
          const isForMyUnit = post.targetUnit === 'all' || post.targetUnit === userUnit;
          const isPublic = !post.targetUnit || post.targetUnit === '' || post.targetUnit === 'all';
          if (isAuthor || isForMe || isForMyUnit || isPublic) filteredPosts.push(post);
        });
        setPosts(filteredPosts);
        setLoading(false);
        setRefreshing(false);
      }, (err) => {
        console.error("Feed: Snapshot error:", err);
        setLoading(false);
      });
    };

    startDataFlow();

    return () => {
      if (unsubscribeFeed) unsubscribeFeed();
    };
  }, [user, userData]);
  const handleSwitchProfile = async (uid: string) => {
    setIsSwitching(true);
    setSidebarOpen(false);
    try {
      await switchProfile(uid);
    } catch (err) {
      console.error(err);
      // Wait, Alert.alert is safer in RN than native browser alert
      // Let's import Alert from react-native or use standard alert fallback since Alert is not explicitly imported (wait, let's check react-native imports: View, FlatList, Text, ActivityIndicator, RefreshControl, Image, TouchableOpacity, Modal, ScrollView, Dimensions. Alert is not there. Let's use standard alert or add it to imports. Let's use alert() which is supported globally in RN, or add Alert to react-native imports.)
      alert("Erro ao alternar perfil. Tente novamente.");
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

  const renderHeader = () => (
    <View className="bg-transparent pt-4">
      {stories.length > 0 && (
        <View className="py-4 mb-4">
          <StoriesBar groups={stories} onPress={(group) => console.log('Story pressed', group)} />
        </View>
      )}
      {/* Respiro extra se não houver stories */}
      {stories.length === 0 && <View className="h-4" />}
    </View>
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
          <View className="w-10" />
        </View>
      </View>

      <FlatList
        className="flex-1"
        style={{ flex: 1 }}
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FeedCard post={item} />}
        ListHeaderComponent={renderHeader}
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
                    <Text className="text-base font-black text-gray-900 dark:text-white" numberOfLines={1}>{firstName}</Text>
                    <Text className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{displayUnit}</Text>
                  </View>
                </View>
                {linkedProfiles && linkedProfiles.length > 0 && (
                  <View className="px-6 py-4 border-b border-gray-100 dark:border-white/5">
                    <Text className="text-[9px] font-black text-gray-400 uppercase tracking-[2px] mb-3">Família / Alternar Perfil</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                      {linkedProfiles.map((profile) => {
                        const profName = (profile.name || profile.nome || 'Dependente').split(' ')[0];
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
                
                <Text className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-6 mb-2 ml-4">Evolução</Text>
                <SidebarItem icon={BookOpen} label="Área do Aluno" onPress={() => { setSidebarOpen(false); router.push('/(tabs)/cursos'); }} />
                <SidebarItem icon={UserCheck} label="Tatame" onPress={() => { setSidebarOpen(false); router.push('/tatame'); }} />
                <SidebarItem icon={Clock} label="Horários" onPress={() => { setSidebarOpen(false); router.push('/atividades'); }} />
                <SidebarItem icon={Calendar} label="Calendário" onPress={() => { setSidebarOpen(false); router.push('/calendario'); }} />

                <Text className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-6 mb-2 ml-4">Serviços</Text>
                <SidebarItem icon={ShoppingBag} label="Loja" onPress={() => { setSidebarOpen(false); router.push('/(tabs)/store'); }} />
                <SidebarItem icon={Layout} label="Meus Pedidos" onPress={() => { setSidebarOpen(false); router.push('/pedidos'); }} />
                <SidebarItem icon={CreditCard} label="Assinatura" onPress={() => { setSidebarOpen(false); router.push('/assinatura'); }} />
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
