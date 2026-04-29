import React from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useCart } from '../src/context/CartContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, Trash2, ShoppingBag, ChevronRight, CreditCard } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

export default function CartScreen() {
  const { items, removeItem, total, clearCart } = useCart();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const renderItem = ({ item }: { item: any }) => (
    <View className="flex-row items-center mb-4 bg-white dark:bg-[#1a1a1a] p-4 rounded-3xl border border-gray-100 dark:border-white/5">
      <Image 
        source={{ uri: item.imageUrl || 'https://via.placeholder.com/100x100.png?text=Sem+Imagem' }} 
        className="w-20 h-20 rounded-2xl"
      />
      <View className="flex-1 ml-4">
        <Text className="text-sm font-black text-gray-900 dark:text-white" numberOfLines={2}>{item.name}</Text>
        <Text className="text-xs text-gray-400 mt-1">Qtd: {item.quantity}</Text>
        <Text className="text-sm font-black text-yellow-600 dark:text-yellow-500 mt-2">
          {(item.totalAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </Text>
      </View>
      <TouchableOpacity 
        onPress={() => removeItem(item.cartId)}
        className="w-10 h-10 items-center justify-center bg-red-500/10 rounded-full"
      >
        <Trash2 size={18} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50 dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View 
        style={{ paddingTop: insets.top || 50 }}
        className="bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-white/5"
      >
        <View className="flex-row items-center justify-between px-6 pb-4 pt-2">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <ArrowLeft size={24} color={isDark ? '#fff' : '#333'} />
            </TouchableOpacity>
            <Text className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Carrinho</Text>
          </View>
          {items.length > 0 && (
            <TouchableOpacity onPress={clearCart}>
              <Text className="text-xs font-black text-red-500 uppercase tracking-widest">Limpar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center p-10">
          <View className="w-24 h-24 rounded-full bg-gray-100 dark:bg-white/5 items-center justify-center mb-6">
            <ShoppingBag size={40} color={isDark ? '#333' : '#ddd'} />
          </View>
          <Text className="text-lg font-black text-gray-900 dark:text-white text-center">Seu carrinho está vazio</Text>
          <Text className="text-sm text-gray-400 text-center mt-2 mb-8">Parece que você ainda não adicionou nenhum item.</Text>
          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/store')}
            className="bg-[#014fa4] px-8 py-4 rounded-2xl shadow-lg"
          >
            <Text className="text-white font-black uppercase tracking-widest text-xs">Voltar para Loja</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={item => item.cartId}
            contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          />

          {/* Footer Summary */}
          <View 
            style={{ paddingBottom: Math.max(insets.bottom, 24) }}
            className="px-6 pt-6 bg-white dark:bg-[#0a0a0a] border-t border-gray-100 dark:border-white/5 shadow-2xl"
          >
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-gray-400 font-bold uppercase tracking-[2px] text-[10px]">Total do Pedido</Text>
              <Text className="text-2xl font-black text-gray-900 dark:text-white">
                {(total / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            </View>

            <TouchableOpacity 
              onPress={() => router.push('/checkout')}
              className="bg-yellow-500 py-5 rounded-2xl items-center justify-center flex-row shadow-lg shadow-yellow-500/20"
              activeOpacity={0.8}
            >
              <CreditCard size={20} color="#000" strokeWidth={3} />
              <Text className="ml-3 text-black font-black uppercase tracking-widest">Finalizar Compra</Text>
              <ChevronRight size={20} color="#000" strokeWidth={3} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}
