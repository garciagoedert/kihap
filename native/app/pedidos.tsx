import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, Calendar, User as UserIcon, MapPin, CheckCircle2, Clock, XCircle, AlertCircle, ShoppingBag } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../src/services/firebase';
import { useAuth } from '../src/context/AuthContext';

export default function PedidosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, "inscricoesFaixaPreta"),
          where("userId", "==", user.uid)
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort descending by created timestamp
        docs.sort((a: any, b: any) => {
          if (!a.created || !b.created) return 0;
          const aTime = a.created.toMillis ? a.created.toMillis() : new Date(a.created).getTime();
          const bTime = b.created.toMillis ? b.created.toMillis() : new Date(b.created).getTime();
          return bTime - aTime;
        });

        setOrders(docs);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchOrders();
    }
  }, [user, authLoading]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <View className="flex-row items-center bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full">
            <CheckCircle2 size={12} color="#22c55e" />
            <Text className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase ml-1">Aprovado</Text>
          </View>
        );
      case 'pending':
        return (
          <View className="flex-row items-center bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full">
            <Clock size={12} color="#eab308" />
            <Text className="text-[10px] font-black text-yellow-600 dark:text-yellow-500 uppercase ml-1">Pendente</Text>
          </View>
        );
      case 'canceled':
      case 'failed':
        return (
          <View className="flex-row items-center bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
            <XCircle size={12} color="#ef4444" />
            <Text className="text-[10px] font-black text-red-500 dark:text-red-400 uppercase ml-1">Cancelado</Text>
          </View>
        );
      default:
        return (
          <View className="flex-row items-center bg-gray-500/10 border border-gray-500/20 px-3 py-1 rounded-full">
            <AlertCircle size={12} color="#999" />
            <Text className="text-[10px] font-black text-gray-500 uppercase ml-1">{status || 'Desconhecido'}</Text>
          </View>
        );
    }
  };

  const getProductTitle = (item: any) => {
    const variantName = item.priceData?.variantName;
    const size = item.userSize;
    let extra = '';
    if (variantName || size) {
      const parts = [];
      if (variantName) parts.push(variantName);
      if (size) parts.push(`Tam: ${size}`);
      extra = ` (${parts.join(' - ')})`;
    }
    return `${item.productName || 'Produto Kihap'}${extra}`;
  };

  const renderOrder = ({ item }: { item: any }) => {
    const formattedPrice = (item.amountTotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const orderDate = item.created?.toDate ? item.created.toDate().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : '';

    return (
      <View className="bg-white dark:bg-[#1a1a1a] p-5 rounded-3xl mb-4 border border-gray-100 dark:border-white/5 shadow-sm">
        {/* Order Header: ID and Date */}
        <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-gray-50 dark:border-white/5">
          <View>
            <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
              ID: #{item.id ? item.id.substring(item.id.length - 8).toUpperCase() : '------'}
            </Text>
            <View className="flex-row items-center">
              <Calendar size={10} color="#999" />
              <Text className="text-[10px] text-gray-400 ml-1">{orderDate}</Text>
            </View>
          </View>
          {getStatusBadge(item.paymentStatus)}
        </View>

        {/* Product Details */}
        <Text className="text-base font-black text-gray-900 dark:text-white mb-3">
          {getProductTitle(item)}
        </Text>

        {/* Participant & Unit Details */}
        <View className="bg-gray-50 dark:bg-black/20 p-3 rounded-2xl mb-4 flex-row justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-[8px] font-bold text-gray-400 uppercase mb-0.5">Aluno(a)</Text>
            <View className="flex-row items-center">
              <UserIcon size={10} color="#666" />
              <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1" numberOfLines={1}>
                {item.userName || 'N/A'}
              </Text>
            </View>
          </View>
          
          <View className="flex-grow">
            <Text className="text-[8px] font-bold text-gray-400 uppercase mb-0.5">Unidade</Text>
            <View className="flex-row items-center">
              <MapPin size={10} color="#666" />
              <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1" numberOfLines={1}>
                {item.userUnit || 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Total Price display */}
        <View className="flex-row justify-between items-center">
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor Total</Text>
          <Text className="text-xl font-black text-yellow-600 dark:text-yellow-500">{formattedPrice}</Text>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (authLoading || loading) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#eab308" size="large" />
        </View>
      );
    }

    if (!user) {
      return (
        <View className="flex-1 items-center justify-center p-10">
          <View className="w-20 h-20 rounded-full bg-gray-100 dark:bg-white/5 items-center justify-center mb-6">
            <ShoppingBag size={36} color={isDark ? '#555' : '#ccc'} />
          </View>
          <Text className="text-lg font-black text-gray-900 dark:text-white text-center">Acesso restrito</Text>
          <Text className="text-sm text-gray-400 text-center mt-2 mb-8 leading-relaxed">
            Faça login na sua conta para visualizar o seu histórico de pedidos.
          </Text>
          <TouchableOpacity 
            onPress={() => router.push('/(auth)/login')}
            className="bg-[#014fa4] px-8 py-4 rounded-2xl shadow-lg"
          >
            <Text className="text-white font-black uppercase tracking-widest text-xs">Fazer Login</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={{ padding: 24, paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-grow items-center justify-center p-10 mt-12">
            <View className="w-20 h-20 rounded-full bg-gray-100 dark:bg-white/5 items-center justify-center mb-6">
              <ShoppingBag size={36} color={isDark ? '#555' : '#ccc'} />
            </View>
            <Text className="text-lg font-black text-gray-900 dark:text-white text-center">Nenhum pedido encontrado</Text>
            <Text className="text-sm text-gray-400 text-center mt-2 mb-8 leading-relaxed">
              Você ainda não realizou nenhuma compra na nossa loja.
            </Text>
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/store')}
              className="bg-[#014fa4] px-8 py-4 rounded-2xl shadow-lg"
            >
              <Text className="text-white font-black uppercase tracking-widest text-xs">Visitar Loja</Text>
            </TouchableOpacity>
          </View>
        }
      />
    );
  };

  return (
    <View className="flex-1 bg-gray-50 dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View 
        style={{ paddingTop: insets.top || 50 }}
        className="bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-white/5"
      >
        <View className="flex-row items-center px-6 pb-4 pt-2">
          <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 -ml-2">
            <ArrowLeft size={24} color={isDark ? '#fff' : '#333'} />
          </TouchableOpacity>
          <Text className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Meus Pedidos</Text>
        </View>
      </View>

      {renderContent()}
    </View>
  );
}
