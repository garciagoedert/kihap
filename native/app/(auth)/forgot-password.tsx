import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { auth, functions, db } from '../../src/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { ArrowLeft } from 'lucide-react-native';

const MASCOTS = [
  'arara.png', 'borboleta.png', 'fenix.png', 'girafa.png', 
  'jacare.png', 'leao.png', 'macaco.png', 'panda.png'
];

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState(1); // 1: Email, 2: New Password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [studentData, setStudentData] = useState<any>(null);
  const [mascot, setMascot] = useState(MASCOTS[0]);
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    const randomMascot = MASCOTS[Math.floor(Math.random() * MASCOTS.length)];
    setMascot(randomMascot);
  }, []);

  const handleVerifyEmail = async () => {
    if (!email) {
      setError('Por favor, insira um e-mail.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const getStudentDataByEmail = httpsCallable(functions, 'getStudentDataByEmail');
      const result: any = await getStudentDataByEmail({ email: email.trim() });
      
      if (result.data.exists) {
        setStudentData(result.data);
        setStep(2);
        setSuccess('E-mail verificado! Agora, crie sua nova senha.');
      } else {
        setError('O e-mail não foi encontrado em nosso sistema.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Erro ao verificar e-mail. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const setStudentPassword = httpsCallable(functions, 'setStudentPassword');
      await setStudentPassword({ ...studentData, newPassword: password });
      
      setSuccess('Senha definida com sucesso! Fazendo login...');
      
      // Auto login
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao definir senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const isDark = colorScheme === 'dark';

  return (
    <View className="flex-1 bg-gray-50 dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Background Glows */}
      <View className="absolute top-[-50] right-[-50] w-64 h-64 bg-[#014fa4] rounded-full opacity-10 dark:opacity-20 blur-[100px]" />
      <View className="absolute bottom-[-50] left-[-50] w-64 h-64 bg-[#014fa4] rounded-full opacity-5 dark:opacity-10 blur-[100px]" />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 justify-center px-6">
            
            <View className="relative w-full max-w-[400px] self-center">
              
              {/* Back Button */}
              <TouchableOpacity 
                onPress={() => router.back()}
                className="absolute top-[-100] left-0 p-2 rounded-full bg-white dark:bg-[#1a1a1a] shadow-sm z-30"
              >
                <ArrowLeft size={20} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>

              {/* Mascot */}
              <View className="absolute top-[-70] right-0 w-28 h-28 z-20">
                <Image 
                  source={{ uri: `https://kihap.com.br/imgs/personagens/${mascot}` }} 
                  className="w-full h-full"
                  resizeMode="contain"
                />
              </View>

              {/* Card */}
              <View className="bg-white dark:bg-[#1a1a1a]/80 p-8 rounded-[32px] shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
                
                {/* Header */}
                <View className="items-center mb-8">
                  <Image 
                    source={{ uri: isDark ? 'https://kihap.com.br/wp-content/uploads/2021/02/logo-wh.png' : 'https://kihap.com.br/imgs/logo.png' }} 
                    className="w-40 h-10 mb-4"
                    resizeMode="contain"
                  />
                  <Text className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest text-center">
                    Recuperar Senha
                  </Text>
                </View>

                {error ? (
                  <View className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-6">
                    <Text className="text-red-500 text-center text-xs font-bold">{error}</Text>
                  </View>
                ) : null}

                {success ? (
                  <View className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl mb-6">
                    <Text className="text-green-500 text-center text-xs font-bold">{success}</Text>
                  </View>
                ) : null}

                {step === 1 ? (
                  <View className="space-y-4">
                    <View>
                      <Text className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Email Cadastrado</Text>
                      <TextInput
                        className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 rounded-xl text-gray-900 dark:text-white text-[16px]"
                        placeholder="seu@email.com"
                        placeholderTextColor={isDark ? '#666' : '#999'}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        editable={!loading}
                      />
                    </View>

                    <TouchableOpacity 
                      onPress={handleVerifyEmail}
                      disabled={loading}
                      className="bg-[#014fa4] p-5 rounded-2xl items-center shadow-lg shadow-blue-500/20 active:opacity-90 mt-4"
                    >
                      {loading ? (
                        <ActivityIndicator color="#white" />
                      ) : (
                        <Text className="text-white font-extrabold text-sm uppercase tracking-widest">Verificar E-mail</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="space-y-4">
                    <View>
                      <Text className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Nova Senha</Text>
                      <TextInput
                        className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 rounded-xl text-gray-900 dark:text-white text-[16px]"
                        placeholder="Mínimo 6 caracteres"
                        placeholderTextColor={isDark ? '#666' : '#999'}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        editable={!loading}
                      />
                    </View>

                    <View className="mt-4">
                      <Text className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Confirmar Senha</Text>
                      <TextInput
                        className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 rounded-xl text-gray-900 dark:text-white text-[16px]"
                        placeholder="Repita a nova senha"
                        placeholderTextColor={isDark ? '#666' : '#999'}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        editable={!loading}
                      />
                    </View>

                    <TouchableOpacity 
                      onPress={handleSetPassword}
                      disabled={loading}
                      className="bg-green-600 p-5 rounded-2xl items-center shadow-lg shadow-green-500/20 active:opacity-90 mt-6"
                    >
                      {loading ? (
                        <ActivityIndicator color="#white" />
                      ) : (
                        <Text className="text-white font-extrabold text-sm uppercase tracking-widest">Definir Senha e Acessar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

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
