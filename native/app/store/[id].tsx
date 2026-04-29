import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { ArrowLeft, ShoppingCart, Minus, Plus, Star, ShieldCheck } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

import { useCart } from '../../src/context/CartContext';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [participants, setParticipants] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  
  const { addItem } = useCart();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.id ? { id: docSnap.id, ...docSnap.data() } : docSnap.data();
          setProduct(data);
          
          // Initial participants list
          setParticipants(Array(1).fill({ 
            userName: '', 
            userPrograma: '', 
            userGraduacao: '', 
            userProfessor: '',
            userSize: ''
          }));
        }

        // Fetch instructors for professor selection
        const q = query(collection(db, 'users'), where('isInstructor', '==', true));
        const instructorSnap = await getDocs(q);
        const instList = instructorSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setInstructors(instList.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')));

      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  useEffect(() => {
    // Update participants array when quantity changes
    setParticipants(prev => {
      const newList = [...prev];
      if (quantity > newList.length) {
        for (let i = newList.length; i < quantity; i++) {
          newList.push({ userName: '', userPrograma: '', userGraduacao: '', userProfessor: '', userSize: '' });
        }
      } else {
        return newList.slice(0, quantity);
      }
      return newList;
    });
  }, [quantity]);

  const updateParticipant = (index: number, field: string, value: string) => {
    const newList = [...participants];
    newList[index] = { ...newList[index], [field]: value };
    setParticipants(newList);
  };

  const handleAddToCart = () => {
    // Basic validation
    const incomplete = participants.some(p => 
      (product.askProfessor && !p.userProfessor) || 
      (product.hasSizes && !p.userSize)
    );

    if (incomplete) {
      alert('Por favor, preencha todas as informações obrigatórias.');
      return;
    }

    const formDataList = participants.map(p => ({
      ...p,
      priceData: { amount: product.price }
    }));

    addItem({
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrl,
      priceType: product.priceType || 'fixed',
      totalAmount: product.price * quantity,
      formDataList
    }, quantity);

    router.push('/cart');
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-[#050505]">
        <ActivityIndicator size="large" color="#eab308" />
      </View>
    );
  }

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-[#050505] p-6">
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

  const price = (product.price / 100).toLocaleString('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  });

  return (
    <View className="flex-1 bg-white dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false }} />

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
          {product.category && (
            <View className="bg-yellow-500/10 self-start px-3 py-1 rounded-lg mb-4 border border-yellow-500/20">
              <Text className="text-[#eab308] text-[10px] font-black uppercase tracking-widest">{product.category}</Text>
            </View>
          )}

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

          <Text className="text-2xl font-black text-yellow-600 dark:text-yellow-500 mb-6">
            {price}
          </Text>

          <View className="h-[1px] bg-gray-100 dark:bg-white/5 w-full mb-6" />

          <Text className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Descrição</Text>
          <Text className="text-gray-600 dark:text-gray-300 leading-relaxed mb-8">
            {product.description || 'Nenhuma descrição disponível para este produto. Qualidade garantida Kihap Martial Arts.'}
          </Text>

          {/* Participant Info Fields */}
          {participants.map((participant, index) => (
            <View key={index} className="mb-8 bg-gray-50 dark:bg-white/5 p-6 rounded-3xl border border-gray-100 dark:border-white/5">
              <Text className="text-xs font-black text-yellow-600 dark:text-yellow-500 uppercase tracking-widest mb-4">
                Informações do Item {index + 1}
              </Text>
              
              <View className="space-y-4">
                <View>
                  <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Nome do Aluno</Text>
                  <TextInput 
                    value={participant.userName}
                    onChangeText={(v) => updateParticipant(index, 'userName', v)}
                    placeholder="Nome completo"
                    placeholderTextColor="#999"
                    className="bg-white dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-100 dark:border-white/10 text-gray-900 dark:text-white"
                  />
                </View>

                {product.hasSizes && product.sizes && (
                  <View>
                    <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Tamanho</Text>
                    <View className="flex-row flex-wrap">
                      {product.sizes.map((size: string) => (
                        <TouchableOpacity 
                          key={size}
                          onPress={() => updateParticipant(index, 'userSize', size)}
                          className={`mr-2 mb-2 px-4 py-2 rounded-xl border ${participant.userSize === size ? 'bg-[#014fa4] border-[#014fa4]' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/10'}`}
                        >
                          <Text className={`text-xs font-bold ${participant.userSize === size ? 'text-white' : 'text-gray-500'}`}>{size}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {product.askProfessor && (
                  <View>
                    <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Professor Responsável</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                      {instructors.map((inst) => (
                        <TouchableOpacity 
                          key={inst.id}
                          onPress={() => updateParticipant(index, 'userProfessor', inst.name)}
                          className={`mr-2 px-4 py-2 rounded-xl border ${participant.userProfessor === inst.name ? 'bg-[#014fa4] border-[#014fa4]' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/10'}`}
                        >
                          <Text className={`text-xs font-bold ${participant.userProfessor === inst.name ? 'text-white' : 'text-gray-500'}`}>{inst.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
          ))}

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
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center bg-gray-100 dark:bg-white/5 rounded-2xl p-1">
            <TouchableOpacity 
              onPress={() => quantity > 1 && setQuantity(q => q - 1)}
              className="w-10 h-10 items-center justify-center"
            >
              <Minus size={18} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
            <Text className="px-4 text-lg font-black text-gray-900 dark:text-white">{quantity}</Text>
            <TouchableOpacity 
              onPress={() => setQuantity(q => q + 1)}
              className="w-10 h-10 items-center justify-center"
            >
              <Plus size={18} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>
          
          <View className="items-end">
            <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total</Text>
            <Text className="text-xl font-black text-gray-900 dark:text-white">
              {(product.price * quantity / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          onPress={handleAddToCart}
          className="bg-[#014fa4] py-5 rounded-2xl items-center justify-center flex-row shadow-lg shadow-blue-500/20"
          activeOpacity={0.8}
        >
          <ShoppingCart size={20} color="#fff" strokeWidth={3} />
          <Text className="ml-3 text-white font-black uppercase tracking-widest">Adicionar ao Carrinho</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
