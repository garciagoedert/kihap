import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Image } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, BookOpen, User, Calendar, Video, FileText } from 'lucide-react-native';
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
    
    // Extract plain text summary
    let summary = '';
    if (item.content && item.content.ops) {
      summary = item.content.ops.map((op: any) => typeof op.insert === 'string' ? op.insert : '').join('').trim();
    } else if (typeof item.content === 'string') {
      summary = item.content;
    }
    if (summary.length > 120) summary = summary.substring(0, 120) + '...';

    const hasImage = item.heroImageUrl && item.heroImageUrl.startsWith('http');
    const hasVideo = !!item.youtubeUrl;

    return (
      <TouchableOpacity 
        onPress={() => router.push(`/user/tatame/${item.id}`)}
        className="bg-white dark:bg-[#1a1a1a] rounded-3xl mb-5 border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden active:opacity-90 flex-col"
      >
        {/* Card Banner Image if available */}
        {hasImage ? (
          <View className="w-full h-44 bg-gray-100 dark:bg-white/5 relative">
            <Image 
              source={{ uri: item.heroImageUrl }} 
              className="w-full h-full"
              resizeMode="cover"
            />
            {hasVideo && (
              <View className="absolute top-3 right-3 bg-red-600 px-2.5 py-1 rounded-xl flex-row items-center shadow-sm">
                <Video size={12} color="#ffffff" />
                <Text className="text-[10px] font-black text-white ml-1 uppercase">Vídeo</Text>
              </View>
            )}
          </View>
        ) : null}

        <View className="p-5">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-xl bg-yellow-500/10 items-center justify-center mr-2.5">
                <BookOpen size={16} color="#eab308" />
              </View>
              <Text className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider">Tatame KIHAP</Text>
            </View>
            
            {!hasImage && hasVideo && (
              <View className="bg-red-500/10 px-2 py-0.5 rounded-lg flex-row items-center border border-red-500/20">
                <Video size={10} color="#ef4444" />
                <Text className="text-[9px] font-black text-red-500 ml-1 uppercase">Vídeo</Text>
              </View>
            )}
          </View>

          <Text className="text-gray-900 dark:text-white font-black text-base leading-snug tracking-tight mb-2" numberOfLines={2}>
            {item.title}
          </Text>

          <Text className="text-gray-500 dark:text-gray-400 text-xs mb-4 leading-relaxed" numberOfLines={2}>
            {summary || 'Clique para visualizar o conteúdo completo.'}
          </Text>

          <View className="flex-row items-center justify-between pt-3 border-t border-gray-100 dark:border-white/5">
            <View className="flex-row items-center">
              <User size={12} color="#999" />
              <Text className="text-[10px] text-gray-400 font-bold ml-1 uppercase">{item.author || 'Equipe KIHAP'}</Text>
            </View>
            <View className="flex-row items-center">
              <Calendar size={12} color="#999" />
              <Text className="text-[10px] text-gray-400 font-bold ml-1">{date}</Text>
            </View>
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
          contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
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
