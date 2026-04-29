import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Image } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, BookOpen, User, Calendar, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../src/services/firebase';

export default function TatameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<any[]>([]);

  useEffect(() => {
    const fetchTatame = async () => {
      try {
        const q = query(collection(db, "tatame_conteudos"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setArticles(docs);
      } catch (error) {
        console.error("Error fetching tatame:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTatame();
  }, []);

  const renderArticle = ({ item }: { item: any }) => {
    const date = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('pt-BR') : '';
    
    // Extract plain text from Quill Delta if present
    let summary = '';
    if (item.content && item.content.ops) {
      summary = item.content.ops.map((op: any) => op.insert).join('').trim().substring(0, 100) + '...';
    } else if (typeof item.content === 'string') {
      summary = item.content.substring(0, 100) + '...';
    }

    return (
      <TouchableOpacity 
        onPress={() => router.push(`/user/tatame/${item.id}`)}
        className="bg-white dark:bg-[#1a1a1a] p-5 rounded-3xl mb-4 border border-gray-100 dark:border-white/5 shadow-sm active:opacity-90"
      >
        <View className="flex-row items-center mb-3">
          <View className="w-10 h-10 rounded-2xl bg-yellow-500/10 items-center justify-center">
            <BookOpen size={20} color="#eab308" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-gray-900 dark:text-white font-black text-lg leading-tight uppercase tracking-tighter" numberOfLines={1}>
              {item.title}
            </Text>
          </View>
        </View>

        <Text className="text-gray-500 dark:text-gray-400 text-xs mb-4 leading-relaxed" numberOfLines={2}>
          {summary || 'Nenhum conteúdo.'}
        </Text>

        <View className="flex-row items-center justify-between pt-4 border-t border-gray-50 dark:border-white/5">
          <View className="flex-row items-center">
            <User size={12} color="#999" />
            <Text className="text-[10px] text-gray-400 font-bold ml-1 uppercase">{item.author || 'Mestre'}</Text>
          </View>
          <View className="flex-row items-center">
            <Calendar size={12} color="#999" />
            <Text className="text-[10px] text-gray-400 font-bold ml-1">{date}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
          <Text className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Tatame</Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#eab308" size="large" />
        </View>
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(item) => item.id}
          renderItem={renderArticle}
          contentContainerStyle={{ padding: 24, paddingBottom: 50 }}
          ListEmptyComponent={
            <View className="items-center justify-center mt-20">
              <Text className="text-gray-400 font-bold">Nenhum conteúdo encontrado.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
