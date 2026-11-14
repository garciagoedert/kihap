import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface StoryGroup {
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  stories: any[];
}

interface StoriesBarProps {
  groups: StoryGroup[];
  onPress?: (group: StoryGroup) => void;
  contentPadding?: number;
}

const IMAGE_STORY_DURATION_MS = 5000;

function resolveMediaUri(url?: string): string {
  if (!url) return '';
  return url.startsWith('/') ? `https://kihap.com.br${url}` : url;
}

function formatStoryTime(createdAt: any): string {
  if (!createdAt) return '';
  try {
    let date: Date;
    if (typeof createdAt.toDate === 'function') {
      date = createdAt.toDate();
    } else if (createdAt.seconds) {
      date = new Date(createdAt.seconds * 1000);
    } else {
      date = new Date(createdAt);
    }
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
}

export default function StoriesBar({
  groups,
  onPress,
  contentPadding = 16,
}: StoriesBarProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const defaultProfileImg = require('../../assets/images/default-profile.png');

  const [activeGroupIdx, setActiveGroupIdx] = useState<number | null>(null);
  const [storyIdx, setStoryIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [mediaLoading, setMediaLoading] = useState(true);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const activeGroup = activeGroupIdx !== null ? groups[activeGroupIdx] : null;
  const currentStory = activeGroup?.stories?.[storyIdx] ?? null;
  const isVideo = (currentStory?.mediaType || '').toUpperCase() === 'VIDEO';

  const resolveAvatarSource = (photoURL?: string) => {
    if (
      !photoURL ||
      photoURL.includes('default-profile.svg') ||
      photoURL.includes('default-profile.png')
    ) {
      return defaultProfileImg;
    }
    return { uri: resolveMediaUri(photoURL) };
  };

  const handleClose = useCallback(() => {
    progressAnim.stopAnimation();
    setActiveGroupIdx(null);
    setStoryIdx(0);
  }, [progressAnim]);

  const handleNext = useCallback(() => {
    if (activeGroupIdx === null) return;
    const group = groups[activeGroupIdx];
    if (!group) {
      handleClose();
      return;
    }
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx(storyIdx + 1);
    } else if (activeGroupIdx < groups.length - 1) {
      setActiveGroupIdx(activeGroupIdx + 1);
      setStoryIdx(0);
    } else {
      handleClose();
    }
  }, [activeGroupIdx, storyIdx, groups, handleClose]);

  const handlePrev = useCallback(() => {
    if (activeGroupIdx === null) return;
    if (storyIdx > 0) {
      setStoryIdx(storyIdx - 1);
    } else if (activeGroupIdx > 0) {
      const prevGroup = groups[activeGroupIdx - 1];
      setActiveGroupIdx(activeGroupIdx - 1);
      setStoryIdx(Math.max(0, (prevGroup?.stories?.length || 1) - 1));
    } else {
      setAnimKey((k) => k + 1);
    }
  }, [activeGroupIdx, storyIdx, groups]);

  useEffect(() => {
    if (activeGroupIdx !== null && (!activeGroup || !currentStory)) {
      handleClose();
    }
  }, [activeGroupIdx, activeGroup, currentStory, handleClose]);

  useEffect(() => {
    progressAnim.stopAnimation();
    progressAnim.setValue(0);

    if (!currentStory) return;
    setMediaLoading(true);

    if (isVideo) {
      return;
    }

    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: IMAGE_STORY_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });

    anim.start(({ finished }) => {
      if (finished) {
        handleNext();
      }
    });

    return () => {
      anim.stop();
    };
  }, [activeGroupIdx, storyIdx, animKey, currentStory, isVideo, progressAnim, handleNext]);

  if (!groups || groups.length === 0) {
    return null;
  }

  const handleCirclePress = (group: StoryGroup, index: number) => {
    if (group.stories && group.stories.length > 0) {
      setActiveGroupIdx(index);
      setStoryIdx(0);
      setAnimKey((k) => k + 1);
    }
    onPress?.(group);
  };

  const mediaUri = resolveMediaUri(currentStory?.mediaUrl);
  const topInset = Math.max(insets.top, 16);

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: contentPadding }}
      >
        {groups.map((group, index) => {
          const photoSource = resolveAvatarSource(group.authorPhotoURL);
          const firstName = (group.authorName || 'Kihap').split(' ')[0];
          return (
            <TouchableOpacity
              key={group.authorId}
              onPress={() => handleCirclePress(group, index)}
              activeOpacity={0.8}
              className="items-center mr-3.5 w-[76px]"
            >
              <LinearGradient
                colors={['#fbbf24', '#f97316', '#ef4444']}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={{ padding: 2.5, borderRadius: 9999 }}
              >
                <View
                  className="p-[2px] rounded-full"
                  style={{ backgroundColor: isDark ? '#050505' : '#f9fafb' }}
                >
                  <Image
                    source={photoSource}
                    className="w-16 h-16 rounded-full"
                    resizeMode="cover"
                  />
                </View>
              </LinearGradient>
              <Text
                className="text-gray-700 dark:text-gray-300 text-[11px] font-semibold mt-1.5 text-center"
                numberOfLines={1}
              >
                {firstName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal
        visible={activeGroupIdx !== null && !!currentStory}
        animationType="fade"
        transparent={false}
        presentationStyle="fullScreen"
        onRequestClose={handleClose}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {/* Story Media */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            {!!mediaUri && (
              isVideo ? (
                <Video
                  key={currentStory?.id || `${activeGroupIdx}-${storyIdx}`}
                  source={{ uri: mediaUri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={true}
                  isLooping={false}
                  onLoadStart={() => setMediaLoading(true)}
                  onLoad={() => setMediaLoading(false)}
                  onError={() => setMediaLoading(false)}
                  onPlaybackStatusUpdate={(status) => {
                    if (!status.isLoaded) return;
                    setMediaLoading(false);
                    if (status.durationMillis && status.durationMillis > 0) {
                      progressAnim.setValue(
                        Math.min(1, status.positionMillis / status.durationMillis)
                      );
                    }
                    if (status.didJustFinish) {
                      handleNext();
                    }
                  }}
                />
              ) : (
                <Image
                  key={currentStory?.id || `${activeGroupIdx}-${storyIdx}`}
                  source={{ uri: mediaUri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                  onLoadStart={() => setMediaLoading(true)}
                  onLoadEnd={() => setMediaLoading(false)}
                />
              )
            )}

            {mediaLoading && (
              <View
                style={{
                  position: 'absolute',
                  inset: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ActivityIndicator size="large" color="#eab308" />
              </View>
            )}
          </View>

          {/* Top Gradient Overlay for Legibility */}
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'transparent']}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: topInset + 96,
              zIndex: 20,
            }}
          />

          {/* Touch Navigation Zones (below header so close button is never blocked) */}
          <View
            style={{
              position: 'absolute',
              top: topInset + 74,
              bottom: insets.bottom,
              left: 0,
              right: 0,
              flexDirection: 'row',
              zIndex: 30,
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={handlePrev}
              style={{ flex: 3 }}
            />
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleNext}
              style={{ flex: 7 }}
            />
          </View>

          {/* Progress Bars + Header */}
          <View
            style={{
              position: 'absolute',
              top: topInset + 8,
              left: 0,
              right: 0,
              paddingHorizontal: 14,
              zIndex: 50,
            }}
          >
            {/* Progress Bars */}
            <View style={{ flexDirection: 'row', gap: 5, marginBottom: 12 }}>
              {activeGroup?.stories.map((story, idx) => {
                const isCompleted = idx < storyIdx;
                const isCurrent = idx === storyIdx;
                return (
                  <View
                    key={story.id || idx}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 999,
                      backgroundColor: 'rgba(255,255,255,0.28)',
                      overflow: 'hidden',
                    }}
                  >
                    {isCompleted ? (
                      <View
                        style={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: '#fff',
                        }}
                      />
                    ) : isCurrent ? (
                      <Animated.View
                        style={{
                          height: '100%',
                          backgroundColor: '#fff',
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                        }}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>

            {/* Author Info + Close Button */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Image
                  source={resolveAvatarSource(activeGroup?.authorPhotoURL)}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    borderWidth: 1.5,
                    borderColor: 'rgba(255,255,255,0.6)',
                  }}
                />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text
                      style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}
                      numberOfLines={1}
                    >
                      {activeGroup?.authorName || 'Kihap'}
                    </Text>
                    {!!formatStoryTime(currentStory?.createdAt) && (
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' }}>
                        {formatStoryTime(currentStory?.createdAt)}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.72)',
                      fontSize: 10,
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                    }}
                  >
                    Kihap Staff
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
