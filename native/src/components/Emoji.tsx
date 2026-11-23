import React from 'react';
import { Platform, StyleProp, Text, TextStyle, ViewStyle } from 'react-native';
import { Image as ExpoImage, ImageStyle } from 'expo-image';
import * as Device from 'expo-device';

export const IS_IOS_SIMULATOR = Platform.OS === 'ios' && Device.isDevice === false;

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72';

export function emojiToTwemojiUrl(symbol: string): string {
  const trimmed = symbol.trim();
  const hasZwj = trimmed.includes('\u200D');
  const codePoints: string[] = [];

  for (const char of Array.from(trimmed)) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;
    if (!hasZwj && cp === 0xfe0f) continue;
    codePoints.push(cp.toString(16));
  }

  return `${TWEMOJI_BASE}/${codePoints.join('-')}.png`;
}

interface EmojiProps {
  symbol?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export default function Emoji({ symbol, size = 16, style }: EmojiProps) {
  if (!symbol || !symbol.trim()) {
    return null;
  }

  if (IS_IOS_SIMULATOR) {
    return (
      <ExpoImage
        source={{ uri: emojiToTwemojiUrl(symbol) }}
        style={[{ width: size, height: size }, style as unknown as StyleProp<ImageStyle>]}
        contentFit="contain"
        cachePolicy="memory-disk"
        accessibilityLabel={symbol}
      />
    );
  }

  return (
    <Text
      style={[
        { fontSize: size, lineHeight: Math.ceil(size * 1.25) },
        style as unknown as StyleProp<TextStyle>,
      ]}
    >
      {symbol}
    </Text>
  );
}
