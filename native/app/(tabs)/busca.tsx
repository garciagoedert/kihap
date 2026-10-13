import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Image, 
  ActivityIndicator, 
  RefreshControl,
  StyleSheet
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { 
  Search, 
  X, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  ArrowRight
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, getDocs, where, limit } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image as ExpoImage } from 'expo-image';

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

export default function BuscaScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Content data: Products and Events only
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);

  const fetchContent = async () => {
    try {
      setLoading(true);

      const [productsRes, eventsRes] = await Promise.allSettled([
        getDocs(query(collection(db, 'products'), where('visible', '==', true))),
        getDocs(query(collection(db, 'events'), limit(30)))
      ]);

      if (productsRes.status === 'fulfilled') {
        const pList = productsRes.value.docs.map(d => ({ id: d.id, ...d.data() }));
        pList.sort((a: any, b: any) => {
          const ordA = typeof a.order === 'number' ? a.order : 99999;
          const ordB = typeof b.order === 'number' ? b.order : 99999;
          return ordA - ordB;
        });
        setAllProducts(pList);
      }

      if (eventsRes.status === 'fulfilled') {
        const eList = eventsRes.value.docs.map(d => ({ id: d.id, ...d.data() }));
        eList.sort((a: any, b: any) => {
          const dateA = a.date || '';
          const dateB = b.date || '';
          return dateA.localeCompare(dateB);
        });
        setAllEvents(eList);
      }
    } catch (error) {
      console.error("Error loading discover content:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchContent();
  };

  const term = searchQuery.toLowerCase().trim();

  // Filtered products for search
  const filteredProducts = useMemo(() => {
    if (!term) return allProducts;
    return allProducts.filter(p => {
      const name = (p.name || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      return name.includes(term) || cat.includes(term) || desc.includes(term);
    });
  }, [allProducts, term]);

  // Filtered events for search
  const filteredEvents = useMemo(() => {
    if (!term) return allEvents;
    return allEvents.filter(e => {
      const title = (e.title || e.name || '').toLowerCase();
      const desc = (e.description || '').toLowerCase();
      const loc = (e.location || e.address || '').toLowerCase();
      return title.includes(term) || desc.includes(term) || loc.includes(term);
    });
  }, [allEvents, term]);

  // Unified search results
  const searchResults = useMemo(() => {
    if (!term) return [];
    const list: any[] = [];
    filteredProducts.forEach(p => list.push({ ...p, _type: 'product' }));
    filteredEvents.forEach(e => list.push({ ...e, _type: 'event' }));
    return list;
  }, [term, filteredProducts, filteredEvents]);

  // Render individual search result item
  const renderSearchResultItem = ({ item }: { item: any }) => {
    if (item._type === 'product') {
      const isAvailable = item.available !== false;
      const price = (item.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      return (
        <TouchableOpacity
          key={item.id}
          onPress={() => isAvailable && router.push({ pathname: '/store/[id]', params: { id: item.id } })}
          activeOpacity={0.8}
          className={`bg-white dark:bg-[#151517] rounded-2xl p-3.5 mb-3 border border-gray-100 dark:border-white/5 flex-row items-center justify-between shadow-sm ${!isAvailable ? 'opacity-60' : ''}`}
        >
          <View className="flex-row items-center flex-1 mr-3">
            <View className="relative">
              <Image
                source={{ uri: item.imageUrl || 'https://via.placeholder.com/200' }}
                className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-black"
                resizeMode="cover"
              />
              {!isAvailable && (
                <View className="absolute inset-0 bg-black/40 items-center justify-center rounded-xl">
                  <View className="bg-red-600 px-1.5 py-0.5 rounded shadow border border-white/30 -rotate-6">
                    <Text className="text-white text-[7px] font-black uppercase tracking-tighter">ESGOTADO</Text>
                  </View>
                </View>
              )}
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
                {item.category || 'Loja Kihap'}
              </Text>
              <Text className="font-bold text-[14px] text-gray-900 dark:text-white leading-snug" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="text-[13px] font-black text-gray-900 dark:text-white mt-1">
                {price}
              </Text>
            </View>
          </View>
          {isAvailable ? (
            <View className="bg-yellow-500 px-3.5 py-1.5 rounded-lg shadow-sm">
              <Text className="text-[11px] font-black text-black">Ver</Text>
            </View>
          ) : (
            <View className="bg-gray-100 dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/5">
              <Text className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase">Esgotado</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }

    if (item._type === 'event') {
      return (
        <TouchableOpacity
          key={item.id}
          onPress={() => router.push('/calendario')}
          activeOpacity={0.8}
          className="bg-white dark:bg-[#151517] rounded-2xl p-3.5 mb-3 border border-gray-100 dark:border-white/5 flex-row items-center justify-between shadow-sm"
        >
          <View className="flex-row items-center flex-1 mr-3">
            <View className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-white/5 items-center justify-center border border-gray-200 dark:border-white/5">
              <CalendarIcon size={22} color={isDark ? '#fff' : '#111'} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-500 mb-0.5">
                {item.date ? formatDateBR(item.date) : 'Evento Kihap'}
              </Text>
              <Text className="font-bold text-[14px] text-gray-900 dark:text-white leading-snug" numberOfLines={1}>
                {item.title || item.name}
              </Text>
              <Text className="text-[11px] text-gray-400 mt-0.5" numberOfLines={1}>
                {item.location || item.address || 'Kihap'}
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={isDark ? '#666' : '#bbb'} />
        </TouchableOpacity>
      );
    }

    return null;
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top }} className="flex-1 bg-[#f8f9fa] dark:bg-[#000000]">
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header with Title and Search */}
      <View className="px-5 pt-3 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <Text 
            style={{ fontFamily: 'NeueMachina-Ultrabold' }} 
            className="text-2xl text-gray-900 dark:text-white tracking-tight"
          >
            Descobrir
          </Text>
        </View>

        {/* Search Input Bar (iOS Native Style) */}
        <View className="flex-row items-center bg-gray-200/60 dark:bg-[#1c1c1e] px-3.5 py-2.5 rounded-xl border border-transparent">
          <Search size={16} color={isDark ? '#8e8e93' : '#8e8e93'} />
          <TextInput 
            placeholder="Buscar produtos ou eventos..." 
            placeholderTextColor="#8e8e93"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
            className="flex-1 ml-2.5 text-[14px] text-gray-900 dark:text-white p-0 font-medium"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} className="p-0.5">
              <X size={15} color="#8e8e93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results View */}
      {searchQuery.trim().length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => `${item._type}-${item.id}`}
          renderItem={renderSearchResultItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Text className="text-gray-400 dark:text-gray-500 text-sm font-medium">
                Nenhum resultado encontrado para "{searchQuery}"
              </Text>
            </View>
          }
        />
      ) : (
        /* Main Discover Feed */
        <ScrollView 
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110 }}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor="#eab308"
            />
          }
        >
          {/* 1. HERO EDITORIAL BANNER */}
          <View className="px-5 mt-1.5 mb-6">
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/store')}
              activeOpacity={0.9}
              className="h-52 rounded-3xl overflow-hidden shadow-lg border border-black/10 dark:border-white/10 relative justify-end bg-black"
            >
              <ExpoImage 
                source={{ uri: 'https://kihap.com.br/imgs/todosjuntos.jpeg' }}
                placeholder={require('../../assets/images/todosjuntos.png')}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.98)', 'rgba(0,0,0,0.88)', 'rgba(0,0,0,0.4)', 'transparent']}
                locations={[0, 0.45, 0.7, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFillObject}
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.2)', 'transparent', 'rgba(0,0,0,0.7)']}
                locations={[0, 0.4, 1]}
                style={StyleSheet.absoluteFillObject}
              />
              <View className="relative z-10 p-5">
                <View className="flex-row items-center mb-2">
                  <View className="bg-yellow-500 px-2.5 py-0.5 rounded-full">
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }} 
                      className="text-black text-[10px] uppercase tracking-wider"
                    >
                      Loja Oficial Kihap
                    </Text>
                  </View>
                </View>
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }} 
                  className="text-2xl text-white uppercase tracking-tight leading-tight"
                >
                  Equipamentos & Uniformes
                </Text>
                <Text className="text-gray-300 text-xs mt-1 font-medium leading-relaxed" numberOfLines={2}>
                  Doboks oficiais, armas e proteções certificadas.
                </Text>
                <View className="flex-row items-center mt-3">
                  <Text className="text-yellow-400 text-xs font-bold mr-1">
                    Conhecer a Loja
                  </Text>
                  <ArrowRight size={14} color="#facc15" />
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* 2. SECTION: LOJA OFICIAL */}
          {allProducts.length > 0 && (
            <View className="mb-7">
              <View className="flex-row items-center justify-between px-5 mb-3">
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }} 
                  className="text-sm text-gray-900 dark:text-white uppercase tracking-tight"
                >
                  Loja Oficial
                </Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/store')}>
                  <Text className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    Ir para loja
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Horizontal carousel of products */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20 }}
              >
                {allProducts.slice(0, 10).map((product) => {
                  const isAvailable = product.available !== false;
                  const price = (product.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  return (
                    <TouchableOpacity
                      key={product.id}
                      onPress={() => isAvailable && router.push({ pathname: '/store/[id]', params: { id: product.id } })}
                      activeOpacity={0.8}
                      style={{ width: 145 }}
                      className={`mr-3 bg-white dark:bg-[#151517] rounded-2xl overflow-hidden border border-gray-100 dark:border-white/5 shadow-sm ${!isAvailable ? 'opacity-60' : ''}`}
                    >
                      <View className="relative">
                        <Image 
                          source={{ uri: product.imageUrl || 'https://via.placeholder.com/200' }} 
                          className="w-full aspect-square bg-gray-50 dark:bg-black"
                          resizeMode="cover"
                        />
                        {product.category && (
                          <View className="absolute top-2 left-2">
                            <View className="bg-yellow-500 px-1.5 py-0.5 rounded-md shadow-lg">
                              <Text className="text-black text-[7px] font-black uppercase tracking-widest">{product.category}</Text>
                            </View>
                          </View>
                        )}
                        {!isAvailable && (
                          <View className="absolute inset-0 bg-black/40 items-center justify-center p-1 backdrop-blur-[2px]">
                            <View className="bg-red-600 px-2.5 py-0.5 rounded shadow-2xl border-2 border-white/30 -rotate-6">
                              <Text className="text-white text-[8px] font-black uppercase tracking-tighter">ESGOTADO</Text>
                            </View>
                          </View>
                        )}
                      </View>
                      <View className="p-3">
                        <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-wider" numberOfLines={1}>
                          {product.category || 'Oficial'}
                        </Text>
                        <Text className="font-bold text-[12px] text-gray-900 dark:text-white leading-tight mt-0.5 h-7" numberOfLines={2}>
                          {product.name}
                        </Text>
                        <Text className="text-xs font-black text-gray-900 dark:text-white mt-1.5">
                          {price}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* 3. SECTION: PRÓXIMOS EVENTOS & CALENDÁRIO */}
          {allEvents.length > 0 && (
            <View className="px-5 mb-7">
              <View className="flex-row items-center justify-between mb-3">
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }} 
                  className="text-sm text-gray-900 dark:text-white uppercase tracking-tight"
                >
                  Próximos Eventos & Exames
                </Text>
                <TouchableOpacity onPress={() => router.push('/calendario')}>
                  <Text className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    Ver calendário
                  </Text>
                </TouchableOpacity>
              </View>

              {allEvents.slice(0, 5).map((event) => (
                <TouchableOpacity
                  key={event.id}
                  onPress={() => router.push('/calendario')}
                  activeOpacity={0.8}
                  className="bg-white dark:bg-[#151517] p-3.5 rounded-2xl border border-gray-100 dark:border-white/5 mb-2.5 flex-row items-center justify-between shadow-sm"
                >
                  <View className="flex-row items-center flex-1 mr-3">
                    <View className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/5 items-center justify-center border border-gray-200/80 dark:border-white/5 mr-3">
                      <CalendarIcon size={20} color={isDark ? '#fff' : '#000'} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-sm text-gray-900 dark:text-white leading-tight" numberOfLines={1}>
                        {event.title || event.name}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        {event.date && (
                          <Text className="text-[11px] text-yellow-600 dark:text-yellow-500 font-bold mr-2">{formatDateBR(event.date)}</Text>
                        )}
                        {event.location && (
                          <Text className="text-[11px] text-gray-400 truncate flex-1" numberOfLines={1}>
                            • {event.location}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                  <ChevronRight size={16} color={isDark ? '#666' : '#bbb'} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 4. Quick info card about calendar */}
          <View className="px-5 mb-6">
            <TouchableOpacity
              onPress={() => router.push('/calendario')}
              activeOpacity={0.8}
              className="bg-yellow-500/10 dark:bg-yellow-500/5 border border-yellow-500/20 p-4 rounded-2xl flex-row items-center justify-between"
            >
              <View className="flex-1 mr-3">
                <Text className="font-bold text-sm text-gray-900 dark:text-white">
                  Fique por dentro das datas
                </Text>
                <Text className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  Consulte exames de graduação, seminários e eventos do ano.
                </Text>
              </View>
              <View className="bg-yellow-500 px-3 py-1.5 rounded-lg">
                <Text className="text-xs font-black text-black">Acessar</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}