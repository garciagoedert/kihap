import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, User, Calendar, BookOpen } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../src/services/firebase';
import RenderHtml from 'react-native-render-html';

export default function TatameDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  
  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<any>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const docRef = doc(db, "tatame_conteudos", id as string);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setArticle({ id: snap.id, ...snap.data() });
        }
      } catch (error) {
        console.error("Error fetching article:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [id]);

  const tagsStyles = {
    body: {
      color: isDark ? '#e5e7eb' : '#374151',
      fontSize: 16,
      lineHeight: 26,
    },
    p: { marginBottom: 16 },
    strong: { fontWeight: 'bold', color: isDark ? '#fff' : '#000' },
    h1: { fontSize: 24, fontWeight: '900', marginBottom: 16, color: isDark ? '#fff' : '#000' },
    h2: { fontSize: 20, fontWeight: '800', marginBottom: 12, color: isDark ? '#fff' : '#000' },
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-[#050505] items-center justify-center">
        <ActivityIndicator color="#eab308" size="large" />
      </View>
    );
  }

  if (!article) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-[#050505] items-center justify-center p-10">
        <Text className="text-gray-400 font-bold text-center">Conteúdo não encontrado.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-[#014fa4] px-6 py-3 rounded-2xl">
          <Text className="text-white font-bold">Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Simple Delta to HTML conversion for basic text
  let htmlContent = '';
  if (article.content && article.content.ops) {
    htmlContent = article.content.ops.map((op: any) => {
      let text = op.insert;
      if (typeof text !== 'string') return '';
      if (op.attributes?.bold) text = `<strong>${text}</strong>`;
      if (op.attributes?.italic) text = `<em>${text}</em>`;
      if (op.attributes?.header === 1) text = `<h1>${text}</h1>`;
      if (op.attributes?.header === 2) text = `<h2>${text}</h2>`;
      return text.replace(/\n/g, '<br/>');
    }).join('');
  } else if (typeof article.content === 'string') {
    htmlContent = article.content;
  }

  return (
    <View className="flex-1 bg-white dark:bg-[#050505]">
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
          <Text className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter flex-1" numberOfLines={1}>
            {article.title}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
        <View className="mb-8">
          <Text className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-tight mb-4">
            {article.title}
          </Text>
          
          <View className="flex-row items-center space-x-6">
            <View className="flex-row items-center bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-full">
              <User size={12} color="#999" />
              <Text className="text-[10px] text-gray-400 font-bold ml-1.5 uppercase">{article.author || 'Mestre'}</Text>
            </View>
            <View className="flex-row items-center bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-full">
              <Calendar size={12} color="#999" />
              <Text className="text-[10px] text-gray-400 font-bold ml-1.5">
                {article.createdAt?.toDate ? article.createdAt.toDate().toLocaleDateString('pt-BR') : ''}
              </Text>
            </View>
          </View>
        </View>

        <View className="pb-20">
          <RenderHtml
            contentWidth={width - 48}
            source={{ html: `<body>${htmlContent}</body>` }}
            tagsStyles={tagsStyles as any}
          />
        </View>
      </ScrollView>
    </View>
  );
}
