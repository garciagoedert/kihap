import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { ArrowLeft, ShoppingCart, Minus, Plus, Star, ShieldCheck, Calendar, Clock, Armchair, MapPin, Check, Ticket, Copy, Layers } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

import { useCart } from '../../src/context/CartContext';
import { useAuth } from '../../src/context/AuthContext';
import {
  getEffectiveProductPrice,
  getEffectiveVariantPrice,
  formatCentsToCurrency,
  getProductTotalStock,
  getProductSizeStock,
  isProductAvailableForPurchase,
} from '../../src/utils/pricing';
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
  const [replicatingSeats, setReplicatingSeats] = useState(false);
  const [expandedAltNamesBySlot, setExpandedAltNamesBySlot] = useState<Record<string, boolean>>({});
  const [purchaseMode, setPurchaseMode] = useState<'full' | 'extra_only'>('full');
  const [hasExistingEnrollment, setHasExistingEnrollment] = useState(false);

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

  // Flattened array of all chosen seats across all sessions (with multi-session slot pricing)
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
      slotIndex: number;
      slotKey: string;
      isMultiSessionFree: boolean;
    }> = [];

    const isMultiFreeEnabled = Boolean(product?.multiSessionSingleCharge);
    const orderedEntries: Array<[string, { session: any; location?: any; seats: string[] }]> = [];
    const seenKeys = new Set<string>();

    availableSessions.forEach((sess: any) => {
      const key = sess?.id || 'default';
      if (selectedSeatsBySession[key] && !seenKeys.has(key)) {
        orderedEntries.push([key, selectedSeatsBySession[key]]);
        seenKeys.add(key);
      }
    });
    Object.entries(selectedSeatsBySession).forEach(([sessId, data]) => {
      if (!seenKeys.has(sessId)) {
        orderedEntries.push([sessId, data]);
        seenKeys.add(sessId);
      }
    });

    if (!isMultiFreeEnabled) {
      let globalIdx = 0;
      orderedEntries.forEach(([sessId, data]) => {
        const scopeKey = data.location?.id || 'default';
        data.seats.forEach(seatId => {
          const slotIndex = globalIdx++;
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
            locationAddress: data.location?.address,
            slotIndex,
            slotKey: `${scopeKey}::${slotIndex}`,
            isMultiSessionFree: false
          });
        });
      });
      return list;
    }

    const seenSlotsByScope = new Map<string, Set<number>>();
    const seatIdToSlotByScope = new Map<string, Map<string, number>>();

    orderedEntries.forEach(([sessId, data]) => {
      const scopeKey = data.location?.id || 'default';
      if (!seenSlotsByScope.has(scopeKey)) {
        seenSlotsByScope.set(scopeKey, new Set<number>());
        seatIdToSlotByScope.set(scopeKey, new Map<string, number>());
      }
      const seenSlots = seenSlotsByScope.get(scopeKey)!;
      const seatIdToSlot = seatIdToSlotByScope.get(scopeKey)!;

      const usedInSession = new Set<number>();
      const assignedSlots = new Map<string, number>();

      // Fase A: alinha cadeiras repetidas ao mesmo slot já usado
      data.seats.forEach((seatId) => {
        if (seatIdToSlot.has(seatId)) {
          const prefSlot = seatIdToSlot.get(seatId)!;
          if (!usedInSession.has(prefSlot)) {
            assignedSlots.set(seatId, prefSlot);
            usedInSession.add(prefSlot);
          }
        }
      });

      // Fase B: assentos alternativos (caso o mesmo esteja ocupado) ou extras
      data.seats.forEach((seatId) => {
        if (assignedSlots.has(seatId)) return;
        let s = 0;
        while (usedInSession.has(s)) s++;
        assignedSlots.set(seatId, s);
        usedInSession.add(s);
        if (!seatIdToSlot.has(seatId)) {
          seatIdToSlot.set(seatId, s);
        }
      });

      data.seats.forEach((seatId) => {
        const slotIndex = assignedSlots.get(seatId)!;
        const isFree = seenSlots.has(slotIndex);
        seenSlots.add(slotIndex);
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
          locationAddress: data.location?.address,
          slotIndex,
          slotKey: `${scopeKey}::${slotIndex}`,
          isMultiSessionFree: isFree
        });
      });
    });

    return list;
  }, [selectedSeatsBySession, availableSessions, product?.multiSessionSingleCharge]);

  const paidSeatsCount = useMemo(
    () => allSelectedSeats.filter((s) => !s.isMultiSessionFree).length,
    [allSelectedSeats]
  );
  const freeMultiSessionCount = useMemo(
    () => allSelectedSeats.filter((s) => s.isMultiSessionFree).length,
    [allSelectedSeats]
  );

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
              selectedVariant: defaultVariant,
              kitSelections: {}
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
    if (!userData?.uid || !id || !product) return;
    const isSeatExtraEvent = Boolean(
      product.hasSeatMap &&
      (product.hasExtraTicketPrice ||
        (product.extraTicketPrice || 0) > 0 ||
        (product.hasLocations &&
          Array.isArray(product.locations) &&
          product.locations.some((loc: any) => (loc?.extraTicketPrice || 0) > 0)))
    );
    if (!isSeatExtraEvent) {
      setHasExistingEnrollment(false);
      setPurchaseMode('full');
      return;
    }

    const checkUserEnrollment = async () => {
      try {
        const q = query(
          collection(db, 'inscricoesFaixaPreta'),
          where('userId', '==', userData.uid)
        );
        const snap = await getDocs(q);
        const found = snap.docs.some(d => {
          const order = d.data();
          if (order.paymentStatus !== 'paid') return false;
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
  }, [userData?.uid, id, product?.hasSeatMap, product?.hasExtraTicketPrice, product?.extraTicketPrice]);

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

  const handleReplicateSeats = async (targetSessions: any[]) => {
    if (!product?.id || replicatingSeats) return;
    if (currentSessionSeats.length === 0) {
      Alert.alert('Selecione ao menos uma cadeira', 'Escolha primeiro uma ou mais cadeiras na sessão atual antes de replicar para outra sessão.');
      return;
    }

    const targets = targetSessions.filter((s) => (s?.id || 'default') !== activeSessionId);
    if (targets.length === 0) return;

    setReplicatingSeats(true);
    try {
      const now = Date.now();
      const disabledSet = new Set<string>(activeSeatMapConfig?.disabledSeats || []);
      const updatesBySessKey: { [k: string]: { session: any; location?: any; seats: string[] } } = {};
      const conflicts: Array<{ session: any; occupied: string[] }> = [];
      let totalCopied = 0;

      for (const targetSess of targets) {
        const targetKey = targetSess.id || 'default';
        const docId = `${product.id}_${targetKey}`;
        const snap = await getDoc(doc(db, 'productSeatReservations', docId));
        const reservedMap = snap.exists() ? (snap.data().seats || {}) : {};

        const availableToCopy: string[] = [];
        const occupiedSeats: string[] = [];

        currentSessionSeats.forEach((seatId) => {
          const reservation = reservedMap[seatId];
          const isDisabled =
            disabledSet.has(seatId) ||
            reservation?.status === 'disabled' ||
            reservation?.status === 'blocked_admin';
          const isBooked = reservation?.status === 'booked';
          const isLocked = reservation?.status === 'locked' && reservation?.lockedUntil > now;

          if (isDisabled || isBooked || isLocked) {
            occupiedSeats.push(seatId);
          } else {
            availableToCopy.push(seatId);
          }
        });

        if (availableToCopy.length > 0) {
          const existingSeats = selectedSeatsBySession[targetKey]?.seats || [];
          const merged = Array.from(new Set([...existingSeats, ...availableToCopy]));
          updatesBySessKey[targetKey] = {
            session: targetSess,
            location: selectedLocation,
            seats: merged
          };
          totalCopied += availableToCopy.length;
        }

        if (occupiedSeats.length > 0) {
          conflicts.push({ session: targetSess, occupied: occupiedSeats });
        }
      }

      if (Object.keys(updatesBySessKey).length > 0) {
        setSelectedSeatsBySession((prev) => ({
          ...prev,
          ...updatesBySessKey
        }));
      }

      if (conflicts.length > 0) {
        setSelectedSession(conflicts[0].session);
        const detailLines = conflicts
          .map((c) => `• ${c.session.name || 'Sessão'}: ${c.occupied.join(', ')}`)
          .join('\n');
        Alert.alert(
          'Algumas cadeiras já estão ocupadas',
          `As seguintes cadeiras já estão reservadas em outra sessão:\n${detailLines}\n\nAbrimos essa sessão no mapa para você escolher outra cadeira disponível sem custo adicional.`
        );
      } else if (totalCopied > 0) {
        const sessNames = targets.map((t) => t.name || 'Sessão').join(', ');
        Alert.alert(
          'Cadeiras replicadas!',
          `Suas cadeiras foram replicadas para: ${sessNames}, sem cobrança adicional.`
        );
      }
    } catch (err) {
      console.warn('Erro ao replicar cadeiras:', err);
      Alert.alert('Erro ao replicar', 'Não foi possível verificar as reservas da outra sessão. Tente selecioná-la manualmente.');
    } finally {
      setReplicatingSeats(false);
    }
  };

  useEffect(() => {
    if (!product) return;
    const defaultVariant = product.priceType === 'variable' && product.priceVariants && product.priceVariants.length > 0
      ? product.priceVariants[0]
      : null;

    if (product.hasSeatMap) {
      const effectiveExtraPrice = (product.hasLocations && selectedLocation?.extraTicketPrice && selectedLocation.extraTicketPrice > 0)
        ? selectedLocation.extraTicketPrice
        : (product.extraTicketPrice || 0);
      const isGraduation = Boolean(product.hasExtraTicketPrice || product.extraTicketPrice > 0 || effectiveExtraPrice > 0);

      const count = isGraduation
        ? (purchaseMode === 'full' ? 1 + allSelectedSeats.length : allSelectedSeats.length)
        : Math.max(1, allSelectedSeats.length);

      if (quantity !== count) {
        setQuantity(count);
      }

      setParticipants(prev => {
        const findPrevSeatParticipant = (seatInfo: any, fallbackIdx: number) => {
          if (seatInfo) {
            const exact = prev.find(
              (p) => p.seatId === seatInfo.seatId && p.sessionId === seatInfo.sessionId
            );
            if (exact) {
              if (!exact.userName?.trim() && !seatInfo.isMultiSessionFree) {
                const slotDonor = prev.find(
                  (p) => p.multiSessionSlotKey === seatInfo.slotKey && p.userName?.trim()
                );
                if (slotDonor) {
                  return { ...exact, userName: slotDonor.userName };
                }
              }
              return exact;
            }
            if (!seatInfo.isMultiSessionFree) {
              const slotDonor = prev.find(
                (p) => p.multiSessionSlotKey === seatInfo.slotKey && p.userName?.trim()
              );
              if (slotDonor) {
                return { ...slotDonor, ticketType: slotDonor.ticketType || 'inteira' };
              }
            }
          }
          return prev[fallbackIdx];
        };

        const newList = [];
        if (isGraduation && purchaseMode === 'full') {
          // Participant 0: Aluno no tatame (sem cadeira)
          const prevStudent = prev.find((p) => p.seatId === null) || prev[0];
          newList.push({
            ...(prevStudent || {
              userName: '',
              userPrograma: '',
              userGraduacao: '',
              userProfessor: '',
              userSize: '',
              selectedVariant: defaultVariant
            }),
            seatId: null,
            isMultiSessionFree: false,
            multiSessionSlotIndex: null,
            multiSessionSlotKey: null,
            sessionId: selectedSession?.id || null,
            sessionName: selectedSession?.name || null,
            sessionLabel: selectedSession?.label || selectedSession?.name || null,
            locationId: selectedLocation?.id || null,
            locationName: selectedLocation?.name || null,
            locationVenue: selectedLocation?.venue || null,
            locationAddress: selectedLocation?.address || null
          });
          // Participants 1..N: Cadeiras de acompanhantes
          for (let i = 0; i < allSelectedSeats.length; i++) {
            const seatInfo = allSelectedSeats[i];
            const prevMatch = findPrevSeatParticipant(seatInfo, i + 1);
            newList.push({
              ...(prevMatch || {
                userName: '',
                ticketType: 'inteira'
              }),
              seatId: seatInfo?.seatId || null,
              isMultiSessionFree: Boolean(seatInfo?.isMultiSessionFree),
              multiSessionSlotIndex: seatInfo ? seatInfo.slotIndex : null,
              multiSessionSlotKey: seatInfo ? seatInfo.slotKey : null,
              sessionId: seatInfo?.sessionId || null,
              sessionName: seatInfo?.sessionName || null,
              sessionLabel: seatInfo?.sessionLabel || null,
              locationId: seatInfo?.locationId || null,
              locationName: seatInfo?.locationName || null,
              locationVenue: seatInfo?.locationVenue || null,
              locationAddress: seatInfo?.locationAddress || null
            });
          }
        } else if (isGraduation && purchaseMode === 'extra_only') {
          // Apenas cadeiras de acompanhantes
          for (let i = 0; i < allSelectedSeats.length; i++) {
            const seatInfo = allSelectedSeats[i];
            const prevMatch = findPrevSeatParticipant(seatInfo, i);
            newList.push({
              ...(prevMatch || {
                userName: '',
                ticketType: 'inteira'
              }),
              seatId: seatInfo?.seatId || null,
              isMultiSessionFree: Boolean(seatInfo?.isMultiSessionFree),
              multiSessionSlotIndex: seatInfo ? seatInfo.slotIndex : null,
              multiSessionSlotKey: seatInfo ? seatInfo.slotKey : null,
              sessionId: seatInfo?.sessionId || null,
              sessionName: seatInfo?.sessionName || null,
              sessionLabel: seatInfo?.sessionLabel || null,
              locationId: seatInfo?.locationId || null,
              locationName: seatInfo?.locationName || null,
              locationVenue: seatInfo?.locationVenue || null,
              locationAddress: seatInfo?.locationAddress || null
            });
          }
        } else {
          for (let i = 0; i < count; i++) {
            const seatInfo = allSelectedSeats[i];
            const prevMatch = findPrevSeatParticipant(seatInfo, i);
            newList.push({
              ...(prevMatch || {
                userName: '',
                userPrograma: '',
                userGraduacao: '',
                userProfessor: '',
                userSize: '',
                selectedVariant: defaultVariant,
                kitSelections: {}
              }),
              seatId: seatInfo?.seatId || null,
              isMultiSessionFree: Boolean(seatInfo?.isMultiSessionFree),
              multiSessionSlotIndex: seatInfo ? seatInfo.slotIndex : null,
              multiSessionSlotKey: seatInfo ? seatInfo.slotKey : null,
              sessionId: seatInfo?.sessionId || null,
              sessionName: seatInfo?.sessionName || null,
              sessionLabel: seatInfo?.sessionLabel || null,
              locationId: seatInfo?.locationId || null,
              locationName: seatInfo?.locationName || null,
              locationVenue: seatInfo?.locationVenue || null,
              locationAddress: seatInfo?.locationAddress || null
            });
          }
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
              selectedVariant: defaultVariant,
              kitSelections: {}
            });
          }
        } else {
          return newList.slice(0, quantity);
        }
        return newList;
      });
    }
  }, [allSelectedSeats, product, quantity, purchaseMode]);

  const updateParticipant = (index: number, updates: { [key: string]: any }) => {
    setParticipants(prev => {
      const newList = [...prev];
      newList[index] = { ...newList[index], ...updates };
      return newList;
    });
  };

  const calculateTotal = () => {
    if (!product) return 0;
    const effectiveExtraPrice = (product.hasLocations && selectedLocation?.extraTicketPrice && selectedLocation.extraTicketPrice > 0)
      ? selectedLocation.extraTicketPrice
      : (product.extraTicketPrice || 0);
    const effectiveBasePrice = (product.hasLocations && selectedLocation?.price && selectedLocation.price > 0)
      ? selectedLocation.price
      : getEffectiveProductPrice(product, userData).price;
    const effectiveExtraHalf = (selectedLocation?.halfPrice && selectedLocation.halfPrice > 0)
      ? selectedLocation.halfPrice
      : (product.extraTicketHalfPrice || product.halfPrice || Math.round(effectiveExtraPrice / 2));
    const effectiveBaseHalf = (selectedLocation?.halfPrice && selectedLocation.halfPrice > 0)
      ? selectedLocation.halfPrice
      : (product.halfPrice || Math.round(effectiveBasePrice / 2));

    const isGraduation = Boolean(product.hasSeatMap && (product.hasExtraTicketPrice || product.extraTicketPrice > 0 || effectiveExtraPrice > 0));

    if (isGraduation) {
      let total = 0;
      if (purchaseMode === 'full') {
        // Aluno no tatame (participante 0)
        const student = participants[0];
        const isStudentMeia = Boolean((product.hasHalfPrice || selectedLocation?.halfPrice) && student?.ticketType === 'meia');
        total += isStudentMeia ? effectiveBaseHalf : effectiveBasePrice;

        // Cadeiras extras de acompanhantes (participantes 1 em diante)
        for (let i = 1; i < participants.length; i++) {
          const comp = participants[i];
          const seatInfo = allSelectedSeats[i - 1];
          if (comp?.isMultiSessionFree || seatInfo?.isMultiSessionFree) continue;
          const isMeia = Boolean((product.hasHalfPrice || selectedLocation?.halfPrice || product.extraTicketHalfPrice) && comp?.ticketType === 'meia');
          total += isMeia ? effectiveExtraHalf : effectiveExtraPrice;
        }
      } else {
        // Apenas cadeiras de acompanhantes (todos os participantes)
        participants.forEach((comp, i) => {
          const seatInfo = allSelectedSeats[i];
          if (comp?.isMultiSessionFree || seatInfo?.isMultiSessionFree) return;
          const isMeia = Boolean((product.hasHalfPrice || selectedLocation?.halfPrice || product.extraTicketHalfPrice) && comp?.ticketType === 'meia');
          total += isMeia ? effectiveExtraHalf : effectiveExtraPrice;
        });
      }
      return total;
    }

    let total = 0;
    participants.forEach((p, i) => {
      const seatInfo = product.hasSeatMap ? allSelectedSeats[i] : null;
      if (p?.isMultiSessionFree || seatInfo?.isMultiSessionFree) return;
      const isMeia = Boolean((product.hasHalfPrice || selectedLocation?.halfPrice) && p.ticketType === 'meia');
      const pVariant = p?.selectedVariant || product.priceVariants?.[0];
      const basePrice = (product.priceType === 'variable' && pVariant)
        ? getEffectiveVariantPrice(pVariant, userData, product).price
        : effectiveBasePrice;
      const half = effectiveBaseHalf;
      total += isMeia ? half : basePrice;
    });

    return total;
  };

  const handleAddToCart = async () => {
    if (!isProductAvailableForPurchase(product)) {
      alert('Este produto está esgotado ou indisponível no momento.');
      return;
    }

    const effectiveExtraPrice = (product.hasLocations && selectedLocation?.extraTicketPrice && selectedLocation.extraTicketPrice > 0)
      ? selectedLocation.extraTicketPrice
      : (product.extraTicketPrice || 0);
    const isGraduation = Boolean(product.hasSeatMap && (product.hasExtraTicketPrice || product.extraTicketPrice > 0 || effectiveExtraPrice > 0));

    if (product.hasSeatMap && purchaseMode === 'extra_only') {
      if (allSelectedSeats.length === 0) {
        alert('Por favor, selecione pelo menos uma cadeira no mapa para os ingressos de acompanhante.');
        return;
      }
    }

    // Mapeia o participante pago por slot para herdar dados em assentos multi-sessão gratuitos se deixados em branco
    const paidBySlot = new Map<string, any>();
    participants.forEach((p, idx) => {
      const isExtra = isGraduation ? (purchaseMode === 'extra_only' || idx > 0) : false;
      const seatInfo = isGraduation
        ? (isExtra ? (purchaseMode === 'full' ? allSelectedSeats[idx - 1] : allSelectedSeats[idx]) : null)
        : allSelectedSeats[idx];
      const isMultiFree = Boolean(seatInfo?.isMultiSessionFree || p.isMultiSessionFree);
      const slotIdx = seatInfo ? seatInfo.slotIndex : p.multiSessionSlotIndex;
      const slotKey = seatInfo?.slotKey || p.multiSessionSlotKey || (typeof slotIdx === 'number' ? String(slotIdx) : undefined);
      if (!isMultiFree && slotKey && !paidBySlot.has(slotKey)) {
        paidBySlot.set(slotKey, p);
      }
    });

    const resolvedParticipants = participants.map((p, idx) => {
      const isExtra = isGraduation ? (purchaseMode === 'extra_only' || idx > 0) : false;
      const seatInfo = isGraduation
        ? (isExtra ? (purchaseMode === 'full' ? allSelectedSeats[idx - 1] : allSelectedSeats[idx]) : null)
        : allSelectedSeats[idx];
      const isMultiFree = Boolean(seatInfo?.isMultiSessionFree || p.isMultiSessionFree);
      const slotIdx = seatInfo ? seatInfo.slotIndex : p.multiSessionSlotIndex;
      const slotKey = seatInfo?.slotKey || p.multiSessionSlotKey || (typeof slotIdx === 'number' ? String(slotIdx) : undefined);
      if (!isMultiFree) return p;

      const source = slotKey ? paidBySlot.get(slotKey) : undefined;
      if (!source) return p;

      return {
        ...p,
        userName: p.userName?.trim() ? p.userName : (source.userName || ''),
        ...(!isExtra ? {
          userPrograma: p.userPrograma || source.userPrograma || '',
          userGraduacao: p.userGraduacao || source.userGraduacao || '',
          userProfessor: p.userProfessor || source.userProfessor || '',
          userSize: p.userSize || source.userSize || '',
          selectedVariant: p.selectedVariant || source.selectedVariant,
          kitSelections: (p.kitSelections && Object.keys(p.kitSelections).length > 0) ? p.kitSelections : (source.kitSelections || {})
        } : {})
      };
    });

    if (product.controlStock) {
      const totalStock = getProductTotalStock(product);
      const physicalRequested = isGraduation
        ? (purchaseMode === 'full' ? 1 : 0)
        : resolvedParticipants.filter((p, idx) => {
            const seatInfo = allSelectedSeats[idx];
            return !(seatInfo?.isMultiSessionFree || p.isMultiSessionFree);
          }).length;

      if (physicalRequested > 0 && (totalStock <= 0 || physicalRequested > totalStock)) {
        alert(
          totalStock <= 0
            ? 'Este produto está esgotado no estoque.'
            : `Estoque insuficiente. Disponível: ${totalStock} unidade(s).`
        );
        return;
      }

      if (product.hasSizes) {
        const sizeDemand: Record<string, { display: string; qty: number }> = {};
        resolvedParticipants.forEach((p, idx) => {
          const isExtra = isGraduation ? (purchaseMode === 'extra_only' || idx > 0) : false;
          const isMultiFree = Boolean(allSelectedSeats[idx]?.isMultiSessionFree || p.isMultiSessionFree);
          if (!isExtra && !isMultiFree && p.userSize) {
            const raw = String(p.userSize).trim();
            const key = raw.toLowerCase();
            if (!sizeDemand[key]) sizeDemand[key] = { display: raw, qty: 0 };
            sizeDemand[key].qty += 1;
          }
        });
        for (const req of Object.values(sizeDemand)) {
          const sizeAvail = getProductSizeStock(product, req.display);
          if (sizeAvail !== null && req.qty > sizeAvail) {
            alert(
              sizeAvail <= 0
                ? `O tamanho "${req.display}" deste produto está esgotado.`
                : `Estoque insuficiente para o tamanho "${req.display}". Disponível: ${sizeAvail} unidade(s).`
            );
            return;
          }
        }
      }
    }

    const effectiveBasePrice = (product.hasLocations && selectedLocation?.price && selectedLocation.price > 0)
      ? selectedLocation.price
      : getEffectiveProductPrice(product, userData).price;

    // Basic validation
    const incomplete = resolvedParticipants.some((p, idx) => {
      const isExtra = isGraduation ? (purchaseMode === 'extra_only' || idx > 0) : false;
      const seatInfo = isGraduation
        ? (isExtra ? (purchaseMode === 'full' ? allSelectedSeats[idx - 1] : allSelectedSeats[idx]) : null)
        : allSelectedSeats[idx];
      const isMultiFree = Boolean(seatInfo?.isMultiSessionFree || p.isMultiSessionFree);
      if (isExtra || isMultiFree) {
        return !p.userName?.trim();
      }
      return (
        !p.userName?.trim() ||
        !p.userPrograma ||
        ((p.userPrograma === 'tradicional' || p.userPrograma === 'littles') && !p.userGraduacao) ||
        (product.askProfessor && !p.userProfessor) || 
        (product.hasSizes && !p.userSize) ||
        (product.priceType === 'variable' && !p.selectedVariant) ||
        (product.priceType === 'kit' && Array.isArray(product.kitItems) && product.kitItems.some((kItem: any) =>
          Array.isArray(kItem.options) && kItem.options.length > 0 && !p.kitSelections?.[kItem.name]
        ))
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

    const effective = (product.hasLocations && selectedLocation?.price && selectedLocation.price > 0)
      ? { price: selectedLocation.price, isPromo: false }
      : getEffectiveProductPrice(product, userData);

    const formDataList = resolvedParticipants.map((p, idx) => {
      const isExtra = isGraduation ? (purchaseMode === 'extra_only' || idx > 0) : false;
      const seatInfo = isGraduation
        ? (isExtra ? (purchaseMode === 'full' ? allSelectedSeats[idx - 1] : allSelectedSeats[idx]) : null)
        : allSelectedSeats[idx];
      const isMultiFree = Boolean(seatInfo?.isMultiSessionFree || p.isMultiSessionFree);
      const isMeia = !isMultiFree && Boolean((product.hasHalfPrice || selectedLocation?.halfPrice || (isExtra && product.extraTicketHalfPrice)) && p.ticketType === 'meia');
      const pVariant = p.selectedVariant || (product.priceType === 'variable' ? product.priceVariants?.[0] : null);

      let selectedAmount = isMultiFree
        ? 0
        : (isExtra
            ? effectiveExtraPrice
            : (pVariant ? getEffectiveVariantPrice(pVariant, userData, product).price : effective.price));

      if (!isMultiFree && isMeia) {
        selectedAmount = isExtra
          ? ((selectedLocation?.halfPrice && selectedLocation.halfPrice > 0) ? selectedLocation.halfPrice : (product.extraTicketHalfPrice || product.halfPrice || Math.round(effectiveExtraPrice / 2)))
          : ((selectedLocation?.halfPrice && selectedLocation.halfPrice > 0) ? selectedLocation.halfPrice : (product.halfPrice || Math.round(selectedAmount / 2)));
      }

      const selectedVariantName = isMultiFree
        ? 'Cadeira Multi-Sessão (Inclusa)'
        : (isExtra
            ? (purchaseMode === 'extra_only' ? (isMeia ? 'Ingresso Acompanhante (Meia)' : 'Ingresso Acompanhante') : (isMeia ? 'Ingresso Adicional (Meia)' : 'Ingresso Adicional (Acompanhante)'))
            : (pVariant ? (isMeia ? `${pVariant.name} (Meia)` : pVariant.name) : (isMeia ? 'Meia-Entrada' : undefined)));

      const pixAmount = isMultiFree
        ? undefined
        : (isMeia
            ? (product.halfPricePix || undefined)
            : (isExtra ? undefined : (pVariant?.pixPrice || product.pixPrice || undefined)));
      
      const priceData: any = {
        amount: selectedAmount,
        ...(selectedVariantName ? { variantName: selectedVariantName } : {}),
        ...(pixAmount ? { pixAmount } : {})
      };

      const { selectedVariant, ...rest } = p;
      return {
        ...rest,
        ticketType: isMeia ? 'meia' : 'inteira',
        ticketTypeName: isMultiFree ? 'Incluso Multi-Sessão' : (isMeia ? 'Meia-Entrada' : 'Inteira'),
        isExtraTicket: isExtra,
        isMainParticipant: !isExtra,
        isMultiSessionFree: isMultiFree,
        multiSessionSlotIndex: seatInfo ? seatInfo.slotIndex : (p.multiSessionSlotIndex ?? null),
        multiSessionSlotKey: seatInfo ? seatInfo.slotKey : (p.multiSessionSlotKey ?? null),
        ...(product.priceType === 'kit' && Array.isArray(product.kitItems) ? {
          kitItemsSnapshot: product.kitItems.map((k: any) => ({
            productId: k.productId || null,
            name: k.name,
            quantity: k.quantity || 1,
            originalPrice: k.originalPrice || 0,
            isGift: Boolean(k.isGift),
          }))
        } : {}),
        seatId: seatInfo ? seatInfo.seatId : null,
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
        } : (selectedLocation ? {
          locationId: selectedLocation.id,
          locationName: selectedLocation.name,
          locationVenue: selectedLocation.venue,
          locationAddress: selectedLocation.address
        } : {})),
        priceData
      };
    });

    const totalAmount = calculateTotal();

    const firstVariantPrice = product.priceType === 'variable' && product.priceVariants && product.priceVariants.length > 0
      ? getEffectiveVariantPrice(resolvedParticipants[0]?.selectedVariant || product.priceVariants[0], userData, product).price
      : effective.price;

    const summarySeats = allSelectedSeats.map(s => s.seatId);
    const summarySessions = Array.from(new Set(allSelectedSeats.map(s => s.sessionLabel).filter(Boolean)));
    const summaryLocations = Array.from(new Set(allSelectedSeats.map(s => s.locationName).filter(Boolean)));

    const isExtraOnlyMode = isGraduation && purchaseMode === 'extra_only';

    addItem({
      id: isExtraOnlyMode ? `${product.id}_extras` : product.id,
      productId: product.id,
      name: isExtraOnlyMode ? `${product.name} (Ingressos Acompanhante)` : product.name,
      productName: isExtraOnlyMode ? `${product.name} (Ingressos Acompanhante)` : product.name,
      imageUrl: product.imageUrl,
      priceType: product.priceType || 'fixed',
      price: isExtraOnlyMode ? effectiveExtraPrice : firstVariantPrice,
      totalAmount,
      purchaseMode: isExtraOnlyMode ? 'extra_only' : 'full',
      isExtraTicketOnly: isExtraOnlyMode,
      hasSeatMap: Boolean(product.hasSeatMap),
      multiSessionSingleCharge: Boolean(product.multiSessionSingleCharge),
      hasExtraTicketPrice: isGraduation,
      extraTicketPrice: effectiveExtraPrice,
      includedTicketsCount: isExtraOnlyMode ? 0 : ((product as any)?.includedTicketsCount ?? 1),
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

  const controlsStock = Boolean(product.controlStock);
  const totalAvailableStock = controlsStock ? getProductTotalStock(product) : 0;
  const isProductUnavailable = !isProductAvailableForPurchase(product);

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
          <View className="flex-row flex-wrap items-center gap-2 mb-4">
            {product.category && (
              <View className="bg-yellow-500/10 px-3 py-1 rounded-lg border border-yellow-500/20">
                <Text className="text-[#eab308] text-[10px] font-black uppercase tracking-widest">{product.category}</Text>
              </View>
            )}
            {product.priceType === 'kit' && (
              <View className="bg-amber-500/15 px-3 py-1 rounded-lg border border-amber-500/30">
                <Text className="text-amber-600 dark:text-amber-300 text-[10px] font-black uppercase tracking-widest">KIT</Text>
              </View>
            )}
            {product.priceType === 'kit' && Array.isArray(product.kitItems) && product.kitItems.some((k: any) => k.isGift) && (
              <View className="bg-emerald-500/15 px-3 py-1 rounded-lg border border-emerald-500/30">
                <Text className="text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest">COM BRINDE</Text>
              </View>
            )}
          </View>

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
            {isProductUnavailable ? (
              <View className="mt-2 self-start bg-red-500/15 px-3 py-1.5 rounded-xl border border-red-500/30">
                <Text className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-wider">
                  Produto Esgotado / Indisponível
                </Text>
              </View>
            ) : controlsStock ? (
              <Text className={`text-xs font-bold mt-1.5 ${totalAvailableStock <= 10 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {totalAvailableStock <= 10
                  ? `Últimas ${totalAvailableStock} unidade(s) em estoque`
                  : `${totalAvailableStock} unidades em estoque`}
              </Text>
            ) : null}
          </View>

          <View className="h-[1px] bg-gray-100 dark:bg-white/5 w-full mb-6" />

          <Text className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Descrição</Text>
          <Text className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
            {product.description || 'Nenhuma descrição disponível para este produto. Qualidade garantida Kihap Martial Arts.'}
          </Text>

          {/* O que está incluso neste Kit */}
          {product.priceType === 'kit' && Array.isArray(product.kitItems) && product.kitItems.length > 0 && (
            <View className="mb-6 bg-gray-50 dark:bg-[#121212] rounded-3xl p-4 border border-gray-100 dark:border-white/5">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">
                  O que está incluso neste Kit
                </Text>
                <View className="bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  <Text className="text-[10px] font-black text-amber-600 dark:text-amber-300">
                    {product.kitItems.length} {product.kitItems.length === 1 ? 'item' : 'itens'}
                  </Text>
                </View>
              </View>

              <View className="space-y-2.5">
                {product.kitItems.map((kItem: any, idx: number) => {
                  const qty = kItem.quantity && kItem.quantity > 1 ? kItem.quantity : 1;
                  const origTotal = (kItem.originalPrice || 0) * qty;
                  return (
                    <View
                      key={`kit-summary-${idx}`}
                      className={`flex-row items-center p-2.5 rounded-2xl border ${kItem.isGift ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/5'}`}
                    >
                      {kItem.imageUrl ? (
                        <Image
                          source={{ uri: kItem.imageUrl }}
                          className="w-11 h-11 rounded-xl mr-3"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className={`w-11 h-11 rounded-xl mr-3 items-center justify-center ${kItem.isGift ? 'bg-emerald-500/20' : 'bg-gray-100 dark:bg-white/5'}`}>
                          <Text className="text-[9px] font-black uppercase text-gray-500 dark:text-gray-400">
                            {kItem.isGift ? 'BRINDE' : 'ITEM'}
                          </Text>
                        </View>
                      )}
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-bold text-gray-900 dark:text-white" numberOfLines={2}>
                          {qty > 1 ? `${qty}x ` : ''}{kItem.name}
                        </Text>
                        {Array.isArray(kItem.options) && kItem.options.length > 0 ? (
                          <Text className="text-[10px] text-gray-400 mt-0.5" numberOfLines={1}>
                            Opções: {kItem.options.join(', ')}
                          </Text>
                        ) : (
                          <Text className="text-[10px] text-gray-400 mt-0.5">
                            Tamanho único / padrão
                          </Text>
                        )}
                      </View>
                      <View className="items-end">
                        {origTotal > 0 && (
                          <Text className="text-[10px] text-gray-400 line-through">
                            {formatCentsToCurrency(origTotal)}
                          </Text>
                        )}
                        {kItem.isGift ? (
                          <View className="bg-emerald-600 px-2 py-0.5 rounded-md mt-0.5">
                            <Text className="text-[9px] font-black text-white uppercase">BRINDE GRÁTIS</Text>
                          </View>
                        ) : (
                          <Text className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                            Incluso
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              {effective.basePrice > effective.price && (
                <View className="mt-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex-row items-center justify-center">
                  <Text className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                    Você economiza {formatCentsToCurrency(effective.basePrice - effective.price)} neste kit
                  </Text>
                </View>
              )}
            </View>
          )}

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
                          Inscrição do Aluno
                        </Text>
                        {purchaseMode === 'full' && <Check size={14} color="#eab308" />}
                      </View>
                      <Text style={{ fontSize: 10, color: isDark ? '#9ca3af' : '#6b7280', fontWeight: '500' }}>
                        Graduação no tatame (cadeira não inclusa)
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
                        {formatCentsToCurrency((product.hasLocations && selectedLocation?.extraTicketPrice && selectedLocation.extraTicketPrice > 0) ? selectedLocation.extraTicketPrice : (product.extraTicketPrice || 0))} cada (Acompanhante)
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
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }} className="flex-row">
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

              {/* Banner informativo Multi-Sessão Cobrança Única */}
              {Boolean(product.multiSessionSingleCharge) && availableSessions.length > 1 && (
                <View
                  style={{
                    marginBottom: 16,
                    padding: 14,
                    borderRadius: 16,
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 10
                  }}
                >
                  <Layers size={18} color="#10b981" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: isDark ? '#34d399' : '#047857', marginBottom: 2 }}>
                      Assento Multi-Sessão Liberado
                    </Text>
                    <Text style={{ fontSize: 11, color: isDark ? '#d1fae5' : '#065f46', lineHeight: 16 }}>
                      Escolha cadeiras em quantas sessões desejar pagando apenas 1x pelo maior número de assentos por sessão. Se a mesma cadeira estiver ocupada em outra sessão, você pode escolher outro assento disponível sem custo adicional.
                    </Text>
                  </View>
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
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }} className="flex-row">
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

              {/* Replicar cadeiras para outra(s) sessão(ões) */}
              {Boolean(product.multiSessionSingleCharge) && availableSessions.length > 1 && currentSessionSeats.length > 0 && (
                <View
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 16,
                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : '#eef2ff',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(99, 102, 241, 0.35)' : '#c7d2fe'
                  }}
                >
                  <View className="flex-row items-center gap-2 mb-2.5">
                    <Copy size={14} color={isDark ? '#818cf8' : '#4f46e5'} />
                    <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#a5b4fc' : '#4338ca', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                      Replicar cadeiras desta sessão para:
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }} className="flex-row">
                    {availableSessions.filter((s: any) => (s?.id || 'default') !== activeSessionId).length >= 2 && (
                      <TouchableOpacity
                        disabled={replicatingSeats}
                        onPress={() => handleReplicateSeats(availableSessions)}
                        activeOpacity={0.8}
                        style={{
                          marginRight: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 12,
                          backgroundColor: '#4f46e5',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          opacity: replicatingSeats ? 0.6 : 1
                        }}
                      >
                        {replicatingSeats ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Layers size={13} color="#fff" />
                        )}
                        <Text style={{ fontSize: 11, fontWeight: '900', color: '#ffffff' }}>
                          Todas as sessões
                        </Text>
                      </TouchableOpacity>
                    )}
                    {availableSessions
                      .filter((s: any) => (s?.id || 'default') !== activeSessionId)
                      .map((targetSess: any) => (
                        <TouchableOpacity
                          key={`rep_${targetSess.id}`}
                          disabled={replicatingSeats}
                          onPress={() => handleReplicateSeats([targetSess])}
                          activeOpacity={0.8}
                          style={{
                            marginRight: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 12,
                            backgroundColor: isDark ? '#1e1b4b' : '#ffffff',
                            borderWidth: 1,
                            borderColor: isDark ? 'rgba(129, 140, 248, 0.45)' : '#a5b4fc',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            opacity: replicatingSeats ? 0.6 : 1
                          }}
                        >
                          <Copy size={12} color={isDark ? '#a5b4fc' : '#4f46e5'} />
                          <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#e0e7ff' : '#312e81' }}>
                            {targetSess.name || 'Outra sessão'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              )}

              {/* Resumo visual de assentos selecionados entre todas as sessões */}
              {allSelectedSeats.length > 0 && (
                <View 
                  style={{
                    marginTop: 16,
                    padding: 14,
                    borderRadius: 16,
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(254, 243, 199, 0.5)',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#fde68a'
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 10, fontWeight: '900', color: '#d97706', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        Assentos Selecionados ({allSelectedSeats.length})
                      </Text>
                      {freeMultiSessionCount > 0 && (
                        <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>
                          {paidSeatsCount} {paidSeatsCount === 1 ? 'pago' : 'pagos'} • {freeMultiSessionCount} {freeMultiSessionCount === 1 ? 'incluso (R$ 0)' : 'inclusos (R$ 0)'}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedSeatsBySession({})}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={{ flexShrink: 0, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.12)' }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#ef4444', textTransform: 'uppercase' }}>
                        Limpar
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ gap: 8 }}>
                    {allSelectedSeats.map((item) => {
                      const isFreeChip = Boolean(item.isMultiSessionFree);
                      const sectorName = getSeatSectorName(item.seatId, activeSeatMapConfig);
                      const showStatusPill = isFreeChip || Boolean(product.multiSessionSingleCharge);
                      return (
                        <View 
                          key={`${item.sessionId}_${item.seatId}`} 
                          style={{
                            width: '100%',
                            paddingHorizontal: 12,
                            paddingVertical: 9,
                            borderRadius: 12,
                            backgroundColor: isFreeChip
                              ? (isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(236, 253, 245, 0.9)')
                              : (isDark ? 'rgba(234, 179, 8, 0.14)' : '#ffffff'),
                            borderWidth: 1,
                            borderColor: isFreeChip
                              ? 'rgba(16, 185, 129, 0.45)'
                              : (isDark ? 'rgba(234, 179, 8, 0.35)' : '#fcd34d'),
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                            <Armchair size={14} color={isFreeChip ? '#10b981' : '#d97706'} style={{ flexShrink: 0 }} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text
                                style={{ fontSize: 12, fontWeight: '900', color: isFreeChip ? '#059669' : '#b45309' }}
                                numberOfLines={1}
                              >
                                Cadeira {item.seatId}{sectorName ? ` • ${sectorName}` : ''}
                              </Text>
                              <Text
                                style={{ fontSize: 10, color: isDark ? '#9ca3af' : '#6b7280', fontWeight: '600', marginTop: 1 }}
                                numberOfLines={1}
                              >
                                {item.sessionName}
                              </Text>
                            </View>
                          </View>
                          {showStatusPill && (
                            <View
                              style={{
                                flexShrink: 0,
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 9999,
                                backgroundColor: isFreeChip ? 'rgba(16, 185, 129, 0.22)' : 'rgba(245, 158, 11, 0.18)'
                              }}
                            >
                              <Text style={{ fontSize: 9, fontWeight: '900', color: isFreeChip ? '#059669' : '#b45309' }}>
                                {isFreeChip ? 'Incluso • R$ 0' : 'Pago'}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Participant Info Fields (Agrupado: 1 card por pessoa / slot em multi-sessão) */}
          {(() => {
            let visibleExtraNum = 0;
            let visibleItemNum = 0;

            return participants.map((participant, index) => {
              const effectiveExtraPrice = (product.hasLocations && selectedLocation?.extraTicketPrice && selectedLocation.extraTicketPrice > 0)
                ? selectedLocation.extraTicketPrice
                : (product.extraTicketPrice || 0);
              const isGraduation = Boolean(product.hasSeatMap && (product.hasExtraTicketPrice || product.extraTicketPrice > 0 || effectiveExtraPrice > 0));
              const isStudent = isGraduation && purchaseMode === 'full' && index === 0;
              const isExtra = isGraduation ? (purchaseMode === 'extra_only' || index > 0) : false;
              const seatInfoForCard = isGraduation
                ? (isExtra ? (purchaseMode === 'full' ? allSelectedSeats[index - 1] : allSelectedSeats[index]) : null)
                : allSelectedSeats[index];
              const isMultiFreeCard = Boolean(seatInfoForCard?.isMultiSessionFree || participant?.isMultiSessionFree);

              // Sessões extras inclusas no mesmo slot aparecem agrupadas dentro do card pago deste slot
              if (isMultiFreeCard) return null;

              if (isExtra) visibleExtraNum += 1;
              else if (!isStudent) visibleItemNum += 1;

              const slotKeyForCard = seatInfoForCard?.slotKey || participant?.multiSessionSlotKey || null;
              const linkedEntries = (slotKeyForCard && seatInfoForCard)
                ? participants
                    .map((pItem, pIdx) => {
                      const pIsExtra = isGraduation ? (purchaseMode === 'extra_only' || pIdx > 0) : false;
                      const pSeat = isGraduation
                        ? (pIsExtra ? (purchaseMode === 'full' ? allSelectedSeats[pIdx - 1] : allSelectedSeats[pIdx]) : null)
                        : allSelectedSeats[pIdx];
                      return { pIndex: pIdx, participant: pItem, seatInfo: pSeat };
                    })
                    .filter((entry) => entry.seatInfo?.slotKey === slotKeyForCard)
                : [];

              const isGroupedMultiSession = linkedEntries.length > 1;
              const isAltExpanded = Boolean(slotKeyForCard && expandedAltNamesBySlot[slotKeyForCard]);
              const hideStudentExtraFields = isExtra;

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
                      <View className="flex-row items-center flex-wrap gap-2">
                        <Text className={`text-xs font-black uppercase tracking-widest ${isExtra ? 'text-amber-600 dark:text-amber-400' : 'text-yellow-600 dark:text-yellow-500'}`}>
                          {isStudent 
                            ? 'Inscrição do Aluno' 
                            : (isExtra 
                                ? `Acompanhante ${visibleExtraNum}` 
                                : `Informações do Item ${visibleItemNum}`)}
                        </Text>
                        {isStudent && (
                          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: 'rgba(234, 179, 8, 0.2)', borderWidth: 1, borderColor: 'rgba(234, 179, 8, 0.4)' }}>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#d97706' }}>
                              Aluno (Tatame)
                            </Text>
                          </View>
                        )}
                        {isExtra && (
                          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: 'rgba(16, 185, 129, 0.2)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#059669' }}>
                              {formatCentsToCurrency(effectiveExtraPrice)}
                            </Text>
                          </View>
                        )}
                        {isGroupedMultiSession && (
                          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: 'rgba(16, 185, 129, 0.18)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.45)', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Layers size={10} color="#10b981" />
                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#10b981' }}>
                              {linkedEntries.length} sessões • Paga 1x
                            </Text>
                          </View>
                        )}
                      </View>
                      {isStudent && (
                        <Text className="text-[10px] text-gray-400 font-semibold mt-0.5">
                          Participação na graduação no tatame (cadeira na plateia não inclusa)
                        </Text>
                      )}
                      {!isGroupedMultiSession && seatInfoForCard && (
                        <Text className="text-[10px] text-gray-400 font-semibold mt-0.5" numberOfLines={2}>
                          {seatInfoForCard.sessionLabel}{seatInfoForCard.locationName ? ` • ${seatInfoForCard.locationName}` : ''}
                        </Text>
                      )}
                    </View>
                    {!isGroupedMultiSession && seatInfoForCard?.seatId && (
                      <View className="px-3 py-1 bg-yellow-500 rounded-full flex-row items-center gap-1.5 shadow-sm">
                        <Armchair size={12} color="#000" />
                        <Text className="text-xs font-black text-black">
                          Cadeira {seatInfoForCard.seatId}
                          {getSeatSectorName(seatInfoForCard.seatId, activeSeatMapConfig) ? ` • ${getSeatSectorName(seatInfoForCard.seatId, activeSeatMapConfig)}` : ''}
                        </Text>
                      </View>
                    )}
                  </View>

                  {isGroupedMultiSession && (
                    <View
                      style={{
                        marginBottom: 16,
                        padding: 12,
                        borderRadius: 16,
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(236, 253, 245, 0.9)',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#a7f3d0',
                        gap: 8
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#34d399' : '#047857', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Sessões e cadeiras incluídas neste ingresso:
                      </Text>
                      {linkedEntries.map((entry, eIdx) => {
                        const sInfo = entry.seatInfo;
                        if (!sInfo) return null;
                        const sectorName = getSeatSectorName(sInfo.seatId, activeSeatMapConfig);
                        const isFreeRow = Boolean(sInfo.isMultiSessionFree);
                        return (
                          <View
                            key={`${sInfo.sessionId}_${sInfo.seatId}`}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              borderRadius: 12,
                              backgroundColor: isDark ? 'rgba(0,0,0,0.28)' : '#ffffff',
                              borderWidth: 1,
                              borderColor: isFreeRow
                                ? (isDark ? 'rgba(16, 185, 129, 0.35)' : '#a7f3d0')
                                : (isDark ? 'rgba(234, 179, 8, 0.35)' : '#fde68a'),
                              gap: 8
                            }}
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#e5e7eb' : '#111827' }} numberOfLines={2}>
                                {sInfo.sessionLabel || sInfo.sessionName}
                                {sInfo.locationName ? ` • ${sInfo.locationName}` : ''}
                              </Text>
                              <Text style={{ fontSize: 10, fontWeight: '800', color: isFreeRow ? '#10b981' : '#d97706', marginTop: 1 }} numberOfLines={1}>
                                Cadeira {sInfo.seatId}{sectorName ? ` • ${sectorName}` : ''}
                              </Text>
                            </View>
                            <View
                              style={{
                                flexShrink: 0,
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 9999,
                                backgroundColor: isFreeRow ? 'rgba(16, 185, 129, 0.18)' : 'rgba(234, 179, 8, 0.18)'
                              }}
                            >
                              <Text style={{ fontSize: 9, fontWeight: '900', color: isFreeRow ? '#10b981' : '#d97706' }}>
                                {isFreeRow ? 'Incluso • R$ 0,00' : `${eIdx + 1}ª sessão`}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                  
                  <View className="space-y-4">
                    {/* Seletor de Tipo de Ingresso (Inteira vs Meia-Entrada) */}
                    {(product.hasHalfPrice || Boolean(selectedLocation?.halfPrice) || (isExtra && product.extraTicketHalfPrice)) && (
                      <View style={{ marginBottom: 12 }}>
                        <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">
                          Tipo de Ingresso
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => updateParticipant(index, { ticketType: 'inteira' })}
                            style={{
                              flex: 1,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 14,
                              borderWidth: 1.5,
                              backgroundColor: (participant.ticketType !== 'meia') ? (isDark ? 'rgba(234, 179, 8, 0.15)' : '#fef3c7') : (isDark ? '#1a1a1a' : '#ffffff'),
                              borderColor: (participant.ticketType !== 'meia') ? '#eab308' : (isDark ? '#333333' : '#e5e7eb'),
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '800', color: (participant.ticketType !== 'meia') ? (isDark ? '#facc15' : '#b45309') : (isDark ? '#9ca3af' : '#4b5563') }}>
                              Inteira
                            </Text>
                            <Text style={{ fontSize: 11, fontWeight: '900', color: (participant.ticketType !== 'meia') ? (isDark ? '#facc15' : '#b45309') : '#9ca3af' }}>
                              {formatCentsToCurrency(isExtra ? ((product.hasLocations && selectedLocation?.extraTicketPrice && selectedLocation.extraTicketPrice > 0) ? selectedLocation.extraTicketPrice : (product.extraTicketPrice || 0)) : ((product.hasLocations && selectedLocation?.price && selectedLocation.price > 0) ? selectedLocation.price : (product.price || 0)))}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => updateParticipant(index, { ticketType: 'meia' })}
                            style={{
                              flex: 1,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 14,
                              borderWidth: 1.5,
                              backgroundColor: (participant.ticketType === 'meia') ? (isDark ? 'rgba(168, 85, 247, 0.15)' : '#f3e8ff') : (isDark ? '#1a1a1a' : '#ffffff'),
                              borderColor: (participant.ticketType === 'meia') ? '#a855f7' : (isDark ? '#333333' : '#e5e7eb'),
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '800', color: (participant.ticketType === 'meia') ? '#a855f7' : (isDark ? '#9ca3af' : '#4b5563') }}>
                              Meia-Entrada
                            </Text>
                            <Text style={{ fontSize: 11, fontWeight: '900', color: (participant.ticketType === 'meia') ? '#a855f7' : '#9ca3af' }}>
                              {formatCentsToCurrency(isExtra 
                                ? ((selectedLocation?.halfPrice && selectedLocation.halfPrice > 0) ? selectedLocation.halfPrice : (product.extraTicketHalfPrice || product.halfPrice || Math.round(((product.hasLocations && selectedLocation?.extraTicketPrice && selectedLocation.extraTicketPrice > 0) ? selectedLocation.extraTicketPrice : (product.extraTicketPrice || 0)) / 2)))
                                : ((selectedLocation?.halfPrice && selectedLocation.halfPrice > 0) ? selectedLocation.halfPrice : (product.halfPrice || Math.round(((product.hasLocations && selectedLocation?.price && selectedLocation.price > 0) ? selectedLocation.price : (product.price || 0)) / 2))))}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    <View>
                      <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">
                        {isExtra ? 'Nome do Acompanhante / Convidado' : 'Nome do Aluno'}
                      </Text>
                      <TextInput 
                        value={participant.userName}
                        onChangeText={(v) => updateParticipant(index, { userName: v })}
                        placeholder={isExtra ? 'Nome do convidado que ocupará o assento' : 'Nome completo do aluno'}
                        placeholderTextColor="#999"
                        className="bg-white dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-100 dark:border-white/10 text-gray-900 dark:text-white"
                      />
                    </View>

                    {isGroupedMultiSession && slotKeyForCard && (
                      <View style={{ gap: 8 }}>
                        <View style={{ padding: 12, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.25)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Layers size={15} color="#10b981" />
                          <Text style={{ fontSize: 11, color: isDark ? '#a7f3d0' : '#065f46', fontWeight: '600', flex: 1 }}>
                            Este nome será usado em todas as {linkedEntries.length} sessões incluídas sem custo adicional.
                          </Text>
                        </View>

                        <TouchableOpacity
                          onPress={() => setExpandedAltNamesBySlot(prev => ({ ...prev, [slotKeyForCard]: !prev[slotKeyForCard] }))}
                          activeOpacity={0.7}
                          style={{ paddingVertical: 4, paddingHorizontal: 4 }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#93c5fd' : '#2563eb' }}>
                            {isAltExpanded ? 'Ocultar nomes por sessão' : 'Outra pessoa ocupará alguma sessão?'}
                          </Text>
                        </TouchableOpacity>

                        {isAltExpanded && (
                          <View style={{ gap: 10, padding: 12, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', borderWidth: 1, borderColor: isDark ? '#262626' : '#e5e7eb' }}>
                            {linkedEntries.slice(1).map((entry) => (
                              <View key={`alt_${entry.pIndex}`}>
                                <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">
                                  Nome em {entry.seatInfo?.sessionName || 'outra sessão'} (Cadeira {entry.seatInfo?.seatId})
                                </Text>
                                <TextInput
                                  value={entry.participant.userName}
                                  onChangeText={(v) => updateParticipant(entry.pIndex, { userName: v })}
                                  placeholder="Deixe em branco para manter o mesmo nome"
                                  placeholderTextColor="#999"
                                  className="bg-white dark:bg-[#1a1a1a] p-3.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-xs"
                                />
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {!isGroupedMultiSession && isExtra && (
                      <View style={{ padding: 12, backgroundColor: 'rgba(234, 179, 8, 0.1)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(234, 179, 8, 0.25)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ticket size={14} color={isDark ? '#fde68a' : '#b45309'} />
                        <Text style={{ fontSize: 11, color: isDark ? '#fde68a' : '#b45309', fontWeight: '500', flex: 1 }}>
                          Ingresso adicional para assistir ao evento. Não requer dados de graduação ou programa.
                        </Text>
                      </View>
                    )}

                  {!hideStudentExtraFields && product.priceType === 'variable' && product.priceVariants && product.priceVariants.length > 0 && (
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

                  {!hideStudentExtraFields && (
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

                  {!hideStudentExtraFields && (participant.userPrograma === 'tradicional' || participant.userPrograma === 'littles') && (
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

                  {!hideStudentExtraFields && product.hasSizes && product.sizes && (
                    <View>
                      <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Tamanho</Text>
                      <View className="flex-row flex-wrap">
                        {product.sizes.map((size: string) => {
                          const sizeQty = controlsStock ? getProductSizeStock(product, size) : null;
                          const isSizeSoldOut = controlsStock && sizeQty !== null && sizeQty <= 0;
                          const isSelectedSize = participant.userSize === size;
                          const labelSuffix =
                            sizeQty === null
                              ? ''
                              : sizeQty <= 0
                                ? ' (Esgotado)'
                                : sizeQty <= 5
                                  ? ` (${sizeQty} rest.)`
                                  : '';
                          return (
                            <TouchableOpacity
                              key={size}
                              disabled={isSizeSoldOut}
                              onPress={() => updateParticipant(index, { userSize: size })}
                              className={`mr-2 mb-2 px-4 py-2 rounded-xl border ${
                                isSizeSoldOut
                                  ? 'bg-gray-100 dark:bg-[#111] border-red-200 dark:border-red-900/30 opacity-45'
                                  : isSelectedSize
                                    ? 'bg-[#014fa4] border-[#014fa4]'
                                    : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/10'
                              }`}
                            >
                              <Text
                                className={`text-xs font-bold ${
                                  isSizeSoldOut
                                    ? 'text-red-500 line-through'
                                    : isSelectedSize
                                      ? 'text-white'
                                      : 'text-gray-500'
                                }`}
                              >
                                {size}{labelSuffix}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {!hideStudentExtraFields && product.priceType === 'kit' && Array.isArray(product.kitItems) && product.kitItems.some((k: any) => Array.isArray(k.options) && k.options.length > 0) && (
                    <View className="space-y-3">
                      <Text className="text-[10px] font-bold text-gray-400 uppercase ml-1">Opções dos Itens do Kit</Text>
                      {product.kitItems.map((kItem: any, kIdx: number) => {
                        if (!Array.isArray(kItem.options) || kItem.options.length === 0) return null;
                        const currentSelection = participant.kitSelections?.[kItem.name] || '';
                        return (
                          <View key={`kit-opt-${kIdx}`} className="bg-white dark:bg-[#141414] p-3 rounded-xl border border-gray-100 dark:border-white/5">
                            <View className="flex-row items-center justify-between mb-2">
                              <Text className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                {(kItem.quantity && kItem.quantity > 1) ? `${kItem.quantity}x ` : ''}{kItem.name} *
                              </Text>
                              {kItem.isGift && (
                                <View className="bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/30">
                                  <Text className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">BRINDE</Text>
                                </View>
                              )}
                            </View>
                            <View className="flex-row flex-wrap">
                              {kItem.options.map((opt: string) => {
                                const isSelected = currentSelection === opt;
                                return (
                                  <TouchableOpacity
                                    key={opt}
                                    onPress={() => updateParticipant(index, {
                                      kitSelections: {
                                        ...(participant.kitSelections || {}),
                                        [kItem.name]: opt
                                      }
                                    })}
                                    className={`mr-2 mb-2 px-3.5 py-2 rounded-xl border ${isSelected ? 'bg-[#014fa4] border-[#014fa4]' : 'bg-gray-50 dark:bg-[#1a1a1a] border-gray-200 dark:border-white/10'}`}
                                  >
                                    <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>{opt}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {!hideStudentExtraFields && product.askProfessor && (
                    <View>
                      <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Professor Responsável</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }} className="flex-row">
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
            });
          })()}

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
        <View className="flex-row items-center justify-between mb-6" style={{ gap: 12 }}>
          {product.hasSeatMap ? (
            <View className="flex-row items-center gap-2" style={{ flexShrink: 1, maxWidth: '42%', minWidth: 0 }}>
              <View className="w-10 h-10 rounded-2xl bg-yellow-500/10 items-center justify-center border border-yellow-500/20" style={{ flexShrink: 0 }}>
                <Armchair size={18} color="#eab308" />
              </View>
              <View style={{ flexShrink: 1, minWidth: 0 }}>
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Cadeiras ({allSelectedSeats.length})
                </Text>
                <Text className="text-xs font-black text-gray-900 dark:text-white" numberOfLines={1}>
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
                onPress={() => {
                  if (controlsStock && quantity >= totalAvailableStock) return;
                  setQuantity(q => q + 1);
                }}
                disabled={controlsStock && quantity >= totalAvailableStock}
                className={`w-10 h-10 items-center justify-center ${controlsStock && quantity >= totalAvailableStock ? 'opacity-30' : ''}`}
              >
                <Plus size={18} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
            </View>
          )}
          
          <View className="items-end" style={{ flex: 1, minWidth: 0 }}>
            <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1" style={{ textAlign: 'right' }} numberOfLines={2}>
              {product.hasSeatMap && (product.hasExtraTicketPrice || ((product.hasLocations && selectedLocation?.extraTicketPrice) ? selectedLocation.extraTicketPrice > 0 : product.extraTicketPrice > 0))
                ? (purchaseMode === 'extra_only'
                    ? (freeMultiSessionCount > 0
                        ? `${paidSeatsCount}x Cadeira Extra (${freeMultiSessionCount === 1 ? '+1 inclusa' : `+${freeMultiSessionCount} inclusas`})`
                        : `${allSelectedSeats.length}x Cadeira Extra`)
                    : (allSelectedSeats.length > 0
                        ? (freeMultiSessionCount > 0
                            ? `1x Inscrição + ${paidSeatsCount}x Cadeira (${freeMultiSessionCount === 1 ? '+1 inclusa' : `+${freeMultiSessionCount} inclusas`})`
                            : `1x Inscrição + ${allSelectedSeats.length}x Cadeira`)
                        : '1x Inscrição do Aluno'))
                : (product.hasSeatMap && freeMultiSessionCount > 0
                    ? `${paidSeatsCount}x Cadeira (${freeMultiSessionCount === 1 ? '+1 multi-sessão' : `+${freeMultiSessionCount} multi-sessão`})`
                    : 'Total')}
            </Text>
            <Text className="text-xl font-black text-gray-900 dark:text-white">
              {(calculateTotal() / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          onPress={handleAddToCart}
          disabled={lockingSeats || isProductUnavailable}
          className={`py-5 rounded-2xl items-center justify-center flex-row shadow-lg ${
            isProductUnavailable
              ? 'bg-gray-400 dark:bg-gray-700'
              : 'bg-[#014fa4] shadow-blue-500/20'
          }`}
          activeOpacity={0.8}
        >
          {lockingSeats ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : isProductUnavailable ? (
            <Text className="text-white font-black uppercase tracking-widest">
              Produto Esgotado
            </Text>
          ) : (
            <>
              <ShoppingCart size={20} color="#fff" strokeWidth={3} />
              <Text className="ml-3 text-white font-black uppercase tracking-widest">
                {product.hasSeatMap 
                  ? (purchaseMode === 'extra_only' 
                      ? 'Comprar Ingressos Extras' 
                      : (allSelectedSeats.length > 0 ? 'Garantir Inscrição & Cadeiras' : 'Garantir Inscrição & Comprar'))
                  : 'Adicionar ao Carrinho'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
