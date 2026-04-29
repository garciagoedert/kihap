import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useCart } from '../src/context/CartContext';
import { useAuth } from '../src/context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, CheckCircle2, Lock, ChevronRight, CreditCard, QrCode } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../src/services/firebase';

export default function CheckoutScreen() {
  const { total, items, clearCart } = useCart();
  const { userData } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [units, setUnits] = useState<string[]>([]);
  
  // Form fields
  const [name, setName] = useState(userData?.name || '');
  const [email, setEmail] = useState(userData?.email || '');
  const [phone, setPhone] = useState(userData?.phoneNumber || '');
  const [cpf, setCpf] = useState(userData?.cpf || '');
  const [unit, setUnit] = useState(userData?.unit || '');

  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const getPublicEvoUnits = httpsCallable(functions, 'getPublicEvoUnits');
        const result: any = await getPublicEvoUnits();
        setUnits(result.data || []);
      } catch (error) {
        console.error("Error fetching units:", error);
      }
    };
    fetchUnits();
  }, []);

  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const handlePayment = async () => {
    if (!name || !email || !phone || !cpf || !unit) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);

    const globalUserData = {
      userName: name,
      userEmail: email,
      userPhone: phone,
      userCpf: cpf,
      userUnit: unit,
      userId: userData?.uid || null
    };

    try {
      const isFree = total <= 0;
      const endpoint = isFree 
        ? 'https://us-central1-intranet-kihap.cloudfunctions.net/processCartFreePurchase'
        : 'https://us-central1-intranet-kihap.cloudfunctions.net/createCartCheckoutSession';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartItems: items,
          globalUserData: globalUserData,
          totalAmount: total
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao processar o checkout.');
      }

      const data = await response.json();
      
      if (isFree && data.status === 'success') {
        setSuccess(true);
        clearCart();
        // Redirect home after a delay
        setTimeout(() => router.replace('/(tabs)'), 3000);
      } else if (data.checkoutUrl) {
        setPaymentUrl(data.checkoutUrl);
        setSuccess(true);
        clearCart();
        
        // Attempt automatic redirect
        try {
          await WebBrowser.openBrowserAsync(data.checkoutUrl);
        } catch (e) {
          Linking.openURL(data.checkoutUrl);
        }
      } else {
        throw new Error('Resposta inválida do servidor.');
      }
    } catch (error: any) {
      console.error('Checkout Error:', error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View className="flex-1 bg-white dark:bg-[#050505] items-center justify-center p-10">
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View className="w-24 h-24 rounded-full bg-blue-500/10 items-center justify-center mb-8">
          <CheckCircle2 size={60} color="#014fa4" />
        </View>
        <Text className="text-3xl font-black text-gray-900 dark:text-white text-center uppercase tracking-tighter">Pedido Gerado!</Text>
        <Text className="text-gray-400 text-center mt-4 mb-10 leading-relaxed">
          Seu pedido foi registrado. Agora você será redirecionado para o Mercado Pago para concluir o pagamento.
        </Text>
        
        {paymentUrl && (
          <TouchableOpacity 
            onPress={() => Linking.openURL(paymentUrl)}
            className="bg-[#014fa4] py-4 px-8 rounded-2xl w-full items-center mb-4"
          >
            <Text className="text-white font-bold uppercase">Ir para Pagamento</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          onPress={() => router.replace('/(tabs)')}
          className="py-4 px-8 rounded-2xl w-full items-center border border-gray-100 dark:border-white/10"
        >
          <Text className="text-gray-500 font-bold uppercase">Voltar para o Início</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View 
          style={{ paddingTop: insets.top || 50 }}
          className="bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-white/5"
        >
          <View className="flex-row items-center px-6 pb-4 pt-2">
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <ArrowLeft size={24} color={isDark ? '#fff' : '#333'} />
            </TouchableOpacity>
            <Text className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Pagamento</Text>
          </View>
        </View>

        <View className="p-6">
          {/* Order Summary */}
          <View className="bg-white dark:bg-[#1a1a1a] rounded-3xl p-6 border border-gray-100 dark:border-white/5 mb-6">
            <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Resumo do Pedido</Text>
            {items.map((item) => (
              <View key={item.cartId} className="mb-4 last:mb-0">
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 mr-4">
                    <Text className="text-gray-900 dark:text-white text-sm font-bold" numberOfLines={1}>{item.productName}</Text>
                    {item.formDataList && item.formDataList.map((form: any, idx: number) => (
                      <Text key={idx} className="text-[10px] text-gray-400 mt-0.5">
                        {form.userName || 'Participante'} {form.userSize ? `| Tam: ${form.userSize}` : ''}
                      </Text>
                    ))}
                  </View>
                  <Text className="text-gray-900 dark:text-white text-sm font-black">
                    {(item.totalAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </Text>
                </View>
              </View>
            ))}
            <View className="h-[1px] bg-gray-100 dark:bg-white/5 my-4" />
            <View className="flex-row justify-between items-center">
              <Text className="text-sm font-black text-gray-900 dark:text-white uppercase">Total</Text>
              <Text className="text-xl font-black text-yellow-600 dark:text-yellow-500">
                {(total / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            </View>
          </View>

          {/* User Data */}
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-2">Dados do Comprador</Text>
          
          <View className="bg-white dark:bg-[#1a1a1a] rounded-3xl p-6 border border-gray-100 dark:border-white/5 space-y-4 mb-6">
            <View>
              <Text className="text-[9px] font-bold text-gray-400 uppercase mb-1 ml-1">Nome Completo</Text>
              <TextInput 
                value={name}
                onChangeText={setName}
                placeholder="Seu nome"
                placeholderTextColor="#999"
                className="bg-gray-50 dark:bg-[#050505] p-4 rounded-2xl border border-gray-100 dark:border-white/5 text-gray-900 dark:text-white"
              />
            </View>

            <View>
              <Text className="text-[9px] font-bold text-gray-400 uppercase mb-1 ml-1">CPF</Text>
              <TextInput 
                value={cpf}
                onChangeText={setCpf}
                placeholder="000.000.000-00"
                placeholderTextColor="#999"
                keyboardType="numeric"
                className="bg-gray-50 dark:bg-[#050505] p-4 rounded-2xl border border-gray-100 dark:border-white/5 text-gray-900 dark:text-white"
              />
            </View>

            <View>
              <Text className="text-[9px] font-bold text-gray-400 uppercase mb-1 ml-1">Unidade Kihap</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-2">
                {units.map((u) => (
                  <TouchableOpacity 
                    key={u}
                    onPress={() => setUnit(u)}
                    className={`mr-2 px-4 py-3 rounded-xl border ${unit === u ? 'bg-[#014fa4] border-[#014fa4]' : 'bg-gray-50 dark:bg-[#050505] border-gray-100 dark:border-white/5'}`}
                  >
                    <Text className={`text-xs font-bold ${unit === u ? 'text-white' : 'text-gray-500'}`}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View>
              <Text className="text-[9px] font-bold text-gray-400 uppercase mb-1 ml-1">WhatsApp</Text>
              <TextInput 
                value={phone}
                onChangeText={setPhone}
                placeholder="(00) 00000-0000"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                className="bg-gray-50 dark:bg-[#050505] p-4 rounded-2xl border border-gray-100 dark:border-white/5 text-gray-900 dark:text-white"
              />
            </View>
          </View>

          <View className="items-center mb-10">
            <View className="flex-row items-center bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-full">
              <Lock size={12} color="#999" />
              <Text className="ml-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pagamento Seguro via Mercado Pago</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Button */}
      <View 
        style={{ paddingBottom: Math.max(insets.bottom, 24) }}
        className="px-6 pt-6 bg-white dark:bg-[#0a0a0a] border-t border-gray-100 dark:border-white/5 shadow-2xl"
      >
        <TouchableOpacity 
          onPress={handlePayment}
          disabled={loading}
          className={`py-5 rounded-2xl items-center justify-center flex-row shadow-lg ${loading ? 'bg-gray-400' : 'bg-[#014fa4] shadow-blue-500/20'}`}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text className="text-white font-black uppercase tracking-widest text-base">
                Ir para Pagamento
              </Text>
              <ChevronRight size={20} color="#fff" strokeWidth={3} className="ml-2" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
