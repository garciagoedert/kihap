import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ExternalLink, Star, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import Emoji from './Emoji';

export interface StoryGroup {
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  isHighlight?: boolean;
  highlightTitle?: string;
  stories: any[];
}

interface StoriesBarProps {
  groups: StoryGroup[];
  highlights?: StoryGroup[];
  seenStoryIds?: Set<string>;
  onStorySeen?: (storyId: string) => void;
  onPress?: (group: StoryGroup) => void;
  contentPadding?: number;
}

const IMAGE_STORY_DURATION_MS = 5000;

const STORY_REACTIONS = [
  { key: 'kihap', emoji: '🥋' },
  { key: 'fire', emoji: '🔥' },
  { key: 'clap', emoji: '👏' },
  { key: 'strong', emoji: '💪' },
];

function resolveMediaUri(url?: string): string {
  if (!url) return '';
  return url.startsWith('/') ? `https://kihap.com.br${url}` : url;
}

const AUTHOR_TITLE_PREFIXES = new Set([
  'mr',
  'ms',
  'mrs',
  'miss',
  'sr',
  'sra',
  'prof',
  'profa',
  'professor',
  'professora',
  'master',
  'mestre',
  'mestra',
  'gm',
  'dr',
  'dra',
  'inst',
  'instrutor',
  'instrutora',
]);

const SHORT_NAME_CONNECTORS = new Set(['da', 'de', 'do', 'dos', 'das']);

function formatStoryAuthorLabel(rawName?: string): string {
  const parts = (rawName || 'Kihap').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Kihap';
  if (parts.length === 1) return parts[0];

  const firstNormalized = parts[0].toLowerCase().replace(/\.$/, '');
  if (AUTHOR_TITLE_PREFIXES.has(firstNormalized)) {
    const secondNormalized = parts[1].toLowerCase();
    if (SHORT_NAME_CONNECTORS.has(secondNormalized) && parts.length >= 3) {
      return `${parts[0]} ${parts[1]} ${parts[2]}`;
    }
    return `${parts[0]} ${parts[1]}`;
  }

  return parts[0];
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
  highlights = [],
  seenStoryIds,
  onStorySeen,
  onPress,
  contentPadding = 16,
}: StoriesBarProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const defaultProfileImg = require('../../assets/images/default-profile.png');

  const combinedGroups = useMemo(() => [...groups, ...highlights], [groups, highlights]);

  const [activeGroupIdx, setActiveGroupIdx] = useState<number | null>(null);
  const [storyIdx, setStoryIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Optimistic local overrides for reactions and poll votes
  const [localReactions, setLocalReactions] = useState<Record<string, Record<string, string[]>>>({});
  const [localPollVotes, setLocalPollVotes] = useState<Record<string, Record<string, string>>>({});

  const progressAnim = useRef(new Animated.Value(0)).current;
  const remainingFractionRef = useRef(1);
  const currentAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const activeGroup = activeGroupIdx !== null ? combinedGroups[activeGroupIdx] : null;
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
    currentAnimRef.current?.stop();
    progressAnim.stopAnimation();
    setIsPaused(false);
    setActiveGroupIdx(null);
    setStoryIdx(0);
  }, [progressAnim]);

  const handleNext = useCallback(() => {
    if (activeGroupIdx === null) return;
    const group = combinedGroups[activeGroupIdx];
    if (!group) {
      handleClose();
      return;
    }
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx(storyIdx + 1);
    } else if (activeGroupIdx < combinedGroups.length - 1) {
      setActiveGroupIdx(activeGroupIdx + 1);
      setStoryIdx(0);
    } else {
      handleClose();
    }
  }, [activeGroupIdx, storyIdx, combinedGroups, handleClose]);

  const handlePrev = useCallback(() => {
    if (activeGroupIdx === null) return;
    if (storyIdx > 0) {
      setStoryIdx(storyIdx - 1);
    } else if (activeGroupIdx > 0) {
      const prevGroup = combinedGroups[activeGroupIdx - 1];
      setActiveGroupIdx(activeGroupIdx - 1);
      setStoryIdx(Math.max(0, (prevGroup?.stories?.length || 1) - 1));
    } else {
      setAnimKey((k) => k + 1);
    }
  }, [activeGroupIdx, storyIdx, combinedGroups]);

  useEffect(() => {
    if (activeGroupIdx !== null && (!activeGroup || !currentStory)) {
      handleClose();
    }
  }, [activeGroupIdx, activeGroup, currentStory, handleClose]);

  // Mark story as seen when displayed
  useEffect(() => {
    if (activeGroupIdx !== null && currentStory?.id) {
      onStorySeen?.(currentStory.id);
    }
  }, [activeGroupIdx, currentStory?.id, onStorySeen]);

  // Start / reset timer when switching story
  useEffect(() => {
    currentAnimRef.current?.stop();
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    remainingFractionRef.current = 1;

    if (!currentStory) return;
    setMediaLoading(true);

    if (isVideo || isPaused) {
      return;
    }

    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: IMAGE_STORY_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    currentAnimRef.current = anim;

    anim.start(({ finished }) => {
      if (finished) {
        handleNext();
      }
    });

    return () => {
      anim.stop();
    };
  }, [activeGroupIdx, storyIdx, animKey, currentStory?.id, isVideo]);

  // Pause & resume image animation when holding touch
  const pauseStory = useCallback(() => {
    setIsPaused(true);
    if (!isVideo) {
      currentAnimRef.current?.stop();
      progressAnim.stopAnimation((val) => {
        remainingFractionRef.current = Math.max(0.05, 1 - val);
      });
    }
  }, [isVideo, progressAnim]);

  const resumeStory = useCallback(() => {
    setIsPaused(false);
    if (!isVideo && currentStory) {
      const remainingMs = Math.max(300, remainingFractionRef.current * IMAGE_STORY_DURATION_MS);
      const anim = Animated.timing(progressAnim, {
        toValue: 1,
        duration: remainingMs,
        easing: Easing.linear,
        useNativeDriver: false,
      });
      currentAnimRef.current = anim;
      anim.start(({ finished }) => {
        if (finished) {
          handleNext();
        }
      });
    }
  }, [isVideo, currentStory, progressAnim, handleNext]);

  if (!combinedGroups || combinedGroups.length === 0) {
    return null;
  }

  const handleCirclePress = (group: StoryGroup, index: number) => {
    if (group.stories && group.stories.length > 0) {
      setIsPaused(false);
      setActiveGroupIdx(index);
      setStoryIdx(0);
      setAnimKey((k) => k + 1);
    }
    onPress?.(group);
  };

  const handleReactStory = async (reactionKey: string) => {
    if (!user?.uid || !currentStory?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const storyId = currentStory.id;
    const baseReactions = localReactions[storyId] ?? currentStory.reactions ?? {};
    const currentList: string[] = Array.isArray(baseReactions[reactionKey]) ? baseReactions[reactionKey] : [];
    const alreadyReacted = currentList.includes(user.uid);
    const nextList = alreadyReacted
      ? currentList.filter((uid) => uid !== user.uid)
      : [...currentList, user.uid];

    setLocalReactions((prev) => ({
      ...prev,
      [storyId]: {
        ...(prev[storyId] ?? currentStory.reactions ?? {}),
        [reactionKey]: nextList,
      },
    }));

    try {
      await updateDoc(doc(db, 'stories', storyId), {
        [`reactions.${reactionKey}`]: alreadyReacted ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch (err) {
      console.warn('[StoriesBar] Error reacting to story:', err);
    }
  };

  const handleVotePoll = async (optionId: string) => {
    if (!user?.uid || !currentStory?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const storyId = currentStory.id;
    setLocalPollVotes((prev) => ({
      ...prev,
      [storyId]: {
        ...(prev[storyId] ?? currentStory.pollVotes ?? {}),
        [user.uid]: optionId,
      },
    }));

    try {
      await updateDoc(doc(db, 'stories', storyId), {
        [`pollVotes.${user.uid}`]: optionId,
      });
    } catch (err) {
      console.warn('[StoriesBar] Error voting poll:', err);
    }
  };

  const handleStoryCTA = () => {
    const url = (currentStory?.ctaButton?.url || '').trim();
    if (!url) return;
    handleClose();

    if (url.startsWith('app://') || url.startsWith('/')) {
      const cleanPath = url.startsWith('app://') ? url.substring(6) : url;
      const routePath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
      try {
        router.push(routePath as any);
      } catch (e) {
        console.warn('[StoriesBar] Route CTA error:', e);
      }
      return;
    }

    Linking.openURL(url).catch(() => {});
  };

  const mediaUri = resolveMediaUri(currentStory?.mediaUrl);
  const topInset = Math.max(insets.top, 16);
  const bottomInset = Math.max(insets.bottom, 14);

  const effectiveReactions = currentStory
    ? localReactions[currentStory.id] ?? currentStory.reactions ?? {}
    : {};
  const effectivePollVotes = currentStory
    ? localPollVotes[currentStory.id] ?? currentStory.pollVotes ?? {}
    : {};
  const myVote = user?.uid ? effectivePollVotes[user.uid] : undefined;
  const pollOptions: { id: string; text: string }[] = Array.isArray(currentStory?.poll?.options)
    ? currentStory.poll.options
    : [];
  const totalVotes = Object.keys(effectivePollVotes).length;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: contentPadding }}
      >
        {combinedGroups.map((group, index) => {
          const photoSource = resolveAvatarSource(group.authorPhotoURL);
          const displayLabel = group.isHighlight
            ? group.highlightTitle || group.authorName || 'Destaque'
            : formatStoryAuthorLabel(group.authorName);
          const hasUnseen = seenStoryIds
            ? group.stories.some((s) => !seenStoryIds.has(s.id))
            : true;

          const ringColors: [string, string, string] = group.isHighlight
            ? ['#eab308', '#ca8a04', '#facc15']
            : hasUnseen
              ? ['#fbbf24', '#f97316', '#ef4444']
              : [isDark ? '#3f3f46' : '#d1d5db', isDark ? '#52525b' : '#cbd5e1', isDark ? '#3f3f46' : '#d1d5db'];

          return (
            <TouchableOpacity
              key={group.authorId}
              onPress={() => handleCirclePress(group, index)}
              activeOpacity={0.8}
              className="items-center mr-3 w-[82px]"
            >
              <View className="relative">
                <LinearGradient
                  colors={ringColors}
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

                {group.isHighlight && (
                  <View className="absolute -bottom-0.5 right-0 w-5 h-5 rounded-full bg-yellow-500 border-2 border-white dark:border-black items-center justify-center">
                    <Star size={10} color="#000" fill="#000" />
                  </View>
                )}
              </View>

              <Text
                className={`text-[11px] font-semibold mt-1.5 text-center ${
                  hasUnseen || group.isHighlight
                    ? 'text-gray-800 dark:text-gray-200'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
                numberOfLines={1}
              >
                {displayLabel}
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
                  shouldPlay={!isPaused}
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

          {/* Top & Bottom Gradient Overlays */}
          <LinearGradient
            colors={['rgba(0,0,0,0.75)', 'transparent']}
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
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: bottomInset + 180,
              zIndex: 20,
            }}
          />

          {/* Touch Navigation Zones + Hold to Pause */}
          <View
            style={{
              position: 'absolute',
              top: topInset + 74,
              bottom: bottomInset + 110,
              left: 0,
              right: 0,
              flexDirection: 'row',
              zIndex: 30,
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              delayLongPress={180}
              onLongPress={pauseStory}
              onPressOut={() => {
                if (isPaused) resumeStory();
              }}
              onPress={() => {
                if (!isPaused) handlePrev();
              }}
              style={{ flex: 3 }}
            />
            <TouchableOpacity
              activeOpacity={1}
              delayLongPress={180}
              onLongPress={pauseStory}
              onPressOut={() => {
                if (isPaused) resumeStory();
              }}
              onPress={() => {
                if (!isPaused) handleNext();
              }}
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
                    borderColor: activeGroup?.isHighlight ? '#eab308' : 'rgba(255,255,255,0.6)',
                  }}
                />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text
                      style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}
                      numberOfLines={1}
                    >
                      {activeGroup?.isHighlight
                        ? activeGroup.highlightTitle || activeGroup.authorName
                        : activeGroup?.authorName || 'Kihap'}
                    </Text>
                    {!!formatStoryTime(currentStory?.createdAt) && (
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' }}>
                        {formatStoryTime(currentStory?.createdAt)}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      color: activeGroup?.isHighlight ? '#facc15' : 'rgba(255,255,255,0.72)',
                      fontSize: 10,
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                    }}
                  >
                    {activeGroup?.isHighlight
                      ? 'Destaque Oficial'
                      : currentStory?.authorRole === 'student'
                        ? 'Aluno Kihap'
                        : 'Kihap Staff'}
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

          {/* Bottom Interactive Overlay: Poll + CTA + Quick Safe Reactions */}
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              bottom: bottomInset,
              left: 16,
              right: 16,
              zIndex: 60,
              gap: 12,
            }}
          >
            {/* Interactive Poll Card */}
            {currentStory?.poll?.question && pollOptions.length >= 2 && (
              <View
                style={{
                  backgroundColor: 'rgba(20,20,24,0.88)',
                  borderRadius: 20,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(234,179,8,0.35)',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Emoji symbol="📊" size={14} />
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: '800',
                      flex: 1,
                    }}
                  >
                    {currentStory.poll.question}
                  </Text>
                </View>

                <View style={{ gap: 8 }}>
                  {pollOptions.map((opt) => {
                    const votesForOpt = Object.values(effectivePollVotes).filter((v) => v === opt.id).length;
                    const pct = totalVotes > 0 ? Math.round((votesForOpt / totalVotes) * 100) : 0;
                    const isSelected = myVote === opt.id;

                    return (
                      <TouchableOpacity
                        key={opt.id}
                        activeOpacity={0.85}
                        onPress={() => handleVotePoll(opt.id)}
                        style={{
                          position: 'relative',
                          overflow: 'hidden',
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: isSelected ? '#eab308' : 'rgba(255,255,255,0.18)',
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        {myVote && (
                          <View
                            style={{
                              position: 'absolute',
                              top: 0,
                              bottom: 0,
                              left: 0,
                              width: `${pct}%`,
                              backgroundColor: isSelected ? 'rgba(234,179,8,0.38)' : 'rgba(255,255,255,0.14)',
                            }}
                          />
                        )}
                        <Text
                          style={{
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: isSelected ? '800' : '600',
                            flex: 1,
                            paddingRight: 8,
                          }}
                        >
                          {opt.text}
                        </Text>
                        {myVote && (
                          <Text style={{ color: '#facc15', fontSize: 11, fontWeight: '800' }}>
                            {pct}%
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Optional CTA Button */}
            {currentStory?.ctaButton?.text && currentStory?.ctaButton?.url && (
              <TouchableOpacity
                onPress={handleStoryCTA}
                activeOpacity={0.88}
                style={{
                  backgroundColor: '#eab308',
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    color: '#000',
                    fontSize: 12,
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                  }}
                >
                  {currentStory.ctaButton.text}
                </Text>
                <ExternalLink size={14} color="#000" />
              </TouchableOpacity>
            )}

            {/* Quick Safe Martial Reactions */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.15)',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', marginLeft: 6 }}>
                Reagir:
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {STORY_REACTIONS.map((rx) => {
                  const arr: string[] = Array.isArray(effectiveReactions[rx.key])
                    ? effectiveReactions[rx.key]
                    : [];
                  const active = Boolean(user?.uid && arr.includes(user.uid));
                  return (
                    <TouchableOpacity
                      key={rx.key}
                      onPress={() => handleReactStory(rx.key)}
                      activeOpacity={0.8}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: active ? 'rgba(234,179,8,0.35)' : 'rgba(0,0,0,0.35)',
                        borderWidth: 1,
                        borderColor: active ? '#eab308' : 'rgba(255,255,255,0.12)',
                        gap: 4,
                      }}
                    >
                      <Emoji symbol={rx.emoji} size={16} />
                      {arr.length > 0 && (
                        <Text style={{ color: active ? '#facc15' : '#fff', fontSize: 11, fontWeight: '800' }}>
                          {arr.length}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
