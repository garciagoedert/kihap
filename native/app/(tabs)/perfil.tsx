import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { Settings, Camera, Mail, LogOut, ChevronRight, CreditCard, User } from 'lucide-react-native';

export default function ProfileScreen() {
  const { userData, signOut } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // Real data mapping with robust fallbacks and URL normalization
  const displayName = userData?.name || userData?.nome || userData?.displayName || 'Aluno';
  
  let rawPhoto = userData?.photoURL || userData?.profilePicture || userData?.photoUrl || userData?.avatar;
  // Handle relative paths from portal
  if (rawPhoto && rawPhoto.startsWith('/')) {
    rawPhoto = `https://kihap.com.br${rawPhoto}`;
  }
  const displayPhoto = rawPhoto || 'https://kihap.com.br/intranet/default-profile.svg';
  
  const displayEmail = userData?.email || 'carregando...';

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
                      source={{ uri: displayPhoto }} 
                      className="w-full h-full object-cover"
                    />
                  </View>
                  <TouchableOpacity className="absolute inset-0 bg-black/40 rounded-full items-center justify-center">
                    <Camera size={24} color="white" />
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

                <TouchableOpacity 
                  onPress={() => signOut?.()}
                  className="mt-6 w-full py-4 border border-red-500/20 bg-red-500/10 rounded-2xl items-center justify-center flex-row space-x-2"
                >
                  <LogOut size={18} color="#ef4444" />
                  <Text className="text-red-500 font-black uppercase tracking-widest text-[10px]">Sair da Conta</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Form Section */}
            <View className="bg-white dark:bg-[#1a1a1a] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-white/5 mb-8">
              <Text className="text-lg font-black text-gray-900 dark:text-white mb-6">Editar Informações</Text>
              
              <View className="space-y-4">
                <View>
                  <Text className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nome Completo</Text>
                  <TextInput 
                    value={displayName}
                    className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 text-[16px] text-gray-900 dark:text-white font-medium"
                  />
                </View>
                <View>
                  <Text className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nova Senha</Text>
                  <TextInput 
                    placeholder="Deixe em branco para não alterar"
                    placeholderTextColor="#999"
                    secureTextEntry
                    className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 text-[16px] text-gray-900 dark:text-white font-medium"
                  />
                </View>
                <TouchableOpacity className="bg-[#014fa4] py-4 rounded-xl items-center justify-center mt-4">
                  <Text className="text-white font-black uppercase tracking-widest text-xs">Salvar Alterações</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Payment History Placeholder */}
            <View className="bg-white dark:bg-[#1a1a1a] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-white/5 mb-12">
              <Text className="text-lg font-black text-gray-900 dark:text-white mb-6">Histórico de Pagamentos</Text>
              <View className="items-center py-8">
                <CreditCard size={32} color={isDark ? '#333' : '#eee'} />
                <Text className="text-gray-400 text-sm mt-4">Nenhum pagamento registrado.</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}