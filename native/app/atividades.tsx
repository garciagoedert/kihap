import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight, User, Clock, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../src/context/AuthContext';
import { db } from '../src/services/firebase';
import { collection, query, where, doc, getDoc, updateDoc, setDoc, arrayUnion, onSnapshot } from 'firebase/firestore';

export default function AtividadesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, userData } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activities, setActivities] = useState<any[]>([]);
  const [instances, setInstances] = useState<Record<string, any>>({});
  const [loadingSubmit, setLoadingSubmit] = useState<Record<string, boolean>>({});

  const unitId = userData?.unitId || userData?.unidadeId || 'centro';

  useEffect(() => {
    setLoading(true);
    const templatesRef = collection(db, 'classTemplates');
    const q = query(templatesRef, where('unitId', '==', unitId));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const dayOfWeek = currentDate.getDay();
      const templatesList: any[] = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.daysOfWeek && data.daysOfWeek.includes(dayOfWeek)) {
          templatesList.push({ id: docSnap.id, ...data });
        }
      });
      
      // Sort by time
      templatesList.sort((a, b) => (a.time > b.time ? 1 : -1));
      setActivities(templatesList);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to class templates:", error);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [currentDate, unitId]);

  // Subscribe to class instances in real-time
  useEffect(() => {
    const dateString = currentDate.toISOString().split('T')[0];
    const instancesRef = collection(db, 'classInstances');
    const q = query(instancesRef, where('unitId', '==', unitId), where('date', '==', dateString));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Record<string, any> = {};
      snapshot.forEach(docSnap => {
        data[docSnap.data().templateId] = { id: docSnap.id, ...docSnap.data() };
      });
      setInstances(data);
    }, (error) => {
      console.error("Error listening to class instances:", error);
    });
    
    return () => unsubscribe();
  }, [currentDate, unitId]);

  const changeDate = (days: number) => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + days);
    setCurrentDate(next);
  };

  const updateStreak = async () => {
    if (!user) return;
    
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) return;
    
    const data = userDoc.data();
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const lastDateStr = data.lastAttendanceDate;
    let currentStreak = data.currentStreak || 0;
    let longestStreak = data.longestStreak || 0;
    
    if (lastDateStr === todayStr) {
      return; // Already checked in today
    }
    
    if (!lastDateStr) {
      currentStreak = 1;
    } else {
      const lastDate = new Date(lastDateStr + 'T12:00:00');
      const todayDate = new Date(todayStr + 'T12:00:00');
      const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 5) {
        currentStreak += 1;
      } else {
        currentStreak = 1;
      }
    }
    
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
    
    await updateDoc(userRef, {
      currentStreak,
      longestStreak,
      lastAttendanceDate: todayStr
    });
  };

  const handleConfirmPresence = async (activity: any) => {
    const studentId = userData?.evoMemberId;
    if (!studentId) {
      Alert.alert('Erro', 'Cadastro do aluno incompleto (ID do membro não encontrado).');
      return;
    }
    
    const dateString = currentDate.toISOString().split('T')[0];
    const instanceId = `${activity.id}_${dateString}`;
    const instanceRef = doc(db, 'classInstances', instanceId);
    
    setLoadingSubmit(prev => ({ ...prev, [activity.id]: true }));
    try {
      const instanceDoc = await getDoc(instanceRef);
      const studentIdToSave = studentId.toString();
      
      if (instanceDoc.exists()) {
        await updateDoc(instanceRef, {
          presentStudents: arrayUnion(studentIdToSave)
        });
      } else {
        await setDoc(instanceRef, {
          templateId: activity.id,
          date: dateString,
          unitId: unitId,
          presentStudents: [studentIdToSave]
        });
      }
      
      await updateStreak();
      
      Alert.alert('Sucesso', 'Presença confirmada com sucesso! 🔥');
    } catch (err) {
      console.error("Erro ao confirmar presença:", err);
      Alert.alert('Erro', 'Não foi possível confirmar presença.');
    } finally {
      setLoadingSubmit(prev => ({ ...prev, [activity.id]: false }));
    }
  };
  
  const handleEnrollClass = async (activityId: string) => {
    const studentId = userData?.evoMemberId;
    if (!studentId) {
      Alert.alert('Erro', 'Cadastro do aluno incompleto (ID do membro não encontrado).');
      return;
    }
    
    setLoadingSubmit(prev => ({ ...prev, [activityId]: true }));
    try {
      const templateRef = doc(db, 'classTemplates', activityId);
      await updateDoc(templateRef, {
        students: arrayUnion(studentId.toString())
      });
      Alert.alert('Sucesso', 'Inscrição realizada com sucesso! Agora você já pode confirmar sua presença. 🔥');
    } catch (err) {
      console.error("Erro ao se inscrever na turma:", err);
      Alert.alert('Erro', 'Não foi possível realizar a inscrição.');
    } finally {
      setLoadingSubmit(prev => ({ ...prev, [activityId]: false }));
    }
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
        <View className="flex-row items-center justify-between px-6 pb-4 pt-2">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 -ml-2">
              <ArrowLeft size={24} color={isDark ? '#fff' : '#333'} />
            </TouchableOpacity>
            <Text className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Atividades</Text>
          </View>
          
          {userData?.currentStreak > 0 && (
            <View className="flex-row items-center bg-orange-500/10 px-3 py-1.5 rounded-full border border-orange-500/20 animate-pulse">
              <Text className="text-orange-550 text-sm font-extrabold mr-1">🔥 {userData.currentStreak}</Text>
              <Text className="text-orange-500 text-[9px] font-black uppercase tracking-wider">Ofensiva</Text>
            </View>
          )}
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
          activities.map((activity, idx) => {
            const instance = instances[activity.id];
            const presentStudents = instance ? instance.presentStudents || [] : [];
            const occupation = presentStudents.length;
            const capacity = activity.capacity || (activity.students ? activity.students.length : 20);
            
            const studentId = userData?.evoMemberId;
            const isPresent = studentId && (presentStudents.includes(studentId.toString()) || presentStudents.includes(Number(studentId)));
            const isEnrolled = studentId && activity.students && (activity.students.includes(studentId.toString()) || activity.students.includes(Number(studentId)));
            
            const isToday = currentDate.toDateString() === new Date().toDateString();
            const isLoadingSubmit = loadingSubmit[activity.id] || false;

            return (
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
                      {activity.time}
                    </Text>
                  </View>
                </View>

                <View className="space-y-2">
                  <View className="flex-row items-center">
                    <User size={14} color="#999" />
                    <Text className="text-xs text-gray-500 dark:text-gray-400 ml-2 font-bold uppercase">
                      Instrutor: <Text className="text-gray-900 dark:text-gray-200">{activity.teacherName || 'Não informado'}</Text>
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Clock size={14} color="#999" />
                    <Text className="text-xs text-gray-500 dark:text-gray-400 ml-2 font-bold">
                      Duração: <Text className="text-gray-900 dark:text-gray-200">{activity.duration} minutos</Text>
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Users size={14} color="#999" />
                    <Text className="text-xs text-gray-500 dark:text-gray-400 ml-2 font-bold">
                      Vagas Preenchidas: <Text className="text-gray-900 dark:text-gray-200">{occupation} / {capacity}</Text>
                    </Text>
                  </View>
                </View>
                
                {isPresent ? (
                  <View className="mt-6 py-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl items-center justify-center flex-row space-x-1.5">
                    <Text className="text-emerald-550 font-black uppercase tracking-widest text-[10px]">
                      Presença Confirmada ✔
                    </Text>
                  </View>
                ) : !isEnrolled ? (
                  <TouchableOpacity 
                    onPress={() => handleEnrollClass(activity.id)}
                    disabled={isLoadingSubmit}
                    className="mt-6 py-3.5 rounded-2xl items-center justify-center bg-[#eab308]"
                  >
                    {isLoadingSubmit ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text className="font-black uppercase tracking-widest text-[10px] text-gray-900">
                        Inscrever-se na Turma
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : !isToday ? (
                  <View className="mt-6 py-3.5 bg-gray-100 dark:bg-white/5 rounded-2xl items-center justify-center">
                    <Text className="text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest text-[10px]">
                      Check-in indisponível (Apenas hoje)
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    onPress={() => handleConfirmPresence(activity)}
                    disabled={isLoadingSubmit || (capacity - occupation <= 0)}
                    className={`mt-6 py-3.5 rounded-2xl items-center justify-center ${capacity - occupation > 0 ? 'bg-[#014fa4]' : 'bg-gray-200 dark:bg-white/5'}`}
                  >
                    {isLoadingSubmit ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text className={`font-black uppercase tracking-widest text-[10px] ${capacity - occupation > 0 ? 'text-white' : 'text-gray-400'}`}>
                        {capacity - occupation > 0 ? 'Confirmar Presença' : 'Esgotado'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        ) : (
          <View className="items-center justify-center mt-20">
            <Text className="text-gray-400 font-bold">Nenhuma atividade para este dia.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
