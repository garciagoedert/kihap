import React from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useColorScheme } from 'nativewind';
import { LinearGradient } from 'expo-linear-gradient';

interface StoryGroup {
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  stories: any[];
}

interface StoriesBarProps {
  groups: StoryGroup[];
  onPress: (group: StoryGroup) => void;
}

export default function StoriesBar({ groups, onPress }: StoriesBarProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className="mb-4">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {groups.map((group) => (
          <TouchableOpacity 
            key={group.authorId} 
            onPress={() => onPress(group)}
            className="items-center mr-4 w-20"
          >
            <View className="p-[2px] rounded-full border-2 border-[#ff9800]">
               <View className="p-[2px] bg-white dark:bg-[#050505] rounded-full">
                  <Image 
                    source={{ uri: group.authorPhotoURL || 'https://kihap.com.br/intranet/default-profile.svg' }} 
                    className="w-16 h-16 rounded-full border-2 border-transparent object-cover"
                  />
               </View>
            </View>
            <Text 
              className="text-gray-600 dark:text-gray-400 text-[10px] font-bold mt-2 text-center"
              numberOfLines={1}
            >
              {group.authorName.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
