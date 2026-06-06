import React, { useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useCart } from '../src/context/CartContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, Trash2, ShoppingBag, ChevronRight, CreditCard, Tag, X } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../src/services/firebase';

export default function CartScreen() {
  const { items, removeItem, subtotal, discount, total, clearCart, coupon, applyCoupon, removeCoupon } = useCart();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const [couponCode, setCouponCode] = useState('');
  const [loadingCoupon, setLoadingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setLoadingCoupon(true);
    setCouponError('');
    
    try {
      const trimmedCode = couponCode.trim();
      const qUpper = query(collection(db, 'coupons'), where('code', '==', trimmedCode.toUpperCase()));
      const qLower = query(collection(db, 'coupons'), where('code', '==', trimmedCode.toLowerCase()));
      const [snapUpper, snapLower] = await Promise.all([getDocs(qUpper), getDocs(qLower)]);
      
      const snap = !snapUpper.empty ? snapUpper : snapLower;
      
      if (snap.empty) {
        setCouponError('Cupom inválido ou não encontrado.');
        return;
      }
      
      const docData = snap.docs[0].data();
      
      if (docData.expiry) {
        const expiryDate = new Date(docData.expiry);
        // Considerando que a data expira às 23:59:59 do dia
        expiryDate.setHours(23, 59, 59, 999);
        if (expiryDate < new Date()) {
          setCouponError('Este cupom já expirou.');
          return;
        }
      }
      
      applyCoupon({
        id: snap.docs[0].id,
        code: docData.code,
        type: docData.type,
        value: docData.value
      });
      setCouponCode('');
    } catch (err) {
      console.error(err);
      setCouponError('Erro ao validar cupom. Tente novamente.');
    } finally {
      setLoadingCoupon(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View className="flex-row items-center mb-4 bg-white dark:bg-[#1a1a1a] p-4 rounded-3xl border border-gray-100 dark:border-white/5">
      <Image 
        source={{ uri: item.imageUrl || 'https://via.placeholder.com/100x100.png?text=Sem+Imagem' }} 
        className="w-20 h-20 rounded-2xl"
      />
      <View className="flex-1 ml-4">
        <Text className="text-sm font-black text-gray-900 dark:text-white" numberOfLines={2}>{item.name}</Text>
        <Text className="text-xs text-gray-400 mt-1 mb-1">Qtd: {item.quantity}</Text>
        {item.formDataList && item.formDataList.map((form: any, idx: number) => {
          const variantStr = form.priceData?.variantName ? ` (${form.priceData.variantName})` : '';
          return (
            <Text key={idx} className="text-[10px] text-gray-400 mt-0.5" numberOfLines={1}>
              • {form.userName || 'Participante'}{variantStr}
            </Text>
          );
        })}
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
            ListFooterComponent={
              <View className="mt-4">
                <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Cupom de Desconto</Text>
                
                {coupon ? (
                  <View className="flex-row items-center justify-between bg-green-500/10 border border-green-500/20 p-4 rounded-2xl">
                    <View className="flex-row items-center">
                      <Tag size={16} color="#22c55e" />
                      <Text className="text-green-600 dark:text-green-400 font-bold ml-2 uppercase">
                        {coupon.code} APLICADO
                      </Text>
                    </View>
                    <TouchableOpacity onPress={removeCoupon} className="p-1">
                      <X size={16} color="#22c55e" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="flex-row">
                    <TextInput
                      value={couponCode}
                      onChangeText={(text) => {
                        setCouponCode(text.toUpperCase());
                        setCouponError('');
                      }}
                      placeholder="CÓDIGO"
                      placeholderTextColor="#999"
                      autoCapitalize="characters"
                      className="flex-1 bg-white dark:bg-[#1a1a1a] px-4 py-3 rounded-2xl border border-gray-100 dark:border-white/5 text-gray-900 dark:text-white uppercase font-bold mr-2"
                    />
                    <TouchableOpacity 
                      onPress={handleApplyCoupon}
                      disabled={loadingCoupon || !couponCode.trim()}
                      className={`px-6 py-3 rounded-2xl justify-center items-center ${loadingCoupon || !couponCode.trim() ? 'bg-gray-200 dark:bg-gray-800' : 'bg-gray-900 dark:bg-white'}`}
                    >
                      {loadingCoupon ? (
                        <ActivityIndicator size="small" color={isDark ? '#000' : '#fff'} />
                      ) : (
                        <Text className={`font-bold uppercase tracking-widest text-xs ${isDark ? 'text-black' : 'text-white'}`}>Aplicar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
                {couponError ? <Text className="text-red-500 text-xs font-bold mt-2 ml-1">{couponError}</Text> : null}
              </View>
            }
          />

          {/* Footer Summary */}
          <View 
            style={{ paddingBottom: Math.max(insets.bottom, 24) }}
            className="px-6 pt-6 bg-white dark:bg-[#0a0a0a] border-t border-gray-100 dark:border-white/5 shadow-2xl"
          >
            <View className="flex-col mb-6">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-gray-400 font-bold uppercase tracking-[2px] text-[10px]">Subtotal</Text>
                <Text className="text-sm font-black text-gray-500">
                  {(subtotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Text>
              </View>
              {discount > 0 && (
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-green-500 font-bold uppercase tracking-[2px] text-[10px]">Desconto</Text>
                  <Text className="text-sm font-black text-green-500">
                    - {(discount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </Text>
                </View>
              )}
              <View className="h-[1px] bg-gray-100 dark:bg-white/5 my-2" />
              <View className="flex-row items-center justify-between">
                <Text className="text-gray-900 dark:text-white font-black uppercase tracking-[2px] text-xs">Total do Pedido</Text>
                <Text className="text-2xl font-black text-yellow-600 dark:text-yellow-500">
                  {(total / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Text>
              </View>
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
