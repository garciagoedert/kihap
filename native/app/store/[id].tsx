import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { ArrowLeft, ShoppingCart, Minus, Plus, Star, ShieldCheck, Calendar, Clock, Armchair, MapPin, Check, Ticket } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

import { useCart } from '../../src/context/CartContext';
import { useAuth } from '../../src/context/AuthContext';
import { getEffectiveProductPrice, getEffectiveVariantPrice, formatCentsToCurrency } from '../../src/utils/pricing';
import { collection, query, where, getDocs } from 'firebase/firestore';
import SeatMapSelector, { getSeatSectorName } from '../../src/components/SeatMapSelector';

const GRADUACOES: { [key: string]: string[] } = {
  tradicional: [
    'Branca', 'Laranja recomendada', 'Laranja decidida', 'Amarela recomendada', 'Amarela decidida',
    'Camuflada recomendada', 'Camuflada decidida', 'Verde recomendada', 'Verde decidida',
    'Roxa recomendada', 'Roxa decidida', 'Azul recomendada', 'Azul decidida',
    'Marrom recomendada', 'Marrom decidida', 'Vermelha recomendada', 'Vermelha decidida',
    'Vermelha e preta', 'Preta 1º Dan', 'Preta 2º Dan', 'Preta 3º Dan', 'Preta 4º Dan',
    'Preta 5º Dan', 'Preta 6º Dan', 'Preta 7º Dan', 'Preta 8º Dan', 'Preta 9º Dan'
  ],
  littles: [
    'Littles Branca', 'Littles Panda', 'Littles Leão', 'Littles Girafa', 'Littles Borboleta',
    'Littles Jacaré', 'Littles Coruja', 'Littles Arara', 'Littles Macaco', 'Littles Fênix'
  ]
};

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [participants, setParticipants] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [selectedSeatsBySession, setSelectedSeatsBySession] = useState<{
    [sessionKey: string]: {
      session: any;
      location?: any;
      seats: string[];
    }
  }>({});
  const [lockingSeats, setLockingSeats] = useState(false);
  const [purchaseMode, setPurchaseMode] = useState<'full' | 'extra_only'>('full');
  const [hasExistingEnrollment, setHasExistingEnrollment] = useState(false);

  // Flattened array of all chosen seats across all sessions
  const allSelectedSeats = useMemo(() => {
    const list: Array<{
      seatId: string;
      sessionId: string;
      sessionName: string;
      sessionLabel: string;
      sessionDate?: string;
      sessionTime?: string;
      locationId?: string;
      locationName?: string;
      locationVenue?: string;
      locationAddress?: string;
    }> = [];

    Object.entries(selectedSeatsBySession).forEach(([sessId, data]) => {
      data.seats.forEach(seatId => {
        list.push({
          seatId,
          sessionId: sessId,
          sessionName: data.session?.name || 'Sessão',
          sessionLabel: data.session?.label || data.session?.name || 'Sessão',
          sessionDate: data.session?.date,
          sessionTime: data.session?.time,
          locationId: data.location?.id,
          locationName: data.location?.name,
          locationVenue: data.location?.venue,
          locationAddress: data.location?.address
        });
      });
    });
    return list;
  }, [selectedSeatsBySession]);

  const availableSessions = useMemo(() => {
    if (!product?.hasSeatMap) return [];
    return (product.hasLocations && selectedLocation?.sessions)
      ? selectedLocation.sessions
      : (product.sessions || []);
  }, [product, selectedLocation]);

  const activeSeatMapConfig = useMemo(() => {
    if (!product?.hasSeatMap) return { rows: 8, seatsPerRow: 16 };
    return (product.hasLocations && selectedLocation?.seatMapConfig)
      ? selectedLocation.seatMapConfig
      : (product.seatMapConfig || { rows: 8, seatsPerRow: 16 });
  }, [product, selectedLocation]);

  const activeSessionId = useMemo(() => {
    return selectedSession?.id || availableSessions[0]?.id || 'default';
  }, [selectedSession, availableSessions]);

  const currentSessionSeats = useMemo(() => {
    if (!activeSessionId) return [];
    return selectedSeatsBySession[activeSessionId]?.seats || [];
  }, [activeSessionId, selectedSeatsBySession]);
  
  const { userData } = useAuth();
  const { addItem } = useCart();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const docRef = doc(db, 'products', id as string);
    const unsubscribeProduct = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.id ? { id: docSnap.id, ...docSnap.data() } : docSnap.data();
        setProduct(data);
        
        if (data.hasLocations && data.locations && data.locations.length > 0) {
          const initialLoc = data.locations[0];
          setSelectedLocation(initialLoc);
          if (initialLoc.sessions && initialLoc.sessions.length > 0) {
            setSelectedSession(initialLoc.sessions[0]);
          }
        } else if (data.sessions && data.sessions.length > 0 && !selectedSession) {
          setSelectedSession(data.sessions[0]);
        }

        const defaultVariant = data.priceType === 'variable' && data.priceVariants && data.priceVariants.length > 0
          ? data.priceVariants[0]
          : null;

        setParticipants(prev => {
          if (prev.length === 0) {
            return [{ 
              userName: '', 
              userPrograma: '', 
              userGraduacao: '', 
              userProfessor: '',
              userSize: '',
              selectedVariant: defaultVariant
            }];
          }
          return prev;
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to product:", error);
      setLoading(false);
    });

    // Fetch instructors for professor selection
    const fetchInstructors = async () => {
      try {
        const q = query(collection(db, 'users'), where('isInstructor', '==', true));
        const instructorSnap = await getDocs(q);
        const instList = instructorSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setInstructors(instList.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')));
      } catch (err) {
        console.error("Error fetching instructors:", err);
      }
    };
    fetchInstructors();

    return () => unsubscribeProduct();
  }, [id]);

  useEffect(() => {
    if (!userData?.uid || !id) return;
    const checkUserEnrollment = async () => {
      try {
        const q = query(
          collection(db, 'inscricoesFaixaPreta'),
          where('userId', '==', userData.uid)
        );
        const snap = await getDocs(q);
        const found = snap.docs.some(d => {
          const order = d.data();
          if (order.productId === id) return true;
          if (Array.isArray(order.items) && order.items.some((it: any) => it.productId === id)) return true;
          return false;
        });
        if (found) {
          setHasExistingEnrollment(true);
          setPurchaseMode('extra_only');
        }
      } catch (err) {
        console.warn('Erro ao verificar inscrição existente:', err);
      }
    };
    checkUserEnrollment();
  }, [userData?.uid, id]);

  const handleSeatToggle = (seatId: string) => {
    const activeSess = selectedSession || availableSessions[0];
    if (!activeSess) return;
    const sessKey = activeSess.id || 'default';

    setSelectedSeatsBySession(prev => {
      const currentGroup = prev[sessKey] || {
        session: activeSess,
        location: selectedLocation,
        seats: []
      };

      const exists = currentGroup.seats.includes(seatId);
      const updatedSeats = exists
        ? currentGroup.seats.filter(s => s !== seatId)
        : [...currentGroup.seats, seatId];

      const next = { ...prev };
      if (updatedSeats.length === 0) {
        delete next[sessKey];
      } else {
        next[sessKey] = {
          session: activeSess,
          location: selectedLocation,
          seats: updatedSeats
        };
      }
      return next;
    });
  };

  useEffect(() => {
    if (!product) return;
    const defaultVariant = product.priceType === 'variable' && product.priceVariants && product.priceVariants.length > 0
      ? product.priceVariants[0]
      : null;

    if (product.hasSeatMap) {
      const count = Math.max(1, allSelectedSeats.length);
      if (quantity !== count) {
        setQuantity(count);
      }
      setParticipants(prev => {
        const newList = [];
        for (let i = 0; i < count; i++) {
          const seatInfo = allSelectedSeats[i];
          newList.push({
            ...(prev[i] || {
              userName: '',
              userPrograma: '',
              userGraduacao: '',
              userProfessor: '',
              userSize: '',
              selectedVariant: defaultVariant
            }),
            seatId: seatInfo?.seatId || null,
            sessionId: seatInfo?.sessionId || null,
            sessionName: seatInfo?.sessionName || null,
            sessionLabel: seatInfo?.sessionLabel || null,
            locationId: seatInfo?.locationId || null,
            locationName: seatInfo?.locationName || null,
            locationVenue: seatInfo?.locationVenue || null,
            locationAddress: seatInfo?.locationAddress || null
          });
        }
        return newList;
      });
    } else {
      // Update participants array when quantity changes (standard products)
      setParticipants(prev => {
        const newList = [...prev];
        if (quantity > newList.length) {
          for (let i = newList.length; i < quantity; i++) {
            newList.push({ 
              userName: '', 
              userPrograma: '', 
              userGraduacao: '', 
              userProfessor: '', 
              userSize: '',
              selectedVariant: defaultVariant
            });
          }
        } else {
          return newList.slice(0, quantity);
        }
        return newList;
      });
    }
  }, [allSelectedSeats, product, quantity]);

  const updateParticipant = (index: number, updates: { [key: string]: any }) => {
    setParticipants(prev => {
      const newList = [...prev];
      newList[index] = { ...newList[index], ...updates };
      return newList;
    });
  };

  const calculateTotal = () => {
    if (!product) return 0;
    const hasExtraTicket = product.hasSeatMap && (product.hasExtraTicketPrice || product.extraTicketPrice > 0);
    const includedCount = product.includedTicketsCount !== undefined ? product.includedTicketsCount : 1;

    if (hasExtraTicket) {
      if (purchaseMode === 'extra_only') {
        return allSelectedSeats.length * (product.extraTicketPrice || 0);
      }

      const pVariant = participants[0]?.selectedVariant || product.priceVariants?.[0];
      const basePrice = (product.priceType === 'variable' && pVariant)
        ? getEffectiveVariantPrice(pVariant, userData, product).price
        : getEffectiveProductPrice(product, userData).price;

      const extraCount = Math.max(0, allSelectedSeats.length - includedCount);
      const extraPrice = extraCount * (product.extraTicketPrice || 0);
      return basePrice + extraPrice;
    }

    if (product.priceType === 'variable') {
      return participants.reduce((sum, p) => {
        const pVariant = p.selectedVariant || product.priceVariants?.[0];
        const pPrice = pVariant ? getEffectiveVariantPrice(pVariant, userData, product).price : 0;
        return sum + pPrice;
      }, 0);
    }
    const effective = getEffectiveProductPrice(product, userData);
    return effective.price * quantity;
  };

  const handleAddToCart = async () => {
    if (product.hasSeatMap) {
      if (allSelectedSeats.length === 0) {
        alert('Por favor, selecione pelo menos uma cadeira no mapa do evento.');
        return;
      }
    }

    const hasExtraTicket = product.hasSeatMap && (product.hasExtraTicketPrice || product.extraTicketPrice > 0);
    const includedCount = product.includedTicketsCount !== undefined ? product.includedTicketsCount : 1;

    // Basic validation
    const incomplete = participants.some((p, idx) => {
      const isExtra = hasExtraTicket && (purchaseMode === 'extra_only' || idx >= includedCount);
      if (isExtra) {
        return !p.userName?.trim();
      }
      return (
        !p.userName?.trim() ||
        !p.userPrograma ||
        ((p.userPrograma === 'tradicional' || p.userPrograma === 'littles') && !p.userGraduacao) ||
        (product.askProfessor && !p.userProfessor) || 
        (product.hasSizes && !p.userSize) ||
        (product.priceType === 'variable' && !p.selectedVariant)
      );
    });

    if (incomplete) {
      alert('Por favor, preencha todas as informações obrigatórias.');
      return;
    }

    if (product.hasSeatMap) {
      setLockingSeats(true);
      try {
        const userIdentifier = userData?.uid || ('anon_' + Date.now() + Math.random().toString(36).substr(2, 4));
        
        // Bloqueia os assentos em cada sessão selecionada
        for (const [sessId, group] of Object.entries(selectedSeatsBySession)) {
          if (!group.seats || group.seats.length === 0) continue;
          const lockRes = await fetch('https://us-central1-intranet-kihap.cloudfunctions.net/lockSeats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: product.id,
              sessionId: sessId,
              seatIds: group.seats,
              userIdentifier
            })
          });

          if (!lockRes.ok) {
            const errData = await lockRes.json();
            alert(`Sessão "${group.session?.name || ''}": ` + (errData.error || 'Uma ou mais cadeiras acabaram de ser reservadas. Por favor, escolha outros assentos.'));
            setLockingSeats(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Erro ao bloquear assentos:', e);
      } finally {
        setLockingSeats(false);
      }
    }

    const effective = getEffectiveProductPrice(product, userData);

    const formDataList = participants.map((p, idx) => {
      const isExtra = hasExtraTicket && (purchaseMode === 'extra_only' || idx >= includedCount);
      const pVariant = p.selectedVariant || (product.priceType === 'variable' ? product.priceVariants?.[0] : null);
      const selectedAmount = isExtra
        ? (product.extraTicketPrice || 0)
        : (pVariant ? getEffectiveVariantPrice(pVariant, userData, product).price : effective.price);
      const selectedVariantName = isExtra
        ? (purchaseMode === 'extra_only' ? 'Ingresso Acompanhante' : 'Ingresso Adicional (Acompanhante)')
        : (pVariant ? pVariant.name : undefined);
      const pixAmount = isExtra
        ? undefined
        : (pVariant?.pixPrice || product.pixPrice || undefined);
      
      const priceData: any = {
        amount: selectedAmount,
        ...(selectedVariantName ? { variantName: selectedVariantName } : {}),
        ...(pixAmount ? { pixAmount } : {})
      };

      const { selectedVariant, ...rest } = p;
      const seatInfo = allSelectedSeats[idx];
      return {
        ...rest,
        isExtraTicket: isExtra,
        isMainParticipant: !isExtra,
        seatId: seatInfo ? seatInfo.seatId : (p.seatId || null),
        ...(product.hasSeatMap && seatInfo ? {
          sessionId: seatInfo.sessionId,
          sessionName: seatInfo.sessionName,
          sessionDate: seatInfo.sessionDate || null,
          sessionTime: seatInfo.sessionTime || null,
          sessionLabel: seatInfo.sessionLabel,
          locationId: seatInfo.locationId || null,
          locationName: seatInfo.locationName || null,
          locationVenue: seatInfo.locationVenue || null,
          locationAddress: seatInfo.locationAddress || null,
        } : {}),
        priceData
      };
    });

    const totalAmount = calculateTotal();

    const firstVariantPrice = product.priceType === 'variable' && product.priceVariants && product.priceVariants.length > 0
      ? getEffectiveVariantPrice(participants[0]?.selectedVariant || product.priceVariants[0], userData, product).price
      : effective.price;

    const summarySeats = allSelectedSeats.map(s => s.seatId);
    const summarySessions = Array.from(new Set(allSelectedSeats.map(s => s.sessionLabel).filter(Boolean)));
    const summaryLocations = Array.from(new Set(allSelectedSeats.map(s => s.locationName).filter(Boolean)));

    addItem({
      id: purchaseMode === 'extra_only' ? `${product.id}_extras` : product.id,
      productId: product.id,
      name: purchaseMode === 'extra_only' ? `${product.name} (Ingressos Acompanhante)` : product.name,
      productName: purchaseMode === 'extra_only' ? `${product.name} (Ingressos Acompanhante)` : product.name,
      imageUrl: product.imageUrl,
      priceType: product.priceType || 'fixed',
      price: purchaseMode === 'extra_only' ? (product.extraTicketPrice || 0) : firstVariantPrice,
      totalAmount,
      purchaseMode,
      isExtraTicketOnly: purchaseMode === 'extra_only',
      hasSeatMap: Boolean(product.hasSeatMap),
      hasExtraTicketPrice: Boolean(product.hasExtraTicketPrice || product.extraTicketPrice > 0),
      extraTicketPrice: product.extraTicketPrice || 0,
      includedTicketsCount: purchaseMode === 'extra_only' ? 0 : includedCount,
      selectedSeats: summarySeats,
      sessionId: allSelectedSeats[0]?.sessionId || selectedSession?.id || 'default',
      sessionLabel: summarySessions.join(' | ') || selectedSession?.label || null,
      locationName: summaryLocations.join(' | ') || selectedLocation?.name || null,
      locationVenue: selectedLocation?.venue || null,
      locationAddress: selectedLocation?.address || null,
      formDataList
    }, quantity);

    router.push('/cart');
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-[#050505]">
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color="#eab308" />
      </View>
    );
  }

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-[#050505] p-6">
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Text className="text-gray-900 dark:text-white font-bold text-center">Produto não encontrado.</Text>
        <TouchableOpacity 
          onPress={() => router.back()}
          className="mt-4 bg-[#014fa4] px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-bold">Voltar para Loja</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const effective = getEffectiveProductPrice(product, userData);
  let priceText = '';
  let originalPriceText = '';

  if (product.priceType === 'variable' && product.priceVariants && product.priceVariants.length > 0) {
    const prices = product.priceVariants.map((v: any) => getEffectiveVariantPrice(v, userData, product).price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    if (minPrice === maxPrice) {
      priceText = formatCentsToCurrency(minPrice);
    } else {
      priceText = `A partir de ${formatCentsToCurrency(minPrice)}`;
    }
    if (effective.isStaffPrice && effective.basePrice > effective.price) {
      originalPriceText = formatCentsToCurrency(effective.basePrice);
    }
  } else if (effective.isStaffPrice) {
    priceText = formatCentsToCurrency(effective.price);
    if (effective.basePrice > effective.price) {
      originalPriceText = formatCentsToCurrency(effective.basePrice);
    }
  } else {
    priceText = formatCentsToCurrency(effective.price);
    if (effective.promoPrice && effective.promoPrice < effective.basePrice) {
      originalPriceText = formatCentsToCurrency(effective.basePrice);
    }
  }

  return (
    <View className="flex-1 bg-white dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Product Image */}
        <View className="relative">
          <Image 
            source={{ uri: product.imageUrl || 'https://via.placeholder.com/600x600.png?text=Sem+Imagem' }} 
            className="w-full aspect-square"
            resizeMode="cover"
          />
          <TouchableOpacity 
            onPress={() => router.back()}
            style={{ top: insets.top + 10 }}
            className="absolute left-6 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md items-center justify-center"
          >
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View className="px-6 py-8">
          {product.category && (
            <View className="bg-yellow-500/10 self-start px-3 py-1 rounded-lg mb-4 border border-yellow-500/20">
              <Text className="text-[#eab308] text-[10px] font-black uppercase tracking-widest">{product.category}</Text>
            </View>
          )}

          <Text className="text-3xl font-black text-gray-900 dark:text-white mb-2 leading-tight">
            {product.name}
          </Text>

          <View className="flex-row items-center mb-6">
            <View className="flex-row mr-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={14} color="#eab308" fill="#eab308" />
              ))}
            </View>
            <Text className="text-gray-400 text-xs font-bold">(48 avaliações)</Text>
          </View>

          <View className="mb-6">
            {originalPriceText ? (
              <Text className="text-sm font-semibold text-gray-400 line-through mb-0.5">
                {originalPriceText}
              </Text>
            ) : null}
            <View className="flex-row items-center gap-2">
              <Text className="text-3xl font-black text-yellow-600 dark:text-yellow-500">
                {priceText}
              </Text>
              {effective.isStaffPrice && (
                <View className="bg-purple-500/20 px-2.5 py-1 rounded-lg border border-purple-500/30">
                  <Text className="text-[10px] font-black text-purple-600 dark:text-purple-300 uppercase tracking-wider">🔒 Preço Staff</Text>
                </View>
              )}
            </View>
          </View>

          <View className="h-[1px] bg-gray-100 dark:bg-white/5 w-full mb-6" />

          <Text className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Descrição</Text>
          <Text className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
            {product.description || 'Nenhuma descrição disponível para este produto. Qualidade garantida Kihap Martial Arts.'}
          </Text>

          {/* Módulo de Mapa de Assentos, Locais & Sessões */}
          {product.hasSeatMap && (
            <View className="mb-6">
              {/* Seletor de Modalidade: Inscrição Completa vs Apenas Ingressos Acompanhante */}
              {(product.hasExtraTicketPrice || (product.extraTicketPrice && product.extraTicketPrice > 0)) && (
                <View 
                  style={{
                    marginBottom: 20,
                    padding: 16,
                    borderRadius: 20,
                    backgroundColor: isDark ? '#141414' : '#f9fafb',
                    borderWidth: 1,
                    borderColor: isDark ? '#262626' : '#e5e7eb'
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#9ca3af' : '#4b5563', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                    O que você deseja adquirir?
                  </Text>
                  
                  {hasExistingEnrollment && (
                    <View style={{ marginBottom: 12, padding: 10, borderRadius: 12, backgroundColor: 'rgba(16, 185, 129, 0.12)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ticket size={16} color="#10b981" />
                      <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: '#10b981' }}>
                        Identificamos que você já possui inscrição neste evento! O modo de cadeiras extras foi ativado.
                      </Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => setPurchaseMode('full')}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        padding: 14,
                        borderRadius: 16,
                        borderWidth: 2,
                        borderColor: purchaseMode === 'full' ? '#eab308' : (isDark ? '#262626' : '#e5e7eb'),
                        backgroundColor: purchaseMode === 'full' ? 'rgba(234, 179, 8, 0.12)' : (isDark ? '#1c1c1c' : '#ffffff')
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: purchaseMode === 'full' ? '#eab308' : (isDark ? '#ffffff' : '#111827') }}>
                          Inscrição + Cadeira
                        </Text>
                        {purchaseMode === 'full' && <Check size={14} color="#eab308" />}
                      </View>
                      <Text style={{ fontSize: 10, color: isDark ? '#9ca3af' : '#6b7280', fontWeight: '500' }}>
                        Graduação do aluno (já inclui 1 cadeira)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setPurchaseMode('extra_only')}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        padding: 14,
                        borderRadius: 16,
                        borderWidth: 2,
                        borderColor: purchaseMode === 'extra_only' ? '#10b981' : (isDark ? '#262626' : '#e5e7eb'),
                        backgroundColor: purchaseMode === 'extra_only' ? 'rgba(16, 185, 129, 0.12)' : (isDark ? '#1c1c1c' : '#ffffff')
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: purchaseMode === 'extra_only' ? '#10b981' : (isDark ? '#ffffff' : '#111827') }}>
                          Apenas Cadeira Extra
                        </Text>
                        {purchaseMode === 'extra_only' && <Check size={14} color="#10b981" />}
                      </View>
                      <Text style={{ fontSize: 10, color: isDark ? '#9ca3af' : '#6b7280', fontWeight: '500' }}>
                        {formatCentsToCurrency(product.extraTicketPrice || 0)} cada (Acompanhante)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Seletor de Cidades / Locais */}
              {product.hasLocations && product.locations && product.locations.length > 0 && (
                <View className="mb-4">
                  <View className="flex-row items-center gap-2 mb-3">
                    <MapPin size={16} color="#eab308" />
                    <Text className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      Escolha a Cidade / Local
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {product.locations.map((loc: any) => {
                      const isSelected = (selectedLocation?.id || product.locations[0]?.id) === loc.id;
                      return (
                        <TouchableOpacity
                          key={loc.id}
                          activeOpacity={0.8}
                          onPress={() => {
                            setSelectedLocation(loc);
                            if (loc.sessions && loc.sessions.length > 0) {
                              setSelectedSession(loc.sessions[0]);
                            } else {
                              setSelectedSession(null);
                            }
                          }}
                          style={{
                            marginRight: 12,
                            padding: 14,
                            borderRadius: 16,
                            borderWidth: 1,
                            backgroundColor: isSelected ? '#eab308' : (isDark ? '#161616' : '#ffffff'),
                            borderColor: isSelected ? '#facc15' : (isDark ? '#262626' : '#e5e7eb'),
                          }}
                        >
                          <Text 
                            style={{ 
                              fontSize: 12, 
                              fontWeight: '900', 
                              marginBottom: 4, 
                              color: isSelected ? '#000000' : (isDark ? '#ffffff' : '#111827') 
                            }}
                          >
                            {loc.name}
                          </Text>
                          {loc.venue ? (
                            <Text 
                              style={{ 
                                fontSize: 11, 
                                fontWeight: '700', 
                                color: isSelected ? '#1f2937' : '#6b7280' 
                              }}
                            >
                              {loc.venue}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Seletor de Sessões / Horários com contador de assentos acumulados */}
              {availableSessions.length > 0 && (
                <View className="mb-4">
                  <View className="flex-row items-center gap-2 mb-3">
                    <Calendar size={16} color="#eab308" />
                    <Text className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      Escolha o Horário / Sessão
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {availableSessions.map((sess: any) => {
                      const isSelected = (selectedSession?.id || availableSessions[0]?.id) === sess.id;
                      const sessionSeatsCount = selectedSeatsBySession[sess.id]?.seats?.length || 0;
                      return (
                        <TouchableOpacity
                          key={sess.id}
                          activeOpacity={0.8}
                          onPress={() => {
                            setSelectedSession(sess);
                          }}
                          style={{
                            marginRight: 12,
                            padding: 14,
                            borderRadius: 16,
                            borderWidth: 1,
                            backgroundColor: isSelected ? '#eab308' : (isDark ? '#161616' : '#ffffff'),
                            borderColor: isSelected ? '#facc15' : (isDark ? '#262626' : '#e5e7eb'),
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <Text 
                              style={{ 
                                fontSize: 12, 
                                fontWeight: '900', 
                                color: isSelected ? '#000000' : (isDark ? '#ffffff' : '#111827') 
                              }}
                            >
                              {sess.name}
                            </Text>
                            {sessionSeatsCount > 0 && (
                              <View 
                                style={{ 
                                  paddingHorizontal: 6, 
                                  paddingVertical: 2, 
                                  borderRadius: 6, 
                                  backgroundColor: isSelected ? 'rgba(0,0,0,0.2)' : 'rgba(234, 179, 8, 0.2)',
                                  borderWidth: isSelected ? 0 : 1,
                                  borderColor: isSelected ? 'transparent' : 'rgba(234, 179, 8, 0.4)'
                                }}
                              >
                                <Text 
                                  style={{ 
                                    fontSize: 9, 
                                    fontWeight: '900', 
                                    color: isSelected ? '#000000' : '#eab308' 
                                  }}
                                >
                                  {sessionSeatsCount} {sessionSeatsCount === 1 ? 'cadeira' : 'cadeiras'}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text 
                            style={{ 
                              fontSize: 11, 
                              fontWeight: '700', 
                              color: isSelected ? '#1f2937' : '#6b7280' 
                            }}
                          >
                            {sess.date ? `${sess.date.split('-').reverse().slice(0, 2).join('/')} ` : ''}{sess.time ? `às ${sess.time}` : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Mapa de Assentos Interativo */}
              <SeatMapSelector
                productId={product.id}
                sessionId={activeSessionId}
                config={activeSeatMapConfig}
                selectedSeats={currentSessionSeats}
                onSeatToggle={handleSeatToggle}
              />

              {/* Resumo visual de assentos selecionados entre todas as sessões */}
              {allSelectedSeats.length > 0 && (
                <View 
                  style={{
                    marginTop: 16,
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(254, 243, 199, 0.5)',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#fde68a'
                  }}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-[10px] font-black text-amber-500 uppercase tracking-wider">
                      Assentos Selecionados ({allSelectedSeats.length}):
                    </Text>
                    <TouchableOpacity
                      onPress={() => setSelectedSeatsBySession({})}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text className="text-[10px] font-bold text-red-400 uppercase">Limpar Seleção</Text>
                    </TouchableOpacity>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {allSelectedSeats.map((item) => (
                      <View 
                        key={`${item.sessionId}_${item.seatId}`} 
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 12,
                          backgroundColor: 'rgba(234, 179, 8, 0.15)',
                          borderWidth: 1,
                          borderColor: 'rgba(234, 179, 8, 0.35)',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <Armchair size={12} color="#eab308" />
                        <Text style={{ fontSize: 12, fontWeight: '900', color: '#eab308' }}>
                          Cadeira {item.seatId}
                          {getSeatSectorName(item.seatId, activeSeatMapConfig) ? ` (${getSeatSectorName(item.seatId, activeSeatMapConfig)})` : ''}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#9ca3af', fontWeight: '600' }}>
                          • {item.sessionName}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Participant Info Fields */}
          {participants.map((participant, index) => {
            const isExtra = !!(product.hasSeatMap && product.hasExtraTicketPrice && (purchaseMode === 'extra_only' || index >= (product.includedTicketsCount || 1)));
            const isGraduationMain = !!(product.hasSeatMap && product.hasExtraTicketPrice && purchaseMode !== 'extra_only' && index < (product.includedTicketsCount || 1));

            return (
              <View 
                key={index} 
                style={{
                  marginBottom: 32,
                  padding: 24,
                  borderRadius: 24,
                  borderWidth: 1,
                  backgroundColor: isExtra 
                    ? (isDark ? 'rgba(69, 26, 3, 0.25)' : 'rgba(254, 243, 199, 0.5)') 
                    : (isDark ? '#121212' : '#f9fafb'),
                  borderColor: isExtra 
                    ? (isDark ? 'rgba(146, 64, 14, 0.35)' : '#fde68a') 
                    : (isDark ? '#262626' : '#f3f4f6')
                }}
              >
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-1 mr-2">
                    <View className="flex-row items-center gap-2">
                      <Text className={`text-xs font-black uppercase tracking-widest ${isExtra ? 'text-amber-600 dark:text-amber-400' : 'text-yellow-600 dark:text-yellow-500'}`}>
                        {product.hasSeatMap 
                          ? (isExtra ? `Ingresso ${index + 1} • Acompanhante` : (isGraduationMain ? `Ingresso 1 • Graduando` : `Ingresso ${index + 1}`))
                          : `Informações do Item ${index + 1}`}
                      </Text>
                      {isExtra && (
                        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: 'rgba(234, 179, 8, 0.2)', borderWidth: 1, borderColor: 'rgba(234, 179, 8, 0.4)' }}>
                          <Text style={{ fontSize: 9, fontWeight: '900', color: '#d97706' }}>
                            Extra {formatCentsToCurrency(product.extraTicketPrice || 0)}
                          </Text>
                        </View>
                      )}
                      {isGraduationMain && (
                        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: 'rgba(59, 130, 246, 0.2)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.4)' }}>
                          <Text style={{ fontSize: 9, fontWeight: '900', color: '#2563eb' }}>
                            Incluso
                          </Text>
                        </View>
                      )}
                    </View>
                    {product.hasSeatMap && allSelectedSeats[index] && (
                      <Text className="text-[10px] text-gray-400 font-semibold mt-0.5" numberOfLines={1}>
                        📅 {allSelectedSeats[index].sessionLabel} {allSelectedSeats[index].locationName ? `• 📍 ${allSelectedSeats[index].locationName}` : ''}
                      </Text>
                    )}
                  </View>
                  {product.hasSeatMap && allSelectedSeats[index]?.seatId && (
                    <View className="px-3 py-1 bg-yellow-500 rounded-full flex-row items-center gap-1.5 shadow-sm">
                      <Armchair size={12} color="#000" />
                      <Text className="text-xs font-black text-black">
                        Cadeira {allSelectedSeats[index].seatId}
                        {getSeatSectorName(allSelectedSeats[index].seatId, activeSeatMapConfig) ? ` • ${getSeatSectorName(allSelectedSeats[index].seatId, activeSeatMapConfig)}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View className="space-y-4">
                  <View>
                    <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">
                      {isExtra ? 'Nome do Acompanhante / Convidado' : 'Nome do Aluno'}
                    </Text>
                    <TextInput 
                      value={participant.userName}
                      onChangeText={(v) => updateParticipant(index, { userName: v })}
                      placeholder={isExtra ? "Nome do convidado que ocupará o assento" : "Nome completo do aluno"}
                      placeholderTextColor="#999"
                      className="bg-white dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-100 dark:border-white/10 text-gray-900 dark:text-white"
                    />
                  </View>

                  {isExtra && (
                    <View style={{ padding: 12, backgroundColor: 'rgba(234, 179, 8, 0.1)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(234, 179, 8, 0.25)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 12 }}>🎟️</Text>
                      <Text style={{ fontSize: 11, color: isDark ? '#fde68a' : '#b45309', fontWeight: '500', flex: 1 }}>
                        Ingresso adicional para assistir ao evento. Não requer dados de graduação ou programa.
                      </Text>
                    </View>
                  )}

                  {!isExtra && product.priceType === 'variable' && product.priceVariants && product.priceVariants.length > 0 && (
                    <View>
                      <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">
                        {product.variantsLabel || 'Opção'}
                      </Text>
                      <View className="flex-row flex-wrap">
                        {product.priceVariants.map((variant: any) => {
                          const isSelected = participant.selectedVariant?.name === variant.name;
                          const variantEff = getEffectiveVariantPrice(variant, userData, product);
                          const variantPriceFormatted = formatCentsToCurrency(variantEff.price);
                          const pixFormatted = (variant.pixPrice && variant.pixPrice < variantEff.price) 
                            ? ` (Pix ${formatCentsToCurrency(variant.pixPrice)})`
                            : '';
                          return (
                            <TouchableOpacity 
                              key={variant.name}
                              onPress={() => updateParticipant(index, { selectedVariant: variant })}
                              className={`mr-2 mb-2 px-4 py-2 rounded-xl border ${isSelected ? 'bg-[#014fa4] border-[#014fa4]' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/10'}`}
                            >
                              <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                                {variant.name} ({variantPriceFormatted}{pixFormatted})
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {!isExtra && (
                    <View>
                      <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Programa</Text>
                      <View className="flex-row flex-wrap">
                        {[
                          { label: 'Tradicional', value: 'tradicional' },
                          { label: 'Littles', value: 'littles' },
                          { label: 'Não Aluno', value: 'não aluno' }
                        ].map((prog) => (
                          <TouchableOpacity 
                            key={prog.value}
                            onPress={() => {
                              console.log(`[DEBUG] Button clicked: ${prog.value}`);
                              updateParticipant(index, { userPrograma: prog.value, userGraduacao: '' });
                            }}
                            className={`mr-2 mb-2 px-4 py-2 rounded-xl border ${participant.userPrograma === prog.value ? 'bg-[#014fa4] border-[#014fa4]' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/10'}`}
                          >
                            <Text className={`text-xs font-bold ${participant.userPrograma === prog.value ? 'text-white' : 'text-gray-500'}`}>{prog.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {!isExtra && (participant.userPrograma === 'tradicional' || participant.userPrograma === 'littles') && (
                    <View>
                      <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Graduação</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
                        {GRADUACOES[participant.userPrograma].map((grad) => (
                          <TouchableOpacity 
                            key={grad}
                            onPress={() => updateParticipant(index, { userGraduacao: grad })}
                            className={`mr-2 px-4 py-2 rounded-xl border ${participant.userGraduacao === grad ? 'bg-[#014fa4] border-[#014fa4]' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/10'}`}
                          >
                            <Text className={`text-xs font-bold ${participant.userGraduacao === grad ? 'text-white' : 'text-gray-500'}`}>{grad}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {!isExtra && product.hasSizes && product.sizes && (
                    <View>
                      <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Tamanho</Text>
                      <View className="flex-row flex-wrap">
                        {product.sizes.map((size: string) => (
                          <TouchableOpacity 
                            key={size}
                            onPress={() => updateParticipant(index, { userSize: size })}
                            className={`mr-2 mb-2 px-4 py-2 rounded-xl border ${participant.userSize === size ? 'bg-[#014fa4] border-[#014fa4]' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/10'}`}
                          >
                            <Text className={`text-xs font-bold ${participant.userSize === size ? 'text-white' : 'text-gray-500'}`}>{size}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {!isExtra && product.askProfessor && (
                    <View>
                      <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Professor Responsável</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                        {product.availableProfessors && product.availableProfessors.length > 0 ? (
                          product.availableProfessors.map((profName: string, i: number) => (
                            <TouchableOpacity 
                              key={`prof-${i}`}
                              onPress={() => updateParticipant(index, { userProfessor: profName })}
                              className={`mr-2 px-4 py-2 rounded-xl border ${participant.userProfessor === profName ? 'bg-[#014fa4] border-[#014fa4]' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/10'}`}
                            >
                              <Text className={`text-xs font-bold ${participant.userProfessor === profName ? 'text-white' : 'text-gray-500'}`}>{profName}</Text>
                            </TouchableOpacity>
                          ))
                        ) : (
                          instructors.map((inst) => (
                            <TouchableOpacity 
                              key={inst.id}
                              onPress={() => updateParticipant(index, { userProfessor: inst.name })}
                              className={`mr-2 px-4 py-2 rounded-xl border ${participant.userProfessor === inst.name ? 'bg-[#014fa4] border-[#014fa4]' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/10'}`}
                            >
                              <Text className={`text-xs font-bold ${participant.userProfessor === inst.name ? 'text-white' : 'text-gray-500'}`}>{inst.name}</Text>
                            </TouchableOpacity>
                          ))
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {/* Benefits */}
          <View className="flex-row justify-between mb-8">
            <View className="items-center flex-1">
              <View className="w-10 h-10 rounded-full bg-green-500/10 items-center justify-center mb-2">
                <ShieldCheck size={20} color="#22c55e" />
              </View>
              <Text className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase text-center">Garantia Original</Text>
            </View>
            <View className="items-center flex-1">
              <View className="w-10 h-10 rounded-full bg-blue-500/10 items-center justify-center mb-2">
                <ShoppingCart size={20} color="#3b82f6" />
              </View>
              <Text className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase text-center">Entrega na Unidade</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer / Buy Area */}
      <View 
        style={{ paddingBottom: Math.max(insets.bottom, 24) }}
        className="px-6 pt-6 bg-white dark:bg-[#0a0a0a] border-t border-gray-100 dark:border-white/5 shadow-2xl"
      >
        <View className="flex-row items-center justify-between mb-6">
          {product.hasSeatMap ? (
            <View className="flex-row items-center gap-2">
              <View className="w-10 h-10 rounded-2xl bg-yellow-500/10 items-center justify-center border border-yellow-500/20">
                <Armchair size={18} color="#eab308" />
              </View>
              <View>
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Cadeiras ({allSelectedSeats.length})
                </Text>
                <Text className="text-xs font-black text-gray-900 dark:text-white max-w-[150px]" numberOfLines={1}>
                  {allSelectedSeats.length > 0 ? allSelectedSeats.map(s => s.seatId).join(', ') : 'Nenhuma'}
                </Text>
              </View>
            </View>
          ) : (
            <View className="flex-row items-center bg-gray-100 dark:bg-white/5 rounded-2xl p-1">
              <TouchableOpacity 
                onPress={() => quantity > 1 && setQuantity(q => q - 1)}
                className="w-10 h-10 items-center justify-center"
              >
                <Minus size={18} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
              <Text className="px-4 text-lg font-black text-gray-900 dark:text-white">{quantity}</Text>
              <TouchableOpacity 
                onPress={() => setQuantity(q => q + 1)}
                className="w-10 h-10 items-center justify-center"
              >
                <Plus size={18} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
            </View>
          )}
          
          <View className="items-end">
            <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              {product.hasSeatMap && product.hasExtraTicketPrice
                ? (purchaseMode === 'extra_only'
                    ? `${allSelectedSeats.length}x Cadeira Extra`
                    : (allSelectedSeats.length > (product.includedTicketsCount || 1)
                        ? `1x Inscrição + ${allSelectedSeats.length - (product.includedTicketsCount || 1)}x Extra`
                        : 'Total'))
                : 'Total'}
            </Text>
            <Text className="text-xl font-black text-gray-900 dark:text-white">
              {(calculateTotal() / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          onPress={handleAddToCart}
          disabled={lockingSeats}
          className="bg-[#014fa4] py-5 rounded-2xl items-center justify-center flex-row shadow-lg shadow-blue-500/20"
          activeOpacity={0.8}
        >
          {lockingSeats ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <ShoppingCart size={20} color="#fff" strokeWidth={3} />
              <Text className="ml-3 text-white font-black uppercase tracking-widest">
                {product.hasSeatMap 
                  ? (purchaseMode === 'extra_only' ? 'Comprar Ingressos Extras' : 'Garantir Cadeiras & Comprar') 
                  : 'Adicionar ao Carrinho'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
