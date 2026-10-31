import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import * as Haptics from 'expo-haptics';

export interface SeatConfig {
  rows: number;
  seatsPerRow?: number;
  cols?: number;
  stageLabel?: string;
  disabledSeats?: string[];
  layoutType?: 'theater' | 'gym_sides' | 'arena_4_sides';
  topRows?: number;
  bottomRows?: number;
  sideCols?: number;
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

export function getSeatSectorName(seatId: string, config?: SeatConfig): string {
  if (!config) return '';
  const layout = config.layoutType || 'theater';
  if (layout === 'theater') return '';

  const [rowLetter, colStr] = seatId.split('-');
  const col = parseInt(colStr, 10);
  const rowIdx = ALPHABET.indexOf(rowLetter);

  const numRows = config.rows || 8;
  const numCols = config.seatsPerRow || config.cols || 16;

  if (layout === 'gym_sides') {
    const leftCols = Math.floor(numCols / 2);
    return col <= leftCols ? 'Ala Esquerda' : 'Ala Direita';
  }

  if (layout === 'arena_4_sides') {
    const topRows = Math.min(Math.max(1, config.topRows || 2), Math.max(1, Math.floor((numRows - 1) / 2)));
    const bottomRows = Math.min(Math.max(1, config.bottomRows || config.topRows || 2), Math.max(1, Math.floor((numRows - 1) / 2)));
    const sideCols = Math.min(Math.max(1, config.sideCols || 4), Math.max(1, Math.floor((numCols - 2) / 2)));

    if (rowIdx < topRows) return 'Setor Superior';
    if (rowIdx >= numRows - bottomRows) return 'Setor Inferior';
    if (col <= sideCols) return 'Setor Oeste (Esq)';
    return 'Setor Leste (Dir)';
  }

  return '';
}

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
  const [activeSectorFilter, setActiveSectorFilter] = useState<'all' | 'left' | 'right' | 'top' | 'bottom'>('all');

  const layoutType = config?.layoutType || 'theater';
  const numRows = Math.min(26, Math.max(1, config?.rows || 8));
  const numCols = Math.min(50, Math.max(1, config?.seatsPerRow || config?.cols || 16));
  const stageLabel = config?.stageLabel || (layoutType === 'theater' ? 'PALCO / TATAME' : 'TATAME CENTRAL');
  const disabledSet = useMemo(() => new Set(config?.disabledSeats || []), [config?.disabledSeats]);

  // Parâmetros de proporção para Ginásio e Arena
  const leftCols = Math.floor(numCols / 2);
  const topRows = Math.min(Math.max(1, config?.topRows || 2), Math.max(1, Math.floor((numRows - 1) / 2)));
  const bottomRows = Math.min(Math.max(1, config?.bottomRows || config?.topRows || 2), Math.max(1, Math.floor((numRows - 1) / 2)));
  const sideCols = Math.min(Math.max(1, config?.sideCols || 4), Math.max(1, Math.floor((numCols - 2) / 2)));

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
    } catch {
      // Haptics not available
    }
    onSeatToggle(seatId);
  };

  const now = Date.now();

  const renderSeat = (seatId: string, seatNum: number, sectorName?: string) => {
    const isSelected = selectedSeats.includes(seatId);
    const reservation = reservations[seatId];
    const isDisabled = disabledSet.has(seatId) || reservation?.status === 'disabled' || reservation?.status === 'blocked_admin';
    const isBooked = reservation?.status === 'booked';
    const isLocked = reservation?.status === 'locked' && reservation?.lockedUntil > now;

    const isOccupied = isBooked || isLocked;
    const isAvailable = !isDisabled && !isOccupied;

    if (isDisabled) {
      return (
        <View
          key={seatId}
          style={{ width: 28, height: 28, margin: 2, alignItems: 'center', justifyContent: 'center', opacity: 0.15 }}
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
          width: 28,
          height: 28,
          margin: 2,
          borderRadius: 7,
          borderWidth: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: seatBg,
          borderColor: seatBorder
        }}
      >
        <Text 
          style={{ 
            fontSize: 9, 
            color: textColor, 
            fontWeight: textFontWeight,
            textDecorationLine: isLineThrough ? 'line-through' : 'none' 
          }}
        >
          {seatNum}
        </Text>
      </TouchableOpacity>
    );
  };

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

      {/* Seletor rápido de setor/ala para facilitar a visualização no mobile */}
      {layoutType === 'gym_sides' && (
        <View className="mb-3 flex-row items-center justify-center gap-1.5 bg-gray-100 dark:bg-gray-800/60 p-1 rounded-xl">
          <TouchableOpacity
            onPress={() => setActiveSectorFilter('all')}
            className={`px-3 py-1.5 rounded-lg ${activeSectorFilter === 'all' ? 'bg-amber-500 shadow-sm' : ''}`}
          >
            <Text className={`text-[10px] font-bold ${activeSectorFilter === 'all' ? 'text-black' : 'text-gray-500 dark:text-gray-400'}`}>
              🏟️ Ginásio Completo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveSectorFilter('left')}
            className={`px-3 py-1.5 rounded-lg ${activeSectorFilter === 'left' ? 'bg-amber-500 shadow-sm' : ''}`}
          >
            <Text className={`text-[10px] font-bold ${activeSectorFilter === 'left' ? 'text-black' : 'text-gray-500 dark:text-gray-400'}`}>
              ⬅️ Ala Esquerda
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveSectorFilter('right')}
            className={`px-3 py-1.5 rounded-lg ${activeSectorFilter === 'right' ? 'bg-blue-600 shadow-sm' : ''}`}
          >
            <Text className={`text-[10px] font-bold ${activeSectorFilter === 'right' ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              Ala Direita ➡️
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {layoutType === 'arena_4_sides' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 py-1">
          <View className="flex-row items-center gap-1.5 bg-gray-100 dark:bg-gray-800/60 p-1 rounded-xl">
            <TouchableOpacity
              onPress={() => setActiveSectorFilter('all')}
              className={`px-3 py-1.5 rounded-lg ${activeSectorFilter === 'all' ? 'bg-amber-500 shadow-sm' : ''}`}
            >
              <Text className={`text-[10px] font-bold ${activeSectorFilter === 'all' ? 'text-black' : 'text-gray-500 dark:text-gray-400'}`}>
                🔄 Arena 360°
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveSectorFilter('top')}
              className={`px-3 py-1.5 rounded-lg ${activeSectorFilter === 'top' ? 'bg-indigo-600 shadow-sm' : ''}`}
            >
              <Text className={`text-[10px] font-bold ${activeSectorFilter === 'top' ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                ⬆️ Superior (Norte)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveSectorFilter('left')}
              className={`px-3 py-1.5 rounded-lg ${activeSectorFilter === 'left' ? 'bg-amber-500 shadow-sm' : ''}`}
            >
              <Text className={`text-[10px] font-bold ${activeSectorFilter === 'left' ? 'text-black' : 'text-gray-500 dark:text-gray-400'}`}>
                ⬅️ Oeste (Esq)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveSectorFilter('right')}
              className={`px-3 py-1.5 rounded-lg ${activeSectorFilter === 'right' ? 'bg-blue-600 shadow-sm' : ''}`}
            >
              <Text className={`text-[10px] font-bold ${activeSectorFilter === 'right' ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                Leste (Dir) ➡️
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveSectorFilter('bottom')}
              className={`px-3 py-1.5 rounded-lg ${activeSectorFilter === 'bottom' ? 'bg-emerald-600 shadow-sm' : ''}`}
            >
              <Text className={`text-[10px] font-bold ${activeSectorFilter === 'bottom' ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                ⬇️ Inferior (Sul)
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Palco no Topo para layout teatro */}
      {layoutType === 'theater' && (
        <View className="mb-6 items-center">
          <View className="w-4/5 py-2 px-4 bg-gray-100 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 items-center justify-center shadow-sm">
            <Text className="text-[11px] font-black text-gray-600 dark:text-gray-300 tracking-widest uppercase">
              {stageLabel}
            </Text>
          </View>
          <View className="w-3/5 h-1 bg-yellow-500/40 rounded-full mt-1.5" />
        </View>
      )}

      {/* Loading state */}
      {loading ? (
        <View className="py-8 items-center justify-center">
          <ActivityIndicator size="small" color="#eab308" />
          <Text className="text-xs text-gray-400 mt-2">Carregando mapa de cadeiras...</Text>
        </View>
      ) : (
        /* Grid com rolagem horizontal e vertical suave */
        <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 4 }}>
          {layoutType === 'theater' && (
            <View className="flex-col gap-1.5 min-w-full items-center">
              {Array.from({ length: numRows }).map((_, r) => {
                const rowLetter = ALPHABET[r];
                return (
                  <View key={rowLetter} className="flex-row items-center gap-1">
                    <View className="w-5 items-center justify-center">
                      <Text className="text-[11px] font-black text-gray-400 dark:text-gray-500">{rowLetter}</Text>
                    </View>

                    {Array.from({ length: numCols }).map((__, cIndex) => {
                      const seatNum = cIndex + 1;
                      const seatId = `${rowLetter}-${seatNum}`;
                      return renderSeat(seatId, seatNum);
                    })}

                    <View className="w-5 items-center justify-center">
                      <Text className="text-[11px] font-black text-gray-400 dark:text-gray-500">{rowLetter}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {layoutType === 'gym_sides' && (
            <View className="flex-row items-center justify-center gap-5 min-w-full">
              {/* Ala Esquerda */}
              {(activeSectorFilter === 'all' || activeSectorFilter === 'left') && (
                <View className="flex-col items-center">
                  <View className="mb-2 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <Text className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase">
                      ⬅️ Ala Esquerda (1 a {leftCols})
                    </Text>
                  </View>
                  <View className="flex-col gap-1.5">
                    {Array.from({ length: numRows }).map((_, r) => {
                      const rowLetter = ALPHABET[r];
                      return (
                        <View key={rowLetter} className="flex-row items-center gap-1 justify-end">
                          <View className="w-5 items-center justify-center">
                            <Text className="text-[10px] font-black text-gray-400">{rowLetter}</Text>
                          </View>
                          {Array.from({ length: leftCols }).map((__, cIndex) => {
                            const seatNum = cIndex + 1;
                            const seatId = `${rowLetter}-${seatNum}`;
                            return renderSeat(seatId, seatNum, 'Ala Esquerda');
                          })}
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Tatame Central no Meio */}
              {activeSectorFilter === 'all' && (
                <View style={{
                  paddingHorizontal: 16,
                  paddingVertical: 28,
                  borderRadius: 24,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: 'rgba(234, 179, 8, 0.45)',
                  backgroundColor: 'rgba(234, 179, 8, 0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 130
                }}>
                  <Text style={{ fontSize: 24, marginBottom: 4 }}>🥋</Text>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#b45309', textTransform: 'uppercase', letterSpacing: 1.2, textAlign: 'center' }}>
                    {stageLabel}
                  </Text>
                  <Text style={{ fontSize: 8, fontWeight: '700', color: '#9ca3af', marginTop: 2, textTransform: 'uppercase' }}>
                    Área Central
                  </Text>
                </View>
              )}

              {/* Ala Direita */}
              {(activeSectorFilter === 'all' || activeSectorFilter === 'right') && (
                <View className="flex-col items-center">
                  <View className="mb-2 px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <Text className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">
                      Ala Direita ({leftCols + 1} a {numCols}) ➡️
                    </Text>
                  </View>
                  <View className="flex-col gap-1.5">
                    {Array.from({ length: numRows }).map((_, r) => {
                      const rowLetter = ALPHABET[r];
                      return (
                        <View key={rowLetter} className="flex-row items-center gap-1 justify-start">
                          {Array.from({ length: numCols - leftCols }).map((__, cIndex) => {
                            const seatNum = leftCols + cIndex + 1;
                            const seatId = `${rowLetter}-${seatNum}`;
                            return renderSeat(seatId, seatNum, 'Ala Direita');
                          })}
                          <View className="w-5 items-center justify-center">
                            <Text className="text-[10px] font-black text-gray-400">{rowLetter}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}

          {layoutType === 'arena_4_sides' && (
            <View className="flex-col items-center gap-4 min-w-full">
              {/* 1. Setor Superior (Norte) */}
              {(activeSectorFilter === 'all' || activeSectorFilter === 'top') && (
                <View className="flex-col items-center">
                  <View className="mb-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                    <Text className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">
                      ⬆️ Setor Superior (Norte)
                    </Text>
                  </View>
                  <View className="flex-col gap-1">
                    {Array.from({ length: topRows }).map((_, r) => {
                      const rowLetter = ALPHABET[r];
                      return (
                        <View key={rowLetter} className="flex-row items-center gap-1 justify-center">
                          <View className="w-4 items-center justify-center">
                            <Text className="text-[9px] font-black text-gray-400">{rowLetter}</Text>
                          </View>
                          {Array.from({ length: numCols }).map((__, cIndex) => {
                            const seatNum = cIndex + 1;
                            const seatId = `${rowLetter}-${seatNum}`;
                            return renderSeat(seatId, seatNum, 'Setor Superior');
                          })}
                          <View className="w-4 items-center justify-center">
                            <Text className="text-[9px] font-black text-gray-400">{rowLetter}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* 2. Miolo: Setor Oeste + Tatame Central + Setor Leste */}
              {(activeSectorFilter === 'all' || activeSectorFilter === 'left' || activeSectorFilter === 'right') && (
                <View className="flex-row items-center justify-center gap-4">
                  {/* Setor Oeste (Esquerda) */}
                  {(activeSectorFilter === 'all' || activeSectorFilter === 'left') && (
                    <View className="flex-col items-center">
                      <View className="mb-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-md">
                        <Text className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase">
                          ⬅️ Oeste (Esq)
                        </Text>
                      </View>
                      <View className="flex-col gap-1">
                        {Array.from({ length: numRows - topRows - bottomRows }).map((_, idx) => {
                          const r = topRows + idx;
                          const rowLetter = ALPHABET[r];
                          return (
                            <View key={rowLetter} className="flex-row items-center gap-1 justify-end">
                              <View className="w-4 items-center justify-center">
                                <Text className="text-[9px] font-black text-gray-400">{rowLetter}</Text>
                              </View>
                              {Array.from({ length: sideCols }).map((__, cIndex) => {
                                const seatNum = cIndex + 1;
                                const seatId = `${rowLetter}-${seatNum}`;
                                return renderSeat(seatId, seatNum, 'Setor Oeste');
                              })}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Tatame Central da Arena 360° */}
                  {activeSectorFilter === 'all' && (
                    <View style={{
                      paddingHorizontal: 14,
                      paddingVertical: 20,
                      borderRadius: 20,
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: 'rgba(234, 179, 8, 0.45)',
                      backgroundColor: 'rgba(234, 179, 8, 0.08)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 120
                    }}>
                      <Text style={{ fontSize: 22, marginBottom: 2 }}>🥋</Text>
                      <Text style={{ fontSize: 9, fontWeight: '900', color: '#b45309', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>
                        {stageLabel}
                      </Text>
                      <Text style={{ fontSize: 7, fontWeight: '700', color: '#9ca3af', marginTop: 2, textTransform: 'uppercase' }}>
                        Arena 360°
                      </Text>
                    </View>
                  )}

                  {/* Setor Leste (Direita) */}
                  {(activeSectorFilter === 'all' || activeSectorFilter === 'right') && (
                    <View className="flex-col items-center">
                      <View className="mb-1.5 px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded-md">
                        <Text className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase">
                          Leste (Dir) ➡️
                        </Text>
                      </View>
                      <View className="flex-col gap-1">
                        {Array.from({ length: numRows - topRows - bottomRows }).map((_, idx) => {
                          const r = topRows + idx;
                          const rowLetter = ALPHABET[r];
                          return (
                            <View key={rowLetter} className="flex-row items-center gap-1 justify-start">
                              {Array.from({ length: sideCols }).map((__, cIndex) => {
                                const seatNum = numCols - sideCols + cIndex + 1;
                                const seatId = `${rowLetter}-${seatNum}`;
                                return renderSeat(seatId, seatNum, 'Setor Leste');
                              })}
                              <View className="w-4 items-center justify-center">
                                <Text className="text-[9px] font-black text-gray-400">{rowLetter}</Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* 3. Setor Inferior (Sul) */}
              {(activeSectorFilter === 'all' || activeSectorFilter === 'bottom') && (
                <View className="flex-col items-center">
                  <View className="mb-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <Text className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">
                      ⬇️ Setor Inferior (Sul)
                    </Text>
                  </View>
                  <View className="flex-col gap-1">
                    {Array.from({ length: bottomRows }).map((_, idx) => {
                      const r = numRows - bottomRows + idx;
                      const rowLetter = ALPHABET[r];
                      return (
                        <View key={rowLetter} className="flex-row items-center gap-1 justify-center">
                          <View className="w-4 items-center justify-center">
                            <Text className="text-[9px] font-black text-gray-400">{rowLetter}</Text>
                          </View>
                          {Array.from({ length: numCols }).map((__, cIndex) => {
                            const seatNum = cIndex + 1;
                            const seatId = `${rowLetter}-${seatNum}`;
                            return renderSeat(seatId, seatNum, 'Setor Inferior');
                          })}
                          <View className="w-4 items-center justify-center">
                            <Text className="text-[9px] font-black text-gray-400">{rowLetter}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}
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
