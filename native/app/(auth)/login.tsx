import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  ActivityIndicator,
  StyleSheet,
  Animated,
  Easing
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { auth } from '../../src/services/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image as ExpoImage } from 'expo-image';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isFocusedEmail, setIsFocusedEmail] = useState(false);
  const [isFocusedPassword, setIsFocusedPassword] = useState(false);
  const router = useRouter();

  // Animação de rotação contínua e suave da Flor de Lótus
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;

    const runSpin = () => {
      spinAnim.setValue(0);
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 26000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && isMounted) {
          runSpin();
        }
      });
    };

    runSpin();

    return () => {
      isMounted = false;
      spinAnim.stopAnimation();
    };
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Preencha todos os campos.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error(err);
      setError('E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#f4f5f8]" style={{ overflow: 'hidden' }}>
      <StatusBar style="dark" />

      {/* Flor de Lótus Kihap no Canto Inferior Direito com Rotação Contínua */}
      <View 
        style={StyleSheet.absoluteFillObject} 
        pointerEvents="none" 
        className="overflow-hidden"
      >
        <Animated.View 
          style={{
            position: 'absolute',
            width: 450,
            height: 410,
            bottom: -190,
            right: -140,
            opacity: 0.36,
            transform: [{ rotate: spin }],
          }}
        >
          <ExpoImage 
            source={{ uri: 'https://kihap.com.br/imgs/flor-de-lotus-01.png' }}
            placeholder={require('../../assets/images/flor-de-lotus-01.png')}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </Animated.View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 justify-center px-6 py-12">
            
            <View className="w-full max-w-[400px] self-center">
              
              {/* Card de Login Claro com alta definição e sombra suave */}
              <View 
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 18 },
                  shadowOpacity: 0.08,
                  shadowRadius: 36,
                  elevation: 10,
                }}
                className="bg-white border border-gray-200/90 p-8 rounded-[36px] overflow-hidden"
              >
                {/* Logo Kihap Preto com contraste total */}
                <View className="items-center mb-8 pt-2">
                  <Image 
                    source={{ uri: 'https://kihap.com.br/imgs/logo.png' }} 
                    style={{ tintColor: '#111827' }}
                    className="w-44 h-12"
                    resizeMode="contain"
                  />
                </View>

                {/* Mensagem de Erro */}
                {error ? (
                  <View className="bg-red-50 border border-red-200 p-3.5 rounded-2xl mb-5 items-center justify-center">
                    <Text className="text-red-600 text-center text-xs font-bold">{error}</Text>
                  </View>
                ) : null}

                {/* Formulário */}
                <View className="space-y-4">
                  {/* E-mail */}
                  <View>
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-gray-700 text-[10px] uppercase tracking-widest mb-2 ml-1"
                    >
                      E-MAIL
                    </Text>
                    <View 
                      className={`flex-row items-center border rounded-2xl px-4 py-3.5 ${
                        isFocusedEmail 
                          ? 'border-yellow-500 bg-white' 
                          : 'border-gray-200 bg-[#f8f9fc]'
                      }`}
                    >
                      <Mail size={18} color={isFocusedEmail ? '#eab308' : '#6b7280'} />
                      <TextInput
                        className="flex-1 ml-3 text-gray-900 text-[15px] p-0 font-medium"
                        placeholder="seu@email.com"
                        placeholderTextColor="#9ca3af"
                        value={email}
                        onChangeText={setEmail}
                        onFocus={() => setIsFocusedEmail(true)}
                        onBlur={() => setIsFocusedEmail(false)}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        returnKeyType="next"
                      />
                    </View>
                  </View>

                  {/* Senha */}
                  <View className="mt-4">
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-gray-700 text-[10px] uppercase tracking-widest mb-2 ml-1"
                    >
                      SENHA
                    </Text>
                    <View 
                      className={`flex-row items-center border rounded-2xl px-4 py-3.5 ${
                        isFocusedPassword 
                          ? 'border-yellow-500 bg-white' 
                          : 'border-gray-200 bg-[#f8f9fc]'
                      }`}
                    >
                      <Lock size={18} color={isFocusedPassword ? '#eab308' : '#6b7280'} />
                      <TextInput
                        className="flex-1 ml-3 text-gray-900 text-[15px] p-0 font-medium"
                        placeholder="Sua senha"
                        placeholderTextColor="#9ca3af"
                        value={password}
                        onChangeText={setPassword}
                        onFocus={() => setIsFocusedPassword(true)}
                        onBlur={() => setIsFocusedPassword(false)}
                        secureTextEntry={!showPassword}
                        returnKeyType="done"
                        onSubmitEditing={handleLogin}
                      />
                      <TouchableOpacity 
                        onPress={() => setShowPassword(!showPassword)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        className="p-1"
                      >
                        {showPassword ? (
                          <EyeOff size={18} color="#4b5563" />
                        ) : (
                          <Eye size={18} color="#9ca3af" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Esqueceu a Senha */}
                  <TouchableOpacity 
                    onPress={() => router.push('/(auth)/forgot-password')}
                    className="items-end mt-2 mb-6"
                  >
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-yellow-600 hover:text-yellow-700 text-[10px] uppercase tracking-wider"
                    >
                      Esqueceu a senha?
                    </Text>
                  </TouchableOpacity>

                  {/* Botão ENTRAR Centralizado */}
                  <TouchableOpacity 
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      handleLogin();
                    }}
                    disabled={loading}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: '#eab308',
                      borderRadius: 16,
                      paddingVertical: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                    }}
                    className="w-full active:scale-[0.99]"
                  >
                    {loading ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text 
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-black text-sm uppercase tracking-[2px] text-center"
                      >
                        ENTRAR
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Divisor */}
                  <View className="flex-row items-center my-5">
                    <View className="flex-1 h-[1px] bg-gray-200" />
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold', fontWeight: 'normal' }}
                      className="text-gray-400 text-[9px] uppercase tracking-widest px-3"
                    >
                      Primeiro acesso?
                    </Text>
                    <View className="flex-1 h-[1px] bg-gray-200" />
                  </View>

                  {/* Botão Primeiro Acesso */}
                  <TouchableOpacity 
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      router.push('/(auth)/forgot-password');
                    }}
                    activeOpacity={0.85}
                    style={{
                      borderColor: '#ca8a04',
                      borderWidth: 1.5,
                      borderRadius: 16,
                      paddingVertical: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      backgroundColor: 'rgba(234, 179, 8, 0.08)'
                    }}
                    className="w-full active:scale-[0.99]"
                  >
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold', fontWeight: 'normal' }}
                      className="text-yellow-700 text-xs uppercase tracking-[2px] text-center"
                    >
                      PRIMEIRO ACESSO DO ALUNO
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>



            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
