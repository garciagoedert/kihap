import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, RefreshControl, Dimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useColorScheme } from 'nativewind';
import { ShoppingBag, ShoppingCart, ArrowLeft, Plus, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useScrollToTop } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { BannerCarousel } from '../../src/components/BannerCarousel';
import { useAuth } from '../../src/context/AuthContext';
import { useCart } from '../../src/context/CartContext';
import { isTargetForUser, getUserUnitSlugs } from './index';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

export default function StoreScreen() {
  const { user, userData } = useAuth();
  const { itemCount } = useCart();
  const [products, setProducts] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  useScrollToTop(flatListRef);

  // Extrai e normaliza as categorias disponíveis dos produtos
  const categories = useMemo(() => {
    const catMap = new Map<string, { key: string; label: string; count: number }>();
    
    products.forEach((p: any) => {
      const raw = (p.category || p.categoria || '').trim();
      if (!raw) return;
      
      const lower = raw.toLowerCase();
      let normalizedKey = lower;
      if (normalizedKey === 'equipamento' || normalizedKey === 'equipamentos') {
        normalizedKey = 'equipamentos';
      } else if (normalizedKey === 'arma' || normalizedKey === 'armas') {
        normalizedKey = 'armas';
      } else if (normalizedKey === 'uniforme' || normalizedKey === 'uniformes') {
        normalizedKey = 'uniformes';
      } else if (normalizedKey === 'acessorio' || normalizedKey === 'acessorios' || normalizedKey === 'acessório' || normalizedKey === 'acessórios') {
        normalizedKey = 'acessórios';
      }

      if (!catMap.has(normalizedKey)) {
        let label = raw.charAt(0).toUpperCase() + raw.slice(1);
        if (normalizedKey === 'equipamentos') label = 'Equipamentos';
        if (normalizedKey === 'armas') label = 'Armas';
        if (normalizedKey === 'uniformes') label = 'Uniformes';
        if (normalizedKey === 'acessórios') label = 'Acessórios';

        catMap.set(normalizedKey, { key: normalizedKey, label, count: 0 });
      }

      catMap.get(normalizedKey)!.count += 1;
    });

    const list = Array.from(catMap.values());
    const orderPriority: { [key: string]: number } = {
      'equipamentos': 1,
      'armas': 2,
      'uniformes': 3,
      'acessórios': 4,
    };
    list.sort((a, b) => {
      const pA = orderPriority[a.key] || 99;
      const pB = orderPriority[b.key] || 99;
      if (pA !== pB) return pA - pB;
      return a.label.localeCompare(b.label);
    });
    return list;
  }, [products]);

  // Produtos filtrados pela categoria selecionada
  const filteredProducts = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'all') {
      return products;
    }
    return products.filter((p: any) => {
      const raw = (p.category || p.categoria || '').trim().toLowerCase();
      if (!raw) return false;
      let norm = raw;
      if (norm === 'equipamento' || norm === 'equipamentos') norm = 'equipamentos';
      else if (norm === 'arma' || norm === 'armas') norm = 'armas';
      else if (norm === 'uniforme' || norm === 'uniformes') norm = 'uniformes';
      else if (norm === 'acessorio' || norm === 'acessorios' || norm === 'acessório' || norm === 'acessórios') norm = 'acessórios';
      return norm === selectedCategory;
    });
  }, [products, selectedCategory]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'products'), 
        where('visible', '==', true)
      );
      const querySnapshot = await getDocs(q);
      const productsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Ordenar por ordem crescente (produtos com número menor aparecem primeiro)
      productsData.sort((a: any, b: any) => {
        const orderA = (typeof a.order === 'number' && !isNaN(a.order)) ? a.order : 99999;
        const orderB = (typeof b.order === 'number' && !isNaN(b.order)) ? b.order : 99999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || '').localeCompare(b.name || '');
      });

      setProducts(productsData);
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();

    // Subscribe to active store banners in real-time
    const bannersQ = query(collection(db, 'banners'), where('active', '==', true));
    const unsubscribeBanners = onSnapshot(bannersQ, (snap) => {
      const bannerBatchUnitsMap = new Map<string, Set<string>>();
      const rawBanners: any[] = [];
      snap.forEach(d => {
        const b: any = { id: d.id, ...d.data() };
        rawBanners.push(b);
        if (b.batchId && b.targetUnit) {
          if (!bannerBatchUnitsMap.has(b.batchId)) {
            bannerBatchUnitsMap.set(b.batchId, new Set<string>());
          }
          bannerBatchUnitsMap.get(b.batchId)!.add(b.targetUnit);
        }
      });

      const userUnitSlugs = getUserUnitSlugs(userData);
      const bList: any[] = [];
      const seenBannerBatches = new Set<string>();

      rawBanners.forEach(b => {
        if (b.batchId && bannerBatchUnitsMap.has(b.batchId)) {
          const batchUnits = Array.from(bannerBatchUnitsMap.get(b.batchId)!);
          if (!b.targetUnits || b.targetUnits.length === 0) {
            b.targetUnits = batchUnits;
          }
        }

        if (b.batchId) {
          if (seenBannerBatches.has(b.batchId)) return;
          seenBannerBatches.add(b.batchId);
        }

        const isTargeted = isTargetForUser(b, user?.uid || '', userUnitSlugs);
        const isPlacementOk = !b.placement || b.placement === 'store' || b.placement === 'all';
        if (isTargeted && isPlacementOk) {
          bList.push(b);
        }
      });
      // Sort client-side by createdAt descending
      bList.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (new Date(a.createdAt || 0)).getTime());
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (new Date(b.createdAt || 0)).getTime());
        return timeB - timeA;
      });
      setBanners(bList);
    }, (err) => console.log('Error listening to store banners:', err));

    return () => unsubscribeBanners();
  }, [userData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  const renderProduct = ({ item }: { item: any }) => {
    const isAvailable = item.available !== false;
    const price = (item.price / 100).toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    });

    return (
      <TouchableOpacity 
        onPress={() => isAvailable && router.push(`/store/${item.id}`)}
        activeOpacity={0.7}
        style={{ width: COLUMN_WIDTH }}
        className={`mb-4 bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-sm ${!isAvailable ? 'opacity-60' : ''}`}
      >
        <View className="relative">
          <Image 
            source={{ uri: item.imageUrl || 'https://via.placeholder.com/300x300.png?text=Sem+Imagem' }} 
            className="w-full aspect-square"
            resizeMode="cover"
          />
          {item.category && (
            <View className="absolute top-3 left-3">
              <View className="bg-yellow-500 px-2 py-0.5 rounded-lg shadow-lg">
                <Text className="text-black text-[8px] font-black uppercase tracking-widest">{item.category}</Text>
              </View>
            </View>
          )}
          {!isAvailable && (
            <View className="absolute inset-0 bg-black/40 items-center justify-center p-2 backdrop-blur-[2px]">
              <View className="bg-red-600 px-3 py-1 rounded shadow-2xl border-2 border-white/30 -rotate-6">
                <Text className="text-white text-[10px] font-black uppercase tracking-tighter">ESGOTADO</Text>
              </View>
            </View>
          )}
          {isAvailable && (
            <View className="absolute bottom-3 right-3">
              <View className="w-8 h-8 rounded-full bg-yellow-500 items-center justify-center shadow-lg">
                <Plus size={16} color="#000" strokeWidth={3} />
              </View>
            </View>
          )}
        </View>

        <View className="p-4">
          <Text 
            numberOfLines={2} 
            className="text-[13px] font-bold text-gray-900 dark:text-white mb-2 leading-tight h-8"
          >
            {item.name}
          </Text>
          <View className="flex-row items-center justify-between mt-auto">
            <Text className="text-sm font-black text-yellow-600 dark:text-yellow-500">
              {price}
            </Text>
            <View className="bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-lg border border-gray-200 dark:border-white/5">
              <Text className="text-[8px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Ver</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-gray-50 dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View 
        style={{ paddingTop: insets.top || 50 }}
        className="bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-xl border-b border-gray-100 dark:border-white/5 z-50"
      >
        <View className="flex-row items-center justify-between px-6 pb-4 pt-2">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
          >
            <Text 
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-2xl text-gray-900 dark:text-white uppercase tracking-tighter"
            >
              Loja
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => router.push('/cart')}
            activeOpacity={0.7}
            className="w-10 h-10 rounded-full bg-gray-50 dark:bg-white/5 items-center justify-center border border-gray-100 dark:border-white/5 relative active:scale-95"
            accessibilityLabel="Ver carrinho de compras"
          >
            <ShoppingCart size={19} color={isDark ? '#fff' : '#000'} />
            {itemCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-yellow-500 rounded-full min-w-[18px] h-[18px] items-center justify-center px-1 border-2 border-white dark:border-[#1a1a1a] shadow-sm">
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-black text-[9px] leading-none"
                >
                  {itemCount > 99 ? '99+' : itemCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#eab308" />
          <Text className="mt-4 text-gray-400 text-[10px] font-bold uppercase tracking-widest">Carregando Vitrine...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredProducts}
          renderItem={renderProduct}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          ListHeaderComponent={
            <View className="mb-4">
              {banners.length > 0 && (
                <View className="mb-3 -mx-4">
                  <BannerCarousel banners={banners} />
                </View>
              )}

              {/* Filtros Rápidos de Categorias */}
              {categories.length > 0 && (
                <View className="mt-1">
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16 }}
                    className="-mx-4"
                  >
                    {/* Botão 'Todos' */}
                    <TouchableOpacity
                      onPress={() => setSelectedCategory('all')}
                      activeOpacity={0.7}
                      className={`mr-2 px-3.5 py-2 rounded-2xl flex-row items-center border active:scale-95 ${
                        selectedCategory === 'all'
                          ? 'bg-yellow-500 border-yellow-500 shadow-sm shadow-yellow-500/30'
                          : isDark
                            ? 'bg-white/5 border-white/10'
                            : 'bg-white border-gray-200'
                      }`}
                    >
                      <Text
                        style={{ fontFamily: 'NeueMachina-Ultrabold', fontWeight: 'normal' }}
                        className={`text-[11px] uppercase tracking-wider ${
                          selectedCategory === 'all'
                            ? 'text-black'
                            : isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}
                      >
                        Todos
                      </Text>
                    </TouchableOpacity>

                    {/* Botões das Categorias Encontradas */}
                    {categories.map((cat) => {
                      const isSelected = selectedCategory === cat.key;
                      return (
                        <TouchableOpacity
                          key={cat.key}
                          onPress={() => setSelectedCategory(isSelected ? 'all' : cat.key)}
                          activeOpacity={0.7}
                          className={`mr-2 px-3.5 py-2 rounded-2xl flex-row items-center border active:scale-95 ${
                            isSelected
                              ? 'bg-yellow-500 border-yellow-500 shadow-sm shadow-yellow-500/30'
                              : isDark
                                ? 'bg-white/5 border-white/10'
                                : 'bg-white border-gray-200'
                          }`}
                        >
                          <Text
                            style={{ fontFamily: 'NeueMachina-Ultrabold', fontWeight: 'normal' }}
                            className={`text-[11px] uppercase tracking-wider ${
                              isSelected
                                ? 'text-black'
                                : isDark ? 'text-gray-300' : 'text-gray-700'
                            }`}
                          >
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          }
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor="#eab308"
              colors={["#eab308"]}
              progressViewOffset={insets.top + 60}
            />
          }
          ListEmptyComponent={
            <View className="py-20 items-center">
              <ShoppingBag size={48} color={isDark ? '#333' : '#ddd'} />
              <Text className="mt-4 text-gray-500 uppercase tracking-widest text-[10px] font-black text-center px-10">
                {selectedCategory !== 'all'
                  ? 'Nenhum produto encontrado nesta categoria.'
                  : 'Nenhum produto disponível no momento.'}
              </Text>
              {selectedCategory !== 'all' && (
                <TouchableOpacity
                  onPress={() => setSelectedCategory('all')}
                  className="mt-4 px-4 py-2.5 bg-yellow-500 rounded-xl active:scale-95"
                >
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold', fontWeight: 'normal' }}
                    className="text-black text-xs uppercase tracking-wider"
                  >
                    Ver Todos os Produtos
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}