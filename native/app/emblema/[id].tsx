import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Dimensions,
  Platform,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot, updateDoc, setDoc, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../src/services/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Award,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Share2,
  BookOpen,
  Target,
  Sparkles,
  Flame,
  Scroll,
  Camera,
  Trash2,
  X,
  Maximize2,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

// Smart martial lore fallback for belts when not explicitly configured
function getBeltLoreFallback(name: string = ''): string {
  const n = name.toLowerCase();

  if (n.includes('branca')) {
    return 'A Faixa Branca simboliza a pureza e a inocência do iniciante. Como a neve intocada ou uma semente recém-plantada em solo fértil, o aluno começa sua jornada despido de vícios, com a mente aberta, humilde e receptiva para absorver os primeiros fundamentos técnicos, a filosofia de respeito e a disciplina marcial do Taekwondo.';
  }
  if (n.includes('laranja')) {
    return 'A Faixa Laranja representa os primeiros raios de sol da alvorada aquecendo a terra. O praticante começa a despertar para o caminho marcial, desenvolvendo agilidade motora, coordenação corporal e os primeiros reflexos defensivos, compreendendo o valor inestimável da constância nos treinos.';
  }
  if (n.includes('amarela')) {
    return 'A Faixa Amarela simboliza a terra fértil onde a planta lança suas primeiras raízes profundas. Os fundamentos básicos se consolidam no corpo e na mente. É o estágio de construir uma base inabalável de postura, equilíbrio e respeito mútuo, preparando o alicerce para o crescimento vindouro.';
  }
  if (n.includes('camuflada')) {
    return 'A Faixa Camuflada representa a capacidade de adaptação às mudanças e a imprevisibilidade do combate real. O guerreiro aprende a ler o ambiente, a disfarçar suas intenções e a superar situações adversas com inteligência tática, flexibilidade e autocontrole emocional.';
  }
  if (n.includes('verde')) {
    return 'A Faixa Verde simboliza o broto que rompe a terra e cresce vigorosamente em direção aos céus. As habilidades técnicas ganham força, velocidade e impacto. O aluno consolida sua autoconfiança e compreende que a verdadeira força marcial caminha lado a lado com a serenidade interior.';
  }
  if (n.includes('roxa')) {
    return 'A Faixa Roxa simboliza a transição, a nobreza de espírito e a sabedoria. Representa a fusão entre a intensidade física e o domínio mental. Os movimentos tornam-se fluidos e conscientes, e o praticante passa a cultivar uma percepção refinada de timing, distância e estratégia marcial.';
  }
  if (n.includes('azul')) {
    return 'A Faixa Azul simboliza o céu infinito em direção ao qual a árvore madura continua crescendo sem limites. O treinamento atinge alto nível de complexidade e maturidade. O praticante assume um papel de liderança natural no tatame, servindo de inspiração para os alunos menos graduados.';
  }
  if (n.includes('marrom')) {
    return 'A Faixa Marrom representa a solidez da terra, a firmeza da montanha e a maturação plena da árvore marcial. O praticante possui técnica refinada e grande resistência física, preparando o espírito para cruzar o sagrado limiar entre o praticante e o mestre.';
  }
  if (n.includes('vermelha e preta')) {
    return 'A Faixa Vermelha e Preta simboliza o amanhecer supremo, a transição entre o perigo do combate e a maturidade da maestria. É o teste final de caráter, humildade e perseverança antes da conquista da consagrada Faixa Preta.';
  }
  if (n.includes('vermelha')) {
    return 'A Faixa Vermelha simboliza o fogo, o perigo iminente e a energia escaldante. O aluno possui grande poder destrutivo e precisão nos golpes, demandando rigoroso autocontrole moral e mental para saber canalizar sua força unicamente para a defesa, a justiça e a proteção dos mais fracos.';
  }
  if (n.includes('preta')) {
    return 'A Faixa Preta é o oposto do branco: representa a maturidade, a imunidade à escuridão, a bravura e a maestria. Longe de ser o final da jornada, a faixa preta é o verdadeiro nascimento do artista marcial, marcando o início de uma vida inteira dedicada à sabedoria, à liderança e ao aperfeiçoamento contínuo.';
  }
  if (n.includes('littles')) {
    return 'O programa Littles Kihap cultiva os valores marciais desde a primeira infância: foco, equilíbrio, respeito aos pais e professores, e disciplina positiva através de desafios divertidos e lúdicos.';
  }

  return 'Este emblema reconhece a dedicação exemplar, o espírito indomável e a superação constante do atleta na Kihap. Cada degrau conquistado no tatame reflete o compromisso de se tornar uma versão mais forte, disciplinada e honrada todos os dias.';
}

function getHowToEarnFallback(name: string = ''): string {
  const n = name.toLowerCase();
  if (
    n.includes('faixa') ||
    n.includes('branca') ||
    n.includes('amarela') ||
    n.includes('verde') ||
    n.includes('azul') ||
    n.includes('vermelha') ||
    n.includes('preta') ||
    n.includes('marrom') ||
    n.includes('roxa') ||
    n.includes('laranja')
  ) {
    return 'Atingir a frequência mínima exigida no ciclo de graduação, dominar os chutes e fórmulas oficiais da graduação, demonstrar disciplina e respeito no tatame, e ser aprovado no Exame Oficial de Faixas da Kihap.';
  }
  return 'Participar ativamente dos treinos, eventos e desafios propostos pela equipe Kihap, superando os critérios técnicos e comportamentais avaliados pelos mestres e instrutores.';
}

const CATEGORY_MAP: { [key: string]: { label: string; icon: any; color: string; bg: string } } = {
  graduacao: {
    label: 'Graduação / Faixa',
    icon: Award,
    color: '#eab308',
    bg: 'bg-yellow-500/10',
  },
  conquista: {
    label: 'Conquista Marcial',
    icon: ShieldCheck,
    color: '#10b981',
    bg: 'bg-emerald-500/10',
  },
  desafio: {
    label: 'Desafio Físico',
    icon: Flame,
    color: '#ef4444',
    bg: 'bg-red-500/10',
  },
  especial: {
    label: 'Especial / Evento',
    icon: Sparkles,
    color: '#8b5cf6',
    bg: 'bg-purple-500/10',
  },
};

export default function EmblemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, userData } = useAuth();

  const [badge, setBadge] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const badgeRef = doc(db, 'badges', id);
    const unsubscribe = onSnapshot(
      badgeRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log('BADGE_HERO_DATA:', JSON.stringify({ id: docSnap.id, name: data.name, heroImageUrl: data.heroImageUrl, backgroundUrl: data.backgroundUrl }));
          setBadge({ id: docSnap.id, ...data });
        } else {
          setBadge(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching badge details:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  const isEarned = (userData?.earnedBadges || []).includes(id);

  // Foto pessoal do aluno associada a esta conquista/graduação
  const badgePhotoEntry = userData?.badgePhotos?.[id || ''];
  const userPhotoUrl: string | null =
    typeof badgePhotoEntry === 'string'
      ? badgePhotoEntry
      : badgePhotoEntry?.photoUrl || null;

  const isGraduation =
    badge?.category === 'graduacao' || badge?.name?.toLowerCase().includes('faixa');

  const handleSelectPhoto = () => {
    if (!user) {
      Alert.alert(
        'Login Necessário',
        'Você precisa estar conectado à sua conta Kihap para registrar sua foto de conquista.'
      );
      return;
    }

    Alert.alert(
      isGraduation ? 'Foto da Graduação' : 'Foto da Conquista',
      'Escolha como deseja adicionar sua foto oficial deste momento:',
      [
        {
          text: 'Tirar Foto com a Câmera',
          onPress: () => pickAndUploadImage(true),
        },
        {
          text: 'Escolher da Galeria',
          onPress: () => pickAndUploadImage(false),
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]
    );
  };

  const pickAndUploadImage = async (useCamera: boolean) => {
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permissão necessária',
            'Precisamos de acesso à câmera para tirar sua foto da conquista.'
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.85,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permissão necessária',
            'Precisamos de acesso à sua galeria para selecionar sua foto da conquista.'
          );
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.85,
        });
      }

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const selectedUri = result.assets[0].uri;
      await uploadBadgePhoto(selectedUri);
    } catch (err: any) {
      console.error('Erro ao selecionar imagem:', err);
      Alert.alert('Erro', 'Não foi possível carregar a imagem selecionada.');
    }
  };

  const uploadBadgePhoto = async (uri: string) => {
    if (!user || !id) return;
    setUploadingPhoto(true);

    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = uri.split('.').pop() || 'jpg';
      const storageRef = ref(storage, `badge_photos/${user.uid}/${id}_${Date.now()}.${ext}`);

      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      const userRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userRef, {
          [`badgePhotos.${id}`]: {
            photoUrl: downloadURL,
            updatedAt: new Date().toISOString(),
          },
        });
      } catch {
        await setDoc(
          userRef,
          {
            badgePhotos: {
              [id]: {
                photoUrl: downloadURL,
                updatedAt: new Date().toISOString(),
              },
            },
          },
          { merge: true }
        );
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Foto Registrada! 🥋',
        'Sua foto foi adicionada à sua conquista com sucesso!'
      );
    } catch (err: any) {
      console.error('Erro ao enviar foto do emblema:', err);
      Alert.alert('Erro ao enviar foto', err.message || 'Ocorreu um erro ao salvar sua imagem.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    if (!user || !id) return;

    Alert.alert(
      'Remover Foto',
      'Tem certeza de que deseja remover a foto desta conquista?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setUploadingPhoto(true);
            try {
              const userRef = doc(db, 'users', user.uid);
              await updateDoc(userRef, {
                [`badgePhotos.${id}`]: deleteField(),
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Foto Removida', 'A foto foi removida deste emblema.');
            } catch (err: any) {
              console.error('Erro ao remover foto:', err);
              Alert.alert('Erro', 'Não foi possível remover a foto.');
            } finally {
              setUploadingPhoto(false);
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    if (!badge) return;
    try {
      const shareMessage = isEarned
        ? `🥋 Conquistei o emblema "${badge.name}" no Taekwondo Kihap!\n\n${badge.description || ''}\n\nFaça parte do time Kihap: https://kihap.com.br`
        : `🥋 Conheça o emblema "${badge.name}" da Kihap Martial Arts!\n\n${badge.description || ''}\n\nSaiba mais em: https://kihap.com.br`;

      await Share.share({
        title: badge.name,
        message: shareMessage,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-[#0a0a0a] items-center justify-center">
        <ActivityIndicator size="large" color="#eab308" />
        <Text className="text-gray-500 dark:text-gray-400 mt-4 text-xs font-semibold tracking-wider uppercase">
          Carregando emblema...
        </Text>
      </View>
    );
  }

  if (!badge) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-[#0a0a0a] items-center justify-center p-6">
        <Award size={48} color="#eab308" />
        <Text
          style={{ fontFamily: 'NeueMachina-Ultrabold' }}
          className="text-lg text-gray-900 dark:text-white mt-4 text-center"
        >
          Emblema não encontrado
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 text-xs mt-2 text-center max-w-xs">
          O emblema solicitado pode ter sido atualizado ou removido do catálogo.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 bg-yellow-500 px-6 py-3 rounded-2xl active:opacity-90"
        >
          <Text
            style={{ fontFamily: 'NeueMachina-Ultrabold' }}
            className="text-black text-xs uppercase"
          >
            Voltar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  let imageUri = badge.imageUrl || '';
  if (imageUri && imageUri.startsWith('/')) {
    imageUri = `https://kihap.com.br${imageUri}`;
  }

  const categoryConfig =
    CATEGORY_MAP[badge.category] || CATEGORY_MAP.graduacao;
  const CategoryIcon = categoryConfig.icon;

  let howToEarnText = (badge.howToEarn?.trim()
    ? badge.howToEarn
    : getHowToEarnFallback(badge.name))
    .replace(/\s*\(Poomsae\)/gi, '')
    .replace(/Poomsae/gi, '')
    .replace(/oficiais da categoria/gi, 'oficiais da graduação');

  const storyText = badge.story?.trim()
    ? badge.story
    : getBeltLoreFallback(badge.name);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-[#0a0a0a]">
      <StatusBar style="light" />

      {/* Floating Top Navbar */}
      <View
        style={{ paddingTop: Math.max(insets.top, 16) }}
        className="px-5 pb-3 flex-row items-center justify-between z-20 absolute top-0 left-0 right-0"
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-black/55 border border-white/20 items-center justify-center active:scale-95 transition-all shadow-md"
        >
          <ArrowLeft size={20} color="#ffffff" />
        </TouchableOpacity>

        <View className="px-3.5 py-1 rounded-full bg-black/45 border border-white/10">
          <Text
            style={{ fontFamily: 'NeueMachina-Ultrabold' }}
            className="text-[11px] uppercase tracking-widest text-white/90"
          >
            Emblema Marcial
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleShare}
          className="w-10 h-10 rounded-full bg-black/55 border border-white/20 items-center justify-center active:scale-95 transition-all shadow-md"
        >
          <Share2 size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 32 }}
      >
        {/* Cinematic Hero Section with Darkened Martial Photo Background */}
        <View
          style={{ paddingTop: Math.max(insets.top, 16) + 54 }}
          className="relative w-full overflow-hidden items-center justify-center pb-9 px-6 mb-5 bg-[#0a0a0a] shadow-xl shadow-black/30"
        >
          {/* Background Martial Image Container */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <ExpoImage
              source={
                badge.heroImageUrl || badge.backgroundUrl
                  ? { uri: badge.heroImageUrl || badge.backgroundUrl }
                  : require('../../assets/images/fundogero.jpg')
              }
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              contentPosition="center"
              transition={200}
            />

            {/* Dark Cinematic Gradient Overlay */}
            <LinearGradient
              colors={[
                'rgba(0, 0, 0, 0.40)',
                'rgba(10, 10, 10, 0.65)',
                '#0a0a0a',
              ]}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFillObject}
            />
          </View>

          {/* Glowing Badge Container */}
          <View className="relative items-center justify-center mb-5 z-10">
            {/* Ambient Radial Halo */}
            <View
              className={`absolute w-44 h-44 rounded-full ${
                isEarned ? 'bg-yellow-500/25' : 'bg-white/10'
              } blur-2xl`}
            />

            {/* Emblem Circle Frame */}
            <View
              className={`w-36 h-36 rounded-full p-2 items-center justify-center border-2 ${
                isEarned
                  ? 'border-yellow-400 bg-black/60 shadow-xl shadow-yellow-500/40'
                  : 'border-white/20 bg-black/70 shadow-lg shadow-black/80'
              }`}
            >
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  className="w-full h-full rounded-full"
                  resizeMode="contain"
                />
              ) : (
                <Award size={64} color={isEarned ? '#eab308' : '#9ca3af'} />
              )}
            </View>

            {/* Conquered Checkmark / Lock Pill Badge on Hero */}
            <View
              className={`absolute -bottom-2 px-3 py-1 rounded-full flex-row items-center gap-1.5 border shadow-md ${
                isEarned
                  ? 'bg-yellow-500 border-yellow-400 shadow-yellow-500/40'
                  : 'bg-black/90 border-gray-700'
              }`}
            >
              {isEarned ? (
                <>
                  <CheckCircle2 size={12} color="#000000" />
                  <Text
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-[9px] uppercase tracking-wider text-black font-black"
                  >
                    Conquistado
                  </Text>
                </>
              ) : (
                <>
                  <Lock size={12} color="#9ca3af" />
                  <Text
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-[9px] uppercase tracking-wider text-gray-300"
                  >
                    Bloqueado
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Category Pill with Glass Background */}
          <View
            className={`flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-yellow-500/30 mb-2.5 z-10`}
          >
            <CategoryIcon size={12} color={categoryConfig.color} />
            <Text
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-[10px] uppercase tracking-widest text-yellow-400"
            >
              {categoryConfig.label}
            </Text>
          </View>

          {/* Badge Name */}
          <Text
            style={{ fontFamily: 'NeueMachina-Ultrabold' }}
            className="text-2xl sm:text-3xl text-white text-center tracking-tight mb-2 drop-shadow-lg z-10"
          >
            {badge.name}
          </Text>

          {/* Short Description */}
          {badge.description ? (
            <Text className="text-gray-300 text-sm text-center leading-relaxed max-w-md px-4 drop-shadow-sm z-10">
              {badge.description}
            </Text>
          ) : null}
        </View>

        {/* Status Callout Banner */}
        <View className="px-5 mb-5">
          <View
            className={`p-4 rounded-3xl border flex-row items-center gap-3.5 ${
              isEarned
                ? 'bg-yellow-500/10 border-yellow-500/30 dark:bg-yellow-500/5 dark:border-yellow-500/20'
                : 'bg-white dark:bg-[#141414] border-gray-200/80 dark:border-white/5'
            }`}
          >
            <View
              className={`w-11 h-11 rounded-2xl items-center justify-center ${
                isEarned ? 'bg-yellow-500' : 'bg-gray-200 dark:bg-white/10'
              }`}
            >
              {isEarned ? (
                <Award size={22} color="#000000" />
              ) : (
                <Lock size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
              )}
            </View>
            <View className="flex-1">
              <Text
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className={`text-xs uppercase ${
                  isEarned
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-gray-800 dark:text-gray-200'
                }`}
              >
                {isEarned ? 'Emblema no seu Perfil' : 'Ainda não Conquistado'}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                {isEarned
                  ? 'Você conquistou este emblema com dedicação e honra nos treinos.'
                  : 'Continue praticando com foco e disciplina para adicioná-lo à sua galeria.'}
              </Text>
            </View>
          </View>
        </View>

        {/* Como Conquistar Card (Ocultado quando já tiver sido conquistado) */}
        {!isEarned && (
          <View className="px-5 mb-5">
            <View className="bg-white dark:bg-[#141414] p-5 rounded-3xl border border-gray-200/80 dark:border-white/5 shadow-sm">
              <View className="flex-row items-center gap-2.5 mb-3">
                <View className="w-8 h-8 rounded-xl bg-yellow-500/10 items-center justify-center">
                  <Target size={16} color="#eab308" />
                </View>
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-xs uppercase tracking-wider text-gray-900 dark:text-white"
                >
                  Como Conquistar
                </Text>
              </View>
              <Text className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm leading-relaxed">
                {howToEarnText}
              </Text>
            </View>
          </View>
        )}

        {/* Foto do Aluno na Conquista / Graduação */}
        <View className="px-5 mb-5">
          <View className="bg-white dark:bg-[#141414] p-5 rounded-3xl border border-gray-200/80 dark:border-white/5 shadow-sm">
            {/* Header do Card */}
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2.5">
                <View className="w-8 h-8 rounded-xl bg-yellow-500/10 items-center justify-center">
                  <Camera size={16} color="#eab308" />
                </View>
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-xs uppercase tracking-wider text-gray-900 dark:text-white"
                >
                  {isGraduation ? 'Foto da sua Graduação' : 'Foto da sua Conquista'}
                </Text>
              </View>

              {userPhotoUrl ? (
                <View className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex-row items-center gap-1">
                  <CheckCircle2 size={10} color="#10b981" />
                  <Text
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
                  >
                    Registrada
                  </Text>
                </View>
              ) : (
                <View className="px-2.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                  <Text
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-[9px] uppercase tracking-wider text-yellow-600 dark:text-yellow-400"
                  >
                    Momento Oficial
                  </Text>
                </View>
              )}
            </View>

            {/* Texto de Encorajamento / Destaque */}
            <Text className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm leading-relaxed mb-4">
              {isGraduation
                ? 'Eternize este momento especial! Adicione uma foto sua no exame de graduação, recebendo sua nova faixa ou comemorando a conquista no tatame com seus mestres e colegas. 🥋📸'
                : 'Eternize esta conquista marcial! Adicione uma foto marcante celebrando este momento especial no tatame da Kihap. 🥋📸'}
            </Text>

            {userPhotoUrl ? (
              // Foto já cadastrada pelo aluno
              <View>
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => setSelectedPreviewImage(userPhotoUrl)}
                  className="relative w-full h-64 rounded-2xl overflow-hidden bg-black mb-3.5 shadow-md border border-gray-200 dark:border-white/10"
                >
                  <Image
                    source={{ uri: userPhotoUrl }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.75)']}
                    className="absolute bottom-0 left-0 right-0 p-3 flex-row items-center justify-between"
                  >
                    <Text className="text-white text-[11px] font-semibold drop-shadow">
                      🥋 {isGraduation ? 'Registro Oficial da Graduação' : 'Registro da Conquista'}
                    </Text>
                    <View className="flex-row items-center gap-1 bg-black/60 px-2 py-0.5 rounded-full border border-white/20">
                      <Maximize2 size={10} color="#ffffff" />
                      <Text className="text-white text-[9px] font-medium">Ampliar</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Ações: Trocar / Remover */}
                <View className="flex-row items-center gap-2.5">
                  <TouchableOpacity
                    onPress={handleSelectPhoto}
                    disabled={uploadingPhoto}
                    className="flex-1 bg-yellow-500/10 dark:bg-yellow-500/20 border border-yellow-500/30 py-3 px-4 rounded-xl flex-row items-center justify-center gap-2 active:opacity-80"
                  >
                    {uploadingPhoto ? (
                      <ActivityIndicator size="small" color="#eab308" />
                    ) : (
                      <>
                        <Camera size={15} color="#eab308" />
                        <Text
                          style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                          className="text-[11px] text-yellow-600 dark:text-yellow-400 uppercase tracking-wider"
                        >
                          Trocar Foto
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleRemovePhoto}
                    disabled={uploadingPhoto}
                    className="bg-red-500/10 border border-red-500/20 py-3 px-4 rounded-xl flex-row items-center justify-center gap-1.5 active:opacity-80"
                  >
                    <Trash2 size={15} color="#ef4444" />
                    <Text
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-[11px] text-red-600 dark:text-red-400 uppercase tracking-wider"
                    >
                      Remover
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Sem foto cadastrada ainda - Botão de incentivo
              <TouchableOpacity
                onPress={handleSelectPhoto}
                disabled={uploadingPhoto}
                activeOpacity={0.8}
                className="w-full border-2 border-dashed border-yellow-500/40 dark:border-yellow-500/30 bg-yellow-500/5 dark:bg-yellow-500/[0.03] rounded-2xl p-5 items-center justify-center"
              >
                {uploadingPhoto ? (
                  <View className="items-center py-2">
                    <ActivityIndicator size="small" color="#eab308" />
                    <Text className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 font-semibold">
                      Enviando foto da conquista...
                    </Text>
                  </View>
                ) : (
                  <View className="items-center">
                    <View className="w-12 h-12 rounded-full bg-yellow-500/20 items-center justify-center mb-2">
                      <Camera size={22} color="#eab308" />
                    </View>
                    <Text
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-xs text-gray-900 dark:text-white uppercase tracking-wider text-center"
                    >
                      {isGraduation ? 'Adicionar Foto da Graduação' : 'Adicionar Foto da Conquista'}
                    </Text>
                    <Text className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 text-center">
                      Tire uma foto com a câmera ou escolha da sua galeria
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* História & Significado Marcial Card */}
        <View className="px-5 mb-6">
          <View className="bg-white dark:bg-[#141414] p-5 rounded-3xl border border-gray-200/80 dark:border-white/5 shadow-sm relative overflow-hidden">
            {/* Subtle decorative watermark */}
            <View className="absolute -bottom-6 -right-6 opacity-5 dark:opacity-10 pointer-events-none">
              <Scroll size={140} color="#eab308" />
            </View>

            <View className="flex-row items-center gap-2.5 mb-3">
              <View className="w-8 h-8 rounded-xl bg-yellow-500/10 items-center justify-center">
                <BookOpen size={16} color="#eab308" />
              </View>
              <Text
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-xs uppercase tracking-wider text-gray-900 dark:text-white"
              >
                História & Significado Marcial
              </Text>
            </View>

            <View className="border-l-2 border-yellow-500/40 pl-3.5 my-1">
              <Text className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm leading-relaxed italic">
                "{storyText}"
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom CTA / Action */}
        <View className="px-5">
          {isEarned ? (
            <TouchableOpacity
              onPress={handleShare}
              className="bg-yellow-500 p-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-lg shadow-yellow-500/30 active:opacity-90"
            >
              <Share2 size={18} color="#000000" />
              <Text
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-black text-xs uppercase tracking-wider font-black"
              >
                Compartilhar Conquista
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.back()}
              className="bg-white dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-300 dark:border-white/10 flex-row items-center justify-center gap-2 active:opacity-90"
            >
              <ArrowLeft size={16} color={isDark ? '#ffffff' : '#111827'} />
              <Text
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-gray-900 dark:text-white text-xs uppercase tracking-wider"
              >
                Voltar à Lista de Emblemas
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Modal de Pré-visualização da Foto em Tela Cheia */}
      <Modal
        visible={!!selectedPreviewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPreviewImage(null)}
      >
        <View className="flex-1 bg-black/95 items-center justify-center px-4">
          <TouchableOpacity
            onPress={() => setSelectedPreviewImage(null)}
            style={{ top: Math.max(insets.top, 20) }}
            className="absolute right-5 w-11 h-11 rounded-full bg-white/15 border border-white/20 items-center justify-center z-50 active:scale-95"
          >
            <X size={22} color="#ffffff" />
          </TouchableOpacity>

          {selectedPreviewImage ? (
            <Image
              source={{ uri: selectedPreviewImage }}
              className="w-full h-4/5 rounded-2xl"
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
