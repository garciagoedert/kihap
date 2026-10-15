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
  StyleSheet
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { 
  ArrowLeft, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  KeyRound, 
  RefreshCw, 
  AlertCircle,
  ShieldCheck,
  ChevronRight
} from 'lucide-react-native';
import { auth, functions } from '../../src/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Email, 2: Código OTP, 3: Nova Senha
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [studentName, setStudentName] = useState('');
  const [code, setCode] = useState('');
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
  const [cooldown, setCooldown] = useState(0);

  const codeInputRef = useRef<TextInput>(null);
  const router = useRouter();

  // Contador de reenvio do código (60 segundos)
  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Foco no input de código ao mudar para o passo 2
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => {
        codeInputRef.current?.focus();
      }, 300);
    }
  }, [step]);

  // PASSO 1: Enviar Código por E-mail
  const handleSendCode = async () => {
    if (!email || !email.trim()) {
      setError('Por favor, informe seu e-mail cadastrado.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const sendAccessVerificationCode = httpsCallable(functions, 'sendAccessVerificationCode');
      const result: any = await sendAccessVerificationCode({ email: email.trim() });

      if (result.data.success) {
        setMaskedEmail(result.data.maskedEmail || email.trim());
        setStudentName(result.data.firstName || 'Aluno');
        setCooldown(60);
        setStep(2);
        setSuccess(`Código enviado para ${result.data.maskedEmail || email.trim()}.`);
      } else {
        setError(result.data.message || 'E-mail não encontrado em nossa base de alunos.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao consultar e-mail. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  // Reenviar código
  const handleResendCode = async () => {
    if (cooldown > 0 || loading) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const sendAccessVerificationCode = httpsCallable(functions, 'sendAccessVerificationCode');
      const result: any = await sendAccessVerificationCode({ email: email.trim() });

      if (result.data.success) {
        setCooldown(60);
        setCode('');
        setSuccess('Um novo código de 6 dígitos foi enviado para seu e-mail.');
      } else {
        setError(result.data.message || 'Não foi possível reenviar o código.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Erro ao reenviar código. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // PASSO 2: Validar Código de 6 dígitos
  const handleVerifyCode = async () => {
    const cleanCode = code.replace(/[^0-9]/g, '');
    if (cleanCode.length !== 6) {
      setError('Digite o código completo com 6 números.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const verifyAccessCode = httpsCallable(functions, 'verifyAccessCode');
      const result: any = await verifyAccessCode({ 
        email: email.trim(), 
        code: cleanCode 
      });

      if (result.data.valid) {
        setStep(3);
        setSuccess('Código verificado com sucesso! Agora crie sua nova senha.');
      } else {
        setError(result.data.message || 'Código incorreto. Verifique seu e-mail.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao validar código. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // PASSO 3: Salvar Senha e Fazer Login Automático
  const handleSetPassword = async () => {
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const completeAccessWithCode = httpsCallable(functions, 'completeAccessWithCode');
      const result: any = await completeAccessWithCode({ 
        email: email.trim(), 
        code: code.replace(/[^0-9]/g, ''), 
        newPassword: password 
      });

      if (result.data.success) {
        setSuccess('Senha criada com sucesso! Conectando ao aplicativo...');
        
        // Login automático no Firebase Auth
        await signInWithEmailAndPassword(auth as any, email.trim(), password);
        router.replace('/(tabs)');
      } else {
        setError(result.data.message || 'Erro ao definir senha.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao definir senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#09090b]">
      <StatusBar style="light" />

      {/* Foto Marcial Kihap de fundo */}
      <Image 
        source={require('../../assets/images/fundogero.jpg')}
        style={[
          StyleSheet.absoluteFillObject,
          { width: '100%', height: '100%', opacity: 0.35 }
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
                onPress={() => {
                  if (step === 2) {
                    setStep(1);
                    setError('');
                    setSuccess('');
                  } else if (step === 3) {
                    setStep(2);
                    setError('');
                    setSuccess('');
                  } else {
                    router.back();
                  }
                }}
                className="mb-4 self-start p-3 rounded-full bg-[#1c1c21]/90 border border-white/10 shadow-lg active:scale-95"
              >
                <ArrowLeft size={20} color="#facc15" />
              </TouchableOpacity>

              {/* Card Principal */}
              <View 
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 16 },
                  shadowOpacity: 0.4,
                  shadowRadius: 32,
                  elevation: 16,
                }}
                className="bg-[#141417]/95 border border-white/10 p-7 rounded-[36px] overflow-hidden"
              >
                {/* Header com Logo e Indicador de Passos */}
                <View className="items-center mb-5 pt-1">
                  <Image 
                    source={{ uri: 'https://kihap.com.br/imgs/logo.png' }} 
                    className="w-40 h-11 mb-2"
                    resizeMode="contain"
                  />
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-yellow-400 text-[10px] uppercase tracking-[2px]"
                  >
                    {step === 1 && 'PRIMEIRO ACESSO OU RECUPERAÇÃO'}
                    {step === 2 && 'CÓDIGO DE VERIFICAÇÃO'}
                    {step === 3 && 'DEFINIR NOVA SENHA'}
                  </Text>

                  {/* Linha de progresso dos 3 passos */}
                  <View className="flex-row items-center gap-2 mt-3">
                    <View className={`h-1.5 rounded-full ${step >= 1 ? 'w-8 bg-yellow-400' : 'w-4 bg-white/10'}`} />
                    <View className={`h-1.5 rounded-full ${step >= 2 ? 'w-8 bg-yellow-400' : 'w-4 bg-white/10'}`} />
                    <View className={`h-1.5 rounded-full ${step >= 3 ? 'w-8 bg-yellow-400' : 'w-4 bg-white/10'}`} />
                  </View>
                </View>

                {/* Feedback de Erro */}
                {error ? (
                  <View className="bg-red-500/15 border border-red-500/30 p-3.5 rounded-2xl mb-5 flex-row items-center gap-2.5">
                    <AlertCircle size={16} color="#f87171" />
                    <Text className="text-red-400 text-xs font-semibold flex-1 leading-5">{error}</Text>
                  </View>
                ) : null}

                {/* Feedback de Sucesso */}
                {success ? (
                  <View className="bg-emerald-500/15 border border-emerald-500/30 p-3.5 rounded-2xl mb-5 flex-row items-center gap-2.5">
                    <CheckCircle size={16} color="#34d399" />
                    <Text className="text-emerald-400 text-xs font-semibold flex-1 leading-5">{success}</Text>
                  </View>
                ) : null}

                {/* ===================== PASSO 1: DIGITAR E-MAIL ===================== */}
                {step === 1 && (
                  <View className="space-y-4">
                    <Text className="text-gray-300 text-xs leading-5 mb-2 text-center">
                      Digite o e-mail cadastrado na sua matrícula para receber um código de segurança.
                    </Text>

                    <View>
                      <Text 
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-gray-400 text-[10px] uppercase tracking-widest mb-2 ml-1"
                      >
                        E-MAIL DO ALUNO
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
                          onChangeText={(text) => {
                            setEmail(text);
                            if (error) setError('');
                          }}
                          onFocus={() => setIsFocusedEmail(true)}
                          onBlur={() => setIsFocusedEmail(false)}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          editable={!loading}
                          returnKeyType="send"
                          onSubmitEditing={handleSendCode}
                        />
                      </View>
                    </View>

                    <TouchableOpacity 
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        handleSendCode();
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
                          ENVIAR CÓDIGO
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* ===================== PASSO 2: DIGITAR CÓDIGO OTP ===================== */}
                {step === 2 && (
                  <View className="space-y-4">
                    <Text className="text-gray-300 text-xs leading-5 text-center">
                      Enviamos um código de 6 números para:{'\n'}
                      <Text className="text-yellow-400 font-bold">{maskedEmail}</Text>
                    </Text>

                    {/* Caixas visuais dos 6 dígitos */}
                    <TouchableOpacity 
                      activeOpacity={1}
                      onPress={() => codeInputRef.current?.focus()}
                      className="relative my-2"
                    >
                      <View className="flex-row justify-between gap-1.5">
                        {[0, 1, 2, 3, 4, 5].map((index) => {
                          const digit = code[index] || '';
                          const isCurrent = code.length === index;
                          return (
                            <View
                              key={index}
                              style={{
                                flex: 1,
                                height: 54,
                                borderRadius: 14,
                                borderWidth: 1.5,
                                borderColor: digit ? '#facc15' : isCurrent ? '#facc15' : 'rgba(255,255,255,0.12)',
                                backgroundColor: digit ? 'rgba(250, 204, 21, 0.08)' : '#1c1c21',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ fontFamily: 'NeueMachina-Ultrabold', fontSize: 22, color: digit ? '#facc15' : '#ffffff' }}>
                                {digit}
                              </Text>
                            </View>
                          );
                        })}
                      </View>

                      {/* TextInput oculto que captura os números */}
                      <TextInput
                        ref={codeInputRef}
                        style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%' }}
                        value={code}
                        onChangeText={(text) => {
                          const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
                          setCode(cleaned);
                          if (error) setError('');
                        }}
                        keyboardType="number-pad"
                        maxLength={6}
                        editable={!loading}
                        returnKeyType="done"
                        onSubmitEditing={handleVerifyCode}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        handleVerifyCode();
                      }}
                      disabled={loading || code.length < 6}
                      activeOpacity={0.85}
                      style={{
                        backgroundColor: code.length === 6 ? '#eab308' : '#71717a',
                        borderRadius: 16,
                        paddingVertical: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                      }}
                      className="w-full mt-3 active:scale-[0.99]"
                    >
                      {loading ? (
                        <ActivityIndicator color="#000" />
                      ) : (
                        <Text 
                          style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                          className="text-black text-sm uppercase tracking-[2px] font-black text-center"
                        >
                          VALIDAR CÓDIGO
                        </Text>
                      )}
                    </TouchableOpacity>

                    {/* Ações auxiliares: Reenviar e Trocar e-mail */}
                    <View className="flex-row items-center justify-between pt-2">
                      <TouchableOpacity
                        onPress={() => {
                          setStep(1);
                          setCode('');
                          setError('');
                        }}
                        className="py-1"
                      >
                        <Text className="text-gray-400 text-xs underline">
                          Alterar e-mail
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleResendCode}
                        disabled={cooldown > 0 || loading}
                        className="flex-row items-center gap-1.5 py-1"
                      >
                        <RefreshCw size={13} color={cooldown > 0 ? '#71717a' : '#facc15'} />
                        <Text className={cooldown > 0 ? 'text-gray-500 text-xs' : 'text-yellow-400 text-xs font-semibold'}>
                          {cooldown > 0 ? `Reenviar (${cooldown}s)` : 'Reenviar código'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* ===================== PASSO 3: CRIAR NOVA SENHA ===================== */}
                {step === 3 && (
                  <View className="space-y-4">
                    <Text className="text-gray-300 text-xs leading-5 mb-1 text-center">
                      {studentName ? `Olá, ${studentName}! ` : ''}Crie sua senha de acesso ao aplicativo.
                    </Text>

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
                          onChangeText={(text) => {
                            setPassword(text);
                            if (error) setError('');
                          }}
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

                    <View className="mt-3">
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
                          onChangeText={(text) => {
                            setConfirmPassword(text);
                            if (error) setError('');
                          }}
                          onFocus={() => setIsFocusedConfirmPassword(true)}
                          onBlur={() => setIsFocusedConfirmPassword(false)}
                          secureTextEntry={!showConfirmPassword}
                          editable={!loading}
                          returnKeyType="done"
                          onSubmitEditing={handleSetPassword}
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
                      className="w-full mt-5 active:scale-[0.99]"
                    >
                      {loading ? (
                        <ActivityIndicator color="#000" />
                      ) : (
                        <Text 
                          style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                          className="text-black text-sm uppercase tracking-[2px] font-black text-center"
                        >
                          CRIAR SENHA E ENTRAR
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
                  className="text-gray-600 text-[9px] uppercase tracking-[2px] font-bold"
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
