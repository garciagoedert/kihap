import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useColorScheme } from 'nativewind';
import { ArrowLeft, MapPin, Heart, Users, Award, Trophy, Star } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  const normalizePhoto = (photo: string) => {
    if (!photo) return 'https://kihap.com.br/intranet/default-profile.svg';
    if (photo.startsWith('/')) return `https://kihap.com.br${photo}`;
    return photo;
  };

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

  const photo = normalizePhoto(userData.photoURL || userData.profilePicture || userData.photoUrl);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-[#0a0a0a]">
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView className="flex-1" bounces={false} showsVerticalScrollIndicator={false}>
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

        {/* Profile Card */}
        <View className="px-6 -mt-20">
          <View className="bg-white dark:bg-[#1a1a1a] rounded-[48px] p-8 shadow-2xl border border-gray-100 dark:border-white/5">
            <View className="items-center">
              <View className="relative">
                <View className="w-36 h-36 rounded-full border-[6px] border-white dark:border-[#1a1a1a] overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-2xl">
                  <Image source={{ uri: photo }} className="w-full h-full object-cover" />
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

              {/* Social Stats */}
              <View className="flex-row items-center justify-center space-x-10 mt-10 w-full border-t border-gray-50 dark:border-white/5 pt-8">
                <View className="items-center">
                  <Text className="text-2xl font-black text-gray-900 dark:text-white">0</Text>
                  <Text className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-1">Seguidores</Text>
                </View>
                <View className="items-center">
                  <Text className="text-2xl font-black text-gray-900 dark:text-white">0</Text>
                  <Text className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-1">Seguindo</Text>
                </View>
                <View className="items-center">
                  <Text className="text-2xl font-black text-yellow-500">0</Text>
                  <Text className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-1">Kihapcoins</Text>
                </View>
              </View>

              <TouchableOpacity className="mt-10 w-full bg-[#014fa4] py-5 rounded-[24px] items-center justify-center shadow-lg active:scale-[0.98]">
                <Text className="text-white font-black uppercase tracking-[3px] text-xs">Seguir</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Achievements Section */}
          <View className="mt-8 space-y-6 pb-24">
            <View className="bg-white dark:bg-[#1a1a1a] rounded-[40px] p-8 shadow-sm border border-gray-100 dark:border-white/5">
              <View className="flex-row items-center justify-between mb-8">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-2xl bg-yellow-400/10 items-center justify-center">
                    <Award size={20} color="#eab308" />
                  </View>
                  <Text className="ml-3 text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Conquistas</Text>
                </View>
                <View className="bg-gray-50 dark:bg-black/20 px-3 py-1 rounded-full">
                  <Text className="text-[9px] font-black text-gray-400 uppercase">0 Total</Text>
                </View>
              </View>

              <View className="flex-row flex-wrap gap-5 justify-center">
                 {[1, 2, 3, 4, 5].map((i) => (
                   <View key={i} className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-2xl items-center justify-center border border-gray-100 dark:border-white/5 opacity-30">
                     <Star size={24} color={isDark ? '#333' : '#ddd'} />
                   </View>
                 ))}
              </View>
            </View>

            <View className="bg-white dark:bg-[#1a1a1a] rounded-[40px] p-8 shadow-sm border border-gray-100 dark:border-white/5">
              <View className="flex-row items-center mb-8">
                <View className="w-10 h-10 rounded-2xl bg-red-400/10 items-center justify-center">
                   <Trophy size={20} color="#ef4444" />
                </View>
                <Text className="ml-3 text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Resultados</Text>
              </View>
              <View className="items-center py-6">
                <Text className="text-gray-400 font-bold text-sm text-center uppercase tracking-widest opacity-50">Nenhum teste físico registrado.</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
