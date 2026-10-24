import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { ArrowLeft, ShoppingCart, Minus, Plus, Star, ShieldCheck } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

import { useCart } from '../../src/context/CartContext';
import { useAuth } from '../../src/context/AuthContext';
import { getEffectiveProductPrice, getEffectiveVariantPrice, formatCentsToCurrency } from '../../src/utils/pricing';
import { collection, query, where, getDocs } from 'firebase/firestore';

const GRADUACOES: { [key: string]: string[] } = {
  tradicional: [
    'Branca', 'Laranja recomendada', 'Laranja decidida', 'Amarela recomendada', 'Amarela decidida',
    'Camuflada recomendada', 'Camuflada decidida', 'Verde recomendada', 'Verde decidida',
    'Roxa recomendada', 'Roxa decidida', 'Azul recomendada', 'Azul decidida',
    'Marrom recomendada', 'Marrom decidida', 'Vermelha recomendada', 'Vermelha decidida',
    'Vermelha e preta', 'Preta 1º Dan', 'Preta 2º Dan', 'Preta 3º Dan', 'Preta 4º Dan',
    'Preta 5º Dan', 'Preta 6º Dan', 'Preta 7º Dan', 'Preta 8º Dan', 'Preta 9º Dan'
  ],
  littles: [
    'Littles Branca', 'Littles Panda', 'Littles Leão', 'Littles Girafa', 'Littles Borboleta',
    'Littles Jacaré', 'Littles Coruja', 'Littles Arara', 'Littles Macaco', 'Littles Fênix'
  ]
};

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [participants, setParticipants] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  
  const { userData } = useAuth();
  const { addItem } = useCart();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const docRef = doc(db, 'products', id as string);
    const unsubscribeProduct = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.id ? { id: docSnap.id, ...docSnap.data() } : docSnap.data();
        setProduct(data);
        
        const defaultVariant = data.priceType === 'variable' && data.priceVariants && data.priceVariants.length > 0
          ? data.priceVariants[0]
          : null;

        setParticipants(prev => {
          if (prev.length === 0) {
            return [{ 
              userName: '', 
              userPrograma: '', 
              userGraduacao: '', 
              userProfessor: '',
              userSize: '',
              selectedVariant: defaultVariant
            }];
          }
          return prev;
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to product:", error);
      setLoading(false);
    });

    // Fetch instructors for professor selection
    const fetchInstructors = async () => {
      try {
        const q = query(collection(db, 'users'), where('isInstructor', '==', true));
        const instructorSnap = await getDocs(q);
        const instList = instructorSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setInstructors(instList.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')));
      } catch (err) {
        console.error("Error fetching instructors:", err);
      }
    };
    fetchInstructors();

    return () => unsubscribeProduct();
  }, [id]);

  useEffect(() => {
    if (!product) return;
    const defaultVariant = product.priceType === 'variable' && product.priceVariants && product.priceVariants.length > 0
      ? product.priceVariants[0]
      : null;

    // Update participants array when quantity changes
    setParticipants(prev => {
      const newList = [...prev];
      if (quantity > newList.length) {
        for (let i = newList.length; i < quantity; i++) {
          newList.push({ 
            userName: '', 
            userPrograma: '', 
            userGraduacao: '', 
            userProfessor: '', 
            userSize: '',
            selectedVariant: defaultVariant
          });
        }
      } else {
        return newList.slice(0, quantity);
      }
      return newList;
    });
  }, [quantity, product]);

  const updateParticipant = (index: number, updates: { [key: string]: any }) => {
    setParticipants(prev => {
      const newList = [...prev];
      newList[index] = { ...newList[index], ...updates };
      return newList;
    });
  };

  const calculateTotal = () => {
    if (!product) return 0;
    if (product.priceType === 'variable') {
      return participants.reduce((sum, p) => {
        const pVariant = p.selectedVariant || product.priceVariants?.[0];
        const pPrice = pVariant ? getEffectiveVariantPrice(pVariant, userData, product).price : 0;
        return sum + pPrice;
      }, 0);
    }
    const effective = getEffectiveProductPrice(product, userData);
    return effective.price * quantity;
  };

  const handleAddToCart = () => {
    // Basic validation
    const incomplete = participants.some(p => 
      !p.userName?.trim() ||
      !p.userPrograma ||
      ((p.userPrograma === 'tradicional' || p.userPrograma === 'littles') && !p.userGraduacao) ||
      (product.askProfessor && !p.userProfessor) || 
      (product.hasSizes && !p.userSize) ||
      (product.priceType === 'variable' && !p.selectedVariant)
    );

    if (incomplete) {
      alert('Por favor, preencha todas as informações obrigatórias.');
      return;
    }

    const effective = getEffectiveProductPrice(product, userData);

    const formDataList = participants.map(p => {
      const pVariant = p.selectedVariant || (product.priceType === 'variable' ? product.priceVariants?.[0] : null);
      const selectedAmount = pVariant ? getEffectiveVariantPrice(pVariant, userData, product).price : effective.price;
      const selectedVariantName = pVariant ? pVariant.name : undefined;
      const pixAmount = pVariant?.pixPrice || product.pixPrice || undefined;
      
      const priceData: any = {
        amount: selectedAmount,
        ...(selectedVariantName ? { variantName: selectedVariantName } : {}),
        ...(pixAmount ? { pixAmount } : {})
      };

      const { selectedVariant, ...rest } = p;
      return {
        ...rest,
        priceData
      };
    });

    const totalAmount = calculateTotal();

    const firstVariantPrice = product.priceType === 'variable' && product.priceVariants && product.priceVariants.length > 0
      ? getEffectiveVariantPrice(participants[0]?.selectedVariant || product.priceVariants[0], userData, product).price
      : effective.price;

    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      productName: product.name,
      imageUrl: product.imageUrl,
      priceType: product.priceType || 'fixed',
      price: firstVariantPrice,
      totalAmount,
      formDataList
    }, quantity);

    router.push('/cart');
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-[#050505]">
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color="#eab308" />
      </View>
    );
  }

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-[#050505] p-6">
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
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

  const effective = getEffectiveProductPrice(product, userData);
  let priceText = '';
  let originalPriceText = '';

  if (product.priceType === 'variable' && product.priceVariants && product.priceVariants.length > 0) {
    const prices = product.priceVariants.map((v: any) => getEffectiveVariantPrice(v, userData, product).price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    if (minPrice === maxPrice) {
      priceText = formatCentsToCurrency(minPrice);
    } else {
      priceText = `A partir de ${formatCentsToCurrency(minPrice)}`;
    }
    if (effective.isStaffPrice && effective.basePrice > effective.price) {
      originalPriceText = formatCentsToCurrency(effective.basePrice);
    }
  } else if (effective.isStaffPrice) {
    priceText = formatCentsToCurrency(effective.price);
    if (effective.basePrice > effective.price) {
      originalPriceText = formatCentsToCurrency(effective.basePrice);
    }
  } else {
    priceText = formatCentsToCurrency(effective.price);
    if (effective.promoPrice && effective.promoPrice < effective.basePrice) {
      originalPriceText = formatCentsToCurrency(effective.basePrice);
    }
  }

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

          <View className="mb-6">
            {originalPriceText ? (
              <Text className="text-sm font-semibold text-gray-400 line-through mb-0.5">
                {originalPriceText}
              </Text>
            ) : null}
            <View className="flex-row items-center gap-2">
              <Text className="text-3xl font-black text-yellow-600 dark:text-yellow-500">
                {priceText}
              </Text>
              {effective.isStaffPrice && (
                <View className="bg-purple-500/20 px-2.5 py-1 rounded-lg border border-purple-500/30">
                  <Text className="text-[10px] font-black text-purple-600 dark:text-purple-300 uppercase tracking-wider">🔒 Preço Staff</Text>
                </View>
              )}
            </View>
          </View>

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
                    onChangeText={(v) => updateParticipant(index, { userName: v })}
                    placeholder="Nome completo"
                    placeholderTextColor="#999"
                    className="bg-white dark:bg-[#1a1a1a] p-4 rounded-2xl border border-gray-100 dark:border-white/10 text-gray-900 dark:text-white"
                  />
                </View>

                {product.priceType === 'variable' && product.priceVariants && product.priceVariants.length > 0 && (
                  <View>
                    <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">
                      {product.variantsLabel || 'Opção'}
                    </Text>
                    <View className="flex-row flex-wrap">
                      {product.priceVariants.map((variant: any) => {
                        const isSelected = participant.selectedVariant?.name === variant.name;
                        const variantEff = getEffectiveVariantPrice(variant, userData, product);
                        const variantPriceFormatted = formatCentsToCurrency(variantEff.price);
                        const pixFormatted = (variant.pixPrice && variant.pixPrice < variantEff.price) 
                          ? ` (Pix ${formatCentsToCurrency(variant.pixPrice)})`
                          : '';
                        return (
                          <TouchableOpacity 
                            key={variant.name}
                            onPress={() => updateParticipant(index, { selectedVariant: variant })}
                            className={`mr-2 mb-2 px-4 py-2 rounded-xl border ${isSelected ? 'bg-[#014fa4] border-[#014fa4]' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/10'}`}
                          >
                            <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                              {variant.name} ({variantPriceFormatted}{pixFormatted})
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                <View>
                  <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Programa</Text>
                  <View className="flex-row flex-wrap">
                    {[
                      { label: 'Tradicional', value: 'tradicional' },
                      { label: 'Littles', value: 'littles' },
                      { label: 'Não Aluno', value: 'não aluno' }
                    ].map((prog) => (
                      <TouchableOpacity 
                        key={prog.value}
                        onPress={() => {
                          console.log(`[DEBUG] Button clicked: ${prog.value}`);
                          updateParticipant(index, { userPrograma: prog.value, userGraduacao: '' });
                        }}
                        className={`mr-2 mb-2 px-4 py-2 rounded-xl border ${participant.userPrograma === prog.value ? 'bg-[#014fa4] border-[#014fa4]' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/10'}`}
                      >
                        <Text className={`text-xs font-bold ${participant.userPrograma === prog.value ? 'text-white' : 'text-gray-500'}`}>{prog.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {(participant.userPrograma === 'tradicional' || participant.userPrograma === 'littles') && (
                  <View>
                    <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Graduação</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
                      {GRADUACOES[participant.userPrograma].map((grad) => (
                        <TouchableOpacity 
                          key={grad}
                          onPress={() => updateParticipant(index, { userGraduacao: grad })}
                          className={`mr-2 px-4 py-2 rounded-xl border ${participant.userGraduacao === grad ? 'bg-[#014fa4] border-[#014fa4]' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/10'}`}
                        >
                          <Text className={`text-xs font-bold ${participant.userGraduacao === grad ? 'text-white' : 'text-gray-500'}`}>{grad}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {product.hasSizes && product.sizes && (
                  <View>
                    <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Tamanho</Text>
                    <View className="flex-row flex-wrap">
                      {product.sizes.map((size: string) => (
                        <TouchableOpacity 
                          key={size}
                          onPress={() => updateParticipant(index, { userSize: size })}
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
                      {product.availableProfessors && product.availableProfessors.length > 0 ? (
                        product.availableProfessors.map((profName: string, i: number) => (
                          <TouchableOpacity 
                            key={`prof-${i}`}
                            onPress={() => updateParticipant(index, { userProfessor: profName })}
                            className={`mr-2 px-4 py-2 rounded-xl border ${participant.userProfessor === profName ? 'bg-[#014fa4] border-[#014fa4]' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/10'}`}
                          >
                            <Text className={`text-xs font-bold ${participant.userProfessor === profName ? 'text-white' : 'text-gray-500'}`}>{profName}</Text>
                          </TouchableOpacity>
                        ))
                      ) : (
                        instructors.map((inst) => (
                          <TouchableOpacity 
                            key={inst.id}
                            onPress={() => updateParticipant(index, { userProfessor: inst.name })}
                            className={`mr-2 px-4 py-2 rounded-xl border ${participant.userProfessor === inst.name ? 'bg-[#014fa4] border-[#014fa4]' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/10'}`}
                          >
                            <Text className={`text-xs font-bold ${participant.userProfessor === inst.name ? 'text-white' : 'text-gray-500'}`}>{inst.name}</Text>
                          </TouchableOpacity>
                        ))
                      )}
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
              {(calculateTotal() / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
