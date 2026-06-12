import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, Calendar as CalendarIcon, MapPin, Clock, CheckCircle2, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../src/services/firebase';
import { useAuth } from '../src/context/AuthContext';

export default function CalendarioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { user, userData } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [purchasedProductIds, setPurchasedProductIds] = useState<Set<string>>(new Set());
  const [checkedInEventIds, setCheckedInEventIds] = useState<Set<string>>(new Set());
  
  const [loading, setLoading] = useState(true);
  const [checkinLoadingId, setCheckinLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'proximos' | 'passados'>('proximos');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const [imageHeights, setImageHeights] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // 1. Fetch Events
        const eventsCol = collection(db, 'events');
        const eventsQuery = query(eventsCol, orderBy('date', 'asc'));
        const eventsSnap = await getDocs(eventsQuery);
        const eventsList = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 2. Fetch User's Purchases to check registrations
        const purchasesQuery = query(
          collection(db, 'inscricoesFaixaPreta'),
          where('userId', '==', user.uid),
          where('paymentStatus', '==', 'paid')
        );
        const purchasesSnap = await getDocs(purchasesQuery);
        const purchasedIds = new Set<string>();
        purchasesSnap.forEach(doc => {
          const p = doc.data();
          if (p.productId) purchasedIds.add(p.productId);
        });
        setPurchasedProductIds(purchasedIds);

        // 3. Fetch User's Check-ins for these events
        const checkedInIds = new Set<string>();
        const checkinPromises = eventsList.map(async (event) => {
          const checkinDocRef = doc(db, 'events', event.id, 'checkins', user.uid);
          const checkinSnap = await getDoc(checkinDocRef);
          if (checkinSnap.exists()) {
            checkedInIds.add(event.id);
          }
        });
        await Promise.all(checkinPromises);
        setCheckedInEventIds(checkedInIds);

        setEvents(eventsList);

      } catch (error) {
        console.error("Error loading events calendar:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleCheckin = async (eventId: string) => {
    if (!user) return;
    setCheckinLoadingId(eventId);
    try {
      const studentName = userData?.name || userData?.nome || 'Aluno Kihap';
      const checkinDocRef = doc(db, 'events', eventId, 'checkins', user.uid);
      
      await setDoc(checkinDocRef, {
        userId: user.uid,
        userName: studentName,
        checkedInAt: serverTimestamp()
      });

      setCheckedInEventIds(prev => {
        const updated = new Set(prev);
        updated.add(eventId);
        return updated;
      });

      Alert.alert(
        "Check-in Realizado!",
        "Sua presença foi confirmada com sucesso neste evento.",
        [{ text: "OK" }]
      );

    } catch (error: any) {
      console.error("Error checking in:", error);
      Alert.alert("Erro no Check-in", "Ocorreu um erro ao registrar sua presença. Tente novamente.");
    } finally {
      setCheckinLoadingId(null);
    }
  };

  const handleImageLoad = (eventId: string, width: number, height: number) => {
    // Dynamically calculate height to keep aspect ratio based on screen container width
    const containerWidth = 340; // Approx card width
    const calculatedHeight = (height / width) * containerWidth;
    setImageHeights(prev => ({ ...prev, [eventId]: calculatedHeight }));
  };

  // Filter events based on activeTab
  const todayStr = new Date().toISOString().split('T')[0];
  const filteredEvents = events.filter(event => {
    const eventDate = event.date || '';
    if (activeTab === 'proximos') {
      return eventDate >= todayStr;
    } else {
      return eventDate < todayStr;
    }
  });

  // Sort: upcoming events ASC (closest first), past events DESC (most recent first)
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    return activeTab === 'proximos' 
      ? dateA.localeCompare(dateB) 
      : dateB.localeCompare(dateA);
  });

  const renderEventCard = (event: any) => {
    const isExpanded = expandedEventId === event.id;
    const isPurchased = event.productId ? purchasedProductIds.has(event.productId) : true;
    const isCheckedIn = checkedInEventIds.has(event.id);
    
    // Format date DD/MM
    let dayNum = '--';
    let monthName = '---';
    if (event.date) {
      const [y, m, d] = event.date.split('-');
      dayNum = d;
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      monthName = months[parseInt(m, 10) - 1] || '---';
    }

    const calculatedHeight = imageHeights[event.id] || 180;

    return (
      <View 
        key={event.id}
        className="bg-white dark:bg-[#1a1a1a] rounded-[28px] border border-gray-100 dark:border-white/5 shadow-sm mb-5 overflow-hidden"
      >
        {/* Cover Image */}
        <View className="relative bg-gray-100 dark:bg-black/20">
          <Image 
            source={{ uri: event.coverUrl || 'https://via.placeholder.com/600x300.png?text=Sem+Imagem' }} 
            className="w-full"
            style={{ height: Math.min(calculatedHeight, 260) }}
            resizeMode="cover"
            onLoad={(e) => {
              const { width, height } = e.nativeEvent.source;
              handleImageLoad(event.id, width, height);
            }}
          />
          {/* Floating Date Badge */}
          <View className="absolute top-4 left-4 bg-yellow-500 rounded-2xl p-2 px-3 items-center justify-center shadow-md">
            <Text className="text-[10px] font-black text-black uppercase tracking-wider">{monthName}</Text>
            <Text className="text-lg font-black text-black leading-none mt-0.5">{dayNum}</Text>
          </View>
        </View>

        {/* Card Body */}
        <View className="p-6">
          <Text className="text-xl font-black text-gray-900 dark:text-white leading-tight mb-3">
            {event.title}
          </Text>

          {/* Details list */}
          <View className="space-y-2 mb-4">
            <View className="flex-row items-center">
              <Clock size={14} color="#eab308" />
              <Text className="text-[12px] text-gray-500 dark:text-gray-400 font-semibold ml-2">{event.time}</Text>
            </View>
            <View className="flex-row items-center">
              <MapPin size={14} color="#eab308" />
              <Text className="text-[12px] text-gray-500 dark:text-gray-400 font-semibold ml-2" numberOfLines={1}>{event.location}</Text>
            </View>
          </View>

          {/* Expandable description */}
          <TouchableOpacity 
            onPress={() => setExpandedEventId(isExpanded ? null : event.id)}
            className="flex-row justify-between items-center py-2 mb-2 border-t border-gray-50 dark:border-white/5"
            activeOpacity={0.7}
          >
            <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Sobre o evento
            </Text>
            {isExpanded ? <ChevronUp size={16} color="#999" /> : <ChevronDown size={16} color="#999" />}
          </TouchableOpacity>
          
          {isExpanded && (
            <Text className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed mb-4 pb-2">
              {event.description}
            </Text>
          )}

          {/* Dynamic CTA Button */}
          <View className="mt-2">
            {!isPurchased ? (
              // Option 1: Not purchased the linked product yet
              <TouchableOpacity 
                onPress={() => router.push(`/store/${event.productId}`)}
                className="bg-[#014fa4] py-4 rounded-2xl items-center justify-center flex-row shadow-md shadow-blue-500/10"
                activeOpacity={0.8}
              >
                <ShoppingBag size={16} color="#fff" />
                <Text className="ml-2 text-white font-black text-[11px] uppercase tracking-widest">Inscrever-se</Text>
              </TouchableOpacity>
            ) : isCheckedIn ? (
              // Option 2: Successfully checked in
              <View className="bg-emerald-500/10 border border-emerald-500/20 py-4 rounded-2xl flex-row items-center justify-center">
                <CheckCircle2 size={16} color="#10b981" />
                <Text className="ml-2 text-emerald-600 dark:text-emerald-400 font-black text-[11px] uppercase tracking-widest">Check-in Realizado</Text>
              </View>
            ) : (
              // Option 3: Purchased/Linked and needs to check in
              <TouchableOpacity 
                onPress={() => handleCheckin(event.id)}
                disabled={checkinLoadingId === event.id}
                className="bg-yellow-500 py-4 rounded-2xl items-center justify-center flex-row shadow-md shadow-yellow-500/10 active:scale-95"
                activeOpacity={0.8}
              >
                {checkinLoadingId === event.id ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <CheckCircle2 size={16} color="#000" />
                    <Text className="ml-2 text-black font-black text-[11px] uppercase tracking-widest">Confirmar Presença (Check-in)</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#eab308" />
        </View>
      );
    }

    if (sortedEvents.length === 0) {
      return (
        <View className="flex-1 items-center justify-center px-10 py-20">
          <CalendarIcon size={48} color={isDark ? '#333' : '#ddd'} className="mb-4" />
          <Text className="text-gray-400 text-center font-bold text-[14px]">
            Nenhum evento encontrado nesta categoria.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView 
        className="flex-1 px-6" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {sortedEvents.map(renderEventCard)}
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top }} className="flex-1 bg-gray-50 dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="px-6 pt-8 pb-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2 -ml-2">
            <ArrowLeft size={24} color={isDark ? '#fff' : '#333'} />
          </TouchableOpacity>
          <Text className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
            Calendário
          </Text>
        </View>
      </View>

      {/* Sub-tab Selector */}
      <View className="flex-row bg-gray-100 dark:bg-[#1a1a1a] p-1.5 rounded-2xl mx-6 mb-6">
        <TouchableOpacity
          onPress={() => setActiveTab('proximos')}
          style={activeTab === 'proximos' ? {
            backgroundColor: isDark ? '#2b2b2b' : '#fff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 1.5,
            elevation: 2,
          } : null}
          className="flex-1 py-3 rounded-xl items-center justify-center"
        >
          <Text 
            style={{ color: activeTab === 'proximos' ? (isDark ? '#fff' : '#111') : '#999' }}
            className="text-[11px] font-black uppercase tracking-wider text-center"
          >
            Próximos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('passados')}
          style={activeTab === 'passados' ? {
            backgroundColor: isDark ? '#2b2b2b' : '#fff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 1.5,
            elevation: 2,
          } : null}
          className="flex-1 py-3 rounded-xl items-center justify-center"
        >
          <Text 
            style={{ color: activeTab === 'passados' ? (isDark ? '#fff' : '#111') : '#999' }}
            className="text-[11px] font-black uppercase tracking-wider text-center"
          >
            Passados
          </Text>
        </TouchableOpacity>
      </View>

      {/* Page Content */}
      {renderContent()}
    </View>
  );
}
