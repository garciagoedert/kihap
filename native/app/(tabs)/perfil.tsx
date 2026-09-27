import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  Alert, 
  ActivityIndicator,
  Modal,
  Switch,
  Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { 
  Camera, 
  Mail, 
  LogOut, 
  ChevronRight, 
  CreditCard, 
  User, 
  Flame, 
  Trophy, 
  Calendar, 
  Award, 
  MapPin, 
  ShieldCheck, 
  Moon, 
  Sun, 
  MessageCircle, 
  Eye, 
  ShoppingBag, 
  Edit3, 
  X, 
  Check, 
  Users,
  ExternalLink,
  Sparkles,
  Lock
} from 'lucide-react-native';
import { auth, db, functions, storage } from '../../src/services/firebase';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, userData, signOut, linkedProfiles, switchProfile } = useAuth();
  const { colorScheme, toggleColorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Badges & physical test states
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [latestPhysical, setLatestPhysical] = useState<any>(null);

  // Sync state with userData once it loads
  useEffect(() => {
    if (userData) {
      setName(userData.name || userData.nome || userData.displayName || '');
    }
  }, [userData]);

  // Real data mapping with robust fallbacks and URL normalization
  const displayName = userData?.name || userData?.nome || userData?.displayName || 'Aluno Kihap';
  
  let rawPhoto = userData?.photoURL || userData?.profilePicture || userData?.photoUrl || userData?.avatar;
  if (rawPhoto && rawPhoto.startsWith('/')) {
    rawPhoto = `https://kihap.com.br${rawPhoto}`;
  }
  const defaultProfileImg = require('../../assets/images/default-profile.png');
  const displayPhoto = rawPhoto && !rawPhoto.includes('default-profile.svg') ? { uri: rawPhoto } : defaultProfileImg;
  
  const displayEmail = userData?.email || user?.email || 'carregando...';
  const studentBelt = userData?.belt || userData?.graduacao || userData?.graduation || userData?.userGraduacao || 'Faixa Branca';
  const studentUnit = userData?.unidade || userData?.unit || userData?.unitName || userData?.unidadeNome || 'Kihap';
  const studentEvoId = userData?.evoMemberId || userData?.matricula;

  // Listen to all badges
  useEffect(() => {
    const badgesCol = collection(db, 'badges');
    const unsub = onSnapshot(badgesCol, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllBadges(list);
    }, (err) => console.log('Badges error:', err));
    return () => unsub();
  }, []);

  // Listen to latest physical test
  useEffect(() => {
    const evoId = userData?.evoMemberId;
    if (!evoId) return;

    const testsQ = query(
      collection(db, 'physicalTests'),
      where('evoMemberId', '==', evoId),
      orderBy('date', 'desc'),
      limit(1)
    );
    const unsub = onSnapshot(testsQ, (snap) => {
      if (!snap.empty) {
        setLatestPhysical(snap.docs[0].data());
      } else {
        setLatestPhysical(null);
      }
    }, (err) => console.log('Physical test error:', err));
    return () => unsub();
  }, [userData?.evoMemberId]);

  const earnedBadgesList = allBadges.filter(b => (userData?.earnedBadges || []).includes(b.id));

  // Unit WhatsApp router
  const getUnitWhatsApp = (unidadeStr?: string) => {
    const u = (unidadeStr || '').toLowerCase();
    if (u.includes('asa sul')) return '556183007146';
    if (u.includes('sudoeste')) return '556182107146';
    if (u.includes('lago sul')) return '556192028980';
    if (u.includes('noroeste')) return '556184170472';
    if (u.includes('jardim botanico')) return '556184171059';
    if (u.includes('centro')) return '554892182423';
    if (u.includes('coqueiros')) return '554896296941';
    if (u.includes('santa monica')) return '554892172423';
    if (u.includes('dourados')) return '556799597001';
    return '5548988694593';
  };

  const handleContactUnit = () => {
    const phone = getUnitWhatsApp(studentUnit);
    const msg = encodeURIComponent(`Olá! Sou o aluno ${displayName} da ${studentUnit} e gostaria de falar com a secretaria da Kihap.`);
    Linking.openURL(`https://wa.me/${phone}?text=${msg}`).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp no seu dispositivo.');
    });
  };

  const handleLogoutConfirmation = () => {
    Alert.alert(
      'Encerrar Sessão',
      'Deseja realmente sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sair', 
          style: 'destructive', 
          onPress: () => signOut?.() 
        }
      ]
    );
  };

  const handleSelectAndUploadImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à sua galeria para alterar a foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const selectedImageUri = result.assets[0].uri;
    setUploading(true);

    try {
      if (!user) {
        throw new Error('Usuário não autenticado.');
      }

      const response = await fetch(selectedImageUri);
      const blob = await response.blob();

      const filename = selectedImageUri.split('/').pop() || 'profile.jpg';
      const storageRef = ref(storage, `profile_pictures/${user.uid}/${Date.now()}_${filename}`);

      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { photoURL: downloadURL });

      Alert.alert('Sucesso', 'Foto de perfil atualizada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao atualizar foto de perfil:', err);
      Alert.alert('Erro ao atualizar foto', err.message || 'Ocorreu um erro ao enviar a imagem.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!name.trim()) {
      Alert.alert('Erro', 'O nome completo não pode estar vazio.');
      return;
    }

    if (password && password.length < 6) {
      Alert.alert('Erro', 'A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoadingSubmit(true);

    try {
      // 1. Sync with EVO API if evoMemberId is present
      if (userData?.evoMemberId) {
        try {
          const updateMemberData = httpsCallable(functions, 'updateMemberData');
          const nameParts = name.trim().split(' ');
          const firstName = nameParts.shift() || '';
          const lastName = nameParts.join(' ');

          await updateMemberData({
            memberId: userData.evoMemberId,
            updatedData: { firstName, lastName }
          });
        } catch (evoErr) {
          console.error("Erro ao sincronizar com a API EVO:", evoErr);
          throw new Error(`Erro ao atualizar dados na EVO: ${evoErr instanceof Error ? evoErr.message : String(evoErr)}`);
        }
      }

      // 2. Update Firestore
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { name: name.trim() });
      } else {
        throw new Error('Usuário não autenticado no Firebase Firestore.');
      }

      // 3. Update password in Firebase Auth (if provided)
      if (password) {
        const currentFirebaseUser = (auth as any)?.currentUser;
        if (currentFirebaseUser) {
          await updatePassword(currentFirebaseUser, password);
        } else {
          throw new Error('Usuário não autenticado no Firebase Auth.');
        }
      }

      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
      setPassword('');
      setEditModalVisible(false);
    } catch (err: any) {
      console.error('Erro ao salvar alterações:', err);
      let errorMsg = err.message || 'Ocorreu um erro desconhecido.';
      
      if (err.code === 'auth/requires-recent-login') {
        errorMsg = 'Para sua segurança, a alteração de senha exige que você tenha feito login recentemente. Por favor, saia da conta e faça login novamente para realizar esta alteração.';
      }
      
      Alert.alert('Erro ao atualizar perfil', errorMsg);
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <View className="flex-1 bg-[#fbfbfa] dark:bg-[#0a0a0a]">
      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        <View style={{ paddingTop: insets.top }}>
          {/* Header Screen Title with Neue Machina */}
          <View className="flex-row items-center justify-between px-6 pt-5 pb-3">
            <View>
              <Text 
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-[11px] uppercase tracking-[3px] text-[#eab308] dark:text-[#f59e0b]"
              >
                KIHAP MARTIAL ARTS
              </Text>
              <Text 
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-3xl text-gray-900 dark:text-white tracking-tight mt-0.5"
              >
                MEU PERFIL
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setEditModalVisible(true)}
              className="w-11 h-11 bg-white dark:bg-[#161616] rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-sm items-center justify-center active:scale-95"
              accessibilityLabel="Editar perfil"
            >
              <Edit3 size={19} color={isDark ? '#fff' : '#111'} />
            </TouchableOpacity>
          </View>

          {/* Linked Family Profiles Selector (if multiple accounts linked) */}
          {linkedProfiles && linkedProfiles.length > 0 && (
            <View className="px-6 mb-4 mt-1">
              <View className="bg-white dark:bg-[#161616] p-3.5 rounded-3xl border border-gray-200/60 dark:border-white/5 shadow-sm">
                <View className="flex-row items-center justify-between mb-2.5">
                  <View className="flex-row items-center">
                    <Users size={14} color="#eab308" />
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 ml-1.5"
                    >
                      Família / Perfis Vinculados
                    </Text>
                  </View>
                  <Text className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Alternar</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  {/* Current Active User */}
                  <View className="flex-row items-center bg-[#eab308]/15 border border-[#eab308] px-3.5 py-1.5 rounded-full mr-2">
                    <Image source={displayPhoto} className="w-5 h-5 rounded-full mr-2" />
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-xs text-black dark:text-yellow-400"
                    >
                      {displayName}
                    </Text>
                    <Check size={12} color="#eab308" style={{ marginLeft: 6 }} />
                  </View>
                  {/* Linked Dependents */}
                  {linkedProfiles.map((p) => {
                    let pPhoto = p.photoURL || p.profilePicture;
                    if (pPhoto && pPhoto.startsWith('/')) pPhoto = `https://kihap.com.br${pPhoto}`;
                    const pImg = pPhoto ? { uri: pPhoto } : defaultProfileImg;
                    return (
                      <TouchableOpacity
                        key={p.uid}
                        onPress={() => switchProfile(p.uid)}
                        className="flex-row items-center bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3.5 py-1.5 rounded-full mr-2 active:scale-95"
                      >
                        <Image source={pImg} className="w-5 h-5 rounded-full mr-2" />
                        <Text className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          {p.name || p.nome || 'Dependente'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Student Martial Identity Passport Hero Card — Iconic Kihap Brand (Gold & Black) */}
          <View className="px-6 mb-5">
            <View 
              className={`rounded-3xl p-6 shadow-xl relative overflow-hidden border ${
                isDark 
                  ? 'bg-[#141414] border-yellow-500/30' 
                  : 'bg-[#eab308] border-yellow-400 shadow-yellow-500/20'
              }`}
            >
              {/* Card Top Row: Status (left) & Matrícula (right) */}
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <View className={`w-2 h-2 rounded-full mr-1.5 ${isDark ? 'bg-emerald-400' : 'bg-black'}`} />
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className={`text-[10px] uppercase tracking-widest ${
                      isDark ? 'text-emerald-400' : 'text-black/85'
                    }`}
                  >
                    Aluno Ativo
                  </Text>
                </View>
                {studentEvoId && (
                  <View className={`px-2.5 py-0.5 rounded-full ${isDark ? 'bg-white/10' : 'bg-black/10'}`}>
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className={`text-[9px] uppercase tracking-widest ${
                        isDark ? 'text-yellow-500' : 'text-black'
                      }`}
                    >
                      MATRÍCULA #{studentEvoId}
                    </Text>
                  </View>
                )}
              </View>

              {/* Card Center: Avatar + Info */}
              <View className="flex-row items-center">
                {/* Avatar with Camera badge */}
                <View className="relative">
                  <View 
                    className={`w-22 h-22 rounded-full overflow-hidden border-3 shadow-lg ${
                      isDark ? 'border-yellow-500/40 bg-gray-800' : 'border-black bg-white'
                    }`}
                    style={{ width: 88, height: 88 }}
                  >
                    <Image 
                      source={displayPhoto} 
                      className={`w-full h-full object-cover ${uploading ? 'opacity-40' : ''}`}
                    />
                  </View>
                  <TouchableOpacity 
                    onPress={handleSelectAndUploadImage}
                    disabled={uploading}
                    className={`absolute bottom-0 right-0 w-7 h-7 rounded-full items-center justify-center border-2 shadow-lg active:scale-90 ${
                      isDark ? 'bg-[#eab308] border-black' : 'bg-black border-white'
                    }`}
                    accessibilityLabel="Alterar foto de perfil"
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color={isDark ? '#000' : '#fff'} />
                    ) : (
                      <Camera size={13} color={isDark ? '#000' : '#fff'} />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Identity Info */}
                <View className="flex-1 ml-4">
                  <Text 
                    numberOfLines={1} 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className={`text-2xl uppercase leading-tight ${
                      isDark ? 'text-white' : 'text-black'
                    }`}
                  >
                    {displayName}
                  </Text>

                  {/* Belt Tag & Unit Tag */}
                  <View className="flex-row items-center mt-2 flex-wrap gap-1.5">
                    {/* Belt Badge */}
                    <View 
                      className={`px-3 py-1 rounded-xl flex-row items-center ${
                        isDark 
                          ? 'bg-yellow-500/15 border border-yellow-500/30' 
                          : 'bg-black border border-black'
                      }`}
                    >
                      <Text 
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className={`text-[11px] uppercase tracking-wider ${
                          isDark ? 'text-yellow-400' : 'text-yellow-400'
                        }`}
                      >
                        {studentBelt}
                      </Text>
                    </View>

                    {/* Unit Pill */}
                    <View 
                      className={`px-2.5 py-1 rounded-xl flex-row items-center ${
                        isDark 
                          ? 'bg-white/5 border border-white/10' 
                          : 'bg-black/10 border border-black/15'
                      }`}
                    >
                      <MapPin size={10} color={isDark ? '#ef4444' : '#000'} fill={isDark ? '#ef4444' : '#000'} />
                      <Text 
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className={`text-[10px] uppercase ml-1 ${
                          isDark ? 'text-gray-300' : 'text-black'
                        }`}
                      >
                        {studentUnit}
                      </Text>
                    </View>
                  </View>

                  {/* Email */}
                  <Text 
                    numberOfLines={1} 
                    className={`text-[11px] font-medium mt-2 ${
                      isDark ? 'text-gray-400' : 'text-black/70'
                    }`}
                  >
                    {displayEmail}
                  </Text>
                </View>
              </View>

              {/* Edit info action button */}
              <TouchableOpacity
                onPress={() => setEditModalVisible(true)}
                className={`mt-5 w-full py-3 rounded-2xl items-center justify-center flex-row active:scale-[0.99] shadow-md ${
                  isDark 
                    ? 'bg-yellow-500/15 border border-yellow-500/30' 
                    : 'bg-black border border-black'
                }`}
              >
                <Edit3 size={13} color={isDark ? '#eab308' : '#ffffff'} style={{ marginRight: 6 }} />
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className={`text-[11px] uppercase tracking-wider ${
                    isDark ? 'text-yellow-400' : 'text-white'
                  }`}
                >
                  EDITAR DADOS & SENHA
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Stats Grid (4 Metrics with Neue Machina) */}
          <View className="px-6 mb-6">
            <View className="flex-row justify-between">
              {/* Presenças / Aulas */}
              <View className="w-[23%] bg-white dark:bg-[#141414] p-3 rounded-2xl border border-gray-200/80 dark:border-white/5 shadow-sm items-center">
                <View className="w-8 h-8 rounded-xl bg-yellow-500/10 items-center justify-center mb-1.5">
                  <ShieldCheck size={16} color="#eab308" />
                </View>
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-lg text-gray-900 dark:text-white leading-tight"
                >
                  {userData?.totalAulas || userData?.totalAttendances || userData?.attendancesCount || userData?.currentStreak || 0}
                </Text>
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-[8px] uppercase tracking-widest text-gray-400 text-center mt-0.5"
                >
                  Aulas
                </Text>
              </View>

              {/* Emblemas Conquistados */}
              <View className="w-[23%] bg-white dark:bg-[#141414] p-3 rounded-2xl border border-gray-200/80 dark:border-white/5 shadow-sm items-center">
                <View className="w-8 h-8 rounded-xl bg-yellow-500/10 items-center justify-center mb-1.5">
                  <Award size={16} color="#eab308" />
                </View>
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-lg text-gray-900 dark:text-white leading-tight"
                >
                  {earnedBadgesList.length}
                </Text>
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-[8px] uppercase tracking-widest text-gray-400 text-center mt-0.5"
                >
                  Emblemas
                </Text>
              </View>

              {/* Último Teste Físico */}
              <View className="w-[23%] bg-white dark:bg-[#141414] p-3 rounded-2xl border border-gray-200/80 dark:border-white/5 shadow-sm items-center">
                <View className="w-8 h-8 rounded-xl bg-red-500/10 items-center justify-center mb-1.5">
                  <Trophy size={16} color="#ef4444" />
                </View>
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-lg text-gray-900 dark:text-white leading-tight"
                >
                  {latestPhysical?.score !== undefined ? latestPhysical.score : '--'}
                </Text>
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-[8px] uppercase tracking-widest text-gray-400 text-center mt-0.5"
                >
                  Teste Fís.
                </Text>
              </View>

              {/* Kihapcoins */}
              <View className="w-[23%] bg-white dark:bg-[#141414] p-3 rounded-2xl border border-gray-200/80 dark:border-white/5 shadow-sm items-center">
                <View className="w-8 h-8 rounded-xl bg-amber-500/10 items-center justify-center mb-1.5">
                  <Sparkles size={16} color="#f59e0b" />
                </View>
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-lg text-[#eab308] leading-tight"
                >
                  {userData?.totalFitCoins || userData?.kihapcoins || userData?.fitCoins || 0}
                </Text>
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-[8px] uppercase tracking-widest text-gray-400 text-center mt-0.5"
                >
                  Coins
                </Text>
              </View>
            </View>
          </View>

          {/* Badges Preview Carousel / Grid */}
          {earnedBadgesList.length > 0 && (
            <View className="px-6 mb-6">
              <View className="bg-white dark:bg-[#141414] p-5 rounded-3xl border border-gray-200/80 dark:border-white/5 shadow-sm">
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center">
                    <View className="w-8 h-8 rounded-xl bg-yellow-500/10 items-center justify-center mr-2.5">
                      <Award size={16} color="#eab308" />
                    </View>
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-base text-gray-900 dark:text-white uppercase tracking-tight"
                    >
                      Minhas Conquistas
                    </Text>
                  </View>
                  <View className="bg-gray-100 dark:bg-white/10 px-2.5 py-1 rounded-full">
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-[10px] text-gray-600 dark:text-gray-300 uppercase"
                    >
                      {earnedBadgesList.length} {earnedBadgesList.length === 1 ? 'emblema' : 'emblemas'}
                    </Text>
                  </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-3">
                  {earnedBadgesList.map((badge) => {
                    let badgeImage = badge.imageUrl || '';
                    if (badgeImage && badgeImage.startsWith('/')) {
                      badgeImage = `https://kihap.com.br${badgeImage}`;
                    }
                    return (
                      <TouchableOpacity
                        key={badge.id}
                        onPress={() => Alert.alert(badge.name, badge.description || 'Emblema conquistado com sucesso!')}
                        className="items-center mr-3 active:scale-95"
                        style={{ width: 72 }}
                      >
                        <View className="w-14 h-14 bg-yellow-500/10 rounded-2xl items-center justify-center border border-yellow-500/25 mb-1.5 overflow-hidden">
                          {badgeImage ? (
                            <Image source={{ uri: badgeImage }} className="w-full h-full object-contain" resizeMode="contain" />
                          ) : (
                            <Award size={24} color="#eab308" />
                          )}
                        </View>
                        <Text numberOfLines={1} className="text-[10px] font-bold text-gray-700 dark:text-gray-300 text-center">
                          {badge.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Grouped Settings Menu (Apple iOS Style with Neue Machina headers) */}
          <View className="px-6 mb-4">
            <Text 
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 ml-1"
            >
              Matrícula & Benefícios
            </Text>
            
            <View className="bg-white dark:bg-[#141414] rounded-3xl border border-gray-200/80 dark:border-white/5 shadow-sm overflow-hidden">
              {/* Plano & Assinatura */}
              <TouchableOpacity 
                onPress={() => router.push('/assinatura')}
                className="flex-row items-center p-4 border-b border-gray-100 dark:border-white/5 active:bg-gray-50 dark:active:bg-white/5"
              >
                <View className="w-10 h-10 rounded-2xl bg-yellow-500/10 items-center justify-center mr-3.5">
                  <CreditCard size={18} color="#eab308" />
                </View>
                <View className="flex-1">
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-sm text-gray-900 dark:text-white uppercase tracking-tight"
                  >
                    Plano & Assinatura
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {userData?.planName || userData?.plano || 'Consultar plano ativo e mensalidades'}
                  </Text>
                </View>
                <ChevronRight size={18} color={isDark ? '#666' : '#bbb'} />
              </TouchableOpacity>

              {/* Meus Pedidos & Eventos */}
              <TouchableOpacity 
                onPress={() => router.push('/pedidos')}
                className="flex-row items-center p-4 active:bg-gray-50 dark:active:bg-white/5"
              >
                <View className="w-10 h-10 rounded-2xl bg-yellow-500/10 items-center justify-center mr-3.5">
                  <ShoppingBag size={18} color="#eab308" />
                </View>
                <View className="flex-1">
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-sm text-gray-900 dark:text-white uppercase tracking-tight"
                  >
                    Meus Pedidos & Eventos
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Histórico de compras e inscrições em exames
                  </Text>
                </View>
                <ChevronRight size={18} color={isDark ? '#666' : '#bbb'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Group 2: Unidade & Academia */}
          <View className="px-6 mb-4">
            <Text 
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 ml-1"
            >
              Academia & Treinos
            </Text>

            <View className="bg-white dark:bg-[#141414] rounded-3xl border border-gray-200/80 dark:border-white/5 shadow-sm overflow-hidden">
              {/* Contato WhatsApp da Unidade */}
              <TouchableOpacity 
                onPress={handleContactUnit}
                className="flex-row items-center p-4 border-b border-gray-100 dark:border-white/5 active:bg-gray-50 dark:active:bg-white/5"
              >
                <View className="w-10 h-10 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3.5">
                  <MessageCircle size={18} color="#10b981" />
                </View>
                <View className="flex-1">
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-sm text-gray-900 dark:text-white uppercase tracking-tight"
                  >
                    Falar com a Secretaria
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    WhatsApp oficial da {studentUnit}
                  </Text>
                </View>
                <ExternalLink size={16} color={isDark ? '#666' : '#bbb'} />
              </TouchableOpacity>

              {/* Grade de Horários */}
              <TouchableOpacity 
                onPress={() => router.push('/calendario')}
                className="flex-row items-center p-4 active:bg-gray-50 dark:active:bg-white/5"
              >
                <View className="w-10 h-10 rounded-2xl bg-yellow-500/10 items-center justify-center mr-3.5">
                  <Calendar size={18} color="#eab308" />
                </View>
                <View className="flex-1">
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-sm text-gray-900 dark:text-white uppercase tracking-tight"
                  >
                    Grade de Horários & Aulas
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Ver dias e horários dos treinos da semana
                  </Text>
                </View>
                <ChevronRight size={18} color={isDark ? '#666' : '#bbb'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Group 3: Preferências & Sistema */}
          <View className="px-6 mb-8">
            <Text 
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 ml-1"
            >
              Preferências & Segurança
            </Text>

            <View className="bg-white dark:bg-[#141414] rounded-3xl border border-gray-200/80 dark:border-white/5 shadow-sm overflow-hidden">
              {/* Tema Escuro / Claro */}
              <View className="flex-row items-center justify-between p-4 border-b border-gray-100 dark:border-white/5">
                <View className="flex-row items-center flex-1 mr-3">
                  <View className="w-10 h-10 rounded-2xl bg-yellow-500/10 items-center justify-center mr-3.5">
                    {isDark ? <Moon size={18} color="#eab308" /> : <Sun size={18} color="#eab308" />}
                  </View>
                  <View className="flex-1">
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-sm text-gray-900 dark:text-white uppercase tracking-tight"
                    >
                      Modo Escuro
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {isDark ? 'Tema escuro ativado' : 'Tema claro ativado'}
                    </Text>
                  </View>
                </View>
                <Switch 
                  value={isDark} 
                  onValueChange={() => {
                    if (toggleColorScheme) {
                      toggleColorScheme();
                    } else if (setColorScheme) {
                      setColorScheme(isDark ? 'light' : 'dark');
                    }
                  }}
                  trackColor={{ false: '#e2e8f0', true: '#000000' }}
                  thumbColor={isDark ? '#eab308' : '#ffffff'}
                />
              </View>

              {/* Sair da Conta */}
              <TouchableOpacity 
                onPress={handleLogoutConfirmation}
                className="flex-row items-center p-4 active:bg-red-50 dark:active:bg-red-950/20"
              >
                <View className="w-10 h-10 rounded-2xl bg-red-500/10 items-center justify-center mr-3.5">
                  <LogOut size={18} color="#ef4444" />
                </View>
                <View className="flex-1">
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-sm text-red-500 uppercase tracking-tight"
                  >
                    Encerrar Sessão
                  </Text>
                  <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Desconectar este dispositivo
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Modern Edit Profile Modal / Bottom Sheet */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View 
            style={{ paddingBottom: Math.max(insets.bottom, 24) }}
            className="bg-white dark:bg-[#141414] rounded-t-[36px] p-6 max-h-[88%] border-t border-gray-200/80 dark:border-white/10"
          >
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-4 border-b border-gray-100 dark:border-white/5">
              <View>
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-xl text-gray-900 dark:text-white uppercase tracking-tight"
                >
                  Editar Informações
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Atualize seu nome ou altere sua senha de acesso
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setEditModalVisible(false)}
                className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/10 items-center justify-center"
              >
                <X size={18} color={isDark ? '#fff' : '#333'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="pt-4">
              {/* Photo Change Banner in Modal */}
              <View className="items-center mb-6">
                <View className="relative">
                  <Image source={displayPhoto} className="w-20 h-20 rounded-full border-2 border-yellow-500/40" />
                  <TouchableOpacity 
                    onPress={handleSelectAndUploadImage}
                    disabled={uploading}
                    className="absolute inset-0 bg-black/40 rounded-full items-center justify-center"
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Camera size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={handleSelectAndUploadImage} className="mt-2">
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-xs text-black dark:text-yellow-500 uppercase tracking-wider"
                  >
                    Toque para trocar foto
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Form inputs */}
              <View className="space-y-4">
                <View>
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2"
                  >
                    Nome Completo
                  </Text>
                  <TextInput 
                    value={name}
                    onChangeText={setName}
                    placeholder="Seu nome completo"
                    placeholderTextColor="#888"
                    className="w-full bg-gray-50 dark:bg-[#0f0f0f] border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-white font-medium"
                  />
                </View>

                <View className="mt-3">
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2"
                  >
                    E-mail Cadastrado
                  </Text>
                  <View className="w-full bg-gray-100/70 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl px-4 py-3.5 flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {displayEmail}
                    </Text>
                    <Lock size={14} color="#999" />
                  </View>
                  <Text className="text-[10px] text-gray-400 mt-1 ml-1">
                    O e-mail é vinculado à sua matrícula EVO e não pode ser alterado por aqui.
                  </Text>
                </View>

                <View className="mt-3">
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2"
                  >
                    Nova Senha de Acesso
                  </Text>
                  <TextInput 
                    placeholder="Deixe em branco para manter a atual"
                    placeholderTextColor="#888"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    className="w-full bg-gray-50 dark:bg-[#0f0f0f] border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3.5 text-base text-gray-900 dark:text-white font-medium"
                  />
                </View>

                {/* Save button */}
                <TouchableOpacity 
                  onPress={handleSaveChanges}
                  disabled={loadingSubmit}
                  className="bg-black dark:bg-[#eab308] py-4 rounded-2xl items-center justify-center mt-6 shadow-md active:scale-[0.98]"
                >
                  {loadingSubmit ? (
                    <ActivityIndicator color={isDark ? '#000' : '#fff'} />
                  ) : (
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-white dark:text-black uppercase tracking-widest text-xs"
                    >
                      Salvar Alterações
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setEditModalVisible(false)}
                  className="py-3 items-center justify-center mb-6"
                >
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider"
                  >
                    Cancelar
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}