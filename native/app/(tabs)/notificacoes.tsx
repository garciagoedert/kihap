import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { Heart, Award, CreditCard, MessageCircle, Bell, CheckCheck } from 'lucide-react-native';

export default function NotificacoesScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const filters = [
    { id: 'all', label: 'Tudo' },
    { id: 'system', label: 'Sistema' },
    { id: 'conversas', label: 'Conversas' },
    { id: 'eventos', label: 'Eventos' },
  ];

  useEffect(() => {
    if (!user) return;

    const notifsCollection = collection(db, 'notifications');
    const q = query(
      notifsCollection,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifList = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setNotifications(notifList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notifications:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'chat': return MessageCircle;
      case 'award': return Award;
      case 'payment': return CreditCard;
      default: return Bell;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'chat': return '#014fa4';
      case 'award': return '#eab308';
      case 'payment': return '#22c55e';
      default: return '#666';
    }
  };

  const filteredNotifs = notifications.filter(n => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'system') return ['admin', 'system'].includes(n.type);
    if (activeFilter === 'conversas') return n.type === 'chat';
    if (activeFilter === 'eventos') return n.type === 'event';
    return true;
  });

  return (
    <View style={{ flex: 1, paddingTop: insets.top }} className="flex-1 bg-white dark:bg-[#0a0a0a]">
      <View className="px-6 pt-8 pb-4">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Atividade</Text>
          <TouchableOpacity className="flex-row items-center bg-blue-500/5 px-4 py-2 rounded-full active:bg-blue-500/10">
            <CheckCheck size={14} color="#3b82f6" />
            <Text className="text-[10px] font-black text-[#3b82f6] ml-2 uppercase">Lidas</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
          {filters.map((filter) => (
            <TouchableOpacity 
              key={filter.id}
              onPress={() => setActiveFilter(filter.id)}
              className={`px-6 py-2.5 rounded-full border mr-2 ${
                activeFilter === filter.id 
                  ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white shadow-md' 
                  : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-gray-800'
              }`}
            >
              <Text className={`text-sm font-bold ${
                activeFilter === filter.id 
                  ? 'text-white dark:text-black' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#eab308" />
        </View>
      ) : (
        <FlatList
          data={filteredNotifs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => {
            const IconComp = getIcon(item.type);
            const color = getColor(item.type);
            
            return (
              <TouchableOpacity className={`flex-row items-start px-6 py-4 active:bg-gray-50 dark:active:bg-white/5 ${!item.read ? 'bg-blue-50/20 dark:bg-blue-500/5' : ''}`}>
                <View className="relative">
                  <View className="w-12 h-12 rounded-full items-center justify-center bg-gray-50 dark:bg-white/10" style={{ backgroundColor: `${color}15` }}>
                    <IconComp size={22} color={color} />
                  </View>
                  {!item.read && (
                    <View className="absolute top-0 right-0 w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-[#0a0a0a]" />
                  )}
                </View>
                <View className="flex-1 ml-4 border-b border-gray-50 dark:border-white/5 pb-4">
                  <View className="flex-row justify-between items-start mb-1">
                    <Text className={`text-[15px] text-gray-900 dark:text-white flex-1 ${!item.read ? 'font-black' : 'font-bold'}`}>{item.title}</Text>
                    <Text className="text-[11px] text-gray-400 font-bold ml-2">Agora</Text>
                  </View>
                  <Text className="text-[14px] text-gray-500 dark:text-gray-400 leading-snug" numberOfLines={2}>{item.message}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-20 px-8">
              <Text className="text-gray-400 text-center font-medium">Nenhuma atividade nesta categoria.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}