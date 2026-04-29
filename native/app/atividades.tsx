import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight, User, Clock, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../src/services/firebase';
import { useAuth } from '../src/context/AuthContext';

export default function AtividadesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { userData } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activities, setActivities] = useState<any[]>([]);

  const unitId = userData?.unitId || userData?.unidadeId || 'centro';

  const fetchActivities = async (date: Date) => {
    setLoading(true);
    try {
      const getActivitiesSchedule = httpsCallable(functions, 'getActivitiesSchedule');
      const dateString = date.toISOString().split('T')[0];
      const result: any = await getActivitiesSchedule({ unitId, date: dateString });
      
      const sorted = (result.data || []).sort((a: any, b: any) => 
        (a.startTime > b.startTime) ? 1 : -1
      );
      setActivities(sorted);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities(currentDate);
  }, [currentDate, unitId]);

  const changeDate = (days: number) => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + days);
    setCurrentDate(next);
  };

  const formattedDate = currentDate.toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });

  return (
    <View className="flex-1 bg-gray-50 dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View 
        style={{ paddingTop: insets.top || 50 }}
        className="bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-white/5"
      >
        <View className="flex-row items-center px-6 pb-4 pt-2">
          <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 -ml-2">
            <ArrowLeft size={24} color={isDark ? '#fff' : '#333'} />
          </TouchableOpacity>
          <Text className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Atividades</Text>
        </View>
      </View>

      {/* Date Selector */}
      <View className="bg-white dark:bg-[#1a1a1a] p-4 flex-row items-center justify-between border-b border-gray-100 dark:border-white/5">
        <TouchableOpacity onPress={() => changeDate(-1)} className="p-2 bg-gray-50 dark:bg-white/5 rounded-xl">
          <ChevronLeft size={20} color={isDark ? '#fff' : '#333'} />
        </TouchableOpacity>
        <Text className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
          {formattedDate}
        </Text>
        <TouchableOpacity onPress={() => changeDate(1)} className="p-2 bg-gray-50 dark:bg-white/5 rounded-xl">
          <ChevronRight size={20} color={isDark ? '#fff' : '#333'} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 50 }}>
        {loading ? (
          <View className="items-center justify-center mt-20">
            <ActivityIndicator color="#eab308" size="large" />
          </View>
        ) : activities.length > 0 ? (
          activities.map((activity, idx) => (
            <View 
              key={idx}
              className="bg-white dark:bg-[#1a1a1a] p-5 rounded-3xl mb-4 border border-gray-100 dark:border-white/5 shadow-sm"
            >
              <View className="flex-row justify-between items-start mb-3">
                <Text className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter flex-1 mr-4">
                  {activity.name}
                </Text>
                <View className="bg-yellow-500/10 px-3 py-1.5 rounded-full">
                  <Text className="text-[#eab308] text-[10px] font-black uppercase tracking-widest">
                    {activity.startTime}
                  </Text>
                </View>
              </View>

              <View className="space-y-2">
                <View className="flex-row items-center">
                  <User size={14} color="#999" />
                  <Text className="text-xs text-gray-500 dark:text-gray-400 ml-2 font-bold uppercase">
                    Instrutor: <Text className="text-gray-900 dark:text-gray-200">{activity.instructor?.name || 'Não informado'}</Text>
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Clock size={14} color="#999" />
                  <Text className="text-xs text-gray-500 dark:text-gray-400 ml-2 font-bold">
                    Horário: <Text className="text-gray-900 dark:text-gray-200">{activity.startTime} - {activity.endTime}</Text>
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Users size={14} color="#999" />
                  <Text className="text-xs text-gray-500 dark:text-gray-400 ml-2 font-bold">
                    Vagas: <Text className="text-gray-900 dark:text-gray-200">{activity.capacity - activity.ocupation} / {activity.capacity}</Text>
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity 
                disabled={activity.capacity - activity.ocupation <= 0}
                className={`mt-6 py-3.5 rounded-2xl items-center ${activity.capacity - activity.ocupation > 0 ? 'bg-[#014fa4]' : 'bg-gray-200 dark:bg-white/5'}`}
              >
                <Text className={`font-black uppercase tracking-widest text-[10px] ${activity.capacity - activity.ocupation > 0 ? 'text-white' : 'text-gray-400'}`}>
                  {activity.capacity - activity.ocupation > 0 ? 'Reservar Vaga' : 'Esgotado'}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View className="items-center justify-center mt-20">
            <Text className="text-gray-400 font-bold">Nenhuma atividade para este dia.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
