import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  Phone,
  Edit3,
  X,
  Plus,
  Check,
  Award,
  Activity,
  Lock,
  User,
} from 'lucide-react-native';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../../../src/services/firebase';
import { formatUnitName } from '../../../src/utils/intranetPermissions';
import { extractStudentEmail, extractStudentPhone } from '../../../src/utils/intranetStudents';

type ProfileTab = 'details' | 'physical' | 'badges' | 'permissions';

export default function IntranetAlunoDetailScreen() {
  const { id, unit } = useLocalSearchParams<{ id: string; unit?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [activeTab, setActiveTab] = useState<ProfileTab>('details');
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any | null>(null);
  const [studentUser, setStudentUser] = useState<any | null>(null);

  // Teste físico
  const [physicalTests, setPhysicalTests] = useState<any[]>([]);
  const [newTestScore, setNewTestScore] = useState('');
  const [newTestDate, setNewTestDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [savingTest, setSavingTest] = useState(false);

  // Emblemas e Permissões
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const [savingBadges, setSavingBadges] = useState(false);

  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [allTatame, setAllTatame] = useState<any[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Modal de Edição
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    cpf: '',
    address: '',
    responsible: '',
    origin: '',
    belt: '',
    rankType: '',
    partials: '0',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const loadAllData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const numericId = parseInt(String(id), 10);
      let loadedStudent: any = null;

      // 1. Tenta buscar detalhes completos via getMemberDetails (EVO + Firestore sync)
      try {
        const currentUser = (auth as any)?.currentUser;
        if (currentUser) {
          const token = await currentUser.getIdToken();
          const resp = await fetch('https://us-central1-intranet-kihap.cloudfunctions.net/getMemberDetails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ data: { memberId: numericId, unitId: unit || undefined } }),
          });
          if (resp.ok) {
            const json = await resp.json();
            loadedStudent = json?.data || null;
          }
        }
      } catch (apiErr) {
        console.warn('getMemberDetails fallback para Firestore:', apiErr);
      }

      // 2. Mescla dados locais salvos em evo_students
      try {
        const localSnap = await getDoc(doc(db, 'evo_students', String(id)));
        if (localSnap.exists()) {
          const localData = localSnap.data();
          if (!loadedStudent) {
            loadedStudent = { idMember: numericId || id, ...localData };
          } else {
            ['phone', 'responsible', 'origin', 'address', 'cpf', 'unitId'].forEach((field) => {
              if (!loadedStudent[field] && localData[field]) {
                loadedStudent[field] = localData[field];
              }
            });
            if (!extractStudentPhone(loadedStudent)) {
              const localPhone = extractStudentPhone(localData);
              if (localPhone) loadedStudent.phone = localPhone;
            }
          }
        }
      } catch (e) {
        console.warn('Erro ao ler evo_students:', e);
      }

      // 3. Conta de usuário no App (users)
      let appUser: any = null;
      try {
        const [snapNum, snapStr] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('evoMemberId', '==', numericId))),
          getDocs(query(collection(db, 'users'), where('evoMemberId', '==', String(id)))),
        ]);
        const foundDoc = !snapNum.empty ? snapNum.docs[0] : !snapStr.empty ? snapStr.docs[0] : null;
        if (foundDoc) {
          appUser = { id: foundDoc.id, ...foundDoc.data() };
          if (loadedStudent) {
            if (appUser.partials !== undefined) loadedStudent.partials = appUser.partials;
            if (appUser.photoURL) loadedStudent.photoURL = appUser.photoURL;
            if (!extractStudentPhone(loadedStudent) && appUser.phone) {
              loadedStudent.phone = appUser.phone;
            }
            if (!loadedStudent.belt && appUser.belt) loadedStudent.belt = appUser.belt;
            if (!loadedStudent.rankType && appUser.rankType) loadedStudent.rankType = appUser.rankType;
          }
        }
      } catch (e) {
        console.warn('Erro ao buscar conta users do aluno:', e);
      }

      setStudent(loadedStudent);
      setStudentUser(appUser);
      setSelectedBadges(Array.isArray(appUser?.earnedBadges) ? appUser.earnedBadges : []);
      setSelectedPermissions(Array.isArray(appUser?.accessibleContent) ? appUser.accessibleContent : []);

      // 4. Carrega testes físicos + listas de emblemas, cursos e tatame em paralelo
      const [testsNum, testsStr, badgesSnap, coursesSnap, tatameSnap] = await Promise.all([
        getDocs(query(collection(db, 'physicalTests'), where('evoMemberId', '==', numericId))),
        getDocs(query(collection(db, 'physicalTests'), where('evoMemberId', '==', String(id)))),
        getDocs(query(collection(db, 'badges'), orderBy('name'))),
        getDocs(query(collection(db, 'courses'), orderBy('title'))),
        getDocs(query(collection(db, 'tatame_conteudos'), orderBy('title'))),
      ]);

      const testsMap = new Map<string, any>();
      [...testsNum.docs, ...testsStr.docs].forEach((d) => testsMap.set(d.id, { id: d.id, ...d.data() }));
      const testsSorted = Array.from(testsMap.values()).sort((a, b) => {
        const aTime = a.date?.toMillis ? a.date.toMillis() : 0;
        const bTime = b.date?.toMillis ? b.date.toMillis() : 0;
        return bTime - aTime;
      });
      setPhysicalTests(testsSorted);

      setAllBadges(badgesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setAllCourses(coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setAllTatame(tatameSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Erro ao carregar perfil do aluno:', err);
    } finally {
      setLoading(false);
    }
  }, [id, unit]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const openEditModal = () => {
    if (!student) return;
    setEditForm({
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      email: extractStudentEmail(student),
      phone: extractStudentPhone(student),
      cpf: student.cpf || student.document || '',
      address: student.address || '',
      responsible: student.responsible || '',
      origin: student.origin || '',
      belt: student.belt || 'Branca Recomendada',
      rankType: student.rankType || 'Tradicional',
      partials: String(student.partials || 0),
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!student) return;
    setSavingEdit(true);
    try {
      const updateLocalStudent = httpsCallable(functions, 'updateLocalStudent');
      await updateLocalStudent({
        idMember: student.idMember || id,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        phone: editForm.phone,
        cpf: editForm.cpf,
        address: editForm.address,
        responsible: editForm.responsible,
        origin: editForm.origin,
        belt: editForm.belt,
        rankType: editForm.rankType,
      });

      if (studentUser?.id) {
        await updateDoc(doc(db, 'users', studentUser.id), {
          partials: parseInt(editForm.partials, 10) || 0,
          belt: editForm.belt,
          graduacao: editForm.belt,
          rankType: editForm.rankType,
        });
      }

      setEditModalVisible(false);
      Alert.alert('Sucesso', 'Dados atualizados com sucesso!');
      await loadAllData();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar os dados.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddPhysicalTest = async () => {
    if (!student) return;
    const numericScore = Number(newTestScore);
    if (!newTestDate || !newTestScore || isNaN(numericScore)) {
      Alert.alert('Atenção', 'Preencha a data e uma pontuação válida.');
      return;
    }

    setSavingTest(true);
    try {
      const evoId = student.idMember || parseInt(String(id), 10);
      await addDoc(collection(db, 'physicalTests'), {
        date: Timestamp.fromDate(new Date(`${newTestDate}T00:00:00`)),
        score: numericScore,
        evoMemberId: evoId,
        studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
      });
      setNewTestScore('');
      Alert.alert('Sucesso', 'Teste físico registrado!');
      await loadAllData();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível registrar o teste.');
    } finally {
      setSavingTest(false);
    }
  };

  const handleSaveBadges = async () => {
    if (!studentUser?.id) {
      Alert.alert('Aviso', 'Este aluno ainda não possui conta de acesso no sistema.');
      return;
    }
    setSavingBadges(true);
    try {
      const updateStudentBadges = httpsCallable(functions, 'updateStudentBadges');
      await updateStudentBadges({
        studentUid: studentUser.id,
        earnedBadges: selectedBadges,
      });
      Alert.alert('Sucesso', 'Emblemas atualizados com sucesso!');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar os emblemas.');
    } finally {
      setSavingBadges(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!studentUser?.id) {
      Alert.alert('Aviso', 'Este aluno ainda não possui conta de acesso no sistema.');
      return;
    }
    setSavingPermissions(true);
    try {
      const updateStudentPermissions = httpsCallable(functions, 'updateStudentPermissions');
      await updateStudentPermissions({
        studentUid: studentUser.id,
        accessibleContent: selectedPermissions,
      });
      Alert.alert('Sucesso', 'Permissões salvas com sucesso!');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar as permissões.');
    } finally {
      setSavingPermissions(false);
    }
  };

  const openWhatsApp = (phoneStr: string) => {
    const digits = phoneStr.replace(/\D/g, '');
    if (!digits) return;
    const fullNumber = digits.startsWith('55') ? digits : `55${digits}`;
    Linking.openURL(`https://wa.me/${fullNumber}`).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    });
  };

  const fullName = student
    ? `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.name || `Aluno #${id}`
    : 'Perfil do Aluno';
  const email = extractStudentEmail(student);
  const phone = extractStudentPhone(student);
  const photoUrl = student?.photoURL || student?.photoUrl || student?.photo || '';
  const isActive =
    student?.membershipStatus === 'Active' ||
    student?.status === 'Active' ||
    student?.status === 1;

  const detailFields = student
    ? [
        { label: 'ID do Aluno', value: String(student.idMember || id) },
        { label: 'Unidade', value: formatUnitName(student.branchName || student.unitId || unit) },
        { label: 'Telefone', value: phone || 'Não informado', isPhone: !!phone },
        { label: 'E-mail', value: email || 'Não informado' },
        { label: 'Documento (CPF/RG)', value: student.cpf || student.document || 'Não informado' },
        {
          label: 'Data de Nascimento',
          value: student.birthDate ? new Date(student.birthDate).toLocaleDateString('pt-BR') : 'Não informado',
        },
        { label: 'Categoria', value: student.rankType || 'Tradicional' },
        { label: 'Faixa / Nível', value: student.belt || 'Não informado' },
        ...(student.collar ? [{ label: 'Colarinho', value: student.collar }] : []),
        { label: 'Parciais (Faixa Preta)', value: student.partials !== undefined ? String(student.partials) : 'Não informado' },
        { label: 'Responsável', value: student.responsible || 'Não informado' },
        { label: 'Origem', value: student.origin || 'Não informado' },
        { label: 'Endereço', value: student.address || 'Não informado' },
      ]
    : [];

  return (
    <View className="flex-1 bg-[#f8f9fa] dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{ paddingTop: Math.max(insets.top, 14) }}
        className="bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-white/5 px-4 pb-3"
      >
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="flex-row items-center gap-2 py-1 pr-3">
            <ArrowLeft size={22} color={isDark ? '#fff' : '#111827'} />
            <Text className="text-base font-black text-gray-900 dark:text-white">Voltar</Text>
          </TouchableOpacity>
          {student && (
            <TouchableOpacity
              onPress={openEditModal}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/30"
            >
              <Edit3 size={14} color="#eab308" />
              <Text className="text-xs font-black text-amber-600 dark:text-amber-400">Editar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#eab308" size="large" />
        </View>
      ) : !student ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm font-bold text-gray-500 text-center">
            Não foi possível carregar os dados deste aluno.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {/* Cartão Resumo do Aluno */}
          <View className="bg-white dark:bg-[#141414] rounded-3xl p-5 border border-gray-100 dark:border-white/10 items-center mb-4">
            <View className="w-20 h-20 rounded-full bg-amber-400/15 border-2 border-amber-400/30 items-center justify-center overflow-hidden mb-3">
              {photoUrl && photoUrl.length > 10 ? (
                <Image source={{ uri: photoUrl }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <User size={32} color="#eab308" />
              )}
            </View>
            <Text className="text-lg font-black text-gray-900 dark:text-white text-center">{fullName}</Text>
            {!!email && <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{email}</Text>}

            <View className="flex-row items-center gap-2 mt-3">
              <View
                className={`px-3 py-1 rounded-full ${
                  isActive ? 'bg-emerald-500/15' : 'bg-red-500/15'
                }`}
              >
                <Text
                  className={`text-[11px] font-black uppercase ${
                    isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                  }`}
                >
                  {isActive ? 'Ativo' : 'Inativo'}
                </Text>
              </View>
              {!!phone && (
                <TouchableOpacity
                  onPress={() => openWhatsApp(phone)}
                  className="flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600"
                >
                  <Phone size={12} color="#fff" />
                  <Text className="text-[11px] font-black text-white">{phone}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Sub-abas */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8 }}>
            {[
              { key: 'details', label: 'Dados', icon: User },
              { key: 'physical', label: 'Teste Físico', icon: Activity },
              { key: 'badges', label: 'Emblemas', icon: Award },
              { key: 'permissions', label: 'Permissões', icon: Lock },
            ].map((tab) => {
              const IconComp = tab.icon;
              const isSelected = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key as ProfileTab)}
                  className={`flex-row items-center gap-1.5 px-4 py-2 rounded-xl border ${
                    isSelected
                      ? 'bg-[#eab308] border-[#eab308]'
                      : 'bg-white dark:bg-[#141414] border-gray-200 dark:border-white/10'
                  }`}
                >
                  <IconComp size={14} color={isSelected ? '#000' : isDark ? '#d1d5db' : '#4b5563'} />
                  <Text
                    className={`text-xs font-black ${
                      isSelected ? 'text-black' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Aba Dados Cadastrais */}
          {activeTab === 'details' && (
            <View className="bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10">
              {detailFields.map((field, idx) => (
                <View
                  key={field.label}
                  className={`py-3 ${idx < detailFields.length - 1 ? 'border-b border-gray-100 dark:border-white/5' : ''}`}
                >
                  <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {field.label}
                  </Text>
                  {field.isPhone ? (
                    <TouchableOpacity onPress={() => openWhatsApp(field.value)} className="mt-1 flex-row items-center gap-1.5">
                      <Text className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {field.value}
                      </Text>
                      <Text className="text-[10px] text-gray-400">(tocar para abrir WhatsApp)</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                      {field.value}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Aba Teste Físico */}
          {activeTab === 'physical' && (
            <View className="gap-4">
              <View className="bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10 gap-3">
                <Text className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  Novo Registro de Teste Físico
                </Text>
                <View className="flex-row gap-2">
                  <TextInput
                    value={newTestDate}
                    onChangeText={setNewTestDate}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor="#9ca3af"
                    className="flex-1 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white"
                  />
                  <TextInput
                    value={newTestScore}
                    onChangeText={setNewTestScore}
                    placeholder="Pontuação"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    className="w-28 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-white"
                  />
                </View>
                <TouchableOpacity
                  onPress={handleAddPhysicalTest}
                  disabled={savingTest}
                  className="bg-[#eab308] py-3 rounded-xl flex-row items-center justify-center gap-1.5"
                >
                  <Plus size={16} color="#000" />
                  <Text className="text-xs font-black text-black">
                    {savingTest ? 'Salvando...' : 'Adicionar Pontuação'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10">
                <Text className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                  Histórico ({physicalTests.length})
                </Text>
                {physicalTests.length === 0 ? (
                  <Text className="text-xs text-gray-400">Nenhum teste físico registrado.</Text>
                ) : (
                  physicalTests.map((t) => {
                    const dtStr = t.date?.toDate ? t.date.toDate().toLocaleDateString('pt-BR') : 'N/A';
                    return (
                      <View
                        key={t.id}
                        className="flex-row items-center justify-between py-2.5 border-b border-gray-100 dark:border-white/5 last:border-b-0"
                      >
                        <Text className="text-xs font-bold text-gray-600 dark:text-gray-300">{dtStr}</Text>
                        <Text className="text-sm font-black text-amber-500">{t.score} pts</Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* Aba Emblemas */}
          {activeTab === 'badges' && (
            <View className="bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10">
              {!studentUser && (
                <Text className="text-xs text-amber-500 font-bold mb-3">
                  Aluno ainda não possui conta ativa no sistema para receber emblemas.
                </Text>
              )}
              <View className="flex-row flex-wrap gap-2.5">
                {allBadges.map((b) => {
                  const checked = selectedBadges.includes(b.id);
                  return (
                    <TouchableOpacity
                      key={b.id}
                      onPress={() =>
                        setSelectedBadges((prev) =>
                          prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id]
                        )
                      }
                      className={`w-[48%] p-3 rounded-2xl border items-center ${
                        checked
                          ? 'bg-amber-400/15 border-[#eab308]'
                          : 'bg-gray-50 dark:bg-[#0a0a0a] border-gray-200 dark:border-white/10'
                      }`}
                    >
                      {!!b.imageUrl && (
                        <Image source={{ uri: b.imageUrl }} className="w-12 h-12 rounded-full mb-2" />
                      )}
                      <Text className="text-xs font-bold text-gray-900 dark:text-white text-center" numberOfLines={2}>
                        {b.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                onPress={handleSaveBadges}
                disabled={savingBadges || !studentUser}
                className="bg-[#eab308] py-3 rounded-xl items-center mt-4"
              >
                <Text className="text-xs font-black text-black">
                  {savingBadges ? 'Salvando...' : 'Salvar Conquistas'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Aba Permissões */}
          {activeTab === 'permissions' && (
            <View className="bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10 gap-4">
              {!studentUser && (
                <Text className="text-xs text-amber-500 font-bold">
                  Aluno ainda não possui conta ativa no sistema para editar permissões.
                </Text>
              )}

              <View>
                <Text className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2">
                  Cursos Liberados
                </Text>
                {allCourses.map((c) => {
                  const checked = selectedPermissions.includes(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() =>
                        setSelectedPermissions((prev) =>
                          prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                        )
                      }
                      className="flex-row items-center justify-between py-2.5 border-b border-gray-100 dark:border-white/5"
                    >
                      <Text className="text-xs font-bold text-gray-900 dark:text-white flex-1 pr-2">
                        {c.title}
                      </Text>
                      <View
                        className={`w-6 h-6 rounded-lg items-center justify-center border ${
                          checked ? 'bg-[#eab308] border-[#eab308]' : 'border-gray-300 dark:border-white/20'
                        }`}
                      >
                        {checked && <Check size={14} color="#000" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View>
                <Text className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2">
                  Conteúdos do Tatame
                </Text>
                {allTatame.map((t) => {
                  const checked = selectedPermissions.includes(t.id);
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() =>
                        setSelectedPermissions((prev) =>
                          prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                        )
                      }
                      className="flex-row items-center justify-between py-2.5 border-b border-gray-100 dark:border-white/5"
                    >
                      <Text className="text-xs font-bold text-gray-900 dark:text-white flex-1 pr-2">
                        {t.title}
                      </Text>
                      <View
                        className={`w-6 h-6 rounded-lg items-center justify-center border ${
                          checked ? 'bg-[#eab308] border-[#eab308]' : 'border-gray-300 dark:border-white/20'
                        }`}
                      >
                        {checked && <Check size={14} color="#000" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                onPress={handleSavePermissions}
                disabled={savingPermissions || !studentUser}
                className="bg-[#eab308] py-3 rounded-xl items-center"
              >
                <Text className="text-xs font-black text-black">
                  {savingPermissions ? 'Salvando...' : 'Salvar Permissões'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal de Edição */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View className="flex-1 bg-[#f8f9fa] dark:bg-[#050505]">
          <View className="bg-white dark:bg-[#0a0a0a] px-5 pt-5 pb-4 border-b border-gray-100 dark:border-white/5 flex-row items-center justify-between">
            <Text className="text-lg font-black text-gray-900 dark:text-white">Editar Dados do Aluno</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)} className="p-2 rounded-xl bg-gray-100 dark:bg-[#1a1a1a]">
              <X size={20} color={isDark ? '#fff' : '#111827'} />
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
            {[
              { key: 'firstName', label: 'Nome' },
              { key: 'lastName', label: 'Sobrenome' },
              { key: 'email', label: 'E-mail' },
              { key: 'phone', label: 'Telefone' },
              { key: 'cpf', label: 'CPF' },
              { key: 'responsible', label: 'Responsável' },
              { key: 'origin', label: 'Como conheceu' },
              { key: 'belt', label: 'Faixa Atual' },
              { key: 'rankType', label: 'Categoria (Tradicional / Littles)' },
              { key: 'partials', label: 'Parciais (Faixa Preta)' },
              { key: 'address', label: 'Endereço' },
            ].map((item) => (
              <View key={item.key}>
                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  {item.label}
                </Text>
                <TextInput
                  value={(editForm as any)[item.key]}
                  onChangeText={(val) => setEditForm((prev) => ({ ...prev, [item.key]: val }))}
                  className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white"
                />
              </View>
            ))}

            <TouchableOpacity
              onPress={handleSaveEdit}
              disabled={savingEdit}
              className="bg-[#eab308] py-3.5 rounded-xl items-center mt-2"
            >
              <Text className="text-sm font-black text-black">
                {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
