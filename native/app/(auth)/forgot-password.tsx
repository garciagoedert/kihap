import React, { useState } from 'react';
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
  StyleSheet
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react-native';
import { auth, functions } from '../../src/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState(1); // 1: Email, 2: New Password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isFocusedEmail, setIsFocusedEmail] = useState(false);
  const [isFocusedPassword, setIsFocusedPassword] = useState(false);
  const [isFocusedConfirmPassword, setIsFocusedConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [studentData, setStudentData] = useState<any>(null);
  const router = useRouter();

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

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      {/* Foto Marcial Kihap de fundo */}
      <Image 
        source={require('../../assets/images/fundogero.jpg')}
        style={[
          StyleSheet.absoluteFillObject,
          { width: '100%', height: '100%', opacity: 0.42 }
        ]}
        resizeMode="cover"
      />

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
            
            <View className="w-full max-w-[400px] self-center relative">
              
              {/* Botão Voltar */}
              <TouchableOpacity 
                onPress={() => router.back()}
                className="mb-4 self-start p-3 rounded-full bg-white/90 border border-gray-200 shadow-md"
              >
                <ArrowLeft size={20} color="#000" />
              </TouchableOpacity>

              {/* Card Principal */}
              <View 
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 16 },
                  shadowOpacity: 0.25,
                  shadowRadius: 32,
                  elevation: 14,
                }}
                className="bg-[#141417] p-8 rounded-[36px] overflow-hidden"
              >
                {/* Header com Logo */}
                <View className="items-center mb-6 pt-2">
                  <Image 
                    source={{ uri: 'https://kihap.com.br/imgs/logo.png' }} 
                    className="w-44 h-12 mb-3"
                    resizeMode="contain"
                  />
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-yellow-400 text-[11px] uppercase tracking-[2px]"
                  >
                    RECUPERAR SENHA
                  </Text>
                </View>

                {error ? (
                  <View className="bg-red-500/15 border border-red-500/30 p-3.5 rounded-2xl mb-5 items-center justify-center">
                    <Text className="text-red-400 text-center text-xs font-bold">{error}</Text>
                  </View>
                ) : null}

                {success ? (
                  <View className="bg-emerald-500/15 border border-emerald-500/30 p-3.5 rounded-2xl mb-5 items-center justify-center flex-row gap-2">
                    <CheckCircle size={15} color="#34d399" />
                    <Text className="text-emerald-400 text-center text-xs font-bold flex-1">{success}</Text>
                  </View>
                ) : null}

                {step === 1 ? (
                  <View className="space-y-4">
                    <View>
                      <Text 
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-gray-400 text-[10px] uppercase tracking-widest mb-2 ml-1"
                      >
                        E-MAIL CADASTRADO
                      </Text>
                      <View 
                        className={`flex-row items-center bg-[#1c1c21] border rounded-2xl px-4 py-3.5 ${
                          isFocusedEmail 
                            ? 'border-yellow-400 bg-[#22222a]' 
                            : 'border-white/10'
                        }`}
                      >
                        <Mail size={18} color={isFocusedEmail ? '#facc15' : '#71717a'} />
                        <TextInput
                          className="flex-1 ml-3 text-white text-[15px] p-0"
                          placeholder="seu@email.com"
                          placeholderTextColor="#52525b"
                          value={email}
                          onChangeText={setEmail}
                          onFocus={() => setIsFocusedEmail(true)}
                          onBlur={() => setIsFocusedEmail(false)}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          editable={!loading}
                        />
                      </View>
                    </View>

                    <TouchableOpacity 
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        handleVerifyEmail();
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
                      className="w-full mt-4 active:scale-[0.99]"
                    >
                      {loading ? (
                        <ActivityIndicator color="#000" />
                      ) : (
                        <Text 
                          style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                          className="text-black text-sm uppercase tracking-[2px] font-black text-center"
                        >
                          VERIFICAR E-MAIL
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="space-y-4">
                    <View>
                      <Text 
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-gray-400 text-[10px] uppercase tracking-widest mb-2 ml-1"
                      >
                        NOVA SENHA
                      </Text>
                      <View 
                        className={`flex-row items-center bg-[#1c1c21] border rounded-2xl px-4 py-3.5 ${
                          isFocusedPassword 
                            ? 'border-yellow-400 bg-[#22222a]' 
                            : 'border-white/10'
                        }`}
                      >
                        <Lock size={18} color={isFocusedPassword ? '#facc15' : '#71717a'} />
                        <TextInput
                          className="flex-1 ml-3 text-white text-[15px] p-0"
                          placeholder="Mínimo 6 caracteres"
                          placeholderTextColor="#52525b"
                          value={password}
                          onChangeText={setPassword}
                          onFocus={() => setIsFocusedPassword(true)}
                          onBlur={() => setIsFocusedPassword(false)}
                          secureTextEntry={!showPassword}
                          editable={!loading}
                        />
                        <TouchableOpacity 
                          onPress={() => setShowPassword(!showPassword)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          className="p-1"
                        >
                          {showPassword ? (
                            <EyeOff size={18} color="#a1a1aa" />
                          ) : (
                            <Eye size={18} color="#71717a" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View className="mt-4">
                      <Text 
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-gray-400 text-[10px] uppercase tracking-widest mb-2 ml-1"
                      >
                        CONFIRMAR SENHA
                      </Text>
                      <View 
                        className={`flex-row items-center bg-[#1c1c21] border rounded-2xl px-4 py-3.5 ${
                          isFocusedConfirmPassword 
                            ? 'border-yellow-400 bg-[#22222a]' 
                            : 'border-white/10'
                        }`}
                      >
                        <Lock size={18} color={isFocusedConfirmPassword ? '#facc15' : '#71717a'} />
                        <TextInput
                          className="flex-1 ml-3 text-white text-[15px] p-0"
                          placeholder="Repita a nova senha"
                          placeholderTextColor="#52525b"
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          onFocus={() => setIsFocusedConfirmPassword(true)}
                          onBlur={() => setIsFocusedConfirmPassword(false)}
                          secureTextEntry={!showConfirmPassword}
                          editable={!loading}
                        />
                        <TouchableOpacity 
                          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          className="p-1"
                        >
                          {showConfirmPassword ? (
                            <EyeOff size={18} color="#a1a1aa" />
                          ) : (
                            <Eye size={18} color="#71717a" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>

                    <TouchableOpacity 
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        handleSetPassword();
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
                      className="w-full mt-6 active:scale-[0.99]"
                    >
                      {loading ? (
                        <ActivityIndicator color="#000" />
                      ) : (
                        <Text 
                          style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                          className="text-black text-sm uppercase tracking-[2px] font-black text-center"
                        >
                          DEFINIR SENHA E ACESSAR
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Rodapé */}
              <View className="mt-8 items-center">
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-gray-700 text-[9px] uppercase tracking-[2px] font-bold"
                >
                  © 2026 KIHAP MARTIAL ARTS
                </Text>
              </View>

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
