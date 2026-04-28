import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { auth } from '../../src/services/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';

const MASCOTS = [
  'arara.png', 'borboleta.png', 'fenix.png', 'girafa.png', 
  'jacare.png', 'leao.png', 'macaco.png', 'panda.png'
];

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mascot, setMascot] = useState(MASCOTS[0]);
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    const randomMascot = MASCOTS[Math.floor(Math.random() * MASCOTS.length)];
    setMascot(randomMascot);
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Preencha todos os campos.');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error(err);
      setError('Credenciais incorretas.');
    }
  };

  const isDark = colorScheme === 'dark';

  return (
    <View className="flex-1 bg-gray-50 dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Background Glows (Subtle in light mode) */}
      <View className="absolute top-[-50] right-[-50] w-64 h-64 bg-[#014fa4] rounded-full opacity-10 dark:opacity-20 blur-[100px]" />
      <View className="absolute bottom-[-50] left-[-50] w-64 h-64 bg-[#014fa4] rounded-full opacity-5 dark:opacity-10 blur-[100px]" />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 justify-center px-6">
            
            <View className="relative w-full max-w-[400px] self-center">
              
              {/* Mascot */}
              <View className="absolute top-[-70] right-0 w-28 h-28 z-20">
                <Image 
                  source={{ uri: `https://kihap.com.br/imgs/personagens/${mascot}` }} 
                  className="w-full h-full"
                  resizeMode="contain"
                />
              </View>

              {/* Login Card */}
              <View className="bg-white dark:bg-[#1a1a1a]/80 p-8 rounded-[32px] shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
                
                {/* Logo */}
                <View className="items-center mb-8">
                  <Image 
                    source={{ uri: isDark ? 'https://kihap.com.br/wp-content/uploads/2021/02/logo-wh.png' : 'https://kihap.com.br/imgs/logo.png' }} 
                    className="w-40 h-10"
                    resizeMode="contain"
                  />
                </View>

                {error ? (
                  <View className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-6">
                    <Text className="text-red-500 text-center text-xs font-bold">{error}</Text>
                  </View>
                ) : null}

                <View className="space-y-4">
                  <View>
                    <Text className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Email</Text>
                    <TextInput
                      className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 rounded-xl text-gray-900 dark:text-white text-[16px]"
                      placeholder="seu@email.com"
                      placeholderTextColor={isDark ? '#666' : '#999'}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>

                  <View className="mt-4">
                    <Text className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Senha</Text>
                    <TextInput
                      className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 rounded-xl text-gray-900 dark:text-white text-[16px]"
                      placeholder="Sua senha"
                      placeholderTextColor={isDark ? '#666' : '#999'}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                  </View>

                  <TouchableOpacity className="items-end mt-2 mb-6">
                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-tighter">Esqueceu a senha?</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={handleLogin}
                    className="bg-[#014fa4] p-5 rounded-2xl items-center shadow-lg shadow-blue-500/20 active:opacity-90"
                  >
                    <Text className="text-white font-extrabold text-sm uppercase tracking-widest">Entrar</Text>
                  </TouchableOpacity>
                </View>

                <View className="pt-8 mt-4 border-t border-gray-100 dark:border-white/5 items-center">
                  <Text className="text-gray-400 dark:text-gray-600 text-[9px] font-bold uppercase tracking-widest">
                    Área Restrita Kihap
                  </Text>
                </View>
              </View>

              <View className="mt-8 items-center opacity-40">
                <Text className="text-gray-500 dark:text-gray-400 text-[9px] font-bold uppercase tracking-widest">
                  © 2026 Kihap Martial Arts
                </Text>
              </View>

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
