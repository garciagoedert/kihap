import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Image, Modal, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { BookOpen, Play, Clock, Star, Menu, X, Home, Layout, MessageSquare, UserCheck, Activity, ShoppingBag, CreditCard, LogOut, Calendar, Lock, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db, functions } from '../../src/services/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { httpsCallable } from 'firebase/functions';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';


export default function CursosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, userData, signOut } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  // Purchase Flow States
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buying, setBuying] = useState(false);

  const handlePurchase = async () => {
    if (!selectedCourse || !user) {
      console.log('handlePurchase: Return early due to selectedCourse or user missing.', { selectedCourse: !!selectedCourse, user: !!user });
      return;
    }
    
    setBuying(true);
    try {
      const isSubscription = selectedCourse.isSubscription === true;
      const functionName = isSubscription ? 'createSubscription' : 'createCourseOneTimeCheckout';
      
      console.log('handlePurchase: Fetching user ID token manually...');
      const token = await user.getIdToken(true).catch(e => {
        console.error('handlePurchase: Failed to get token manually:', e);
        throw e;
      });
      console.log('handlePurchase: Manual token fetched successfully:', token.substring(0, 15) + '...');

      const purchaseFunction = httpsCallable(functions, functionName);
      
      console.log(`handlePurchase: Starting flow via "${functionName}" for course:`, selectedCourse.id);
      
      const result: any = await purchaseFunction({ courseId: selectedCourse.id });
      console.log('handlePurchase: Cloud Function responded successfully:', result);
      
      if (result.data && result.data.success && result.data.initPoint) {
        const checkoutUrl = result.data.initPoint;
        setShowBuyModal(false);
        setSelectedCourse(null);
        
        console.log('handlePurchase: Redirecting user to browser using Linking.openURL...', checkoutUrl);
        await Linking.openURL(checkoutUrl);
      } else {
        throw new Error('Não foi possível obter o link de pagamento do servidor.');
      }
    } catch (error: any) {
      console.error('Erro na compra (handlePurchase catch):', error);
      alert(error.message || 'Ocorreu um erro ao processar a compra. Tente novamente.');
    } finally {
      setBuying(false);
    }
  };

  // Mapping real data with robust fallbacks and URL normalization
  const displayName = userData?.name || userData?.nome || userData?.displayName || 'Aluno';
  const firstName = displayName.split(' ')[0];
  
  let rawPhoto = userData?.photoURL || userData?.profilePicture || userData?.photoUrl || userData?.avatar;
  if (rawPhoto && rawPhoto.startsWith('/')) {
    rawPhoto = `https://kihap.com.br${rawPhoto}`;
  }
  const defaultProfileImg = require('../../assets/images/default-profile.png');
  const displayPhoto = rawPhoto && !rawPhoto.includes('default-profile.svg') ? { uri: rawPhoto } : defaultProfileImg;
  
  const displayUnit = userData?.unidade || userData?.unit || 'Kihap Member';

  const SidebarItem = ({ icon: Icon, label, onPress, color = isDark ? '#fff' : '#333' }: any) => (
    <TouchableOpacity 
      onPress={onPress}
      className="flex-row items-center px-4 py-3.5 mb-1 rounded-xl active:bg-gray-100 dark:active:bg-white/5"
    >
      <Icon size={20} color={color} />
      <Text className="ml-4 text-[15px] font-bold text-gray-700 dark:text-gray-200">{label}</Text>
    </TouchableOpacity>
  );

  useEffect(() => {
    const fetchCourses = async () => {
      if (!user) return;
      try {
        setLoading(true);
        console.log("Cursos: Fetching for user", user.uid);
        
        // 1. Fetch user subscriptions
        let subIds: string[] = [];
        try {
          const subQuery = query(collection(db, `users/${user.uid}/subscriptions`));
          const subSnapshot = await getDocs(subQuery);
          subIds = subSnapshot.docs
            .filter(doc => {
              const status = doc.data().status;
              return status === 'active' || status === 'authorized';
            })
            .map(doc => doc.data().courseId);
          console.log("Cursos: Subscriptions found:", subIds.length);
        } catch (e) {
          console.error("Cursos: Error fetching subs:", e);
        }

        // 2. Fetch all courses (Try 'courses' then 'cursos')
        let snap = await getDocs(query(collection(db, "courses")));
        console.log("Cursos: 'courses' collection size:", snap.size);
        
        if (snap.empty) {
          console.log("Cursos: 'courses' empty, trying 'cursos'...");
          snap = await getDocs(query(collection(db, "cursos")));
          console.log("Cursos: 'cursos' collection size:", snap.size);
        }

        if (snap.empty) {
          setDebugInfo('Nenhum curso encontrado em "courses" ou "cursos".');
        }

        const docs = snap.docs.map(doc => {
          const data = doc.data();
          const courseId = doc.id;
          
          // Access logic:
          // 1. If it's in the subIds list (explicit active subscription/purchase)
          // 2. If it's NOT a subscription nor a one-time purchase
          // 3. If it's marked as free
          const hasSubscription = subIds.includes(courseId);
          const isPremium = data.isSubscription === true || data.isOneTimePurchase === true;
          const isFree = data.free === true;
          
          return { 
            id: courseId, 
            ...data,
            hasAccess: hasSubscription || !isPremium || isFree
          };
        });

        console.log("Cursos: Final count with access:", docs.filter(d => d.hasAccess).length);
        setDebugInfo(`User: ${user.uid.substring(0,5)} | Subs: ${subIds.length} | Courses: ${docs.length}`);
        setMyCourses(docs);
      } catch (error: any) {
        console.error("Error fetching courses:", error);
        setDebugInfo('Erro: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [user]);

  const renderCourse = ({ item }: { item: any }) => (
    <TouchableOpacity 
      onPress={() => {
        if (item.hasAccess) {
          router.push(`/player?courseId=${item.id}`);
        } else {
          setSelectedCourse(item);
          setShowBuyModal(true);
        }
      }}
      className={`bg-white dark:bg-[#1a1a1a] rounded-3xl mb-6 overflow-hidden border border-gray-100 dark:border-white/5 shadow-sm active:opacity-90 ${!item.hasAccess ? 'opacity-60' : ''}`}
    >
      <Image 
        source={{ uri: item.thumbnailURL || item.thumbnail || 'https://kihap.com.br/wp-content/uploads/2021/02/logo-wh.png' }} 
        className="w-full h-48 bg-gray-100 dark:bg-[#050505]"
        resizeMode="cover"
      />
      <View className="p-5">
        <View className="flex-row items-center mb-2">
          {(item.isSubscription || item.isOneTimePurchase) && !item.hasAccess && (
            <View className="bg-yellow-500 px-2 py-1 rounded-md mr-2">
              <Text className="text-black text-[9px] font-black uppercase tracking-widest">Premium</Text>
            </View>
          )}
          <View className="bg-blue-500/10 px-2 py-1 rounded-md mr-2">
            <Text className="text-blue-500 text-[9px] font-black uppercase tracking-widest">{item.category || 'Curso'}</Text>
          </View>
        </View>
        
        <Text className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-2">
          {item.title}
        </Text>
        
        <Text className="text-gray-500 dark:text-gray-400 text-xs mb-6 leading-relaxed" numberOfLines={2}>
          {item.description || 'Aprenda as técnicas mais avançadas com os nossos mestres.'}
        </Text>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Clock size={14} color="#999" />
            <Text className="text-[10px] text-gray-400 font-bold ml-1.5 uppercase">{item.author || 'Mestre Kihap'}</Text>
          </View>
          <View className={`${item.hasAccess ? 'bg-[#014fa4]' : 'bg-gray-400'} px-5 py-2.5 rounded-2xl flex-row items-center`}>
            <Text className="text-white font-black uppercase tracking-widest text-[9px] mr-2">
              {item.hasAccess ? 'Assistir' : 'Bloqueado'}
            </Text>
            <Play size={10} color="white" fill="white" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-gray-50 dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Fixed Header */}
      <View 
        style={{ paddingTop: insets.top || 50 }}
        className="bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-lg border-b border-gray-100 dark:border-white/5 z-50"
      >
        <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
          <View className="w-10">
            <TouchableOpacity onPress={() => setSidebarOpen(true)} className="p-2 -ml-2">
              <Menu size={24} color={isDark ? '#fff' : '#333'} />
            </TouchableOpacity>
          </View>
          <View className="flex-1 items-center justify-center">
            <Image 
              source={{ uri: 'https://kihap.com.br/imgs/favicon.png' }} 
              className="h-9 w-9 mt-1"
              resizeMode="contain"
              style={{ tintColor: isDark ? '#ffffff' : '#000000' }}
            />
          </View>
          <View className="w-10" />
        </View>
      </View>

      {/* Screen Title */}
      <View className="px-6 pt-6 pb-2">
        <Text className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Área do Aluno</Text>
        <Text className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mt-1">Meus Cursos</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#eab308" size="large" />
        </View>
      ) : (
        <FlatList
          data={myCourses}
          keyExtractor={(item) => item.id}
          renderItem={renderCourse}
          contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="items-center justify-center mt-20">
              <Text className="text-gray-400 font-bold">Você ainda não tem cursos liberados.</Text>
              {debugInfo ? <Text className="text-[8px] text-gray-500 mt-4 opacity-30">{debugInfo}</Text> : null}
            </View>
          }
        />
      )}

      {/* Course Purchase Modal */}
      <Modal
        visible={showBuyModal && !!selectedCourse}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!buying) {
            setShowBuyModal(false);
            setSelectedCourse(null);
          }
        }}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white dark:bg-[#121212] rounded-t-[40px] px-6 pt-8 pb-10 shadow-2xl border-t border-gray-100 dark:border-white/5">
            {/* Header / Top Indicator */}
            <View className="w-12 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full mb-6 mx-auto" />
            
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center bg-yellow-500/10 px-3 py-1.5 rounded-full">
                <Sparkles size={14} color="#eab308" />
                <Text className="text-yellow-600 dark:text-yellow-500 text-[10px] font-black uppercase tracking-wider ml-1">Curso Premium</Text>
              </View>
              <TouchableOpacity 
                disabled={buying} 
                onPress={() => { setShowBuyModal(false); setSelectedCourse(null); }}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 items-center justify-center"
              >
                <X size={16} color={isDark ? '#fff' : '#333'} />
              </TouchableOpacity>
            </View>

            {selectedCourse && (
              <ScrollView showsVerticalScrollIndicator={false} className="max-h-[75vh]">
                {/* Course Details */}
                <Image 
                  source={{ uri: selectedCourse.thumbnailURL || selectedCourse.thumbnail || 'https://kihap.com.br/wp-content/uploads/2021/02/logo-wh.png' }} 
                  className="w-full h-40 bg-gray-100 dark:bg-[#050505] rounded-3xl mb-5"
                  resizeMode="cover"
                />

                <Text className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-2">
                  {selectedCourse.title}
                </Text>
                
                <Text className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
                  {selectedCourse.description || 'Aprenda as técnicas mais avançadas com os nossos mestres.'}
                </Text>

                {/* Price section */}
                <View className="bg-gray-50 dark:bg-[#1a1a1a] rounded-3xl p-6 border border-gray-100 dark:border-white/5 mb-6">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-4">
                      <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                        {selectedCourse.isSubscription ? 'Assinatura Recorrente' : 'Acesso Vitalício'}
                      </Text>
                      <Text className="text-gray-500 dark:text-gray-400 text-xs">
                        {selectedCourse.isSubscription 
                          ? `Cobrança automática a cada ${selectedCourse.subscriptionInterval === 'year' ? 'ano' : 'mês'}` 
                          : 'Pague uma vez e assista para sempre'}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-3xl font-black text-yellow-600 dark:text-yellow-500">
                        {selectedCourse.subscriptionPrice 
                          ? (selectedCourse.subscriptionPrice / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          : 'R$ 0,00'}
                      </Text>
                      {selectedCourse.isSubscription && (
                        <Text className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                          /{selectedCourse.subscriptionInterval === 'year' ? 'ano' : 'mês'}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Security info */}
                <View className="flex-row items-center bg-blue-500/5 dark:bg-blue-500/10 px-4 py-3 rounded-2xl mb-8 border border-blue-500/10">
                  <Lock size={16} color="#014fa4" />
                  <Text className="ml-3 text-[11px] font-medium text-blue-800 dark:text-blue-300 flex-1 leading-relaxed">
                    Pagamento 100% seguro via Mercado Pago. Ao avançar, você será redirecionado para concluir a transação.
                  </Text>
                </View>

                {/* Purchase Button */}
                <TouchableOpacity
                  onPress={handlePurchase}
                  disabled={buying}
                  className={`py-5 rounded-2xl items-center justify-center flex-row shadow-lg ${buying ? 'bg-gray-400' : 'bg-[#014fa4] shadow-blue-500/20'}`}
                  activeOpacity={0.8}
                >
                  {buying ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text className="text-white font-black uppercase tracking-widest text-base">
                        {selectedCourse.isSubscription ? 'Assinar Agora' : 'Comprar Agora'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Navigation Sidebar Modal */}
      <Modal
        visible={isSidebarOpen}
        animationType="none"
        transparent={true}
        onRequestClose={() => setSidebarOpen(false)}
      >
        <View className="flex-1 flex-row">
          <View className="w-72 bg-white dark:bg-[#1a1a1a] h-full shadow-2xl">
            <View className="flex-1">
              <View style={{ paddingTop: insets.top }}>
                <View className="p-6 border-b border-gray-100 dark:border-white/5 flex-row items-center">
                  <Image source={displayPhoto} className="w-12 h-12 rounded-full border-2 border-yellow-500/20" />
                  <View className="ml-3">
                    <Text className="text-base font-black text-gray-900 dark:text-white" numberOfLines={1}>{firstName}</Text>
                    <Text className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{displayUnit}</Text>
                  </View>
                </View>
              </View>

              <ScrollView className="flex-1 p-4">
                <SidebarItem icon={Home} label="Início" onPress={() => { setSidebarOpen(false); router.push('/(tabs)'); }} />
                
                <Text className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-6 mb-2 ml-4">Evolução</Text>
                <SidebarItem icon={BookOpen} label="Área do Aluno" onPress={() => setSidebarOpen(false)} />
                <SidebarItem icon={UserCheck} label="Tatame" onPress={() => { setSidebarOpen(false); router.push('/tatame'); }} />
                <SidebarItem icon={Clock} label="Horários" onPress={() => { setSidebarOpen(false); router.push('/atividades'); }} />
                <SidebarItem icon={Calendar} label="Calendário" onPress={() => { setSidebarOpen(false); router.push('/calendario'); }} />

                <Text className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-6 mb-2 ml-4">Serviços</Text>
                <SidebarItem icon={ShoppingBag} label="Loja" onPress={() => { setSidebarOpen(false); router.push('/(tabs)/store'); }} />
                <SidebarItem icon={Layout} label="Meus Pedidos" onPress={() => { setSidebarOpen(false); router.push('/pedidos'); }} />
                <SidebarItem icon={CreditCard} label="Assinatura" onPress={() => { setSidebarOpen(false); router.push('/assinatura'); }} />
              </ScrollView>

              <View className="p-6 border-t border-gray-100 dark:border-white/5">
                <TouchableOpacity 
                  onPress={() => { setSidebarOpen(false); signOut?.(); }}
                  className="flex-row items-center p-4 bg-red-500/10 rounded-2xl"
                >
                  <LogOut size={20} color="#ef4444" />
                  <View style={{ width: 12 }} />
                  <Text className="text-red-500 font-bold uppercase tracking-widest text-[10px]">Sair da Conta</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <TouchableOpacity activeOpacity={1} onPress={() => setSidebarOpen(false)} className="flex-1 bg-black/40" />
        </View>
      </Modal>
    </View>
  );
}