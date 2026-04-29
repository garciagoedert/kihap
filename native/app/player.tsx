import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, Play, FileText, ChevronDown, ChevronUp, Layers } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../src/services/firebase';
import RenderHtml from 'react-native-render-html';

export default function PlayerScreen() {
  const { courseId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<any>(null);
  const [currentModuleIdx, setCurrentModuleIdx] = useState(0);
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [expandedModules, setExpandedModules] = useState<number[]>([0]);

  useEffect(() => {
    const fetchCourse = async () => {
      if (!courseId) return;
      try {
        const docRef = doc(db, "courses", courseId as string);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setCourse({ id: snap.id, ...snap.data() });
        }
      } catch (error) {
        console.error("Error fetching course:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [courseId]);

  const toggleModule = (idx: number) => {
    if (expandedModules.includes(idx)) {
      setExpandedModules(expandedModules.filter(i => i !== idx));
    } else {
      setExpandedModules([...expandedModules, idx]);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-[#050505] items-center justify-center">
        <ActivityIndicator color="#eab308" size="large" />
      </View>
    );
  }

  if (!course) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-[#050505] items-center justify-center p-10">
        <Text className="text-gray-400 font-bold text-center">Curso não encontrado.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-[#014fa4] px-6 py-3 rounded-2xl">
          <Text className="text-white font-bold">Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentLesson = course.modules?.[currentModuleIdx]?.lessons?.[currentLessonIdx];

  const renderVideo = (url: string) => {
    let embedUrl = url;
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes('vimeo.com/')) {
      const videoId = url.split('/').pop();
      embedUrl = `https://player.vimeo.com/video/${videoId}`;
    }

    return (
      <View className="bg-black w-full aspect-video">
        <iframe 
          src={embedUrl} 
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </View>
    );
  };

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
            {course.title}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Content Player Area */}
        <View className="bg-gray-100 dark:bg-black">
          {currentLesson?.type === 'video' ? (
            renderVideo(currentLesson.content)
          ) : (
            <View className="p-8 min-h-[200px] items-center justify-center">
              <FileText size={48} color="#999" />
              <Text className="text-gray-400 mt-4 font-bold">Conteúdo em texto abaixo</Text>
            </View>
          )}
        </View>

        {/* Lesson Info */}
        <View className="px-6 py-4 border-b border-gray-100 dark:border-white/5">
          <Text className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-1">
            {currentLesson?.title || 'Selecione uma aula'}
          </Text>
          
          {currentLesson?.description ? (
            <View className="mt-2">
              <RenderHtml
                contentWidth={width - 48}
                source={{ html: currentLesson.description }}
                baseStyle={{
                  color: isDark ? '#9ca3af' : '#4b5563',
                  fontSize: 14,
                  lineHeight: 20,
                }}
              />
            </View>
          ) : null}
        </View>

        {/* Modules List */}
        <View className="p-6">
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-4">Conteúdo do Curso</Text>
          
          {(course.modules || []).map((module: any, mIdx: number) => (
            <View key={mIdx} className="mb-4">
              <TouchableOpacity 
                onPress={() => toggleModule(mIdx)}
                className="flex-row items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5"
              >
                <View className="flex-row items-center">
                  <Layers size={16} color="#eab308" />
                  <Text className="ml-3 font-black text-gray-900 dark:text-white uppercase tracking-tighter">{module.title}</Text>
                </View>
                {expandedModules.includes(mIdx) ? <ChevronUp size={16} color="#999" /> : <ChevronDown size={16} color="#999" />}
              </TouchableOpacity>

              {expandedModules.includes(mIdx) && (
                <View className="mt-2 space-y-2 pl-2">
                  {(module.lessons || []).map((lesson: any, lIdx: number) => {
                    const isActive = currentModuleIdx === mIdx && currentLessonIdx === lIdx;
                    return (
                      <TouchableOpacity 
                        key={lIdx}
                        onPress={() => {
                          setCurrentModuleIdx(mIdx);
                          setCurrentLessonIdx(lIdx);
                          // On mobile, scroll to top when changing lesson
                        }}
                        className={`flex-row items-center p-4 rounded-xl border ${isActive ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-transparent border-transparent'}`}
                      >
                        <View className={`w-6 h-6 rounded-full items-center justify-center ${isActive ? 'bg-yellow-500' : 'bg-gray-100 dark:bg-white/5'}`}>
                          {lesson.type === 'video' ? (
                            <Play size={10} color={isActive ? 'white' : '#999'} fill={isActive ? 'white' : 'transparent'} />
                          ) : (
                            <FileText size={10} color={isActive ? 'white' : '#999'} />
                          )}
                        </View>
                        <Text className={`ml-3 text-sm font-bold flex-1 ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                          {lesson.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
        </View>

        <View className="h-20" />
      </ScrollView>
    </View>
  );
}
