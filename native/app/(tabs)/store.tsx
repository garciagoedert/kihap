import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useColorScheme } from 'nativewind';
import { ShoppingBag, Filter, ArrowLeft, Plus, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

export default function StoreScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'products'), 
        where('visible', '==', true), 
        orderBy('name')
      );
      const querySnapshot = await getDocs(q);
      const productsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
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
  }, []);

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
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <ArrowLeft size={24} color={isDark ? '#fff' : '#333'} />
            </TouchableOpacity>
            <Text className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Loja</Text>
          </View>
          <TouchableOpacity className="w-10 h-10 rounded-full bg-gray-50 dark:bg-white/5 items-center justify-center border border-gray-100 dark:border-white/5">
            <Filter size={18} color={isDark ? '#999' : '#666'} />
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
          data={products}
          renderItem={renderProduct}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
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
                Nenhum produto disponível no momento.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}