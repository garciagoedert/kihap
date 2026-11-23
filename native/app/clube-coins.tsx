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
import Emoji from '../src/components/Emoji';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Check,
  Gift,
  History,
  Shield,
  Sparkles,
  Ticket,
  ChevronRight,
} from 'lucide-react-native';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../src/services/firebase';
import { useAuth } from '../src/context/AuthContext';
import {
  AVATAR_FRAMES,
  CoinRewardItem,
  DEFAULT_COIN_REWARDS,
  getEffectiveKihapcoins,
} from '../src/utils/engagement';

type ClubeTab = 'recompensas' | 'resgates' | 'extrato';

function formatTxDate(createdAt: any): string {
  if (!createdAt) return 'Agora';
  try {
    const d =
      typeof createdAt.toDate === 'function'
        ? createdAt.toDate()
        : createdAt.seconds
          ? new Date(createdAt.seconds * 1000)
          : new Date(createdAt);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return '';
  }
}

export default function ClubeCoinsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, userData } = useAuth();

  const myCoins = getEffectiveKihapcoins(userData);
  const myShields = Number(userData?.streakShields || 0);
  const unlockedFrames: string[] = Array.isArray(userData?.unlockedFrames) ? userData.unlockedFrames : [];
  const activeFrame: string = userData?.avatarFrame || 'none';

  const [activeTab, setActiveTab] = useState<ClubeTab>('recompensas');
  const [customRewards, setCustomRewards] = useState<CoinRewardItem[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'coin_rewards'), where('active', '==', true)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CoinRewardItem, 'id'>),
        }));
        setCustomRewards(list);
      },
      () => setCustomRewards([])
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubRedemptions = onSnapshot(
      query(
        collection(db, 'coin_redemptions'),
        where('userId', '==', user.uid),
        limit(50)
      ),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setRedemptions(list);
      }
    );

    const unsubTx = onSnapshot(
      query(
        collection(db, 'kihapcoin_transactions'),
        where('userId', '==', user.uid),
        limit(50)
      ),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setTransactions(list);
      }
    );

    return () => {
      unsubRedemptions();
      unsubTx();
    };
  }, [user?.uid]);

  const rewardsCatalog = useMemo(() => {
    if (customRewards.length === 0) return DEFAULT_COIN_REWARDS;
    const mergedMap = new Map<string, CoinRewardItem>();
    DEFAULT_COIN_REWARDS.forEach((r) => mergedMap.set(r.id, r));
    customRewards.forEach((r) => mergedMap.set(r.id, { ...mergedMap.get(r.id), ...r }));
    return Array.from(mergedMap.values()).filter((r) => r.active !== false);
  }, [customRewards]);

  const handleEquipFrame = async (frameId: string) => {
    if (!user?.uid) return;
    if (frameId !== 'none' && !unlockedFrames.includes(frameId)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await updateDoc(doc(db, 'users', user.uid), { avatarFrame: frameId });
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível equipar a moldura.');
    }
  };

  const handleRedeem = (reward: CoinRewardItem) => {
    if (myCoins < reward.cost) {
      Alert.alert(
        'Saldo Insuficiente',
        `Você possui ${myCoins} Kihapcoins e precisa de ${reward.cost}. Complete Missões Semanais para ganhar mais!`
      );
      return;
    }

    Alert.alert(
      'Confirmar Resgate',
      `Deseja trocar ${reward.cost} Kihapcoins por "${reward.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resgatar',
          onPress: async () => {
            setRedeemingId(reward.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            try {
              const redeemFn = httpsCallable(functions, 'redeemCoinReward');
              const res: any = await redeemFn({ rewardId: reward.id });
              const data = res?.data || {};
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

              if (data.voucherCode) {
                Alert.alert(
                  'Resgate Confirmado! 🎉',
                  `${reward.title} desbloqueado!\n\nSeu código: ${data.voucherCode}\nVocê também pode consultá-lo na aba "Meus Resgates".`
                );
              } else {
                Alert.alert('Resgate Confirmado! 🎉', `${reward.title} foi ativado na sua conta!`);
              }
            } catch (err: any) {
              Alert.alert('Não foi possível resgatar', err?.message || 'Tente novamente.');
            } finally {
              setRedeemingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top }} className="flex-1 bg-[#f8f9fa] dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
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
              Clube de Coins
            </Text>
            <Text className="text-[11px] font-semibold text-gray-400">
              Recompensas & Benefícios Kihap
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 24) + 24 }}
      >
        {/* Balance Hero Card */}
        <View className="bg-[#eab308] rounded-3xl p-5 mb-5 shadow-lg">
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-[10px] text-black/75 uppercase tracking-widest"
              >
                SEU SALDO DISPONÍVEL
              </Text>
              <View className="flex-row items-center gap-2 mt-1">
                <Text
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-4xl text-black"
                >
                  {myCoins}
                </Text>
                <Emoji symbol="⚡" size={28} />
              </View>
            </View>
            <View className="bg-black/15 px-3 py-2 rounded-2xl items-center">
              <View className="flex-row items-center">
                <Shield size={14} color="#000" style={{ marginRight: 4 }} />
                <Text className="text-xs font-black text-black">{myShields}/3</Text>
              </View>
              <Text className="text-[9px] font-bold text-black/75 uppercase mt-0.5">Escudos</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/missoes')}
            className="bg-black py-2.5 px-4 rounded-xl flex-row items-center justify-between"
          >
            <Text className="text-xs font-bold text-yellow-400">
              Ganhar mais Coins nas Missões Semanais
            </Text>
            <ChevronRight size={16} color="#eab308" />
          </TouchableOpacity>
        </View>

        {/* Equipped Frame Selector */}
        {unlockedFrames.length > 0 && (
          <View className="bg-white dark:bg-[#141414] p-4 rounded-2xl border border-gray-100 dark:border-white/10 mb-5">
            <Text
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-[10px] text-gray-400 uppercase tracking-wider mb-2.5"
            >
              Moldura do Avatar Equipada
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {['none', ...unlockedFrames].map((fKey) => {
                const meta = AVATAR_FRAMES[fKey] || AVATAR_FRAMES.none;
                const isSelected = activeFrame === fKey;
                return (
                  <TouchableOpacity
                    key={fKey}
                    onPress={() => handleEquipFrame(fKey)}
                    className={`px-3 py-1.5 rounded-full border flex-row items-center ${
                      isSelected
                        ? 'bg-yellow-500/20 border-yellow-500'
                        : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10'
                    }`}
                  >
                    {!!meta.badgeIcon && <Emoji symbol={meta.badgeIcon} size={13} style={{ marginRight: 6 }} />}
                    <Text className="text-xs font-bold text-gray-800 dark:text-white">
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Internal 3-way Sub-tabs */}
        <View className="flex-row bg-gray-100 dark:bg-[#161616] p-1.5 rounded-2xl mb-5 border border-gray-200/50 dark:border-white/5">
          {[
            { id: 'recompensas' as ClubeTab, label: 'Recompensas', Icon: Gift },
            { id: 'resgates' as ClubeTab, label: 'Resgates', Icon: Ticket },
            { id: 'extrato' as ClubeTab, label: 'Extrato', Icon: History },
          ].map((tab) => {
            const active = activeTab === tab.id;
            const IconComp = tab.Icon;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={active ? { backgroundColor: isDark ? '#262626' : '#000' } : undefined}
                className="flex-1 py-2.5 rounded-xl items-center justify-center flex-row px-2"
              >
                <IconComp size={13} color={active ? '#eab308' : '#888'} style={{ marginRight: 5 }} />
                <Text
                  style={{
                    fontFamily: 'NeueMachina-Ultrabold',
                    color: active ? '#fff' : '#888',
                  }}
                  className="text-[10px] uppercase tracking-wider"
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 'recompensas' && (
          <View>
            {rewardsCatalog.map((reward) => {
              const isOwnedFrame =
                reward.type === 'avatar_frame' &&
                reward.frameId &&
                unlockedFrames.includes(reward.frameId);
              const isMaxShields = reward.type === 'streak_shield' && myShields >= 3;
              const canAfford = myCoins >= reward.cost;
              const isProcessing = redeemingId === reward.id;
              const disabled = Boolean(isOwnedFrame || isMaxShields || isProcessing);

              return (
                <View
                  key={reward.id}
                  className="bg-white dark:bg-[#141414] p-4 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm mb-3"
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-row items-center flex-1 mr-3">
                      <View className="w-12 h-12 rounded-2xl bg-yellow-500/10 items-center justify-center mr-3">
                        <Emoji symbol={reward.icon || '🎁'} size={24} />
                      </View>
                      <View className="flex-1">
                        <Text className="font-bold text-sm text-gray-900 dark:text-white">
                          {reward.title}
                        </Text>
                        <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                          {reward.description}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between pt-2 border-t border-gray-50 dark:border-white/5">
                    <View className="flex-row items-center">
                      <Sparkles size={14} color="#eab308" style={{ marginRight: 4 }} />
                      <Text
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-sm text-yellow-600 dark:text-yellow-400"
                      >
                        {reward.cost} Coins
                      </Text>
                    </View>

                    {isOwnedFrame ? (
                      <View className="bg-emerald-500/10 px-3 py-1.5 rounded-xl flex-row items-center">
                        <Check size={13} color="#10b981" style={{ marginRight: 4 }} />
                        <Text className="text-[11px] font-bold text-emerald-500 uppercase">
                          Desbloqueada
                        </Text>
                      </View>
                    ) : isMaxShields ? (
                      <View className="bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-xl">
                        <Text className="text-[11px] font-bold text-gray-400 uppercase">
                          Máx. 3 Escudos
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        disabled={disabled}
                        onPress={() => handleRedeem(reward)}
                        className={`px-4 py-2 rounded-xl ${
                          canAfford
                            ? 'bg-[#eab308]'
                            : 'bg-gray-200 dark:bg-white/10 opacity-70'
                        }`}
                      >
                        {isProcessing ? (
                          <ActivityIndicator size="small" color="#000" />
                        ) : (
                          <Text
                            style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                            className={`text-[11px] uppercase ${
                              canAfford ? 'text-black' : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {canAfford ? 'Resgatar' : `Faltam ${reward.cost - myCoins}`}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {activeTab === 'resgates' && (
          <View>
            {redemptions.length === 0 ? (
              <View className="bg-white dark:bg-[#141414] p-8 rounded-3xl border border-gray-100 dark:border-white/10 items-center">
                <Ticket size={36} color="#9ca3af" style={{ marginBottom: 10 }} />
                <Text className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  Nenhum resgate realizado ainda
                </Text>
                <Text className="text-xs text-gray-400 text-center mt-1">
                  Seus vouchers, cupons e brindes aparecerão aqui assim que você resgatar.
                </Text>
              </View>
            ) : (
              redemptions.map((r) => (
                <View
                  key={r.id}
                  className="bg-white dark:bg-[#141414] p-4 rounded-2xl border border-gray-100 dark:border-white/10 mb-3"
                >
                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text className="font-bold text-sm text-gray-900 dark:text-white flex-1 mr-2">
                      {r.rewardTitle}
                    </Text>
                    <View
                      className={`px-2.5 py-0.5 rounded-full ${
                        r.status === 'delivered' ? 'bg-emerald-500/15' : 'bg-yellow-500/15'
                      }`}
                    >
                      <Text
                        className={`text-[9px] font-black uppercase ${
                          r.status === 'delivered' ? 'text-emerald-500' : 'text-yellow-600 dark:text-yellow-400'
                        }`}
                      >
                        {r.status === 'delivered' ? 'Ativo / Entregue' : 'Retirar na Unidade'}
                      </Text>
                    </View>
                  </View>

                  {!!r.voucherCode && (
                    <View className="bg-gray-50 dark:bg-white/5 px-3 py-2 rounded-xl my-2 flex-row items-center justify-between border border-dashed border-yellow-500/40">
                      <Text className="text-[10px] font-bold text-gray-400 uppercase">Código:</Text>
                      <Text
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-sm text-gray-900 dark:text-yellow-400 tracking-widest"
                      >
                        {r.voucherCode}
                      </Text>
                    </View>
                  )}

                  <View className="flex-row items-center justify-between mt-1">
                    <Text className="text-[11px] text-gray-400">
                      {formatTxDate(r.createdAt)}
                    </Text>
                    <Text className="text-xs font-bold text-gray-500 dark:text-gray-400">
                      -{r.cost} Kihapcoins
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'extrato' && (
          <View>
            {transactions.length === 0 ? (
              <View className="bg-white dark:bg-[#141414] p-8 rounded-3xl border border-gray-100 dark:border-white/10 items-center">
                <History size={36} color="#9ca3af" style={{ marginBottom: 10 }} />
                <Text className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  Sem movimentações pelo app ainda
                </Text>
                <Text className="text-xs text-gray-400 text-center mt-1">
                  Complete Missões, Quizzes e Diários de Treino para ver seu histórico aqui.
                </Text>
              </View>
            ) : (
              transactions.map((tx) => {
                const isEarn = Number(tx.amount) > 0;
                return (
                  <View
                    key={tx.id}
                    className="bg-white dark:bg-[#141414] p-3.5 rounded-2xl border border-gray-100 dark:border-white/10 mb-2.5 flex-row items-center justify-between"
                  >
                    <View className="flex-1 mr-3">
                      <Text className="font-bold text-xs text-gray-900 dark:text-white">
                        {tx.reason || 'Movimentação de Kihapcoins'}
                      </Text>
                      <Text className="text-[10px] text-gray-400 mt-0.5">
                        {formatTxDate(tx.createdAt)}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Text
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className={`text-sm ${
                          isEarn ? 'text-emerald-500' : 'text-red-500'
                        }`}
                      >
                        {isEarn ? `+${tx.amount}` : tx.amount}
                      </Text>
                      <Emoji symbol="⚡" size={14} />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
