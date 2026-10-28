import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import * as Haptics from 'expo-haptics';

interface SeatConfig {
  rows: number;
  seatsPerRow: number;
  stageLabel?: string;
  disabledSeats?: string[];
}

interface SeatMapSelectorProps {
  productId: string;
  sessionId?: string;
  config: SeatConfig;
  selectedSeats: string[];
  onSeatToggle: (seatId: string) => void;
  maxSeats?: number;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function SeatMapSelector({
  productId,
  sessionId = 'default',
  config,
  selectedSeats,
  onSeatToggle,
  maxSeats
}: SeatMapSelectorProps) {
  const [reservations, setReservations] = useState<{ [seatId: string]: any }>({});
  const [loading, setLoading] = useState(true);

  const numRows = Math.min(26, Math.max(1, config?.rows || 8));
  const numCols = Math.min(50, Math.max(1, config?.seatsPerRow || 16));
  const stageLabel = config?.stageLabel || 'PALCO / TATAME';
  const disabledSet = new Set(config?.disabledSeats || []);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);

    const docId = `${productId}_${sessionId || 'default'}`;
    const docRef = doc(db, 'productSeatReservations', docId);

    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setReservations(snap.data().seats || {});
      } else {
        setReservations({});
      }
      setLoading(false);
    }, (err) => {
      console.warn('[SeatMapSelector] Erro ao escutar reservas:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [productId, sessionId]);

  const handlePressSeat = (seatId: string, isAvailable: boolean) => {
    if (!isAvailable) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    onSeatToggle(seatId);
  };

  const now = Date.now();

  return (
    <View className="my-4 p-4 bg-white dark:bg-[#121212] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
          Escolha suas cadeiras
        </Text>
        {selectedSeats.length > 0 && (
          <View className="px-2.5 py-1 bg-yellow-500/20 border border-yellow-500 rounded-full">
            <Text className="text-xs font-black text-yellow-600 dark:text-yellow-400">
              {selectedSeats.length} {selectedSeats.length === 1 ? 'cadeira' : 'cadeiras'}
            </Text>
          </View>
        )}
      </View>

      {/* Palco / Tatame Visual */}
      <View className="mb-6 items-center">
        <View className="w-4/5 py-2 px-4 bg-gray-100 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 items-center justify-center shadow-sm">
          <Text className="text-[11px] font-black text-gray-600 dark:text-gray-300 tracking-widest uppercase">
            {stageLabel}
          </Text>
        </View>
        <View className="w-3/5 h-1 bg-yellow-500/40 rounded-full mt-1.5" />
      </View>

      {/* Loading state */}
      {loading ? (
        <View className="py-8 items-center justify-center">
          <ActivityIndicator size="small" color="#eab308" />
          <Text className="text-xs text-gray-400 mt-2">Carregando mapa de cadeiras...</Text>
        </View>
      ) : (
        /* Grid com rolagem horizontal e vertical suave */
        <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ paddingVertical: 8 }}>
          <View className="flex-col gap-2 min-w-full items-center">
            {Array.from({ length: numRows }).map((_, r) => {
              const rowLetter = ALPHABET[r];
              return (
                <View key={rowLetter} className="flex-row items-center gap-1.5">
                  {/* Letra da Fileira (esquerda) */}
                  <View className="w-6 items-center justify-center">
                    <Text className="text-xs font-black text-gray-400 dark:text-gray-500">
                      {rowLetter}
                    </Text>
                  </View>

                  {/* Cadeiras da Fileira */}
                  {Array.from({ length: numCols }).map((__, cIndex) => {
                    const seatNum = cIndex + 1;
                    const seatId = `${rowLetter}-${seatNum}`;
                    const isSelected = selectedSeats.includes(seatId);

                    const reservation = reservations[seatId];
                    const isDisabled = disabledSet.has(seatId) || reservation?.status === 'disabled' || reservation?.status === 'blocked_admin';
                    const isBooked = reservation?.status === 'booked';
                    const isLocked = reservation?.status === 'locked' && reservation?.lockedUntil > now;

                    const isOccupied = isBooked || isLocked;
                    const isAvailable = !isDisabled && !isOccupied;

                    if (isDisabled) {
                      // Espaço vazio / corredor
                      return (
                        <View
                          key={seatId}
                          style={{ width: 30, height: 30, margin: 2, alignItems: 'center', justifyContent: 'center', opacity: 0.1 }}
                        >
                          <Text className="text-[8px] text-gray-400">•</Text>
                        </View>
                      );
                    }

                    let seatBg = 'rgba(16, 185, 129, 0.12)';
                    let seatBorder = 'rgba(16, 185, 129, 0.35)';
                    let textColor = '#059669';
                    let isLineThrough = false;
                    let textFontWeight: '700' | '900' = '700';

                    if (isSelected) {
                      seatBg = '#eab308';
                      seatBorder = '#facc15';
                      textColor = '#000000';
                      textFontWeight = '900';
                    } else if (isBooked) {
                      seatBg = 'rgba(239, 68, 68, 0.15)';
                      seatBorder = 'rgba(239, 68, 68, 0.35)';
                      textColor = '#ef4444';
                      isLineThrough = true;
                    } else if (isLocked) {
                      seatBg = 'rgba(245, 158, 11, 0.15)';
                      seatBorder = 'rgba(245, 158, 11, 0.35)';
                      textColor = '#d97706';
                    }

                    return (
                      <TouchableOpacity
                        key={seatId}
                        activeOpacity={isAvailable ? 0.7 : 1}
                        onPress={() => handlePressSeat(seatId, isAvailable)}
                        disabled={!isAvailable}
                        style={{
                          width: 30,
                          height: 30,
                          margin: 2,
                          borderRadius: 8,
                          borderWidth: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: seatBg,
                          borderColor: seatBorder
                        }}
                      >
                        <Text 
                          style={{ 
                            fontSize: 10, 
                            color: textColor, 
                            fontWeight: textFontWeight,
                            textDecorationLine: isLineThrough ? 'line-through' : 'none' 
                          }}
                        >
                          {seatNum}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Letra da Fileira (direita) */}
                  <View className="w-6 items-center justify-center">
                    <Text className="text-xs font-black text-gray-400 dark:text-gray-500">
                      {rowLetter}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Legenda visual */}
      <View className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex-row flex-wrap items-center justify-around gap-2">
        <View className="flex-row items-center gap-1.5">
          <View className="w-3.5 h-3.5 rounded bg-yellow-500 border border-yellow-400" />
          <Text className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Selecionada</Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          <View className="w-3.5 h-3.5 rounded bg-emerald-500/10 border border-emerald-500/30" />
          <Text className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Disponível</Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          <View className="w-3.5 h-3.5 rounded bg-red-500/20 border border-red-500/40" />
          <Text className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Ocupada</Text>
        </View>
      </View>
    </View>
  );
}
