import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { Settings, Camera, Mail, LogOut, ChevronRight, CreditCard, User, Flame, Trophy, Calendar } from 'lucide-react-native';
import { auth, db, functions, storage } from '../../src/services/firebase';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileScreen() {
  const { user, userData, signOut } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Sync state with userData once it loads
  useEffect(() => {
    if (userData) {
      setName(userData.name || userData.nome || userData.displayName || '');
    }
  }, [userData]);

  // Real data mapping with robust fallbacks and URL normalization
  const displayName = userData?.name || userData?.nome || userData?.displayName || 'Aluno';
  
  let rawPhoto = userData?.photoURL || userData?.profilePicture || userData?.photoUrl || userData?.avatar;
  if (rawPhoto && rawPhoto.startsWith('/')) {
    rawPhoto = `https://kihap.com.br${rawPhoto}`;
  }
  const defaultProfileImg = require('../../assets/images/default-profile.png');
  const displayPhoto = rawPhoto && !rawPhoto.includes('default-profile.svg') ? { uri: rawPhoto } : defaultProfileImg;
  
  const displayEmail = userData?.email || 'carregando...';

  const handleSelectAndUploadImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à sua galeria para alterar a foto.');
      return;
    }

    // Launch image picker
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

      // Convert local URI to Blob (required for Firebase JS SDK in React Native)
      const response = await fetch(selectedImageUri);
      const blob = await response.blob();

      // Define reference path
      const filename = selectedImageUri.split('/').pop() || 'profile.jpg';
      const storageRef = ref(storage, `profile_pictures/${user.uid}/${Date.now()}_${filename}`);

      // Upload to Storage
      await uploadBytes(storageRef, blob);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update Firestore user document
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
        if (auth.currentUser) {
          await updatePassword(auth.currentUser, password);
        } else {
          throw new Error('Usuário não autenticado no Firebase Auth.');
        }
      }

      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
      setPassword(''); // Clear password field
    } catch (err: any) {
      console.error('Erro ao salvar alterações:', err);
      let errorMsg = err.message || 'Ocorreu um erro desconhecido.';
      
      // Specially handle recent login requirement for password update
      if (err.code === 'auth/requires-recent-login') {
        errorMsg = 'Para sua segurança, a alteração de senha exige que você tenha feito login recentemente. Por favor, saia da conta e faça login novamente para realizar esta alteração.';
      }
      
      Alert.alert('Erro ao atualizar perfil', errorMsg);
    } finally {
      setLoadingSubmit(false);
    }
  };

  const getStreakStatus = () => {
    const lastDateStr = userData?.lastAttendanceDate;
    if (!lastDateStr) {
      return {
        message: "Faça seu primeiro check-in de aula para iniciar sua ofensiva! 🥋",
        urgencyColor: "text-blue-500",
        bgClass: "bg-blue-500/10 border-blue-500/20"
      };
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    if (lastDateStr === todayStr) {
      return {
        message: "Excelente! Você fez aula hoje. Ofensiva garantida por mais 5 dias! 🛡️",
        urgencyColor: "text-emerald-500",
        bgClass: "bg-emerald-500/10 border-emerald-500/20"
      };
    }

    const lastDate = new Date(lastDateStr + 'T12:00:00');
    const todayDate = new Date(todayStr + 'T12:00:00');
    const diffTime = todayDate.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const daysRemaining = 5 - diffDays;

    if (daysRemaining > 1) {
      return {
        message: `Faltam ${daysRemaining} dias para fazer aula e manter sua chama acesa! ⏳`,
        urgencyColor: "text-orange-500",
        bgClass: "bg-orange-500/10 border-orange-500/20"
      };
    } else if (daysRemaining === 1) {
      return {
        message: "Atenção: Você tem apenas 1 dia para fazer aula ou sua ofensiva será zerada! ⚠️",
        urgencyColor: "text-rose-500",
        bgClass: "bg-rose-500/10 border-rose-500/20"
      };
    } else {
      return {
        message: "Sua ofensiva expirou. Faça check-in na próxima aula para recomeçar! 🔄",
        urgencyColor: "text-gray-500",
        bgClass: "bg-gray-500/10 border-gray-500/20"
      };
    }
  };

  return (
    <View className="flex-1 bg-gray-50 dark:bg-[#0a0a0a]">
      <ScrollView className="flex-1">
        <View style={{ paddingTop: insets.top }}>
          <View className="px-6 pt-8 pb-4">
            <Text className="text-2xl font-black text-gray-900 dark:text-white mb-6">Editar Perfil</Text>

            {/* Profile Info Card (Matching perfil.html) */}
            <View className="bg-white dark:bg-[#1a1a1a] p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 mb-8">
              <View className="items-center">
                <View className="relative group">
                  <View className="w-32 h-32 rounded-full overflow-hidden border-4 border-yellow-500/20">
                    <Image 
                      source={displayPhoto} 
                      className={`w-full h-full object-cover ${uploading ? 'opacity-50' : ''}`}
                    />
                  </View>
                  <TouchableOpacity 
                    onPress={handleSelectAndUploadImage}
                    disabled={uploading}
                    className="absolute inset-0 bg-black/40 rounded-full items-center justify-center"
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Camera size={24} color="white" />
                    )}
                  </TouchableOpacity>
                </View>

                <View className="items-center mt-6">
                  <Text className="text-2xl font-black text-gray-900 dark:text-white mb-2">{displayName}</Text>
                  <View className="flex-row items-center space-x-2">
                    <Mail size={16} color="#eab308" />
                    <Text className="text-gray-500 dark:text-gray-400 text-base">{displayEmail}</Text>
                  </View>
                  <Text className="text-gray-400 text-xs mt-2">Clique na foto para alterar</Text>
                </View>

                {/* Duolingo Streak Element */}
                {userData?.currentStreak > 0 && (
                  <View className="mt-4 flex-row items-center bg-orange-500/10 px-4 py-2 rounded-2xl border border-orange-500/20">
                    <Text className="text-orange-500 text-lg font-black mr-1.5">🔥 {userData.currentStreak}</Text>
                    <Text className="text-orange-500 text-xs font-bold uppercase tracking-wider">
                      {userData.currentStreak === 1 ? 'Dia de Ofensiva!' : 'Dias de Ofensiva!'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Estatísticas de Ofensiva (Duolingo Style Panel) */}
            <View className="bg-white dark:bg-[#1a1a1a] p-6 rounded-3xl border border-gray-100 dark:border-white/5 mb-8 shadow-xl">
              <Text className="text-lg font-black text-gray-900 dark:text-white mb-4 uppercase tracking-tighter">
                🏆 Minhas Ofensivas
              </Text>
              
              <View className="flex-row justify-between">
                {/* Card Ofensiva Atual */}
                <View className="w-[48%] bg-orange-500/5 dark:bg-orange-500/10 p-4 rounded-2xl border border-orange-500/20 items-center justify-center">
                  <Flame size={32} color="#f97316" />
                  <Text className="text-3xl font-black text-orange-500 mt-2">
                    {userData?.currentStreak || 0}
                  </Text>
                  <Text className="text-[10px] font-black text-orange-500 uppercase tracking-widest mt-1 text-center">
                    Ofensiva Atual
                  </Text>
                </View>

                {/* Card Recorde de Ofensiva */}
                <View className="w-[48%] bg-yellow-500/5 dark:bg-yellow-500/10 p-4 rounded-2xl border border-yellow-500/20 items-center justify-center">
                  <Trophy size={32} color="#eab308" />
                  <Text className="text-3xl font-black text-[#eab308] mt-2">
                    {userData?.longestStreak || 0}
                  </Text>
                  <Text className="text-[10px] font-black text-yellow-600 dark:text-yellow-500 uppercase tracking-widest mt-1 text-center">
                    Recorde Máximo
                  </Text>
                </View>
              </View>

              {/* Status e Mensagem de Urgência */}
              {(() => {
                const status = getStreakStatus();
                return (
                  <View className={`mt-4 p-4 rounded-2xl border flex-row items-center ${status.bgClass}`}>
                    <View style={{ marginRight: 12 }}>
                      <Calendar size={20} color={status.urgencyColor.includes('emerald') ? '#10b981' : status.urgencyColor.includes('rose') ? '#f43f5e' : '#f97316'} />
                    </View>
                    <Text className={`text-xs font-bold leading-relaxed flex-1 ${status.urgencyColor}`}>
                      {status.message}
                    </Text>
                  </View>
                );
              })()}
            </View>

            {/* Form Section */}
            <View className="bg-white dark:bg-[#1a1a1a] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-white/5 mb-8">
              <Text className="text-lg font-black text-gray-900 dark:text-white mb-6">Editar Informações</Text>
              
              <View className="space-y-4">
                <View>
                  <Text className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nome Completo</Text>
                  <TextInput 
                    value={name}
                    onChangeText={setName}
                    className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 text-[16px] text-gray-900 dark:text-white font-medium"
                  />
                </View>
                <View>
                  <Text className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nova Senha</Text>
                  <TextInput 
                    placeholder="Deixe em branco para não alterar"
                    placeholderTextColor="#999"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 text-[16px] text-gray-900 dark:text-white font-medium"
                  />
                </View>
                <TouchableOpacity 
                  onPress={handleSaveChanges}
                  disabled={loadingSubmit}
                  className="bg-[#014fa4] py-4 rounded-xl items-center justify-center mt-4"
                >
                  {loadingSubmit ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-black uppercase tracking-widest text-xs">Salvar Alterações</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Payment History Placeholder */}
            <View className="bg-white dark:bg-[#1a1a1a] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-white/5 mb-8">
              <Text className="text-lg font-black text-gray-900 dark:text-white mb-6">Histórico de Pagamentos</Text>
              <View className="items-center py-8">
                <CreditCard size={32} color={isDark ? '#333' : '#eee'} />
                <Text className="text-gray-400 text-sm mt-4">Nenhum pagamento registrado.</Text>
              </View>
            </View>

            <TouchableOpacity 
              onPress={() => signOut?.()}
              className="mb-12 w-full py-4 border border-red-500/20 bg-red-500/10 rounded-2xl items-center justify-center flex-row"
            >
              <LogOut size={18} color="#ef4444" style={{ marginRight: 8 }} />
              <Text className="text-red-500 font-black uppercase tracking-widest text-[10px]">Sair da Conta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}