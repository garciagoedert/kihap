import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  CheckCircle2,
  Flame,
  HelpCircle,
  Sparkles,
  Target,
  ChevronRight,
  BookOpen,
  Award,
} from 'lucide-react-native';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../src/services/firebase';
import { useAuth } from '../src/context/AuthContext';
import Emoji from '../src/components/Emoji';
import {
  DEFAULT_WEEKLY_QUIZZES,
  getCurrentWeekKey,
  getEffectiveKihapcoins,
  getLocalDateStr,
  WeeklyQuizItem,
} from '../src/utils/engagement';

function getWeekDateRange(d: Date = new Date()) {
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: getLocalDateStr(monday),
    end: getLocalDateStr(sunday),
  };
}

export default function MissoesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, userData } = useAuth();

  const weekKey = getCurrentWeekKey();
  const myCoins = getEffectiveKihapcoins(userData);

  const [weeklyAttendanceDays, setWeeklyAttendanceDays] = useState(0);
  const [claimedItems, setClaimedItems] = useState<Set<string>>(new Set());
  const [quizzes, setQuizzes] = useState<WeeklyQuizItem[]>([]);
  const [quizAttempt, setQuizAttempt] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [claimingMissionId, setClaimingMissionId] = useState<string | null>(null);

  // Weekly attendance check
  useEffect(() => {
    const memberId = userData?.evoMemberId || user?.uid;
    if (!memberId) return;

    const { start, end } = getWeekDateRange();
    const q = query(
      collection(db, 'classInstances'),
      where('date', '>=', start),
      where('date', '<=', end)
    );

    const unsub = onSnapshot(q, (snap) => {
      const uniqueDates = new Set<string>();
      snap.forEach((d) => {
        const data = d.data();
        const present = data.presentStudents || [];
        const isPresent =
          present.includes(String(memberId)) ||
          (!isNaN(Number(memberId)) && present.includes(Number(memberId))) ||
          (user?.uid && present.includes(user.uid));
        if (isPresent && data.date) {
          uniqueDates.add(data.date);
        }
      });
      setWeeklyAttendanceDays(uniqueDates.size);
    });

    return () => unsub();
  }, [user?.uid, userData?.evoMemberId]);

  // Listen to claimed mission rewards for current week
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'mission_claims'),
      where('userId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const claimed = new Set<string>();
      snap.forEach((d) => {
        const data = d.data();
        if (data.periodKey === weekKey && data.itemId) {
          claimed.add(`${data.claimType}_${data.itemId}`);
        }
      });
      setClaimedItems(claimed);
    });
    return () => unsub();
  }, [user?.uid, weekKey]);

  // Listen to quiz attempt this week
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      doc(db, 'quiz_attempts', `${user.uid}_${weekKey}`),
      (snap) => {
        if (snap.exists()) {
          setQuizAttempt(snap.data());
        } else {
          setQuizAttempt(null);
        }
      }
    );
    return () => unsub();
  }, [user?.uid, weekKey]);

  // Listen to active weekly quizzes
  useEffect(() => {
    const q = query(collection(db, 'weekly_quizzes'), where('active', '==', true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<WeeklyQuizItem, 'id'>),
        }));
        setQuizzes(list);
      },
      () => setQuizzes([])
    );
    return () => unsub();
  }, []);

  const activeQuiz: WeeklyQuizItem = useMemo(() => {
    const pool = quizzes.length > 0 ? quizzes : DEFAULT_WEEKLY_QUIZZES;
    const weekNumberMatch = weekKey.match(/W(\d+)/);
    const weekNum = weekNumberMatch ? Number(weekNumberMatch[1]) : 1;
    return pool[weekNum % pool.length];
  }, [quizzes, weekKey]);

  const weeklyProgress = userData?.weeklyProgress?.[weekKey] || {};
  const tatameDone = Boolean(weeklyProgress.tatameRead);
  const cheerDone = Boolean(weeklyProgress.cheerSent);
  const quizDone = Boolean(quizAttempt || weeklyProgress.quizAnswered || claimedItems.has(`weekly_quiz_${activeQuiz.id}`));

  const missions = [
    {
      id: 'train_2x',
      title: 'Treinar 2x na semana',
      description: 'Faça check-in em pelo menos 2 aulas diferentes esta semana.',
      reward: 20,
      progress: Math.min(weeklyAttendanceDays, 2),
      target: 2,
      done: weeklyAttendanceDays >= 2,
      ctaLabel: 'Fazer check-in',
      onCta: () => router.push('/(tabs)/notificacoes'),
    },
    {
      id: 'tatame_study',
      title: 'Estudar no Tatame',
      description: 'Abra e leia/assista 1 conteúdo do Tatame esta semana.',
      reward: 10,
      progress: tatameDone ? 1 : 0,
      target: 1,
      done: tatameDone,
      ctaLabel: 'Ir para Tatame',
      onCta: () => router.push('/tatame'),
    },
    {
      id: 'weekly_quiz',
      title: 'Responder ao Quiz da Semana',
      description: 'Participe do quiz rápido de filosofia e técnicas logo acima.',
      reward: 15,
      progress: quizDone ? 1 : 0,
      target: 1,
      done: quizDone,
      ctaLabel: null,
      onCta: null,
    },
    {
      id: 'social_cheer',
      title: 'Dar um Kihap para um colega',
      description: 'Parabenize ou incentive um colega no Ranking da sua unidade.',
      reward: 10,
      progress: cheerDone ? 1 : 0,
      target: 1,
      done: cheerDone,
      ctaLabel: 'Ir ao Ranking',
      onCta: () => router.push('/(tabs)/notificacoes'),
    },
  ];

  const handleAnswerQuiz = async (idx: number) => {
    if (quizAttempt || submittingQuiz) return;
    setSelectedOption(idx);
    setSubmittingQuiz(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      const claimFn = httpsCallable(functions, 'claimMissionReward');
      const res: any = await claimFn({
        claimType: 'weekly_quiz',
        periodKey: weekKey,
        itemId: activeQuiz.id,
        metadata: {
          selectedIndex: idx,
          isCorrect: idx === activeQuiz.correctIndex,
        },
      });
      const coinsAwarded = res?.data?.coinsAwarded || 0;
      if (coinsAwarded > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert(
          idx === activeQuiz.correctIndex ? 'Resposta Certa! 🥋' : 'Participação Registrada! 🔥',
          `Você ganhou +${coinsAwarded} Kihapcoins no Quiz da Semana!`
        );
      }
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível registrar sua resposta.');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const handleClaimMission = async (missionId: string) => {
    if (claimingMissionId) return;
    setClaimingMissionId(missionId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      const claimFn = httpsCallable(functions, 'claimMissionReward');
      const res: any = await claimFn({
        claimType: 'weekly_mission',
        periodKey: weekKey,
        itemId: missionId,
      });
      const coinsAwarded = res?.data?.coinsAwarded || 0;
      if (coinsAwarded > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert('Missão Concluída! 🎉', `Você resgatou +${coinsAwarded} Kihapcoins!`);
      }
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível resgatar a recompensa.');
    } finally {
      setClaimingMissionId(null);
    }
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top }} className="flex-1 bg-[#f8f9fa] dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Header */}
      <View className="flex-row items-center justify-between px-5 pt-3 pb-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 items-center justify-center mr-3"
          >
            <ArrowLeft size={20} color={isDark ? '#fff' : '#111'} />
          </TouchableOpacity>
          <View>
            <Text
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-xl text-gray-900 dark:text-white uppercase tracking-tight"
            >
              Missões & Quiz
            </Text>
            <Text className="text-[11px] font-semibold text-gray-400">
              Semana {weekKey} • Renova toda segunda
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/clube-coins')}
          className="flex-row items-center bg-yellow-500/15 border border-yellow-500/35 px-3 py-1.5 rounded-full"
        >
          <Sparkles size={13} color="#eab308" style={{ marginRight: 5 }} />
          <Text
            style={{ fontFamily: 'NeueMachina-Ultrabold' }}
            className="text-xs text-yellow-600 dark:text-yellow-400"
          >
            {myCoins}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 24) + 24 }}
      >
        {/* QUIZ SEMANAL DO TATAME */}
        <View className="bg-white dark:bg-[#141414] p-5 rounded-3xl border border-yellow-500/30 shadow-sm mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-xl bg-yellow-500/15 items-center justify-center mr-2.5">
                <HelpCircle size={18} color="#eab308" />
              </View>
              <View>
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-xs text-gray-900 dark:text-white uppercase"
                >
                  Quiz do Tatame
                </Text>
                <Text className="text-[10px] text-gray-400">
                  Responda para ganhar +{activeQuiz.rewardCoins || 15} Kihapcoins
                </Text>
              </View>
            </View>
            {quizAttempt && (
              <View className="bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                <Text className="text-[9px] font-black text-emerald-500 uppercase">Respondido</Text>
              </View>
            )}
          </View>

          <Text className="text-[15px] font-bold text-gray-900 dark:text-white leading-snug mb-4">
            {activeQuiz.question}
          </Text>

          <View className="gap-2.5">
            {activeQuiz.options.map((optionText, idx) => {
              const answeredIndex = quizAttempt?.selectedIndex ?? selectedOption;
              const isAnswered = answeredIndex !== null && answeredIndex !== undefined;
              const isPicked = answeredIndex === idx;
              const isCorrectOption = idx === activeQuiz.correctIndex;

              let borderClass = 'border-gray-200 dark:border-white/10';
              let bgClass = 'bg-gray-50 dark:bg-white/5';
              if (isAnswered) {
                if (isCorrectOption) {
                  borderClass = 'border-emerald-500';
                  bgClass = 'bg-emerald-500/15';
                } else if (isPicked) {
                  borderClass = 'border-red-500';
                  bgClass = 'bg-red-500/15';
                }
              }

              return (
                <TouchableOpacity
                  key={idx}
                  disabled={Boolean(quizAttempt) || submittingQuiz}
                  onPress={() => handleAnswerQuiz(idx)}
                  activeOpacity={0.85}
                  className={`p-3.5 rounded-2xl border flex-row items-center justify-between ${bgClass} ${borderClass}`}
                >
                  <Text className="text-xs font-semibold text-gray-900 dark:text-white flex-1 pr-2 leading-relaxed">
                    {optionText}
                  </Text>
                  {isAnswered && isCorrectOption && (
                    <CheckCircle2 size={16} color="#10b981" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {quizAttempt && !!activeQuiz.explanation && (
            <View className="mt-4 p-3.5 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
              <Text className="text-[11px] font-bold text-yellow-700 dark:text-yellow-400 mb-0.5 uppercase">
                Sabedoria Kihap:
              </Text>
              <Text className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                {activeQuiz.explanation}
              </Text>
            </View>
          )}
        </View>

        {/* MISSÕES SEMANAIS */}
        <View className="mb-4">
          <Text
            style={{ fontFamily: 'NeueMachina-Ultrabold' }}
            className="text-sm text-gray-900 dark:text-white uppercase tracking-tight mb-3"
          >
            Missões desta Semana
          </Text>

          {missions.map((m) => {
            const alreadyClaimed = claimedItems.has(`weekly_mission_${m.id}`);
            const pct = Math.round((m.progress / m.target) * 100);
            const isClaiming = claimingMissionId === m.id;

            return (
              <View
                key={m.id}
                className="bg-white dark:bg-[#141414] p-4 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm mb-3"
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 mr-3">
                    <Text className="font-bold text-sm text-gray-900 dark:text-white">
                      {m.title}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                      {m.description}
                    </Text>
                  </View>
                  <View className="bg-yellow-500/15 border border-yellow-500/30 px-2.5 py-1 rounded-full flex-row items-center gap-1">
                    <Text className="text-[10px] font-black text-yellow-600 dark:text-yellow-400">
                      +{m.reward}
                    </Text>
                    <Emoji symbol="⚡" size={11} />
                  </View>
                </View>

                {/* Progress bar */}
                <View className="flex-row items-center mb-3 mt-1">
                  <View className="flex-1 h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden mr-3">
                    <View
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full ${m.done ? 'bg-emerald-500' : 'bg-[#eab308]'}`}
                    />
                  </View>
                  <Text className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                    {m.progress}/{m.target}
                  </Text>
                </View>

                {alreadyClaimed ? (
                  <View className="bg-emerald-500/10 py-2.5 rounded-xl border border-emerald-500/20 flex-row items-center justify-center">
                    <CheckCircle2 size={14} color="#10b981" style={{ marginRight: 6 }} />
                    <Text className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase">
                      Recompensa Resgatada
                    </Text>
                  </View>
                ) : m.done ? (
                  <TouchableOpacity
                    onPress={() => handleClaimMission(m.id)}
                    disabled={isClaiming}
                    className="bg-[#eab308] py-3 rounded-xl flex-row items-center justify-center shadow-sm active:opacity-90"
                  >
                    {isClaiming ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-black text-xs uppercase tracking-wider"
                      >
                        Resgatar +{m.reward} Kihapcoins
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : m.ctaLabel && m.onCta ? (
                  <TouchableOpacity
                    onPress={m.onCta}
                    className="bg-gray-100 dark:bg-white/5 py-2.5 px-4 rounded-xl flex-row items-center justify-between"
                  >
                    <Text className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      {m.ctaLabel}
                    </Text>
                    <ChevronRight size={15} color={isDark ? '#aaa' : '#555'} />
                  </TouchableOpacity>
                ) : (
                  <View className="py-1.5">
                    <Text className="text-[11px] text-gray-400 font-semibold">
                      Responda ao Quiz do Tatame acima para completar
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Link Clube de Coins */}
        <TouchableOpacity
          onPress={() => router.push('/clube-coins')}
          className="bg-black dark:bg-[#1a1a1a] p-4 rounded-2xl border border-yellow-500/30 flex-row items-center justify-between"
        >
          <View className="flex-row items-center flex-1 mr-3">
            <Award size={20} color="#eab308" style={{ marginRight: 10 }} />
            <View className="flex-1">
              <Text
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-xs text-white uppercase"
              >
                Usar seus Kihapcoins
              </Text>
              <Text className="text-[11px] text-gray-400 mt-0.5">
                Troque por Escudo de Chama, molduras e cupons na Loja!
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color="#eab308" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
