import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, Share2, Sparkles, X } from 'lucide-react-native';

export type ShareCardMode = 'streak' | 'badge' | 'physical' | 'passport' | 'littles';
export type ShareCardThemeId = 'obsidian' | 'gold' | 'crimson' | 'editorial';

export interface ShareableCardStat {
  label: string;
  value: string;
}

export interface ShareableCardData {
  mode: ShareCardMode;
  studentName: string;
  belt?: string;
  unit?: string;
  title: string;
  metricValue: string;
  metricLabel: string;
  subtitle: string;
  footerTag?: string;
  avatarUrl?: string;
  roleLabel?: string;
  stats?: ShareableCardStat[];
}

interface ShareableCardModalProps {
  visible: boolean;
  onClose: () => void;
  cardData: ShareableCardData | null;
}

interface CardThemeSpec {
  id: ShareCardThemeId;
  label: string;
  swatch: string;
  bgStops: [string, string, string];
  glowColor: string;
  glowOpacity: number;
  accent: string;
  accentBright: string;
  frameStroke: string;
  frameOpacity: number;
  frameInnerOpacity: number;
  pillBg: string;
  pillText: string;
  titleColor: string;
  subtitleColor: string;
  mutedColor: string;
  medallionFill: string;
  medallionIconColor: string;
  medallionValue: string;
  medallionLabel: string;
  panelBg: string;
  panelOpacity: number;
  panelStroke: string;
  panelStrokeOpacity: number;
  panelText: string;
  panelSubtext: string;
  panelAccent: string;
  panelDivider: string;
  panelDividerOpacity: number;
  watermarkColor: string;
  watermarkOpacity: number;
  stripeColor: string;
  stripeOpacity: number;
  avatarPlaceholderBg: string;
  avatarPlaceholderText: string;
}

const CARD_THEMES: Record<ShareCardThemeId, CardThemeSpec> = {
  obsidian: {
    id: 'obsidian',
    label: 'Obsidian',
    swatch: '#eab308',
    bgStops: ['#050507', '#0f0f14', '#1b1507'],
    glowColor: '#eab308',
    glowOpacity: 0.24,
    accent: '#eab308',
    accentBright: '#fde047',
    frameStroke: '#eab308',
    frameOpacity: 0.36,
    frameInnerOpacity: 0.14,
    pillBg: '#eab308',
    pillText: '#09090b',
    titleColor: '#ffffff',
    subtitleColor: '#d4d4d8',
    mutedColor: '#a1a1aa',
    medallionFill: '#0b0b0e',
    medallionIconColor: '#eab308',
    medallionValue: '#ffffff',
    medallionLabel: '#facc15',
    panelBg: '#121216',
    panelOpacity: 0.94,
    panelStroke: '#eab308',
    panelStrokeOpacity: 0.34,
    panelText: '#ffffff',
    panelSubtext: '#a1a1aa',
    panelAccent: '#facc15',
    panelDivider: '#ffffff',
    panelDividerOpacity: 0.12,
    watermarkColor: '#eab308',
    watermarkOpacity: 0.035,
    stripeColor: '#eab308',
    stripeOpacity: 0.055,
    avatarPlaceholderBg: '#18181b',
    avatarPlaceholderText: '#fde047',
  },
  gold: {
    id: 'gold',
    label: 'Ouro Kihap',
    swatch: '#facc15',
    bgStops: ['#facc15', '#eab308', '#ca8a04'],
    glowColor: '#fef9c3',
    glowOpacity: 0.38,
    accent: '#09090b',
    accentBright: '#27272a',
    frameStroke: '#09090b',
    frameOpacity: 0.42,
    frameInnerOpacity: 0.18,
    pillBg: '#09090b',
    pillText: '#facc15',
    titleColor: '#09090b',
    subtitleColor: '#18181b',
    mutedColor: '#18181b',
    medallionFill: '#09090b',
    medallionIconColor: '#facc15',
    medallionValue: '#fde047',
    medallionLabel: '#ffffff',
    panelBg: '#09090b',
    panelOpacity: 0.95,
    panelStroke: '#09090b',
    panelStrokeOpacity: 0.7,
    panelText: '#ffffff',
    panelSubtext: '#d4d4d8',
    panelAccent: '#facc15',
    panelDivider: '#facc15',
    panelDividerOpacity: 0.22,
    watermarkColor: '#09090b',
    watermarkOpacity: 0.05,
    stripeColor: '#09090b',
    stripeOpacity: 0.06,
    avatarPlaceholderBg: '#18181b',
    avatarPlaceholderText: '#facc15',
  },
  crimson: {
    id: 'crimson',
    label: 'Chama',
    swatch: '#ef4444',
    bgStops: ['#09070a', '#1b0b0f', '#2d0f13'],
    glowColor: '#f97316',
    glowOpacity: 0.28,
    accent: '#f97316',
    accentBright: '#fb923c',
    frameStroke: '#f97316',
    frameOpacity: 0.38,
    frameInnerOpacity: 0.16,
    pillBg: '#ef4444',
    pillText: '#ffffff',
    titleColor: '#ffffff',
    subtitleColor: '#e4e4e7',
    mutedColor: '#a1a1aa',
    medallionFill: '#12080b',
    medallionIconColor: '#fb923c',
    medallionValue: '#ffffff',
    medallionLabel: '#fb923c',
    panelBg: '#160b0e',
    panelOpacity: 0.94,
    panelStroke: '#f97316',
    panelStrokeOpacity: 0.35,
    panelText: '#ffffff',
    panelSubtext: '#d4d4d8',
    panelAccent: '#fb923c',
    panelDivider: '#f97316',
    panelDividerOpacity: 0.2,
    watermarkColor: '#f97316',
    watermarkOpacity: 0.045,
    stripeColor: '#ef4444',
    stripeOpacity: 0.07,
    avatarPlaceholderBg: '#231014',
    avatarPlaceholderText: '#fb923c',
  },
  editorial: {
    id: 'editorial',
    label: 'Editorial',
    swatch: '#f5f0e6',
    bgStops: ['#faf9f6', '#f2efe9', '#e7e1d4'],
    glowColor: '#eab308',
    glowOpacity: 0.22,
    accent: '#b45309',
    accentBright: '#ca8a04',
    frameStroke: '#b45309',
    frameOpacity: 0.4,
    frameInnerOpacity: 0.16,
    pillBg: '#09090b',
    pillText: '#facc15',
    titleColor: '#09090b',
    subtitleColor: '#3f3f46',
    mutedColor: '#52525b',
    medallionFill: '#09090b',
    medallionIconColor: '#facc15',
    medallionValue: '#ffffff',
    medallionLabel: '#facc15',
    panelBg: '#ffffff',
    panelOpacity: 0.96,
    panelStroke: '#b45309',
    panelStrokeOpacity: 0.28,
    panelText: '#09090b',
    panelSubtext: '#52525b',
    panelAccent: '#b45309',
    panelDivider: '#09090b',
    panelDividerOpacity: 0.1,
    watermarkColor: '#b45309',
    watermarkOpacity: 0.045,
    stripeColor: '#ca8a04',
    stripeOpacity: 0.06,
    avatarPlaceholderBg: '#18181b',
    avatarPlaceholderText: '#facc15',
  },
};

const THEME_ORDER: ShareCardThemeId[] = ['obsidian', 'gold', 'crimson', 'editorial'];

function truncateText(str: string, maxLen: number): string {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1)}…`;
}

function stripEmojisForSvg(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveMediaUrl(url?: string): string {
  if (!url) return '';
  const clean = url.trim();
  return clean.startsWith('/') ? `https://kihap.com.br${clean}` : clean;
}

function getInitials(name: string): string {
  const parts = stripEmojisForSvg(name || 'Aluno Kihap')
    .replace(/\./g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'KH';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getBeltVisualMeta(belt?: string) {
  const str = stripEmojisForSvg(belt || '').toLowerCase();
  const danMatch =
    str.match(/(\d+)\s*(?:º|o|°)?\s*(?:dan|grau)/i) || str.match(/preta\s*(\d+)/i);
  const stripeCount = danMatch ? Math.min(9, Math.max(0, parseInt(danMatch[1], 10))) : 0;

  if (str.includes('preta') || str.includes('dan')) {
    return {
      fill: '#111113',
      border: '#3f3f46',
      text: '#ffffff',
      stitchColor: '#27272a',
      tipBg: '#1c1917',
      stripeColor: '#eab308',
      stripeCount,
    };
  }
  if (str.includes('vermelh')) {
    return {
      fill: '#dc2626',
      border: '#ef4444',
      text: '#ffffff',
      stitchColor: '#991b1b',
      tipBg: '#111113',
      stripeColor: '#eab308',
      stripeCount,
    };
  }
  if (str.includes('marrom')) {
    return {
      fill: '#78350f',
      border: '#92400e',
      text: '#ffffff',
      stitchColor: '#451a03',
      tipBg: '#111113',
      stripeColor: '#eab308',
      stripeCount,
    };
  }
  if (str.includes('roxa')) {
    return {
      fill: '#7c3aed',
      border: '#8b5cf6',
      text: '#ffffff',
      stitchColor: '#5b21b6',
      tipBg: '#111113',
      stripeColor: '#eab308',
      stripeCount,
    };
  }
  if (str.includes('azul')) {
    return {
      fill: '#2563eb',
      border: '#3b82f6',
      text: '#ffffff',
      stitchColor: '#1e40af',
      tipBg: '#111113',
      stripeColor: '#eab308',
      stripeCount,
    };
  }
  if (str.includes('verde')) {
    return {
      fill: '#16a34a',
      border: '#22c55e',
      text: '#ffffff',
      stitchColor: '#166534',
      tipBg: '#111113',
      stripeColor: '#eab308',
      stripeCount,
    };
  }
  if (str.includes('camuflad')) {
    return {
      fill: '#4d7c0f',
      border: '#65a30d',
      text: '#ffffff',
      stitchColor: '#365314',
      tipBg: '#111113',
      stripeColor: '#eab308',
      stripeCount,
    };
  }
  if (str.includes('laranja')) {
    return {
      fill: '#ea580c',
      border: '#f97316',
      text: '#ffffff',
      stitchColor: '#9a3412',
      tipBg: '#111113',
      stripeColor: '#eab308',
      stripeCount,
    };
  }
  if (str.includes('amarel')) {
    return {
      fill: '#eab308',
      border: '#facc15',
      text: '#09090b',
      stitchColor: '#a16207',
      tipBg: '#111113',
      stripeColor: '#facc15',
      stripeCount,
    };
  }
  if (str.includes('branc')) {
    return {
      fill: '#f4f4f5',
      border: '#d4d4d8',
      text: '#09090b',
      stitchColor: '#d4d4d8',
      tipBg: '#111113',
      stripeColor: '#eab308',
      stripeCount,
    };
  }
  if (str.includes('cinza')) {
    return {
      fill: '#64748b',
      border: '#94a3b8',
      text: '#ffffff',
      stitchColor: '#475569',
      tipBg: '#111113',
      stripeColor: '#eab308',
      stripeCount,
    };
  }
  return {
    fill: '#27272a',
    border: '#eab308',
    text: '#ffffff',
    stitchColor: '#3f3f46',
    tipBg: '#111113',
    stripeColor: '#eab308',
    stripeCount,
  };
}

function getModeAccent(mode: ShareCardMode) {
  switch (mode) {
    case 'streak':
      return { tag: 'OFENSIVA KIHAP', icon: '🔥' };
    case 'badge':
      return { tag: 'CONQUISTA DESBLOQUEADA', icon: '🏅' };
    case 'physical':
      return { tag: 'TESTE FÍSICO KIHAP', icon: '⚡' };
    case 'littles':
      return { tag: 'KIHAP LITTLES EM CASA', icon: '🐼' };
    case 'passport':
    default:
      return { tag: 'PASSAPORTE MARCIAL', icon: '🥋' };
  }
}

function renderModeVectorIcon(mode: ShareCardMode, color: string) {
  switch (mode) {
    case 'streak':
      return (
        <G transform="translate(504, 548) scale(3)">
          <Path
            d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
            fill={color}
            fillOpacity={0.24}
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
      );
    case 'badge':
      return (
        <G transform="translate(504, 548) scale(3)">
          <Circle
            cx="12"
            cy="9"
            r="6"
            fill={color}
            fillOpacity={0.22}
            stroke={color}
            strokeWidth={1.8}
          />
          <Path
            d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"
            fill={color}
            fillOpacity={0.14}
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="m12 6.3.85 1.72 1.9.28-1.37 1.34.32 1.89L12 10.64l-1.7.89.32-1.89L9.25 8.3l1.9-.28z"
            fill={color}
          />
        </G>
      );
    case 'physical':
      return (
        <G transform="translate(504, 548) scale(3)">
          <Path
            d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"
            fill={color}
            fillOpacity={0.26}
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
      );
    case 'littles':
      return (
        <G transform="translate(504, 548) scale(3)">
          <Path
            d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"
            fill={color}
            fillOpacity={0.24}
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M5 20.5h14" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        </G>
      );
    case 'passport':
    default:
      return (
        <G transform="translate(504, 548) scale(3)">
          <Path
            d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
            fill={color}
            fillOpacity={0.22}
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="m12 7.4 1.05 2.13 2.35.34-1.7 1.66.4 2.34L12 12.76l-2.1 1.11.4-2.34-1.7-1.66 2.35-.34z"
            fill={color}
          />
        </G>
      );
  }
}

export default function ShareableCardModal({
  visible,
  onClose,
  cardData,
}: ShareableCardModalProps) {
  const insets = useSafeAreaInsets();
  const svgRef = useRef<any>(null);
  const [sharing, setSharing] = useState(false);
  const [cleanPreviewMode, setCleanPreviewMode] = useState(false);
  const [themeId, setThemeId] = useState<ShareCardThemeId>('obsidian');
  const [avatarDataUri, setAvatarDataUri] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !cardData) return;
    setThemeId(cardData.mode === 'physical' ? 'crimson' : 'obsidian');
  }, [visible, cardData?.mode]);

  useEffect(() => {
    let isCancelled = false;

    const prefetchAvatar = async () => {
      if (!visible || !cardData?.avatarUrl || !FileSystem.cacheDirectory) {
        setAvatarDataUri(null);
        return;
      }
      const raw = cardData.avatarUrl.trim();
      if (
        !raw ||
        raw.includes('default-profile.svg') ||
        raw.includes('default-profile.png')
      ) {
        setAvatarDataUri(null);
        return;
      }

      const uri = resolveMediaUrl(raw);
      const isPng = uri.split('?')[0].toLowerCase().endsWith('.png');
      const ext = isPng ? '.png' : '.jpg';
      const mime = isPng ? 'image/png' : 'image/jpeg';
      const tempFile = `${FileSystem.cacheDirectory}kihap-avatar-${Date.now()}${ext}`;

      try {
        const dlRes = await FileSystem.downloadAsync(uri, tempFile);
        if (dlRes?.status === 200) {
          const b64 = await FileSystem.readAsStringAsync(dlRes.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (!isCancelled && b64) {
            setAvatarDataUri(`data:${mime};base64,${b64}`);
          }
        }
      } catch {
        if (!isCancelled) setAvatarDataUri(null);
      } finally {
        FileSystem.deleteAsync(tempFile, { idempotent: true }).catch(() => {});
      }
    };

    prefetchAvatar();

    return () => {
      isCancelled = true;
    };
  }, [visible, cardData?.avatarUrl]);

  if (!cardData) return null;

  const theme = CARD_THEMES[themeId];
  const accent = getModeAccent(cardData.mode);
  const beltText = stripEmojisForSvg(cardData.belt || 'Aluno Kihap') || 'Aluno Kihap';
  const beltMeta = getBeltVisualMeta(beltText);
  const unitText = stripEmojisForSvg(cardData.unit || 'Kihap') || 'Kihap';
  const roleText = stripEmojisForSvg(cardData.roleLabel || 'Atleta Kihap') || 'Atleta Kihap';

  const dateLabel = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const cleanTitle = truncateText(stripEmojisForSvg(cardData.title).toUpperCase(), 24);
  const titleFontSize = cleanTitle.length > 18 ? 48 : 60;
  const cleanMetric = truncateText(stripEmojisForSvg(cardData.metricValue), 10) || '0';
  const metricFontSize =
    cleanMetric.length <= 2
      ? 172
      : cleanMetric.length <= 4
        ? 136
        : cleanMetric.length <= 7
          ? 100
          : 76;
  const cleanMetricLabel = truncateText(
    stripEmojisForSvg(cardData.metricLabel).toUpperCase(),
    24
  );
  const cleanSubtitle = truncateText(stripEmojisForSvg(cardData.subtitle), 46);
  const stats = Array.isArray(cardData.stats)
    ? cardData.stats.slice(0, 3).map((s) => ({
        label: truncateText(stripEmojisForSvg(s.label).toUpperCase(), 12),
        value: truncateText(stripEmojisForSvg(s.value), 12),
      }))
    : [];
  const hasStats = stats.length > 0;
  const studentInitials = getInitials(cardData.studentName);

  const handleSelectTheme = (id: ShareCardThemeId) => {
    setThemeId(id);
    Haptics.selectionAsync().catch(() => {});
  };

  const handleShare = async () => {
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const message = `${accent.icon} ${cardData.title} — ${cardData.metricValue} ${cardData.metricLabel}\n${cardData.studentName} • ${beltText} • ${unitText}\n${cardData.subtitle}\n#KihapMartialArts`;

    try {
      if (
        Platform.OS === 'ios' &&
        svgRef.current &&
        typeof svgRef.current.toDataURL === 'function'
      ) {
        const base64Data = await new Promise<string | null>((resolve) => {
          try {
            svgRef.current.toDataURL((base64: string) => resolve(base64));
          } catch {
            resolve(null);
          }
        });

        if (base64Data && FileSystem.cacheDirectory) {
          const cleanB64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
          const fileUri = `${FileSystem.cacheDirectory}kihap-conquista-${Date.now()}.png`;
          await FileSystem.writeAsStringAsync(fileUri, cleanB64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await Share.share({
            url: fileUri,
            message,
          });
          setSharing(false);
          return;
        }
      }

      await Share.share({
        title: cardData.title,
        message,
      });
    } catch (err: any) {
      if (err?.message && !String(err.message).toLowerCase().includes('cancel')) {
        Alert.alert('Compartilhar', 'Não foi possível abrir o compartilhamento agora.');
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      presentationStyle="fullScreen"
      onRequestClose={() => {
        setCleanPreviewMode(false);
        onClose();
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: '#050505',
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
      >
        {!cleanPreviewMode && (
          <View className="flex-row items-center justify-between px-5 py-2.5">
            <View className="flex-row items-center">
              <Sparkles size={17} color="#eab308" style={{ marginRight: 8 }} />
              <Text
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-sm text-white uppercase tracking-wider"
              >
                Card para Stories
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setCleanPreviewMode(false);
                onClose();
              }}
              className="w-9 h-9 rounded-full bg-white/10 items-center justify-center"
            >
              <X size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: cleanPreviewMode ? 8 : 20,
            paddingVertical: 4,
          }}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {
              if (cleanPreviewMode) setCleanPreviewMode(false);
            }}
            style={{
              width: '100%',
              maxWidth: cleanPreviewMode ? 390 : 284,
              aspectRatio: 9 / 16,
              borderRadius: cleanPreviewMode ? 12 : 26,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(234,179,8,0.38)',
              backgroundColor: '#050507',
            }}
          >
            <Svg ref={svgRef} width="100%" height="100%" viewBox="0 0 1080 1920">
              <Defs>
                <SvgLinearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={theme.bgStops[0]} stopOpacity="1" />
                  <Stop offset="52%" stopColor={theme.bgStops[1]} stopOpacity="1" />
                  <Stop offset="100%" stopColor={theme.bgStops[2]} stopOpacity="1" />
                </SvgLinearGradient>

                <RadialGradient id="spotGrad" cx="50%" cy="38%" r="52%" fx="50%" fy="38%">
                  <Stop offset="0%" stopColor={theme.glowColor} stopOpacity={theme.glowOpacity} />
                  <Stop offset="55%" stopColor={theme.glowColor} stopOpacity={theme.glowOpacity * 0.28} />
                  <Stop offset="100%" stopColor={theme.bgStops[1]} stopOpacity="0" />
                </RadialGradient>

                <SvgLinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={theme.accentBright} stopOpacity="1" />
                  <Stop offset="55%" stopColor={theme.accent} stopOpacity="1" />
                  <Stop offset="100%" stopColor={theme.accentBright} stopOpacity="0.85" />
                </SvgLinearGradient>

                <SvgLinearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor={theme.accent} stopOpacity="0.3" />
                  <Stop offset="50%" stopColor={theme.accentBright} stopOpacity="1" />
                  <Stop offset="100%" stopColor={theme.accent} stopOpacity="0.3" />
                </SvgLinearGradient>

                <ClipPath id="avatarClip">
                  <Circle cx="210" cy="1484" r="72" />
                </ClipPath>
              </Defs>

              {/* Layer 1: Base Gradient + Radial Spotlight */}
              <Rect x="0" y="0" width="1080" height="1920" fill="url(#bgGrad)" />
              <Rect x="0" y="0" width="1080" height="1920" fill="url(#spotGrad)" />

              {/* Layer 2: Kinetic Diagonal Stripes */}
              <Polygon
                points="-140,360 1220,40 1220,210 -140,530"
                fill={theme.stripeColor}
                fillOpacity={theme.stripeOpacity}
              />
              <Polygon
                points="-140,1490 1220,1150 1220,1275 -140,1615"
                fill={theme.stripeColor}
                fillOpacity={theme.stripeOpacity}
              />

              {/* Layer 3: Subtle Typographic Watermark */}
              <SvgText
                x="540"
                y="935"
                fill={theme.watermarkColor}
                fillOpacity={theme.watermarkOpacity}
                fontSize="310"
                fontFamily="NeueMachina-Ultrabold"
                letterSpacing="12"
                textAnchor="middle"
              >
                KIHAP
              </SvgText>

              {/* Layer 4: Double Frame + L-Corner Brackets */}
              <Rect
                x="42"
                y="42"
                width="996"
                height="1836"
                rx="44"
                fill="none"
                stroke={theme.frameStroke}
                strokeOpacity={theme.frameOpacity}
                strokeWidth="2.5"
              />
              <Rect
                x="58"
                y="58"
                width="964"
                height="1804"
                rx="34"
                fill="none"
                stroke={theme.frameStroke}
                strokeOpacity={theme.frameInnerOpacity}
                strokeWidth="1.5"
              />
              <G stroke={theme.accent} strokeWidth="5" strokeLinecap="round" fill="none">
                <Path d="M84 128 V84 H128" />
                <Path d="M952 84 H996 V128" />
                <Path d="M84 1792 V1836 H128" />
                <Path d="M952 1836 H996 V1792" />
              </G>

              {/* Layer 5: Top Brand Emblem & Category Pill */}
              <G>
                <Circle
                  cx="540"
                  cy="132"
                  r="34"
                  fill="none"
                  stroke={theme.accent}
                  strokeWidth="3.5"
                />
                <Rect x="526" y="114" width="7" height="36" rx="3.5" fill={theme.accent} />
                <Rect x="547" y="114" width="7" height="36" rx="3.5" fill={theme.accent} />
                <SvgText
                  x="540"
                  y="204"
                  fill={theme.accent}
                  fontSize="25"
                  fontFamily="NeueMachina-Ultrabold"
                  letterSpacing="8"
                  textAnchor="middle"
                >
                  KIHAP MARTIAL ARTS
                </SvgText>

                <Rect x="290" y="232" width="500" height="58" rx="29" fill={theme.pillBg} />
                <SvgText
                  x="540"
                  y="270"
                  fill={theme.pillText}
                  fontSize="23"
                  fontFamily="NeueMachina-Ultrabold"
                  letterSpacing="3"
                  textAnchor="middle"
                >
                  {accent.tag}
                </SvgText>
              </G>

              {/* Layer 6: Editorial Title + Accent Bar */}
              <SvgText
                x="540"
                y="376"
                fill={theme.titleColor}
                fontSize={titleFontSize}
                fontFamily="NeueMachina-Ultrabold"
                textAnchor="middle"
              >
                {cleanTitle}
              </SvgText>
              <Rect x="440" y="406" width="200" height="6" rx="3" fill="url(#accentGrad)" />

              {/* Layer 7: Hero Chronograph Medallion */}
              <G>
                <Circle
                  cx="540"
                  cy="735"
                  r="294"
                  fill="none"
                  stroke={theme.accent}
                  strokeOpacity={0.3}
                  strokeWidth="3"
                  strokeDasharray={[16, 14]}
                />
                <Circle
                  cx="540"
                  cy="735"
                  r="264"
                  fill={theme.accent}
                  fillOpacity={0.08}
                />
                <Circle
                  cx="540"
                  cy="735"
                  r="248"
                  fill="none"
                  stroke="url(#ringGrad)"
                  strokeWidth="7"
                />
                <Circle
                  cx="540"
                  cy="735"
                  r="234"
                  fill={theme.medallionFill}
                  stroke={theme.accent}
                  strokeOpacity={0.25}
                  strokeWidth="2"
                />

                {renderModeVectorIcon(cardData.mode, theme.medallionIconColor)}

                <SvgText
                  x="544"
                  y="784"
                  fill="#000000"
                  fillOpacity={0.35}
                  fontSize={metricFontSize}
                  fontFamily="NeueMachina-Ultrabold"
                  textAnchor="middle"
                >
                  {cleanMetric}
                </SvgText>
                <SvgText
                  x="540"
                  y="780"
                  fill={theme.medallionValue}
                  fontSize={metricFontSize}
                  fontFamily="NeueMachina-Ultrabold"
                  textAnchor="middle"
                >
                  {cleanMetric}
                </SvgText>

                <SvgText
                  x="540"
                  y="866"
                  fill={theme.medallionLabel}
                  fontSize="22"
                  fontFamily="NeueMachina-Ultrabold"
                  letterSpacing="3"
                  textAnchor="middle"
                >
                  {cleanMetricLabel}
                </SvgText>
              </G>

              {/* Layer 8: 3-Stat Bar (when provided) + Subtitle */}
              {hasStats && (
                <G>
                  <Rect
                    x="86"
                    y="1078"
                    width="908"
                    height="146"
                    rx="30"
                    fill={theme.panelBg}
                    fillOpacity={theme.panelOpacity}
                    stroke={theme.panelStroke}
                    strokeOpacity={theme.panelStrokeOpacity}
                    strokeWidth="2"
                  />
                  {stats.map((st, idx) => {
                    const colWidth = 908 / stats.length;
                    const cx = 86 + colWidth * (idx + 0.5);
                    const valSize = st.value.length > 7 ? 30 : 40;
                    return (
                      <G key={`${st.label}-${idx}`}>
                        {idx > 0 && (
                          <Line
                            x1={86 + colWidth * idx}
                            y1="1108"
                            x2={86 + colWidth * idx}
                            y2="1194"
                            stroke={theme.panelDivider}
                            strokeOpacity={theme.panelDividerOpacity}
                            strokeWidth="2"
                          />
                        )}
                        <SvgText
                          x={cx}
                          y="1148"
                          fill={theme.panelAccent}
                          fontSize={valSize}
                          fontFamily="NeueMachina-Ultrabold"
                          textAnchor="middle"
                        >
                          {st.value || '0'}
                        </SvgText>
                        <SvgText
                          x={cx}
                          y="1192"
                          fill={theme.panelSubtext}
                          fontSize="19"
                          fontWeight="bold"
                          letterSpacing="2.5"
                          textAnchor="middle"
                        >
                          {st.label}
                        </SvgText>
                      </G>
                    );
                  })}
                </G>
              )}

              <SvgText
                x="540"
                y={hasStats ? 1300 : 1205}
                fill={theme.subtitleColor}
                fontSize={hasStats ? 28 : 34}
                fontWeight="bold"
                textAnchor="middle"
              >
                {cleanSubtitle}
              </SvgText>

              {/* Layer 9: Athlete Identity Card + Real Martial Belt Bar */}
              <G>
                <Rect
                  x="86"
                  y="1358"
                  width="908"
                  height="360"
                  rx="38"
                  fill={theme.panelBg}
                  fillOpacity={theme.panelOpacity}
                  stroke={theme.panelStroke}
                  strokeOpacity={theme.panelStrokeOpacity}
                  strokeWidth="2.5"
                />

                {/* Avatar Ring & Clipped Image / Initials Fallback */}
                <Circle
                  cx="210"
                  cy="1484"
                  r="78"
                  fill="none"
                  stroke="url(#ringGrad)"
                  strokeWidth="5"
                />
                <Circle cx="210" cy="1484" r="72" fill={theme.avatarPlaceholderBg} />
                {avatarDataUri ? (
                  <G clipPath="url(#avatarClip)">
                    <SvgImage
                      x="138"
                      y="1412"
                      width="144"
                      height="144"
                      href={{ uri: avatarDataUri }}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  </G>
                ) : (
                  <SvgText
                    x="210"
                    y="1502"
                    fill={theme.avatarPlaceholderText}
                    fontSize="48"
                    fontFamily="NeueMachina-Ultrabold"
                    textAnchor="middle"
                  >
                    {studentInitials}
                  </SvgText>
                )}

                {/* Role, Student Name, Unit */}
                <SvgText
                  x="316"
                  y="1442"
                  fill={theme.panelAccent}
                  fontSize="21"
                  fontFamily="NeueMachina-Ultrabold"
                  letterSpacing="3"
                  textAnchor="start"
                >
                  {truncateText(roleText.toUpperCase(), 24)}
                </SvgText>
                <SvgText
                  x="316"
                  y="1502"
                  fill={theme.panelText}
                  fontSize="44"
                  fontFamily="NeueMachina-Ultrabold"
                  textAnchor="start"
                >
                  {truncateText(stripEmojisForSvg(cardData.studentName).toUpperCase(), 19)}
                </SvgText>
                <SvgText
                  x="316"
                  y="1552"
                  fill={theme.panelSubtext}
                  fontSize="23"
                  fontWeight="bold"
                  letterSpacing="2"
                  textAnchor="start"
                >
                  {truncateText(`KIHAP  •  ${unitText.toUpperCase()}`, 28)}
                </SvgText>

                {/* Martial Belt Bar */}
                <Rect
                  x="128"
                  y="1612"
                  width="824"
                  height="62"
                  rx="18"
                  fill={beltMeta.fill}
                  stroke={beltMeta.border}
                  strokeWidth="2.5"
                />
                <Line
                  x1="152"
                  y1="1622"
                  x2="928"
                  y2="1622"
                  stroke={beltMeta.stitchColor}
                  strokeOpacity={0.7}
                  strokeWidth="1.5"
                />
                <Line
                  x1="152"
                  y1="1664"
                  x2="928"
                  y2="1664"
                  stroke={beltMeta.stitchColor}
                  strokeOpacity={0.7}
                  strokeWidth="1.5"
                />

                {beltMeta.stripeCount > 0 &&
                  Array.from({ length: beltMeta.stripeCount }).map((_, idx) => (
                    <Rect
                      key={`dan-stripe-${idx}`}
                      x={914 - idx * 16}
                      y="1621"
                      width="8"
                      height="44"
                      rx="2"
                      fill={beltMeta.stripeColor}
                    />
                  ))}

                <SvgText
                  x="540"
                  y="1652"
                  fill={beltMeta.text}
                  fontSize="24"
                  fontFamily="NeueMachina-Ultrabold"
                  letterSpacing="3.5"
                  textAnchor="middle"
                >
                  {truncateText(beltText.toUpperCase(), 24)}
                </SvgText>
              </G>

              {/* Layer 10: Signature Footer */}
              <SvgText
                x="540"
                y="1814"
                fill={theme.mutedColor}
                fontSize="22"
                fontWeight="bold"
                letterSpacing="3"
                textAnchor="middle"
              >
                {`${cardData.footerTag || 'KIHAP.COM.BR'}  •  @KIHAPMARTIALARTS  •  ${dateLabel.toUpperCase()}`}
              </SvgText>
            </Svg>
          </TouchableOpacity>

          {/* Theme Picker Pills (hidden in Clean Preview Mode) */}
          {!cleanPreviewMode && (
            <View className="flex-row items-center justify-center flex-wrap gap-2 mt-3.5 px-2">
              {THEME_ORDER.map((id) => {
                const t = CARD_THEMES[id];
                const active = themeId === id;
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => handleSelectTheme(id)}
                    activeOpacity={0.85}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 11,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? '#eab308' : 'rgba(255,255,255,0.16)',
                      backgroundColor: active ? 'rgba(234,179,8,0.18)' : 'rgba(255,255,255,0.06)',
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: 6,
                        backgroundColor: t.swatch,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.35)',
                      }}
                    />
                    <Text
                      style={{
                        color: active ? '#facc15' : '#d4d4d8',
                        fontSize: 11,
                        fontWeight: active ? '800' : '600',
                      }}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {cleanPreviewMode && (
            <Text className="text-xs text-gray-400 mt-3 text-center">
              Toque no card para voltar aos botões
            </Text>
          )}
        </ScrollView>

        {!cleanPreviewMode && (
          <View className="px-5 pt-2 gap-2.5">
            <TouchableOpacity
              onPress={handleShare}
              disabled={sharing}
              className="bg-[#eab308] py-4 rounded-2xl flex-row items-center justify-center shadow-lg active:opacity-90"
            >
              {sharing ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Share2 size={18} color="#000" style={{ marginRight: 8 }} />
                  <Text
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-black text-xs uppercase tracking-wider"
                  >
                    Compartilhar nos Stories / WhatsApp
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setCleanPreviewMode(true)}
              className="bg-white/10 py-3 rounded-2xl flex-row items-center justify-center border border-white/10"
            >
              <Eye size={15} color="#fff" style={{ marginRight: 6 }} />
              <Text className="text-white text-xs font-bold">
                Modo Tela Limpa (para printar)
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}
