import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Dimensions,
  Platform,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  ShoppingBag,
  Share2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  X,
  ChevronRight,
  Maximize2,
  Radio,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

// Formata data ISO (YYYY-MM-DD...) para o formato brasileiro (DD/MM/AAAA)
function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    return `${d}/${m}/${y}`;
  }
  return str;
}

// Extrai dia e mês abreviado para badge de calendário
function getDateBadge(dateStr?: string | null): { day: string; month: string } | null {
  if (!dateStr) return null;
  const match = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, , m, d] = match;
  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const monthIdx = parseInt(m, 10) - 1;
  return {
    day: d,
    month: months[monthIdx] || m,
  };
}

export default function EventoDetailsScreen() {
  const { id, checkin, nfc } = useLocalSearchParams<{ id: string; checkin?: string; nfc?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, userData } = useAuth();

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);

  // Custom question form modal
  const [customFormModalVisible, setCustomFormModalVisible] = useState(false);
  const [formAnswers, setFormAnswers] = useState<Record<string, any>>({});

  // Fullscreen gallery viewer
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // 1. Subscribe to Event in real-time
  useEffect(() => {
    if (!id) return;
    const eventDocRef = doc(db, 'events', id);
    const unsubscribe = onSnapshot(
      eventDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setEvent({ id: docSnap.id, ...docSnap.data() });
        } else {
          setEvent(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to event:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // 2. Check if user is already checked in
  useEffect(() => {
    if (!id || !user) return;
    const checkinDocRef = doc(db, 'events', id, 'checkins', user.uid);
    const unsubscribe = onSnapshot(checkinDocRef, (snap) => {
      setIsCheckedIn(snap.exists());
    });
    return () => unsubscribe();
  }, [id, user]);

  // 3. Auto-trigger checkin if requested via NFC or Deep Link
  useEffect(() => {
    if (event && !loading && !isCheckedIn && (checkin === 'true' || nfc === 'true')) {
      handleCheckin();
    }
  }, [event, loading, isCheckedIn, checkin, nfc]);

  const handleShare = async () => {
    if (!event) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const url = `https://kihap.com.br/evento?id=${event.id}`;
      await Share.share({
        title: event.title,
        message: `Confira o evento ${event.title} no aplicativo Kihap!\nData: ${formatDateBR(event.date)}\nLocal: ${event.location || 'Kihap'}\n${url}`,
        url,
      });
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  const performCheckin = async (answersMap: any = {}, answersList: any[] = []) => {
    if (!user || !event) return;
    setCheckinLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const studentName = userData?.name || userData?.nome || user.displayName || 'Aluno Kihap';
      const studentGraduation = userData?.belt || userData?.graduacao || userData?.graduation || userData?.userGraduacao || 'Não informada';
      const studentUnit = userData?.unit || userData?.unidade || userData?.unitName || userData?.unidadeNome || 'Não informada';
      const studentEmail = user.email || userData?.email || '';
      const studentPhoto = userData?.photoURL || userData?.profilePicture || userData?.photoUrl || userData?.avatar || '';

      const checkinDocRef = doc(db, 'events', event.id, 'checkins', user.uid);

      await setDoc(checkinDocRef, {
        userId: user.uid,
        userName: studentName,
        userGraduation: studentGraduation,
        userUnit: studentUnit,
        userEmail: studentEmail,
        userPhoto: studentPhoto,
        customAnswers: answersMap,
        customAnswersList: answersList,
        checkedInAt: serverTimestamp(),
      });

      setCustomFormModalVisible(false);
      setFormAnswers({});
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Presença Confirmada! 🥋',
        `Parabéns, ${studentName}! Seu check-in no evento "${event.title}" foi registrado com sucesso.`,
        [{ text: 'Maravilha!' }]
      );
    } catch (error) {
      console.error('Error checking in:', error);
      Alert.alert('Erro no Check-in', 'Não foi possível confirmar sua presença. Tente novamente.');
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleCheckin = () => {
    if (!user) {
      Alert.alert('Atenção', 'Você precisa estar logado para fazer check-in.');
      return;
    }
    if (isCheckedIn) {
      Alert.alert('Presença Já Confirmada', 'Você já realizou o check-in para este evento!');
      return;
    }

    if (event.customForm && Array.isArray(event.customForm) && event.customForm.length > 0) {
      setFormAnswers({});
      setCustomFormModalVisible(true);
    } else {
      performCheckin();
    }
  };

  const handleSubmitCustomForm = () => {
    if (!event?.customForm) return;

    for (const field of event.customForm) {
      if (field.required) {
        const val = formAnswers[field.id];
        if (val === undefined || val === null || String(val).trim() === '') {
          Alert.alert('Campo Obrigatório', `Por favor, responda: "${field.label}"`);
          return;
        }
      }
    }

    const answersList = event.customForm.map((f: any) => ({
      label: f.label,
      answer: formAnswers[f.id] !== undefined ? formAnswers[f.id] : null,
    }));

    performCheckin(formAnswers, answersList);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white dark:bg-[#0a0a0c] items-center justify-center">
        <ActivityIndicator size="large" color="#eab308" />
        <Text className="text-gray-400 text-xs font-semibold mt-3">Carregando detalhes do evento...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View className="flex-1 bg-white dark:bg-[#0a0a0c] items-center justify-center px-6">
        <AlertCircle size={48} color="#ef4444" />
        <Text className="text-gray-900 dark:text-white text-lg font-bold mt-4 text-center">
          Evento Não Encontrado
        </Text>
        <Text className="text-gray-500 text-xs text-center mt-1 mb-6">
          O evento que você está procurando pode ter sido removido ou o link está incorreto.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-yellow-500 px-5 py-2.5 rounded-xl"
        >
          <Text className="text-black font-bold text-sm">Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const heroImageUri = event.heroUrl || event.coverUrl;
  const dateBadge = getDateBadge(event.date);
  const hasTime = !!(event.time && event.time.trim() && event.time !== '00');
  const scheduleList: any[] = Array.isArray(event.schedule) ? event.schedule : [];
  const galleryList: string[] = Array.isArray(event.gallery) ? event.gallery : [];

  return (
    <View className="flex-1 bg-gray-50 dark:bg-[#0a0a0c]">
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ========================================================= */}
        {/* HERO BANNER SECTION                                       */}
        {/* ========================================================= */}
        <View className="relative w-full h-[360px] bg-black">
          {heroImageUri ? (
            <ExpoImage
              source={{ uri: heroImageUri }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={300}
            />
          ) : (
            <View className="w-full h-full bg-[#111] items-center justify-center">
              <Calendar size={64} color="#333" />
            </View>
          )}

          {/* Top-to-bottom soft gradient */}
          <LinearGradient
            colors={['rgba(0,0,0,0.65)', 'transparent', 'rgba(0,0,0,0.95)']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Top Bar Navigation (Back & Share) */}
          <View
            style={{ paddingTop: Math.max(insets.top, 16) }}
            className="px-5 flex-row items-center justify-between z-20"
          >
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.8}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md items-center justify-center border border-white/10"
            >
              <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShare}
              activeOpacity={0.8}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md items-center justify-center border border-white/10"
            >
              <Share2 size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Hero Bottom Info (Date Badge, Tag, Title) */}
          <View className="absolute bottom-5 left-5 right-5 z-20">
            {(dateBadge || isCheckedIn) && (
              <View className="flex-row items-center mb-3" style={{ gap: 10 }}>
                {dateBadge && (
                  <View className="bg-yellow-500 rounded-xl px-2.5 py-1 items-center justify-center shadow-lg">
                    <Text className="text-[10px] font-black text-black leading-tight">
                      {dateBadge.month}
                    </Text>
                    <Text className="text-sm font-black text-black leading-tight">
                      {dateBadge.day}
                    </Text>
                  </View>
                )}
                {isCheckedIn && (
                  <View className="bg-emerald-500/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/40 flex-row items-center" style={{ gap: 4 }}>
                    <CheckCircle2 size={12} color="#10b981" />
                    <Text className="text-emerald-400 text-[11px] font-bold">
                      Inscrito
                    </Text>
                  </View>
                )}
              </View>
            )}

            <Text
              style={{ fontFamily: 'NeueMachina-Ultrabold', fontWeight: 'normal' }}
              className="text-2xl sm:text-3xl text-white uppercase tracking-tight leading-tight shadow-md"
            >
              {event.title}
            </Text>
          </View>
        </View>

        {/* ========================================================= */}
        {/* QUICK META PILLS (Date, Time, Location, Store)             */}
        {/* ========================================================= */}
        <View className="px-5 py-4 bg-white dark:bg-[#121215] border-b border-gray-100 dark:border-white/5" style={{ gap: 10 }}>
          <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
            {event.date && (
              <View className="flex-row items-center bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-gray-200/60 dark:border-white/5">
                <Calendar size={14} color="#eab308" />
                <Text className="text-xs font-bold text-gray-800 dark:text-gray-200 ml-1.5">
                  {formatDateBR(event.date)}
                </Text>
              </View>
            )}

            {hasTime && (
              <View className="flex-row items-center bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-gray-200/60 dark:border-white/5">
                <Clock size={14} color="#eab308" />
                <Text className="text-xs font-bold text-gray-800 dark:text-gray-200 ml-1.5">
                  {event.time}
                </Text>
              </View>
            )}

            {event.location && (
              <View className="flex-row items-center bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-gray-200/60 dark:border-white/5 flex-1 min-w-[140px]">
                <MapPin size={14} color="#eab308" />
                <Text
                  className="text-xs font-semibold text-gray-800 dark:text-gray-200 ml-1.5"
                  numberOfLines={1}
                >
                  {event.location}
                </Text>
              </View>
            )}
          </View>

          {/* Linked Store Product Callout */}
          {event.productId && (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/store/[id]',
                  params: { id: event.productId },
                })
              }
              activeOpacity={0.8}
              className="mt-1 bg-yellow-500/10 dark:bg-yellow-500/5 border border-yellow-500/25 p-3 rounded-2xl flex-row items-center justify-between"
            >
              <View className="flex-row items-center flex-1 mr-2">
                <ShoppingBag size={18} color="#eab308" />
                <View className="ml-2.5 flex-1">
                  <Text className="text-xs font-bold text-gray-900 dark:text-white">
                    Produto / Inscrição na Loja Oficial
                  </Text>
                  <Text className="text-[11px] text-gray-500 dark:text-gray-400">
                    Toque para visualizar detalhes e adquirir com desconto de aluno.
                  </Text>
                </View>
              </View>
              <ChevronRight size={16} color="#eab308" />
            </TouchableOpacity>
          )}
        </View>

        {/* ========================================================= */}
        {/* MAIN DETAILS CONTENT                                      */}
        {/* ========================================================= */}
        <View style={{ padding: 20, gap: 16 }}>
          {/* 1. SOBRE O EVENTO */}
          {event.description ? (
            <View className="bg-white dark:bg-[#121215] p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
              <View className="flex-row items-center mb-3">
                <View className="w-8 h-8 rounded-xl bg-yellow-500/10 items-center justify-center mr-2.5">
                  <Info size={18} color="#eab308" />
                </View>
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold', fontWeight: 'normal' }}
                  className="text-base text-gray-900 dark:text-white uppercase tracking-tight"
                >
                  Sobre o Evento
                </Text>
              </View>
              <Text className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {event.description}
              </Text>
            </View>
          ) : null}

          {/* 2. PROGRAMAÇÃO & CRONOGRAMA */}
          {scheduleList.length > 0 && (
            <View className="bg-white dark:bg-[#121215] p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-xl bg-yellow-500/10 items-center justify-center mr-2.5">
                    <Clock size={18} color="#eab308" />
                  </View>
                  <Text
                    style={{ fontFamily: 'NeueMachina-Ultrabold', fontWeight: 'normal' }}
                    className="text-base text-gray-900 dark:text-white uppercase tracking-tight"
                  >
                    Programação
                  </Text>
                </View>
                <View className="bg-gray-100 dark:bg-white/5 px-2.5 py-1 rounded-full">
                  <Text className="text-[10px] font-bold text-gray-500 uppercase">
                    {scheduleList.length} etapas
                  </Text>
                </View>
              </View>

              {/* Timeline Items */}
              <View className="pl-2">
                {scheduleList.map((item, index) => {
                  const isLast = index === scheduleList.length - 1;
                  return (
                    <View key={index} className="flex-row">
                      {/* Timeline dot & vertical bar */}
                      <View className="items-center mr-3.5">
                        <View className="w-3.5 h-3.5 rounded-full bg-yellow-500 border-2 border-white dark:border-[#121215] shadow-sm z-10" />
                        {!isLast && (
                          <View className="w-0.5 flex-1 bg-yellow-500/30 my-0.5" />
                        )}
                      </View>

                      {/* Timeline content */}
                      <View className="flex-1 pb-5">
                        <View className="flex-row items-center">
                          {item.time && (
                            <View className="bg-yellow-500/15 px-2 py-0.5 rounded-md mr-2">
                              <Text className="text-[11px] font-black text-yellow-600 dark:text-yellow-400">
                                {item.time}
                              </Text>
                            </View>
                          )}
                          <Text className="font-bold text-sm text-gray-900 dark:text-white flex-1">
                            {item.title}
                          </Text>
                        </View>
                        {item.description ? (
                          <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                            {item.description}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* 3. ORIENTAÇÕES IMPORTANTES */}
          {event.guidelines ? (
            <View className="bg-amber-500/10 dark:bg-amber-500/5 p-5 rounded-3xl border border-amber-500/20">
              <View className="flex-row items-center mb-2.5">
                <AlertCircle size={20} color="#f59e0b" />
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold', fontWeight: 'normal' }}
                  className="text-base text-gray-900 dark:text-white uppercase tracking-tight ml-2"
                >
                  Orientações Importantes
                </Text>
              </View>
              <Text className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                {event.guidelines}
              </Text>
            </View>
          ) : null}

          {/* 4. GALERIA DE FOTOS */}
          {galleryList.length > 0 && (
            <View className="bg-white dark:bg-[#121215] p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
              <View className="flex-row items-center justify-between mb-3.5">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-xl bg-yellow-500/10 items-center justify-center mr-2.5">
                    <Sparkles size={18} color="#eab308" />
                  </View>
                  <Text
                    style={{ fontFamily: 'NeueMachina-Ultrabold', fontWeight: 'normal' }}
                    className="text-base text-gray-900 dark:text-white uppercase tracking-tight"
                  >
                    Galeria do Evento
                  </Text>
                </View>
                <Text className="text-[11px] font-bold text-gray-400">
                  {galleryList.length} fotos
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="-mx-5 px-5"
              >
                {galleryList.map((photoUrl, pIdx) => (
                  <TouchableOpacity
                    key={pIdx}
                    onPress={() => setFullscreenImage(photoUrl)}
                    activeOpacity={0.85}
                    style={{ width: 140, height: 140, marginRight: 10 }}
                    className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-black/40 border border-gray-200/60 dark:border-white/5 relative"
                  >
                    <ExpoImage
                      source={{ uri: photoUrl }}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="cover"
                      transition={200}
                    />
                    <View className="absolute bottom-1.5 right-1.5 bg-black/60 p-1 rounded-lg">
                      <Maximize2 size={12} color="#fff" />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 5. CARD INFORMATIVO DE NFC / CHECK-IN */}
          <View className="bg-gray-100 dark:bg-white/5 p-4 rounded-2xl border border-gray-200/60 dark:border-white/5 flex-row items-center mb-6">
            <View className="w-10 h-10 rounded-xl bg-yellow-500/15 items-center justify-center mr-3">
              <Radio size={20} color="#eab308" />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-xs text-gray-900 dark:text-white">
                Check-in por Aproximação (NFC)
              </Text>
              <Text className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                No local do evento, basta encostar o celular na tag NFC na recepção para confirmar presença na hora.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ========================================================= */}
      {/* STICKY BOTTOM CHECK-IN BAR                                */}
      {/* ========================================================= */}
      <View
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        className="absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-xl border-t border-gray-200/80 dark:border-white/10 px-5 pt-3.5 z-30"
      >
        {isCheckedIn ? (
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-3">
              <View className="w-10 h-10 rounded-full bg-emerald-500/15 items-center justify-center mr-3 border border-emerald-500/30">
                <CheckCircle2 size={22} color="#10b981" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-sm text-gray-900 dark:text-white">
                  Presença Confirmada!
                </Text>
                <Text className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Seu check-in foi registrado no sistema.
                </Text>
              </View>
            </View>
            <View className="bg-emerald-500 px-3 py-1.5 rounded-xl">
              <Text className="text-white text-xs font-black">Check-in OK</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleCheckin}
            disabled={checkinLoading}
            activeOpacity={0.85}
            className="w-full bg-yellow-500 py-3.5 rounded-2xl flex-row items-center justify-center shadow-lg shadow-yellow-500/30"
          >
            {checkinLoading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <CheckCircle2 size={18} color="#000" />
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold', fontWeight: 'normal' }}
                  className="text-black text-sm uppercase tracking-wider ml-2"
                >
                  Confirmar Presença (Check-in)
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ========================================================= */}
      {/* CUSTOM FORM QUESTIONS MODAL                                */}
      {/* ========================================================= */}
      <Modal
        visible={customFormModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomFormModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View
            style={{ paddingBottom: Math.max(insets.bottom, 24) }}
            className="bg-white dark:bg-[#151517] rounded-t-3xl p-6 max-h-[85%]"
          >
            <View className="flex-row items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5 mb-4">
              <View className="flex-1 mr-2">
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold', fontWeight: 'normal' }}
                  className="text-lg text-gray-900 dark:text-white uppercase tracking-tight"
                >
                  Confirmar Presença
                </Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  Por favor, responda às perguntas para concluir o check-in.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCustomFormModalVisible(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 items-center justify-center"
              >
                <X size={16} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
              {event.customForm?.map((field: any, idx: number) => (
                <View key={field.id || idx} className="mb-4">
                  <Text className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1.5">
                    {field.label} {field.required && <Text className="text-red-500">*</Text>}
                  </Text>

                  {field.type === 'text' && (
                    <TextInput
                      value={formAnswers[field.id] || ''}
                      onChangeText={(txt) =>
                        setFormAnswers((prev) => ({ ...prev, [field.id]: txt }))
                      }
                      placeholder="Sua resposta..."
                      placeholderTextColor="#888"
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white"
                    />
                  )}

                  {field.type === 'select' && (
                    <View style={{ gap: 6 }}>
                      {field.options?.map((opt: string, oIdx: number) => {
                        const isOptSelected = formAnswers[field.id] === opt;
                        return (
                          <TouchableOpacity
                            key={oIdx}
                            onPress={() =>
                              setFormAnswers((prev) => ({ ...prev, [field.id]: opt }))
                            }
                            className={`p-3 rounded-xl border flex-row items-center justify-between ${
                              isOptSelected
                                ? 'bg-yellow-500/15 border-yellow-500'
                                : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10'
                            }`}
                          >
                            <Text
                              className={`text-xs ${
                                isOptSelected
                                  ? 'font-bold text-yellow-600 dark:text-yellow-400'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {opt}
                            </Text>
                            {isOptSelected && <CheckCircle2 size={16} color="#eab308" />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={handleSubmitCustomForm}
              disabled={checkinLoading}
              className="w-full bg-yellow-500 py-3.5 rounded-xl items-center justify-center shadow-lg"
            >
              {checkinLoading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold', fontWeight: 'normal' }}
                  className="text-black font-black uppercase tracking-wider text-sm"
                >
                  Concluir Check-in
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* FULLSCREEN IMAGE VIEWER MODAL                              */}
      {/* ========================================================= */}
      <Modal
        visible={!!fullscreenImage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenImage(null)}
      >
        <View className="flex-1 bg-black items-center justify-center relative">
          <TouchableOpacity
            style={{ top: Math.max(insets.top, 20) }}
            onPress={() => setFullscreenImage(null)}
            className="absolute right-5 z-20 w-10 h-10 rounded-full bg-white/20 items-center justify-center backdrop-blur-md"
          >
            <X size={20} color="#fff" />
          </TouchableOpacity>

          {fullscreenImage && (
            <ExpoImage
              source={{ uri: fullscreenImage }}
              style={{ width: '100%', height: '80%' }}
              contentFit="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
