import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image, useWindowDimensions, Linking } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, User, Calendar, BookOpen, Video, ExternalLink } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../src/services/firebase';
import RenderHtml from 'react-native-render-html';
import { WebView } from 'react-native-webview';

function getYouTubeVideoId(url: string) {
  if (!url) return null;
  try {
    if (url.includes('youtu.be/')) {
      return url.split('youtu.be/')[1]?.split('?')[0];
    }
    if (url.includes('youtube.com/watch')) {
      const searchParams = url.split('?')[1];
      const params = new URLSearchParams(searchParams);
      return params.get('v');
    }
    if (url.includes('youtube.com/embed/')) {
      return url.split('youtube.com/embed/')[1]?.split('?')[0];
    }
  } catch (e) {
    console.error('Error parsing YouTube URL:', e);
  }
  return null;
}

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
      fontSize: 15,
      lineHeight: 24,
    },
    p: { marginBottom: 14 },
    strong: { fontWeight: 'bold', color: isDark ? '#fff' : '#000' },
    h1: { fontSize: 22, fontWeight: '900', marginBottom: 14, color: isDark ? '#fff' : '#000' },
    h2: { fontSize: 18, fontWeight: '800', marginBottom: 12, color: isDark ? '#fff' : '#000' },
    h3: { fontSize: 16, fontWeight: '700', marginBottom: 10, color: isDark ? '#fff' : '#000' },
    a: { color: '#eab308', textDecorationLine: 'underline' },
    img: { borderRadius: 16, marginVertical: 12 },
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
        <Text className="text-gray-400 font-bold text-center mb-4">Conteúdo não encontrado.</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-[#014fa4] px-6 py-3 rounded-2xl">
          <Text className="text-white font-bold">Voltar ao Tatame</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Delta to HTML conversion with Image and List support
  let htmlContent = '';
  if (article.content && article.content.ops) {
    htmlContent = article.content.ops.map((op: any) => {
      if (!op.insert) return '';
      
      // Handle embedded images in Quill Delta
      if (typeof op.insert === 'object' && op.insert.image) {
        return `<img src="${op.insert.image}" style="max-width:100%; border-radius:16px; margin: 12px 0;" />`;
      }
      
      let text = typeof op.insert === 'string' ? op.insert : '';
      if (!text) return '';

      // Escape basic HTML special chars in raw text
      text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      if (op.attributes?.bold) text = `<strong>${text}</strong>`;
      if (op.attributes?.italic) text = `<em>${text}</em>`;
      if (op.attributes?.underline) text = `<u>${text}</u>`;
      if (op.attributes?.link) text = `<a href="${op.attributes.link}">${text}</a>`;
      if (op.attributes?.header === 1) text = `<h1>${text}</h1>`;
      if (op.attributes?.header === 2) text = `<h2>${text}</h2>`;
      if (op.attributes?.header === 3) text = `<h3>${text}</h3>`;
      return text.replace(/\n/g, '<br/>');
    }).join('');
  } else if (typeof article.content === 'string') {
    htmlContent = article.content;
  }

  const youtubeVideoId = article.youtubeUrl ? getYouTubeVideoId(article.youtubeUrl) : null;
  const hasImage = article.heroImageUrl && article.heroImageUrl.startsWith('http');

  return (
    <View className="flex-1 bg-white dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Top Bar Header */}
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
        
        {/* Article Meta Header */}
        <View className="mb-6">
          <View className="flex-row items-center mb-3">
            <View className="bg-yellow-500/10 px-2.5 py-1 rounded-lg border border-yellow-500/20 mr-2 flex-row items-center">
              <BookOpen size={12} color="#eab308" />
              <Text className="text-[10px] font-extrabold text-amber-500 uppercase ml-1">Tatame KIHAP</Text>
            </View>
            {youtubeVideoId && (
              <View className="bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 flex-row items-center">
                <Video size={12} color="#ef4444" />
                <Text className="text-[10px] font-black text-red-500 uppercase ml-1">Vídeo</Text>
              </View>
            )}
          </View>

          <Text className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white leading-tight mb-4 tracking-tight">
            {article.title}
          </Text>
          
          <View className="flex-row items-center space-x-3">
            <View className="flex-row items-center bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-full">
              <User size={12} color="#999" />
              <Text className="text-[10px] text-gray-400 font-bold ml-1.5 uppercase">{article.author || 'Equipe KIHAP'}</Text>
            </View>
            <View className="flex-row items-center bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-full">
              <Calendar size={12} color="#999" />
              <Text className="text-[10px] text-gray-400 font-bold ml-1.5">
                {article.createdAt?.toDate ? article.createdAt.toDate().toLocaleDateString('pt-BR') : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Hero Banner Image */}
        {hasImage ? (
          <View className="w-full h-56 rounded-3xl overflow-hidden mb-6 bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/5">
            <Image 
              source={{ uri: article.heroImageUrl }} 
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>
        ) : null}

        {/* YouTube Video Player Embed */}
        {youtubeVideoId ? (
          <View className="w-full mb-6">
            <View className="w-full h-56 rounded-3xl overflow-hidden bg-black shadow-md border border-gray-100 dark:border-white/5">
              <WebView
                style={{ flex: 1 }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsFullscreenVideo={true}
                source={{ uri: `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=0&rel=0` }}
              />
            </View>

            {/* Direct Open Button as Fallback */}
            <TouchableOpacity 
              onPress={() => Linking.openURL(article.youtubeUrl)}
              className="mt-2.5 flex-row items-center justify-center bg-red-500/10 dark:bg-red-500/20 py-2.5 px-4 rounded-2xl border border-red-500/20"
            >
              <Video size={14} color="#ef4444" />
              <Text className="text-xs font-bold text-red-500 dark:text-red-400 ml-2">Abrir Vídeo no App do YouTube</Text>
              <ExternalLink size={12} color="#ef4444" className="ml-1.5" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Main Article Text Body */}
        <View className="pb-24 pt-2">
          {htmlContent ? (
            <RenderHtml
              contentWidth={width - 48}
              source={{ html: `<body>${htmlContent}</body>` }}
              tagsStyles={tagsStyles as any}
            />
          ) : (
            <Text className="text-gray-400 italic">Sem texto adicional registrado.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
