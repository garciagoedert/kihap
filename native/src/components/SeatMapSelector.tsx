import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import * as Haptics from 'expo-haptics';
import { 
  ArrowLeft, 
  ArrowRight, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw, 
  LayoutGrid, 
  Award 
} from 'lucide-react-native';

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

export function getSeatSectorName(seatId?: string, config?: SeatConfig): string {
  if (!seatId || typeof seatId !== 'string' || !config) return '';
  const layout = config.layoutType || 'theater';
  if (layout === 'theater') return '';

  const parts = seatId.split('-');
  if (parts.length < 2) return '';
  const rowLetter = parts[0];
  const col = parseInt(parts[1], 10) || 0;
  const rowIdx = ALPHABET.indexOf(rowLetter);

  const numRows = Math.min(26, Math.max(1, parseInt(String(config.rows || 8), 10) || 8));
  const numCols = Math.min(50, Math.max(1, parseInt(String(config.seatsPerRow || config.cols || 16), 10) || 16));

  if (layout === 'gym_sides') {
    const leftCols = Math.floor(numCols / 2);
    return col <= leftCols ? 'Ala Esquerda' : 'Ala Direita';
  }

  if (layout === 'arena_4_sides') {
    const maxBlockRows = Math.max(1, Math.floor((numRows - 1) / 2));
    const rawTop = parseInt(String(config.topRows || 2), 10) || 2;
    const rawBottom = parseInt(String(config.bottomRows || config.topRows || 2), 10) || 2;
    const rawSide = parseInt(String(config.sideCols || 4), 10) || 4;

    const topRows = Math.min(Math.max(1, rawTop), maxBlockRows);
    const bottomRows = Math.min(Math.max(1, rawBottom), maxBlockRows);
    const sideCols = Math.min(Math.max(1, rawSide), Math.max(1, Math.floor((numCols - 2) / 2)));

    if (rowIdx >= 0 && rowIdx < topRows) return 'Setor Superior';
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
  onSeatToggle
}: SeatMapSelectorProps) {
  const [reservations, setReservations] = useState<{ [seatId: string]: any }>({});
  const [loading, setLoading] = useState(true);
  const [activeSectorFilter, setActiveSectorFilter] = useState<'all' | 'left' | 'right' | 'top' | 'bottom'>('all');

  const layoutType = config?.layoutType || 'theater';
  const numRows = Math.min(26, Math.max(1, parseInt(String(config?.rows || 8), 10) || 8));
  const numCols = Math.min(50, Math.max(1, parseInt(String(config?.seatsPerRow || config?.cols || 16), 10) || 16));
  const stageLabel = config?.stageLabel || (layoutType === 'theater' ? 'PALCO / TATAME' : 'TATAME CENTRAL');
  const disabledSet = useMemo(() => new Set(config?.disabledSeats || []), [config?.disabledSeats]);

  // Parâmetros de proporção seguros para Ginásio e Arena
  const leftCols = Math.max(1, Math.floor(numCols / 2));
  const maxBlockRows = Math.max(1, Math.floor((numRows - 1) / 2));
  const rawTop = parseInt(String(config?.topRows || 2), 10) || 2;
  const rawBottom = parseInt(String(config?.bottomRows || config?.topRows || 2), 10) || 2;
  const rawSide = parseInt(String(config?.sideCols || 4), 10) || 4;

  const topRows = Math.min(Math.max(1, rawTop), maxBlockRows);
  const bottomRows = Math.min(Math.max(1, rawBottom), maxBlockRows);
  const sideCols = Math.min(Math.max(1, rawSide), Math.max(1, Math.floor((numCols - 2) / 2)));
  const midRowsCount = Math.max(0, numRows - topRows - bottomRows);

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

  const renderSeat = (seatId: string, seatNum: number, _sectorName?: string) => {
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
          <Text style={{ fontSize: 8, color: '#9ca3af' }}>•</Text>
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
          {String(seatNum)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{
      marginVertical: 16,
      padding: 16,
      borderRadius: 24,
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: 'rgba(229, 231, 235, 0.8)',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1
    }}>
      <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: '900', color: '#111827', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Escolha suas cadeiras
        </Text>
        {selectedSeats.length > 0 ? (
          <View style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            backgroundColor: 'rgba(234, 179, 8, 0.2)',
            borderWidth: 1,
            borderColor: '#eab308',
            borderRadius: 9999
          }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: '#ca8a04' }}>
              {selectedSeats.length} {selectedSeats.length === 1 ? 'cadeira' : 'cadeiras'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Seletor rápido de setor para layout Ginásio */}
      {layoutType === 'gym_sides' ? (
        <View style={{
          marginBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          backgroundColor: '#f3f4f6',
          padding: 4,
          borderRadius: 12
        }}>
          <TouchableOpacity
            onPress={() => setActiveSectorFilter('all')}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: activeSectorFilter === 'all' ? '#f59e0b' : 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4
            }}
          >
            <LayoutGrid size={12} color={activeSectorFilter === 'all' ? '#000000' : '#6b7280'} />
            <Text style={{
              fontSize: 10,
              fontWeight: '700',
              color: activeSectorFilter === 'all' ? '#000000' : '#6b7280'
            }}>
              Ginásio Completo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveSectorFilter('left')}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: activeSectorFilter === 'left' ? '#f59e0b' : 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4
            }}
          >
            <ArrowLeft size={12} color={activeSectorFilter === 'left' ? '#000000' : '#6b7280'} />
            <Text style={{
              fontSize: 10,
              fontWeight: '700',
              color: activeSectorFilter === 'left' ? '#000000' : '#6b7280'
            }}>
              Ala Esquerda
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveSectorFilter('right')}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: activeSectorFilter === 'right' ? '#2563eb' : 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Text style={{
              fontSize: 10,
              fontWeight: '700',
              color: activeSectorFilter === 'right' ? '#ffffff' : '#6b7280'
            }}>
              Ala Direita
            </Text>
            <ArrowRight size={12} color={activeSectorFilter === 'right' ? '#ffffff' : '#6b7280'} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Seletor rápido de setor para Arena 360° */}
      {layoutType === 'arena_4_sides' ? (
        <View style={{ marginBottom: 14 }}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingVertical: 2, paddingHorizontal: 2 }}
          >
            {[
              { id: 'all', label: 'Arena 360°', icon: RotateCcw, activeBg: '#f59e0b', activeText: '#000000' },
              { id: 'top', label: 'Norte (Sup)', icon: ArrowUp, activeBg: '#4f46e5', activeText: '#ffffff' },
              { id: 'left', label: 'Oeste (Esq)', icon: ArrowLeft, activeBg: '#f59e0b', activeText: '#000000' },
              { id: 'right', label: 'Leste (Dir)', icon: ArrowRight, activeBg: '#2563eb', activeText: '#ffffff' },
              { id: 'bottom', label: 'Sul (Inf)', icon: ArrowDown, activeBg: '#059669', activeText: '#ffffff' },
            ].map(sec => {
              const isActive = activeSectorFilter === sec.id;
              const IconComp = sec.icon;
              return (
                <TouchableOpacity
                  key={sec.id}
                  onPress={() => setActiveSectorFilter(sec.id as any)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 10,
                    backgroundColor: isActive ? sec.activeBg : '#f3f4f6',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <IconComp size={11} color={isActive ? sec.activeText : '#6b7280'} />
                  <Text style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color: isActive ? sec.activeText : '#6b7280'
                  }}>
                    {sec.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Palco no Topo para layout teatro */}
      {layoutType === 'theater' ? (
        <View style={{ marginBottom: 20, alignItems: 'center' }}>
          <View style={{
            width: '80%',
            paddingVertical: 8,
            paddingHorizontal: 16,
            backgroundColor: '#f3f4f6',
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: '#d1d5db',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: '#4b5563', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              {stageLabel}
            </Text>
          </View>
          <View style={{ width: '60%', height: 4, backgroundColor: 'rgba(234, 179, 8, 0.4)', borderRadius: 2, marginTop: 6 }} />
        </View>
      ) : null}

      {/* Loading state */}
      {loading ? (
        <View style={{ paddingVertical: 32, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color="#eab308" />
          <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>Carregando mapa de cadeiras...</Text>
        </View>
      ) : (
        /* Grid com rolagem horizontal */
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={true} 
          contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 4 }}
        >
          {layoutType === 'theater' ? (
            <View style={{ flexDirection: 'column', gap: 6, minWidth: '100%', alignItems: 'center' }}>
              {Array.from({ length: numRows }).map((_, r) => {
                const rowLetter = ALPHABET[Math.min(ALPHABET.length - 1, r)] || 'A';
                return (
                  <View key={`row_${rowLetter}_${r}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 20, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 11, fontWeight: '900', color: '#9ca3af' }}>{rowLetter}</Text>
                    </View>

                    {Array.from({ length: numCols }).map((__, cIndex) => {
                      const seatNum = cIndex + 1;
                      const seatId = `${rowLetter}-${seatNum}`;
                      return renderSeat(seatId, seatNum);
                    })}

                    <View style={{ width: 20, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 11, fontWeight: '900', color: '#9ca3af' }}>{rowLetter}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {layoutType === 'gym_sides' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, minWidth: '100%' }}>
              {/* Ala Esquerda */}
              {(activeSectorFilter === 'all' || activeSectorFilter === 'left') ? (
                <View style={{ flexDirection: 'column', alignItems: 'center' }}>
                  <View style={{
                    marginBottom: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 1,
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5
                  }}>
                    <ArrowLeft size={11} color="#d97706" />
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#d97706', textTransform: 'uppercase' }}>
                      Ala Esquerda (1 a {leftCols})
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'column', gap: 6 }}>
                    {Array.from({ length: numRows }).map((_, r) => {
                      const rowLetter = ALPHABET[Math.min(ALPHABET.length - 1, r)] || 'A';
                      return (
                        <View key={`left_${rowLetter}_${r}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                          <View style={{ width: 20, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 10, fontWeight: '900', color: '#9ca3af' }}>{rowLetter}</Text>
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
              ) : null}

              {/* Tatame Central no Meio */}
              {activeSectorFilter === 'all' ? (
                <View style={{
                  paddingHorizontal: 16,
                  paddingVertical: 24,
                  borderRadius: 24,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: 'rgba(234, 179, 8, 0.45)',
                  backgroundColor: 'rgba(234, 179, 8, 0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 130
                }}>
                  <Award size={24} color="#b45309" style={{ marginBottom: 4 }} />
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#b45309', textTransform: 'uppercase', letterSpacing: 1.2, textAlign: 'center' }}>
                    {stageLabel}
                  </Text>
                  <Text style={{ fontSize: 8, fontWeight: '700', color: '#9ca3af', marginTop: 2, textTransform: 'uppercase' }}>
                    Área Central
                  </Text>
                </View>
              ) : null}

              {/* Ala Direita */}
              {(activeSectorFilter === 'all' || activeSectorFilter === 'right') ? (
                <View style={{ flexDirection: 'column', alignItems: 'center' }}>
                  <View style={{
                    marginBottom: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 1,
                    borderColor: 'rgba(37, 99, 235, 0.3)',
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#2563eb', textTransform: 'uppercase' }}>
                      Ala Direita ({leftCols + 1} a {numCols})
                    </Text>
                    <ArrowRight size={11} color="#2563eb" />
                  </View>
                  <View style={{ flexDirection: 'column', gap: 6 }}>
                    {Array.from({ length: numRows }).map((_, r) => {
                      const rowLetter = ALPHABET[Math.min(ALPHABET.length - 1, r)] || 'A';
                      return (
                        <View key={`right_${rowLetter}_${r}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-start' }}>
                          {Array.from({ length: Math.max(0, numCols - leftCols) }).map((__, cIndex) => {
                            const seatNum = leftCols + cIndex + 1;
                            const seatId = `${rowLetter}-${seatNum}`;
                            return renderSeat(seatId, seatNum, 'Ala Direita');
                          })}
                          <View style={{ width: 20, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 10, fontWeight: '900', color: '#9ca3af' }}>{rowLetter}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {layoutType === 'arena_4_sides' ? (
            <View style={{ flexDirection: 'column', alignItems: 'center', gap: 16, minWidth: '100%' }}>
              {/* 1. Setor Superior (Norte) */}
              {(activeSectorFilter === 'all' || activeSectorFilter === 'top') ? (
                <View style={{ flexDirection: 'column', alignItems: 'center' }}>
                  <View style={{
                    marginBottom: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 1,
                    borderColor: 'rgba(79, 70, 229, 0.3)',
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5
                  }}>
                    <ArrowUp size={11} color="#4f46e5" />
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#4f46e5', textTransform: 'uppercase' }}>
                      Setor Superior (Norte)
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'column', gap: 4 }}>
                    {Array.from({ length: topRows }).map((_, r) => {
                      const rowLetter = ALPHABET[Math.min(ALPHABET.length - 1, r)] || 'A';
                      return (
                        <View key={`arena_top_${rowLetter}_${r}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                          <View style={{ width: 16, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#9ca3af' }}>{rowLetter}</Text>
                          </View>
                          {Array.from({ length: numCols }).map((__, cIndex) => {
                            const seatNum = cIndex + 1;
                            const seatId = `${rowLetter}-${seatNum}`;
                            return renderSeat(seatId, seatNum, 'Setor Superior');
                          })}
                          <View style={{ width: 16, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#9ca3af' }}>{rowLetter}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* 2. Miolo: Setor Oeste + Tatame Central + Setor Leste */}
              {(activeSectorFilter === 'all' || activeSectorFilter === 'left' || activeSectorFilter === 'right') ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                  {/* Setor Oeste (Esquerda) */}
                  {(activeSectorFilter === 'all' || activeSectorFilter === 'left') ? (
                    <View style={{ flexDirection: 'column', alignItems: 'center' }}>
                      <View style={{
                        marginBottom: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(245, 158, 11, 0.3)',
                        borderRadius: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <ArrowLeft size={10} color="#d97706" />
                        <Text style={{ fontSize: 9, fontWeight: '900', color: '#d97706', textTransform: 'uppercase' }}>
                          Oeste (Esq)
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'column', gap: 4 }}>
                        {Array.from({ length: midRowsCount }).map((_, idx) => {
                          const r = topRows + idx;
                          const rowLetter = ALPHABET[Math.min(ALPHABET.length - 1, r)] || 'A';
                          return (
                            <View key={`arena_west_${rowLetter}_${idx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                              <View style={{ width: 16, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 9, fontWeight: '900', color: '#9ca3af' }}>{rowLetter}</Text>
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
                  ) : null}

                  {/* Tatame Central da Arena 360° */}
                  {activeSectorFilter === 'all' ? (
                    <View style={{
                      paddingHorizontal: 14,
                      paddingVertical: 18,
                      borderRadius: 20,
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: 'rgba(234, 179, 8, 0.45)',
                      backgroundColor: 'rgba(234, 179, 8, 0.08)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 120
                    }}>
                      <Award size={22} color="#b45309" style={{ marginBottom: 2 }} />
                      <Text style={{ fontSize: 9, fontWeight: '900', color: '#b45309', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>
                        {stageLabel}
                      </Text>
                      <Text style={{ fontSize: 7, fontWeight: '700', color: '#9ca3af', marginTop: 2, textTransform: 'uppercase' }}>
                        Arena 360°
                      </Text>
                    </View>
                  ) : null}

                  {/* Setor Leste (Direita) */}
                  {(activeSectorFilter === 'all' || activeSectorFilter === 'right') ? (
                    <View style={{ flexDirection: 'column', alignItems: 'center' }}>
                      <View style={{
                        marginBottom: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(37, 99, 235, 0.3)',
                        borderRadius: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <Text style={{ fontSize: 9, fontWeight: '900', color: '#2563eb', textTransform: 'uppercase' }}>
                          Leste (Dir)
                        </Text>
                        <ArrowRight size={10} color="#2563eb" />
                      </View>
                      <View style={{ flexDirection: 'column', gap: 4 }}>
                        {Array.from({ length: midRowsCount }).map((_, idx) => {
                          const r = topRows + idx;
                          const rowLetter = ALPHABET[Math.min(ALPHABET.length - 1, r)] || 'A';
                          return (
                            <View key={`arena_east_${rowLetter}_${idx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-start' }}>
                              {Array.from({ length: sideCols }).map((__, cIndex) => {
                                const seatNum = Math.max(1, numCols - sideCols + cIndex + 1);
                                const seatId = `${rowLetter}-${seatNum}`;
                                return renderSeat(seatId, seatNum, 'Setor Leste');
                              })}
                              <View style={{ width: 16, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 9, fontWeight: '900', color: '#9ca3af' }}>{rowLetter}</Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* 3. Setor Inferior (Sul) */}
              {(activeSectorFilter === 'all' || activeSectorFilter === 'bottom') ? (
                <View style={{ flexDirection: 'column', alignItems: 'center' }}>
                  <View style={{
                    marginBottom: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    backgroundColor: 'rgba(5, 150, 105, 0.1)',
                    borderWidth: 1,
                    borderColor: 'rgba(5, 150, 105, 0.3)',
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5
                  }}>
                    <ArrowDown size={11} color="#059669" />
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#059669', textTransform: 'uppercase' }}>
                      Setor Inferior (Sul)
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'column', gap: 4 }}>
                    {Array.from({ length: bottomRows }).map((_, idx) => {
                      const r = Math.max(0, numRows - bottomRows + idx);
                      const rowLetter = ALPHABET[Math.min(ALPHABET.length - 1, r)] || 'A';
                      return (
                        <View key={`arena_bottom_${rowLetter}_${idx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                          <View style={{ width: 16, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#9ca3af' }}>{rowLetter}</Text>
                          </View>
                          {Array.from({ length: numCols }).map((__, cIndex) => {
                            const seatNum = cIndex + 1;
                            const seatId = `${rowLetter}-${seatNum}`;
                            return renderSeat(seatId, seatNum, 'Setor Inferior');
                          })}
                          <View style={{ width: 16, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#9ca3af' }}>{rowLetter}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Legenda visual */}
      <View style={{
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-around',
        gap: 8
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#eab308', borderWidth: 1, borderColor: '#facc15' }} />
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#4b5563' }}>Selecionada</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: 'rgba(16, 185, 129, 0.12)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.35)' }} />
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#4b5563' }}>Disponível</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.35)' }} />
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#4b5563' }}>Ocupada</Text>
        </View>
      </View>
    </View>
  );
}
