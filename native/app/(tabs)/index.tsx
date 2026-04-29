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
import { Menu, X, Home, Layout, MessageSquare, BookOpen, UserCheck, Activity, ShoppingBag, CreditCard, Star, LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function FeedScreen() {
  const { user, userData, signOut } = useAuth();
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
  const displayPhoto = rawPhoto || 'https://kihap.com.br/intranet/default-profile.svg';
  
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
              className={`h-9 w-9 mt-1 ${isDark ? '' : 'grayscale'}`}
              resizeMode="contain"
              style={!isDark ? { tintColor: '#014fa4' } : {}}
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
                <View className="p-6 border-b border-gray-100 dark:border-white/5 flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Image source={{ uri: displayPhoto }} className="w-12 h-12 rounded-full border-2 border-yellow-500/20" />
                    <View className="ml-3">
                      <Text className="text-base font-black text-gray-900 dark:text-white" numberOfLines={1}>{firstName}</Text>
                      <Text className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{displayUnit}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setSidebarOpen(false)} className="p-2 -mr-2">
                    <X size={20} color={isDark ? '#fff' : '#333'} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView className="flex-1 p-4">
                <SidebarItem icon={Home} label="Início" onPress={() => setSidebarOpen(false)} />
                <SidebarItem icon={Layout} label="Painel" onPress={() => {}} />
                <SidebarItem icon={MessageSquare} label="Chat" onPress={() => router.push('/(tabs)/chat')} />
                
                <Text className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-6 mb-2 ml-4">Evolução</Text>
                <SidebarItem icon={BookOpen} label="Meus Cursos" onPress={() => { setSidebarOpen(false); router.push('/(tabs)/cursos'); }} />
                <SidebarItem icon={UserCheck} label="Tatame" onPress={() => { setSidebarOpen(false); router.push('/tatame'); }} />
                <SidebarItem icon={Activity} label="Atividades" onPress={() => { setSidebarOpen(false); router.push('/atividades'); }} />

                <Text className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-6 mb-2 ml-4">Serviços</Text>
                <SidebarItem icon={ShoppingBag} label="Loja" onPress={() => { setSidebarOpen(false); router.push('/(tabs)/store'); }} />
                <SidebarItem icon={Layout} label="Meus Pedidos" onPress={() => { setSidebarOpen(false); router.push('/pedidos'); }} />
                <SidebarItem icon={CreditCard} label="Assinatura" onPress={() => { setSidebarOpen(false); router.push('/assinatura'); }} />

                <TouchableOpacity className="mt-8 mx-2 bg-yellow-400/10 py-4 rounded-2xl flex-row items-center justify-center border border-yellow-400/20">
                  <Star size={16} color="#eab308" fill="#eab308" />
                  <Text className="ml-2 text-[#eab308] font-black text-xs uppercase">Avaliar Experiência</Text>
                </TouchableOpacity>
              </ScrollView>

              <View className="p-6 border-t border-gray-100 dark:border-white/5">
                <TouchableOpacity 
                  onPress={() => { setSidebarOpen(false); signOut?.(); }}
                  className="flex-row items-center space-x-3 p-4 bg-red-500/10 rounded-2xl"
                >
                  <LogOut size={20} color="#ef4444" />
                  <Text className="text-red-500 font-bold uppercase tracking-widest text-[10px]">Sair da Conta</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <TouchableOpacity activeOpacity={1} onPress={() => setSidebarOpen(false)} className="flex-1 bg-black/40" />
        </View>
      </Modal>

      {loading && !refreshing && (
        <View className="absolute inset-0 items-center justify-center bg-gray-50/50 dark:bg-[#050505]/50">
          <ActivityIndicator size="large" color="#eab308" />
        </View>
      )}
    </View>
  );
}
