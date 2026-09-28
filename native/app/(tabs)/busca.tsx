import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Image, 
  ImageBackground,
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
  ArrowRight,
  ShoppingBag,
  MapPin,
  Tag
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, getDocs, where, limit } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

type FilterType = 'all' | 'products' | 'events';

export default function BuscaScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Content data: Products and Events only (no courses, no people)
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [activeFilter]);

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

  // Distinct product categories
  const productCategories = useMemo(() => {
    const set = new Set<string>();
    allProducts.forEach(p => {
      if (p.category && typeof p.category === 'string') {
        set.add(p.category.trim());
      }
    });
    return Array.from(set);
  }, [allProducts]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let list = allProducts;

    if (activeFilter === 'products' && selectedProductCategory !== 'all') {
      list = list.filter(p => (p.category || '').toLowerCase() === selectedProductCategory.toLowerCase());
    }

    if (!term) return list;

    return list.filter(p => {
      const name = (p.name || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      return name.includes(term) || cat.includes(term) || desc.includes(term);
    });
  }, [allProducts, term, activeFilter, selectedProductCategory]);

  // Filtered events
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

    if (activeFilter === 'all' || activeFilter === 'products') {
      filteredProducts.forEach(p => list.push({ ...p, _type: 'product' }));
    }
    if (activeFilter === 'all' || activeFilter === 'events') {
      filteredEvents.forEach(e => list.push({ ...e, _type: 'event' }));
    }

    return list;
  }, [term, activeFilter, filteredProducts, filteredEvents]);

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'Tudo' },
    { id: 'products', label: 'Loja Oficial' },
    { id: 'events', label: 'Eventos & Exames' },
  ];

  // Render individual search result item
  const renderSearchResultItem = ({ item }: { item: any }) => {
    if (item._type === 'product') {
      const isAvailable = item.available !== false;
      const price = (item.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      return (
        <TouchableOpacity
          key={item.id}
          onPress={() => isAvailable && router.push(`/store/${item.id}`)}
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
                {item.date ? String(item.date) : 'Evento Kihap'}
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
      <View className="px-5 pt-3 pb-2">
        <View className="flex-row items-center justify-between mb-3">
          <Text 
            style={{ fontFamily: 'NeueMachina-Ultrabold' }} 
            className="text-2xl font-black text-gray-900 dark:text-white tracking-tight"
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

        {/* Minimalist Segmented Filters */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="mt-3.5 -mx-5 px-5"
        >
          {filters.map((filter) => {
            const isSelected = activeFilter === filter.id;
            return (
              <TouchableOpacity 
                key={filter.id}
                onPress={() => {
                  setActiveFilter(filter.id);
                  setSelectedProductCategory('all');
                }}
                activeOpacity={0.7}
                style={{ marginRight: 8 }}
                className={`px-4 py-2 rounded-full transition-all ${
                  isSelected 
                    ? 'bg-gray-900 dark:bg-white shadow-sm' 
                    : 'bg-white dark:bg-[#161618] border border-gray-200/70 dark:border-white/10'
                }`}
              >
                <Text className={`text-[12px] font-semibold tracking-tight ${
                  isSelected 
                    ? 'text-white dark:text-black font-bold' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sub-category pills when in 'products' tab */}
        {activeFilter === 'products' && productCategories.length > 0 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            className="mt-2.5 -mx-5 px-5"
          >
            <TouchableOpacity
              onPress={() => setSelectedProductCategory('all')}
              style={{ marginRight: 6 }}
              className={`px-3 py-1 rounded-lg ${
                selectedProductCategory === 'all'
                  ? 'bg-yellow-500'
                  : 'bg-gray-200/70 dark:bg-white/5'
              }`}
            >
              <Text className={`text-[10px] font-bold uppercase ${
                selectedProductCategory === 'all' ? 'text-black' : 'text-gray-600 dark:text-gray-400'
              }`}>
                Todos
              </Text>
            </TouchableOpacity>
            {productCategories.map(cat => {
              const isSelected = selectedProductCategory.toLowerCase() === cat.toLowerCase();
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedProductCategory(cat)}
                  style={{ marginRight: 6 }}
                  className={`px-3 py-1 rounded-lg ${
                    isSelected
                      ? 'bg-yellow-500'
                      : 'bg-gray-200/70 dark:bg-white/5'
                  }`}
                >
                  <Text className={`text-[10px] font-bold uppercase ${
                    isSelected ? 'text-black' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Main Content Area */}
      {loading && !refreshing ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#eab308" size="small" />
        </View>
      ) : term.length > 0 ? (
        /* SEARCH RESULTS MODE */
        <FlatList
          data={searchResults}
          keyExtractor={(item, idx) => `${item._type}_${item.id || idx}`}
          renderItem={renderSearchResultItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 }}
          ListHeaderComponent={
            <View className="mb-3">
              <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                {searchResults.length} {searchResults.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-8">
              <Text className="text-gray-900 dark:text-white font-bold text-base text-center mb-1">
                Nenhum resultado para "{searchQuery}"
              </Text>
              <Text className="text-gray-500 text-xs text-center leading-relaxed">
                Tente buscar por termos como "faixa", "dobok", "luva" ou nomes de eventos e seminários.
              </Text>
            </View>
          }
        />
      ) : (
        /* DISCOVERY CONTENT VIEW (BY FILTER) */
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
          {/* ======================================================= */}
          {/* 1. HERO EDITORIAL BANNER: Loja Oficial & Equipamentos   */}
          {/* ======================================================= */}
          {activeFilter === 'all' && (
            <View className="px-5 mt-2.5 mb-6">
              <TouchableOpacity 
                onPress={() => router.push('/(tabs)/store')}
                activeOpacity={0.9}
                className="rounded-3xl overflow-hidden shadow-lg border border-black/10 dark:border-white/10"
              >
                <ImageBackground 
                  source={require('../../assets/images/todosjuntos.jpg')}
                  className="h-52 justify-end p-5"
                  resizeMode="cover"
                >
                  <LinearGradient
                    colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.85)']}
                    style={StyleSheet.absoluteFillObject}
                  />
                  
                  <View className="relative z-10">
                    <View className="flex-row items-center mb-2">
                      <View className="bg-yellow-500 px-2.5 py-0.5 rounded-full">
                        <Text 
                          style={{ fontFamily: 'NeueMachina-Ultrabold' }} 
                          className="text-black text-[10px] font-black uppercase tracking-wider"
                        >
                          Loja Oficial Kihap
                        </Text>
                      </View>
                    </View>
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }} 
                      className="text-2xl font-black text-white uppercase tracking-tight leading-tight"
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
                </ImageBackground>
              </TouchableOpacity>
            </View>
          )}

          {/* ======================================================= */}
          {/* 2. SECTION: LOJA OFICIAL                               */}
          {/* ======================================================= */}
          {(activeFilter === 'all' || activeFilter === 'products') && allProducts.length > 0 && (
            <View className="mb-7">
              <View className="flex-row items-center justify-between px-5 mb-3">
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }} 
                  className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight"
                >
                  Loja Oficial
                </Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/store')}>
                  <Text className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    Ir para loja
                  </Text>
                </TouchableOpacity>
              </View>

              {activeFilter === 'products' ? (
                /* Grid display when Products tab is selected */
                <View className="px-5 flex-row flex-wrap justify-between">
                  {filteredProducts.map((product) => {
                    const isAvailable = product.available !== false;
                    const price = (product.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    return (
                      <TouchableOpacity
                        key={product.id}
                        onPress={() => isAvailable && router.push(`/store/${product.id}`)}
                        activeOpacity={0.8}
                        style={{ width: '48%' }}
                        className={`mb-4 bg-white dark:bg-[#151517] rounded-2xl overflow-hidden border border-gray-100 dark:border-white/5 shadow-sm ${!isAvailable ? 'opacity-60' : ''}`}
                      >
                        <View className="relative">
                          <Image 
                            source={{ uri: product.imageUrl || 'https://via.placeholder.com/200' }} 
                            className="w-full aspect-square bg-gray-50 dark:bg-black"
                            resizeMode="cover"
                          />
                          {product.category && (
                            <View className="absolute top-2.5 left-2.5">
                              <View className="bg-yellow-500 px-2 py-0.5 rounded-lg shadow-lg">
                                <Text className="text-black text-[8px] font-black uppercase tracking-widest">{product.category}</Text>
                              </View>
                            </View>
                          )}
                          {!isAvailable && (
                            <View className="absolute inset-0 bg-black/40 items-center justify-center p-2 backdrop-blur-[2px]">
                              <View className="bg-red-600 px-2.5 py-0.5 rounded shadow-2xl border-2 border-white/30 -rotate-6">
                                <Text className="text-white text-[9px] font-black uppercase tracking-tighter">ESGOTADO</Text>
                              </View>
                            </View>
                          )}
                        </View>
                        <View className="p-3">
                          <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-wider" numberOfLines={1}>
                            {product.category || 'Oficial'}
                          </Text>
                          <Text className="font-bold text-[13px] text-gray-900 dark:text-white leading-tight mt-0.5 h-8" numberOfLines={2}>
                            {product.name}
                          </Text>
                          <Text className="text-xs font-black text-gray-900 dark:text-white mt-1.5">
                            {price}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                /* Horizontal carousel when in 'all' view */
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
                        onPress={() => isAvailable && router.push(`/store/${product.id}`)}
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
              )}
            </View>
          )}

          {/* ======================================================= */}
          {/* 3. SECTION: PRÓXIMOS EVENTOS & CALENDÁRIO               */}
          {/* ======================================================= */}
          {(activeFilter === 'all' || activeFilter === 'events') && allEvents.length > 0 && (
            <View className="px-5 mb-7">
              <View className="flex-row items-center justify-between mb-3">
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }} 
                  className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight"
                >
                  Próximos Eventos & Exames
                </Text>
                <TouchableOpacity onPress={() => router.push('/calendario')}>
                  <Text className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    Ver calendário
                  </Text>
                </TouchableOpacity>
              </View>

              {allEvents.slice(0, activeFilter === 'events' ? 20 : 4).map((event) => (
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
                          <Text className="text-[11px] text-yellow-600 dark:text-yellow-500 font-bold mr-2">{event.date}</Text>
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

          {/* Quick info card about calendar */}
          {activeFilter === 'all' && (
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
          )}
        </ScrollView>
      )}
    </View>
  );
}