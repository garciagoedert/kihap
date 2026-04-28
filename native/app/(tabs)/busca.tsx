import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Search, ChevronRight } from 'lucide-react-native';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useRouter } from 'expo-router';

export default function BuscaScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const filters = [
    { id: 'all', label: 'Todos' },
    { id: 'Instrutor', label: 'Instrutores' },
    { id: 'Preta', label: 'Faixas Pretas' },
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, activeFilter, allUsers]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'users'), limit(100));
      const snap = await getDocs(q);
      const usersData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const term = searchQuery.toLowerCase().trim();
    
    if (!term && activeFilter === 'all') {
      const suggested = allUsers.filter(u => 
        u.isCharacter === true || (u.name && u.name.toLowerCase().includes('kobe'))
      );
      setFilteredUsers(suggested);
      return;
    }

    const filtered = allUsers.filter(u => {
      const name = (u.name || u.displayName || "").toLowerCase();
      const unit = (u.unidade || u.unit || "").toLowerCase();
      const belt = (u.belt || "").toLowerCase();
      
      const matchesTerm = name.includes(term) || unit.includes(term) || belt.includes(term);
      
      if (activeFilter === 'all') return matchesTerm;
      if (activeFilter === 'Instrutor') return matchesTerm && (u.isInstructor === true || u.isAdmin === true);
      if (activeFilter === 'Preta') return matchesTerm && belt.includes('preta');
      return matchesTerm;
    });

    setFilteredUsers(filtered);
  };

  const normalizePhoto = (photo: string) => {
    if (!photo) return 'https://kihap.com.br/intranet/default-profile.svg';
    if (photo.startsWith('/')) return `https://kihap.com.br${photo}`;
    return photo;
  };

  const renderItem = ({ item }: { item: any }) => {
    const isStaff = item.isInstructor === true || item.isAdmin === true;
    const photo = normalizePhoto(item.photoURL || item.profilePicture || item.photoUrl);

    return (
      <TouchableOpacity 
        onPress={() => router.push(`/user/${item.id}`)}
        className="bg-white dark:bg-[#1a1a1a] p-4 rounded-3xl flex-row items-center justify-between border border-gray-100 dark:border-white/5 mb-4 shadow-sm active:bg-gray-50 dark:active:bg-white/10"
      >
        <View className="flex-row items-center flex-1">
          <View className="relative">
            <Image 
              source={{ uri: photo }} 
              className="w-12 h-12 rounded-full border border-gray-200 dark:border-white/10 object-cover"
            />
            <View className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-[#1a1a1a] rounded-full" />
          </View>
          
          <View className="ml-4 flex-1">
            <View className="flex-row items-center flex-wrap">
              <Text className="font-bold text-[14px] text-gray-900 dark:text-white mr-2" numberOfLines={1}>
                {item.name || item.displayName || 'Usuário Kihap'}
              </Text>
              {isStaff && (
                <View className="bg-[#014fa4]/10 px-1.5 py-0.5 rounded border border-[#014fa4]/20 mr-1">
                  <Text className="text-[#014fa4] dark:text-[#58a6ff] text-[8px] font-black uppercase">Instrutor</Text>
                </View>
              )}
              {item.isCharacter && (
                <View className="bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">
                  <Text className="text-yellow-600 dark:text-yellow-400 text-[8px] font-black uppercase">Mascote</Text>
                </View>
              )}
            </View>
            <View className="flex-row items-center mt-0.5">
              <Text className="text-[10px] text-gray-500 uppercase font-black tracking-tighter">{item.belt || 'Membro'}</Text>
              <Text className="text-[10px] text-gray-400 mx-1.5">•</Text>
              <Text className="text-[10px] text-gray-500 font-medium truncate flex-1">{item.unidade || item.unit || 'Kihap Unit'}</Text>
            </View>
          </View>
        </View>
        <ChevronRight size={16} color={isDark ? '#444' : '#ccc'} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top }} className="flex-1 bg-white dark:bg-[#0a0a0a]">
      <View className="px-6 pt-6 pb-2">
        <Text className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 uppercase tracking-tighter">Descobrir</Text>
        <Text className="text-gray-500 text-sm font-medium mb-6">Encontre instrutores e membros da Kihap.</Text>

        <View className="mb-6">
          <View className="flex-row items-center bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/5 rounded-2xl py-4 px-5 shadow-sm">
            <Search size={20} color={isDark ? '#666' : '#999'} />
            <TextInput 
              placeholder="Buscar por nome, unidade ou faixa..." 
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 ml-3 text-[16px] font-medium text-gray-900 dark:text-white"
            />
          </View>
        </View>

        <View className="flex-row mb-6 space-x-2">
          {filters.map((filter) => (
            <TouchableOpacity 
              key={filter.id}
              onPress={() => setActiveFilter(filter.id)}
              className={`px-5 py-2.5 rounded-full border ${
                activeFilter === filter.id 
                  ? 'bg-[#014fa4] border-[#014fa4]' 
                  : 'bg-white dark:bg-white/5 border-gray-100 dark:border-transparent shadow-sm'
              }`}
            >
              <Text className={`text-[11px] font-black uppercase tracking-widest ${activeFilter === filter.id ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#eab308" size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
          ListEmptyComponent={() => (
            <View className="items-center justify-center py-20">
              <Text className="text-gray-400 font-medium">Nenhum membro encontrado.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}