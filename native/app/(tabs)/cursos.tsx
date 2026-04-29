import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Image } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { BookOpen, Play, Clock, Star } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useAuth } from '../../src/context/AuthContext';

export default function CursosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [myCourses, setMyCourses] = useState<any[]>([]);

  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    const fetchCourses = async () => {
      if (!user) return;
      try {
        setLoading(true);
        console.log("Cursos: Fetching for user", user.uid);
        
        // 1. Fetch user subscriptions
        let subIds: string[] = [];
        try {
          const subQuery = query(collection(db, `users/${user.uid}/subscriptions`));
          const subSnapshot = await getDocs(subQuery);
          subIds = subSnapshot.docs.map(doc => doc.data().courseId);
          console.log("Cursos: Subscriptions found:", subIds.length);
        } catch (e) {
          console.error("Cursos: Error fetching subs:", e);
        }

        // 2. Fetch all courses (Try 'courses' then 'cursos')
        let snap = await getDocs(query(collection(db, "courses")));
        console.log("Cursos: 'courses' collection size:", snap.size);
        
        if (snap.empty) {
          console.log("Cursos: 'courses' empty, trying 'cursos'...");
          snap = await getDocs(query(collection(db, "cursos")));
          console.log("Cursos: 'cursos' collection size:", snap.size);
        }

        if (snap.empty) {
          setDebugInfo('Nenhum curso encontrado em "courses" ou "cursos".');
        }

        const docs = snap.docs.map(doc => {
          const data = doc.data();
          const courseId = doc.id;
          
          // Access logic:
          // 1. If it's in the subIds list (explicit subscription)
          // 2. If it's NOT a subscription (isSubscription is not true)
          // 3. If it's marked as free
          const hasSubscription = subIds.includes(courseId);
          const isPremium = data.isSubscription === true;
          const isFree = data.free === true;
          
          return { 
            id: courseId, 
            ...data,
            hasAccess: hasSubscription || !isPremium || isFree
          };
        });

        console.log("Cursos: Final count with access:", docs.filter(d => d.hasAccess).length);
        setDebugInfo(`User: ${user.uid.substring(0,5)} | Subs: ${subIds.length} | Courses: ${docs.length}`);
        setMyCourses(docs);
      } catch (error: any) {
        console.error("Error fetching courses:", error);
        setDebugInfo('Erro: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [user]);

  const renderCourse = ({ item }: { item: any }) => (
    <TouchableOpacity 
      onPress={() => {
        if (item.hasAccess) {
          router.push(`/player?courseId=${item.id}`);
        } else {
          alert("Este é um curso Premium. Assine na plataforma para liberar.");
        }
      }}
      className={`bg-white dark:bg-[#1a1a1a] rounded-3xl mb-6 overflow-hidden border border-gray-100 dark:border-white/5 shadow-sm active:opacity-90 ${!item.hasAccess ? 'opacity-60' : ''}`}
    >
      <Image 
        source={{ uri: item.thumbnailURL || item.thumbnail || 'https://kihap.com.br/wp-content/uploads/2021/02/logo-wh.png' }} 
        className="w-full h-48 bg-gray-100 dark:bg-[#050505]"
        resizeMode="cover"
      />
      <View className="p-5">
        <View className="flex-row items-center mb-2">
          {item.isSubscription && !item.hasAccess && (
            <View className="bg-yellow-500 px-2 py-1 rounded-md mr-2">
              <Text className="text-black text-[9px] font-black uppercase tracking-widest">Premium</Text>
            </View>
          )}
          <View className="bg-blue-500/10 px-2 py-1 rounded-md mr-2">
            <Text className="text-blue-500 text-[9px] font-black uppercase tracking-widest">{item.category || 'Curso'}</Text>
          </View>
        </View>
        
        <Text className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-2">
          {item.title}
        </Text>
        
        <Text className="text-gray-500 dark:text-gray-400 text-xs mb-6 leading-relaxed" numberOfLines={2}>
          {item.description || 'Aprenda as técnicas mais avançadas com os nossos mestres.'}
        </Text>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Clock size={14} color="#999" />
            <Text className="text-[10px] text-gray-400 font-bold ml-1.5 uppercase">{item.author || 'Mestre Kihap'}</Text>
          </View>
          <View className={`${item.hasAccess ? 'bg-[#014fa4]' : 'bg-gray-400'} px-5 py-2.5 rounded-2xl flex-row items-center`}>
            <Text className="text-white font-black uppercase tracking-widest text-[9px] mr-2">
              {item.hasAccess ? 'Assistir' : 'Bloqueado'}
            </Text>
            <Play size={10} color="white" fill="white" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-gray-50 dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View 
        style={{ paddingTop: insets.top || 50 }}
        className="bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-white/5"
      >
        <View className="px-6 pb-4 pt-2">
          <Text className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Meus Cursos</Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#eab308" size="large" />
        </View>
      ) : (
        <FlatList
          data={myCourses}
          keyExtractor={(item) => item.id}
          renderItem={renderCourse}
          contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="items-center justify-center mt-20">
              <Text className="text-gray-400 font-bold">Você ainda não tem cursos liberados.</Text>
              {debugInfo ? <Text className="text-[8px] text-gray-500 mt-4 opacity-30">{debugInfo}</Text> : null}
            </View>
          }
        />
      )}
    </View>
  );
}