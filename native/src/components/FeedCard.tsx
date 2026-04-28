import React from 'react';
import { View, Text, Image, TouchableOpacity, Linking, useWindowDimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Heart, MessageCircle, Share2, ExternalLink } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import RenderHtml from 'react-native-render-html';

interface FeedCardProps {
  post: {
    id: string;
    authorName: string;
    authorPhotoURL?: string;
    content: string;
    mediaUrl?: string;
    mediaType?: string;
    createdAt?: any;
    ctaButton?: {
      text: string;
      url: string;
    };
    authorId: string;
    isHtml?: boolean;
  };
}

export default function FeedCard({ post }: FeedCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();

  const formattedDate = post.createdAt 
    ? new Date(post.createdAt.seconds * 1000).toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
      }) 
    : 'Recentemente';

  const handleCTA = () => {
    if (post.ctaButton?.url) {
      Linking.openURL(post.ctaButton.url);
    }
  };

  const tagsStyles = {
    body: {
      color: isDark ? '#e5e7eb' : '#374151',
      fontSize: 14,
      lineHeight: 22,
    },
    p: {
      marginBottom: 8,
      backgroundColor: 'transparent',
    },
    span: {
      backgroundColor: 'transparent',
    },
    strong: {
      fontWeight: 'bold',
      color: isDark ? '#fff' : '#000',
    },
    em: {
      fontStyle: 'italic',
    },
    a: {
      color: '#014fa4',
      textDecorationLine: 'none',
    }
  };

  const cleanContent = post.content
    .replace(/background-color:[^;]+;/g, '')
    .replace(/background:[^;]+;/g, '')
    .replace(/font-family:[^;]+;/g, '')
    .replace(/margin:[^;]+;/g, '')
    .replace(/padding:[^;]+;/g, '');

  return (
    <View className="bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm mb-6 overflow-hidden mx-4">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 pb-2">
        <View className="flex-row items-center">
          <View className="relative">
            <Image 
              source={{ uri: post.authorPhotoURL || 'https://kihap.com.br/intranet/default-profile.svg' }} 
              className="w-10 h-10 rounded-full border border-gray-100 dark:border-white/10 object-cover"
            />
            <View className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#1a1a1a] rounded-full" />
          </View>
          <View className="ml-3">
            <Text className="text-gray-900 dark:text-white font-bold text-[13px]">{post.authorName}</Text>
            <Text className="text-gray-400 text-[10px] uppercase font-bold tracking-tight">{formattedDate}</Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <View className="px-4 py-2">
        {post.isHtml ? (
          <RenderHtml
            contentWidth={width - 64}
            source={{ html: `<body>${cleanContent}</body>` }}
            tagsStyles={tagsStyles as any}
            ignoredStyles={['background-color', 'background', 'font-family', 'color', 'margin', 'padding']}
          />
        ) : (
          <Text className="text-gray-800 dark:text-gray-200 text-[14px] leading-relaxed">
            {post.content}
          </Text>
        )}
      </View>

      {/* Media */}
      {post.mediaUrl ? (
        <View className="mt-2 overflow-hidden bg-white dark:bg-[#1a1a1a]">
          {post.mediaType?.includes('video') ? (
            <Video
              source={{ uri: post.mediaUrl }}
              className="w-full aspect-video"
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              isLooping={false}
            />
          ) : (
            <Image 
              source={{ uri: post.mediaUrl }} 
              className="w-full aspect-video"
              resizeMode="contain" // Back to contain to see full image
            />
          )}
        </View>
      ) : null}

      {/* CTA Button */}
      {post.ctaButton ? (
        <View className="px-4 py-4">
          <TouchableOpacity 
            onPress={handleCTA}
            className="bg-[#014fa4] py-3 rounded-2xl flex-row items-center justify-center space-x-2 shadow-sm active:opacity-80"
          >
            <Text className="text-white font-bold text-xs uppercase tracking-widest">{post.ctaButton.text}</Text>
            <ExternalLink size={14} color="white" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Actions */}
      <View className="flex-row items-center justify-between px-4 py-4 border-t border-gray-50 dark:border-white/5">
        <View className="flex-row items-center space-x-6">
          <TouchableOpacity className="flex-row items-center">
            <Heart size={22} color={isDark ? '#aaa' : '#666'} />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center">
            <MessageCircle size={22} color={isDark ? '#aaa' : '#666'} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity>
          <Share2 size={22} color={isDark ? '#aaa' : '#666'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
