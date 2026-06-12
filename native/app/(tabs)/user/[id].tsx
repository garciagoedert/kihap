import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { doc, getDoc, collection, query, where, onSnapshot, getDocs, addDoc, deleteDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../src/services/firebase';
import { useColorScheme } from 'nativewind';
import { ArrowLeft, MapPin, Award, Trophy, Star } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../../src/context/AuthContext';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // Chat, follow and social states
  const [loadingChat, setLoadingChat] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followDocId, setFollowDocId] = useState<string | null>(null);
  const [loadingFollow, setLoadingFollow] = useState(false);
  
  // Badges & physical test states
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [physicalTest, setPhysicalTest] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchUserData();
    }
  }, [id]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'users', id as string);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      }
    } catch (error) {
      console.error("Error fetching public profile:", error);
    } finally {
      setLoading(false);
    }
  };

  // Follower/Following counters & Follow status
  useEffect(() => {
    if (!id) return;

    const followersQ = query(collection(db, 'follows'), where('followingId', '==', id));
    const unsubscribeFollowers = onSnapshot(followersQ, (snap) => {
      setFollowersCount(snap.size);
    }, (err) => console.error("Error fetching followers:", err));

    const followingQ = query(collection(db, 'follows'), where('followerId', '==', id));
    const unsubscribeFollowing = onSnapshot(followingQ, (snap) => {
      setFollowingCount(snap.size);
    }, (err) => console.error("Error fetching following:", err));

    return () => {
      unsubscribeFollowers();
      unsubscribeFollowing();
    };
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;

    const q = query(
      collection(db, 'follows'),
      where('followerId', '==', user.uid),
      where('followingId', '==', id)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setIsFollowing(true);
        setFollowDocId(snap.docs[0].id);
      } else {
        setIsFollowing(false);
        setFollowDocId(null);
      }
    });

    return () => unsubscribe();
  }, [user, id]);

  // Fetch all badges
  useEffect(() => {
    const badgesCol = collection(db, 'badges');
    const unsubscribe = onSnapshot(badgesCol, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setAllBadges(list);
      setBadgesLoading(false);
    }, (error) => {
      console.error("Error fetching badges:", error);
      setBadgesLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch physical test
  useEffect(() => {
    const evoId = userData?.evoMemberId;
    if (!evoId) {
      setTestLoading(false);
      return;
    }

    const testsQ = query(
      collection(db, 'physicalTests'),
      where('evoMemberId', '==', evoId),
      orderBy('date', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(testsQ, (snap) => {
      if (!snap.empty) {
        setPhysicalTest(snap.docs[0].data());
      } else {
        setPhysicalTest(null);
      }
      setTestLoading(false);
    }, (err) => {
      console.error("Error fetching physical test:", err);
      setTestLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.evoMemberId]);

  const handleFollowToggle = async () => {
    if (!user) {
      Alert.alert("Erro", "Você precisa estar logado para seguir usuários.");
      return;
    }
    if (user.uid === id) {
      Alert.alert("Erro", "Você não pode seguir a si mesmo.");
      return;
    }

    setLoadingFollow(true);
    try {
      if (isFollowing && followDocId) {
        // Unfollow
        await deleteDoc(doc(db, 'follows', followDocId));
      } else {
        // Follow
        await addDoc(collection(db, 'follows'), {
          followerId: user.uid,
          followingId: id,
          createdAt: serverTimestamp()
        });

        // Add follow notification
        await addDoc(collection(db, 'notifications'), {
          userId: id,
          title: "Novo Seguidor",
          message: `${user.displayName || user.email || 'Alguém'} começou a te seguir!`,
          type: "social",
          link: `/members/perfil-publico.html?id=${user.uid}`,
          icon: user.photoURL || "/imgs/kobe.png",
          createdAt: serverTimestamp(),
          read: false
        });
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      Alert.alert("Erro", "Não foi possível processar a ação social.");
    } finally {
      setLoadingFollow(false);
    }
  };

  const handleStartChat = async () => {
    if (!user) {
      Alert.alert("Erro", "Você precisa estar logado para iniciar uma conversa.");
      return;
    }
    if (user.uid === id) {
      Alert.alert("Erro", "Você não pode conversar com você mesmo.");
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
      let existingChatId = null;

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.members && data.members.includes(id)) {
          existingChatId = docSnap.id;
        }
      });

      if (existingChatId) {
        router.push(`/chat/${existingChatId}`);
      } else {
        const newChatRef = await addDoc(chatsRef, {
          isGroup: false,
          members: [user.uid, id],
          lastMessage: {
            text: "Conversa iniciada",
            timestamp: serverTimestamp()
          },
          unreadCount: {
            [user.uid.replace(/\./g, '_')]: 0,
            [(id as string).replace(/\./g, '_')]: 0
          },
          createdAt: serverTimestamp()
        });

        router.push(`/chat/${newChatRef.id}`);
      }
    } catch (error) {
      console.error("Error starting chat:", error);
      Alert.alert("Erro", "Não foi possível iniciar a conversa.");
    } finally {
      setLoadingChat(false);
    }
  };

  const defaultProfileImg = require('../../../assets/images/default-profile.png');

  if (loading) {
    return (
      <View className="flex-1 bg-white dark:bg-[#0a0a0a] items-center justify-center">
        <ActivityIndicator size="large" color="#eab308" />
      </View>
    );
  }

  if (!userData) {
    return (
      <View className="flex-1 bg-white dark:bg-[#0a0a0a] items-center justify-center p-6">
        <Text className="text-gray-500 font-bold text-center">Usuário não encontrado.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-[#014fa4] px-6 py-3 rounded-xl">
          <Text className="text-white font-bold">Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const photoURL = userData.photoURL || userData.profilePicture || userData.photoUrl;
  let photoSource;
  if (!photoURL || photoURL.includes('default-profile.svg') || photoURL.includes('default-profile.png')) {
    photoSource = defaultProfileImg;
  } else {
    const uri = photoURL.startsWith('/') ? `https://kihap.com.br${photoURL}` : photoURL;
    photoSource = { uri };
  }

  // Filter user's earned badges
  const earnedBadgesList = allBadges.filter(b => (userData.earnedBadges || []).includes(b.id));

  return (
    <View className="flex-1 bg-gray-50 dark:bg-[#0a0a0a]">
      <StatusBar style="light" />
      
      <ScrollView className="flex-1" bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Cover Header */}
        <View className="h-56 bg-[#014fa4] relative">
          <View className="absolute inset-0 bg-black/30" />
          <View className="absolute inset-0 opacity-10 bg-[url('https://kihap.com.br/imgs/favicon.png')] bg-repeat opacity-5" />
          
          <SafeAreaView className="flex-row items-center justify-between px-6 pt-2">
             <TouchableOpacity 
                onPress={() => router.back()} 
                className="w-10 h-10 rounded-full bg-black/40 items-center justify-center border border-white/20"
             >
               <ArrowLeft size={22} color="white" strokeWidth={3} />
             </TouchableOpacity>
          </SafeAreaView>
        </View>

        {/* Profile Card Wrapper */}
        <View className="px-6 -mt-20 mb-6">
          <View className="bg-white dark:bg-[#1a1a1a] rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-white/5">
            <View className="items-center">
              <View className="relative">
                <View className="w-36 h-36 rounded-full border-[6px] border-white dark:border-[#1a1a1a] overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-2xl">
                  <Image source={photoSource} className="w-full h-full object-cover" />
                </View>
                <View className="absolute -bottom-1 self-center bg-yellow-500 px-5 py-1.5 rounded-full shadow-xl border-2 border-white dark:border-[#1a1a1a]">
                  <Text className="text-[10px] font-black text-black uppercase tracking-[2px]">
                    {userData.belt || 'Membro'}
                  </Text>
                </View>
              </View>

              <View className="items-center mt-6">
                <Text className="text-3xl font-black text-gray-900 dark:text-white text-center leading-none">
                  {userData.name || userData.displayName || 'Usuário Kihap'}
                </Text>
                <View className="flex-row items-center mt-3 bg-gray-50 dark:bg-black/20 px-4 py-2 rounded-full">
                   <MapPin size={12} color="#ef4444" fill="#ef4444" />
                   <Text className="text-gray-500 dark:text-gray-400 font-bold text-xs ml-1.5 uppercase tracking-tighter">
                     {userData.unidade || userData.unit || 'Kihap Unit'}
                   </Text>
                </View>
              </View>

              {/* Social Stats Row */}
              <View className="flex-row items-center justify-around mt-8 w-full border-t border-gray-100 dark:border-white/5 pt-8 px-4">
                <View className="items-center flex-1">
                  <Text className="text-2xl font-black text-gray-900 dark:text-white">{followersCount}</Text>
                  <Text className="text-[9px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest mt-1 text-center">Seguidores</Text>
                </View>
                <View className="items-center flex-1 border-x border-gray-100 dark:border-white/5">
                  <Text className="text-2xl font-black text-gray-900 dark:text-white">{followingCount}</Text>
                  <Text className="text-[9px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest mt-1 text-center">Seguindo</Text>
                </View>
                <View className="items-center flex-1">
                  <Text className="text-2xl font-black text-yellow-500">{userData.totalFitCoins || 0}</Text>
                  <Text className="text-[9px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest mt-1 text-center">Kihapcoins</Text>
                </View>
              </View>

              {/* Follow & Message Buttons */}
              <View className="flex-row w-full mt-8 justify-between">
                <TouchableOpacity 
                  onPress={handleFollowToggle}
                  disabled={loadingFollow}
                  style={{ marginRight: 6 }}
                  className={`flex-1 py-3 rounded-2xl items-center justify-center shadow-md active:scale-[0.98] ${
                    isFollowing 
                      ? 'bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-transparent' 
                      : 'bg-[#014fa4]'
                  }`}
                >
                  {loadingFollow ? (
                    <ActivityIndicator size="small" color={isFollowing ? (isDark ? "#fff" : "#333") : "#fff"} />
                  ) : (
                    <Text className={`font-extrabold uppercase tracking-widest text-[10px] ${
                      isFollowing 
                        ? 'text-gray-900 dark:text-white' 
                        : 'text-white'
                    }`}>
                      {isFollowing ? 'Seguindo' : 'Seguir'}
                    </Text>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={handleStartChat}
                  disabled={loadingChat}
                  style={{ marginLeft: 6 }}
                  className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 py-3 rounded-2xl items-center justify-center shadow-md active:scale-[0.98]"
                >
                  {loadingChat ? (
                    <ActivityIndicator size="small" color={isDark ? "#fff" : "#014fa4"} />
                  ) : (
                    <Text className="text-gray-900 dark:text-white font-extrabold uppercase tracking-widest text-[10px]">Mensagem</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Achievements (Conquistas) Card Wrapper */}
        <View className="px-6 mb-6">
          <View className="bg-white dark:bg-[#1a1a1a] rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-white/5">
            <View className="flex-row items-center justify-between mb-8">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-2xl bg-yellow-400/10 items-center justify-center">
                  <Award size={20} color="#eab308" />
                </View>
                <Text className="ml-3 text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Conquistas</Text>
              </View>
              <View className="bg-gray-50 dark:bg-black/20 px-3 py-1 rounded-full">
                <Text className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase">{earnedBadgesList.length} Total</Text>
              </View>
            </View>

            {badgesLoading ? (
              <ActivityIndicator size="small" color="#eab308" className="py-4" />
            ) : earnedBadgesList.length > 0 ? (
              <View className="flex-row flex-wrap gap-4 justify-start px-2">
                {earnedBadgesList.map((badge) => {
                  let badgeImage = badge.imageUrl || '';
                  if (badgeImage && badgeImage.startsWith('/')) {
                    badgeImage = `https://kihap.com.br${badgeImage}`;
                  }
                  return (
                    <TouchableOpacity
                      key={badge.id}
                      onPress={() => Alert.alert(badge.name, badge.description || 'Emblema conquistado!')}
                      className="w-[21%] items-center mb-2"
                    >
                      <View className="w-14 h-14 bg-yellow-500/5 dark:bg-yellow-500/10 rounded-full items-center justify-center border border-yellow-500/20 shadow-sm mb-1 overflow-hidden">
                        {badgeImage ? (
                          <Image source={{ uri: badgeImage }} className="w-full h-full object-contain" resizeMode="contain" />
                        ) : (
                          <Award size={26} color="#eab308" />
                        )}
                      </View>
                      <Text numberOfLines={1} className="text-[9px] font-black uppercase text-gray-500 dark:text-gray-400 text-center tracking-tighter">
                        {badge.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View className="items-center py-4">
                <Text className="text-gray-400 dark:text-gray-500 text-sm font-semibold text-center">Nenhum emblema conquistado ainda.</Text>
              </View>
            )}
          </View>
        </View>

        {/* Results (Resultados) Card Wrapper */}
        <View className="px-6 mb-6">
          <View className="bg-white dark:bg-[#1a1a1a] rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-white/5">
            <View className="flex-row items-center mb-8">
              <View className="w-10 h-10 rounded-2xl bg-red-400/10 items-center justify-center">
                 <Trophy size={20} color="#ef4444" />
              </View>
              <Text className="ml-3 text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Último Teste Físico</Text>
            </View>
            
            {testLoading ? (
              <ActivityIndicator size="small" color="#ef4444" className="py-4" />
            ) : physicalTest ? (
              <View className="bg-gray-50 dark:bg-black/20 p-5 rounded-3xl border border-gray-100 dark:border-white/5 flex-row items-center justify-between">
                <View>
                  <Text className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Data de Realização</Text>
                  <Text className="text-sm font-black text-gray-800 dark:text-gray-200">
                    {physicalTest.date?.seconds 
                      ? new Date(physicalTest.date.seconds * 1000).toLocaleDateString('pt-BR')
                      : 'Não informada'}
                  </Text>
                </View>
                <View className="bg-red-500/10 px-4 py-2.5 rounded-2xl border border-red-500/25 items-center">
                  <Text className="text-red-550 text-[10px] font-black uppercase tracking-wider mb-0.5">Pontuação</Text>
                  <Text className="text-2xl font-black text-red-550">{physicalTest.score}</Text>
                </View>
              </View>
            ) : (
              <View className="items-center py-4">
                <Text className="text-gray-400 dark:text-gray-500 text-sm font-semibold text-center">Nenhum teste físico registrado.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
