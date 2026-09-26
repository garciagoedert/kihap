import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, FlatList, Image, TouchableOpacity, Dimensions, Linking, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';

export interface BannerItem {
  id: string;
  imageUrl: string;
  link?: string;
  title?: string;
}

interface BannerCarouselProps {
  banners: BannerItem[];
}

export const BannerCarousel = React.memo(({ banners }: BannerCarouselProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const currentIndexRef = useRef(0);
  const router = useRouter();
  const screenWidth = Dimensions.get('window').width;
  const isInteracting = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincroniza ref com estado atual
  useEffect(() => {
    currentIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Auto-scroll a cada 5 segundos
  useEffect(() => {
    if (banners.length <= 1) return;

    const interval = setInterval(() => {
      if (isInteracting.current) return;
      const nextIndex = (currentIndexRef.current + 1) % banners.length;
      currentIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
      
      try {
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
      } catch (err) {
        // Fallback caso ainda não tenha medido layout
        flatListRef.current?.scrollToOffset({
          offset: nextIndex * screenWidth,
          animated: true,
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [banners.length, screenWidth]);

  const handleBannerPress = useCallback((banner: BannerItem) => {
    if (!banner.link) return;
    const link = banner.link.trim();
    if (link.startsWith('http://') || link.startsWith('https://')) {
      Linking.openURL(link).catch((e) => console.error("Error opening URL:", e));
    } else {
      router.push(link as any);
    }
  }, [router]);

  const onMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offset / screenWidth);
    if (newIndex >= 0 && newIndex < banners.length) {
      currentIndexRef.current = newIndex;
      setActiveIndex(newIndex);
    }

    // Permite retomar o auto-scroll após 3 segundos sem toque
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      isInteracting.current = false;
    }, 3000);
  }, [screenWidth, banners.length]);

  const onScrollBeginDrag = useCallback(() => {
    isInteracting.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  if (!banners || banners.length === 0) return null;

  return (
    <View className="mb-4">
      <FlatList
        ref={flatListRef}
        data={banners}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled={true}
        bounces={false}
        decelerationRate="fast"
        snapToInterval={screenWidth}
        snapToAlignment="start"
        disableIntervalMomentum={true}
        scrollEventThrottle={16}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({
              offset: info.index * screenWidth,
              animated: false,
            });
          }, 100);
        }}
        getItemLayout={(_, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
        renderItem={({ item }) => (
          <View style={{ width: screenWidth }} className="px-4">
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handleBannerPress(item)}
              className="w-full rounded-2xl overflow-hidden shadow-sm border border-gray-200/80 dark:border-white/10 bg-black"
              style={{ aspectRatio: 2.5 }}
            >
              <Image
                source={{ uri: item.imageUrl }}
                className="w-full h-full"
                resizeMode="cover"
              />
            </TouchableOpacity>
          </View>
        )}
      />

      {banners.length > 1 && (
        <View className="flex-row justify-center items-center mt-2.5">
          {banners.map((_, idx) => (
            <View
              key={idx}
              className={`h-1.5 rounded-full mx-1 transition-all ${
                activeIndex === idx
                  ? 'w-5 bg-yellow-500'
                  : 'w-1.5 bg-gray-300 dark:bg-white/20'
              }`}
            />
          ))}
        </View>
      )}
    </View>
  );
});

export default BannerCarousel;
