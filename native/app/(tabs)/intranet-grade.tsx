import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { IntranetScreenHeader } from '../../src/components/IntranetModeBar';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  Check,
  X,
  Search,
  UserPlus,
  Calendar,
} from 'lucide-react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { KIHAP_UNITS, formatUnitName } from '../../src/utils/intranetPermissions';
import { UnitFilterStrip } from '../../src/components/UnitFilterStrip';
import { fetchStudentsByUnit, matchesStudentQuery } from '../../src/utils/intranetStudents';

function getLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function IntranetGradeScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { userData } = useAuth();

  const defaultUnit = useMemo(() => {
    const raw = String(userData?.unitId || userData?.unidadeId || '').toLowerCase();
    return KIHAP_UNITS.some((u) => u.id === raw) ? raw : 'centro';
  }, [userData?.unitId, userData?.unidadeId]);

  const [selectedUnit, setSelectedUnit] = useState<string>(defaultUnit);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [templates, setTemplates] = useState<any[]>([]);
  const [instancesMap, setInstancesMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Alunos para exibir nomes e realizar check-in rápido
  const [unitStudents, setUnitStudents] = useState<any[]>([]);
  const [allStudentsCache, setAllStudentsCache] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Modal de Chamada da Turma
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Adicionar Experimental
  const [showAddTrial, setShowAddTrial] = useState(false);
  const [trialName, setTrialName] = useState('');
  const [trialPhone, setTrialPhone] = useState('');
  const [savingTrial, setSavingTrial] = useState(false);

  const dateString = useMemo(() => getLocalDateStr(currentDate), [currentDate]);

  useEffect(() => {
    setSelectedUnit(defaultUnit);
  }, [defaultUnit]);

  // Escuta turmas da unidade e filtra pelo dia da semana
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'classTemplates'), where('unitId', '==', selectedUnit));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const dayOfWeek = currentDate.getDay();
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((t: any) => Array.isArray(t.daysOfWeek) && t.daysOfWeek.includes(dayOfWeek))
          .sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));
        setTemplates(list);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao carregar classTemplates:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [selectedUnit, currentDate]);

  // Escuta instâncias (chamadas) do dia selecionado
  useEffect(() => {
    const q = query(
      collection(db, 'classInstances'),
      where('unitId', '==', selectedUnit),
      where('date', '==', dateString)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const map: Record<string, any> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.templateId) {
            map[data.templateId] = { id: d.id, ...data };
          }
        });
        setInstancesMap(map);
      },
      (err) => console.error('Erro ao carregar classInstances:', err)
    );
    return () => unsub();
  }, [selectedUnit, dateString]);

  // Carrega alunos da unidade para mapear nomes e agilizar chamada
  useEffect(() => {
    let active = true;
    setLoadingStudents(true);
    fetchStudentsByUnit(selectedUnit)
      .then((list) => {
        if (active) setUnitStudents(list);
      })
      .catch((err) => console.warn('Erro ao carregar alunos da unidade:', err))
      .finally(() => {
        if (active) setLoadingStudents(false);
      });
    return () => {
      active = false;
    };
  }, [selectedUnit]);

  const studentsById = useMemo(() => {
    const map = new Map<string, any>();
    [...unitStudents, ...allStudentsCache].forEach((s) => {
      if (s?.idMember !== undefined && s?.idMember !== null) {
        map.set(String(s.idMember), s);
      }
    });
    return map;
  }, [unitStudents, allStudentsCache]);

  const changeDate = (offset: number) => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + offset);
    setCurrentDate(next);
  };

  const ensureAllSchoolLoadedForSearch = useCallback(async () => {
    if (allStudentsCache.length > 0) return;
    try {
      const all = await fetchStudentsByUnit('all');
      setAllStudentsCache(all);
    } catch (e) {
      console.warn('Falha ao buscar base completa:', e);
    }
  }, [allStudentsCache.length]);

  const toggleStudentPresence = async (studentId: string | number, isCurrentlyPresent: boolean) => {
    if (!selectedTemplate) return;
    const idStr = String(studentId);
    const instanceId = `${selectedTemplate.id}_${dateString}`;
    const instanceRef = doc(db, 'classInstances', instanceId);

    setSubmittingId(idStr);
    try {
      const snap = await getDoc(instanceRef);
      if (isCurrentlyPresent) {
        if (snap.exists()) {
          await updateDoc(instanceRef, {
            presentStudents: arrayRemove(idStr, Number(idStr)),
          });
        }
      } else {
        if (snap.exists()) {
          await updateDoc(instanceRef, {
            presentStudents: arrayUnion(idStr),
          });
        } else {
          await setDoc(instanceRef, {
            templateId: selectedTemplate.id,
            date: dateString,
            unitId: selectedUnit,
            presentStudents: [idStr],
            trialStudents: [],
          });
        }
      }
    } catch (err: any) {
      console.error('Erro ao atualizar presença:', err);
      Alert.alert('Erro', err?.message || 'Não foi possível atualizar a presença.');
    } finally {
      setSubmittingId(null);
    }
  };

  const toggleTrialAttendance = async (trialIndex: number) => {
    if (!selectedTemplate) return;
    const instanceId = `${selectedTemplate.id}_${dateString}`;
    const instanceRef = doc(db, 'classInstances', instanceId);
    const currentInst = instancesMap[selectedTemplate.id];
    const trials: any[] = Array.isArray(currentInst?.trialStudents) ? [...currentInst.trialStudents] : [];
    if (!trials[trialIndex]) return;

    trials[trialIndex] = {
      ...trials[trialIndex],
      compareceu: !trials[trialIndex].compareceu,
    };

    try {
      await updateDoc(instanceRef, { trialStudents: trials });
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível atualizar a experimental.');
    }
  };

  const handleAddTrialStudent = async () => {
    if (!selectedTemplate) return;
    if (!trialName.trim()) {
      Alert.alert('Atenção', 'Informe o nome do aluno experimental.');
      return;
    }

    const instanceId = `${selectedTemplate.id}_${dateString}`;
    const instanceRef = doc(db, 'classInstances', instanceId);
    const newTrial = {
      name: trialName.trim(),
      phone: trialPhone.trim(),
      compareceu: true,
      addedAt: new Date().toISOString(),
    };

    setSavingTrial(true);
    try {
      const snap = await getDoc(instanceRef);
      if (snap.exists()) {
        const existing = Array.isArray(snap.data().trialStudents) ? snap.data().trialStudents : [];
        await updateDoc(instanceRef, {
          trialStudents: [...existing, newTrial],
        });
      } else {
        await setDoc(instanceRef, {
          templateId: selectedTemplate.id,
          date: dateString,
          unitId: selectedUnit,
          presentStudents: [],
          trialStudents: [newTrial],
        });
      }
      setTrialName('');
      setTrialPhone('');
      setShowAddTrial(false);
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível adicionar a experimental.');
    } finally {
      setSavingTrial(false);
    }
  };

  const selectedInstance = selectedTemplate ? instancesMap[selectedTemplate.id] : null;
  const presentIdsSet = useMemo<Set<string>>(() => {
    const raw = selectedInstance?.presentStudents || [];
    return new Set<string>(raw.map((id: any) => String(id)));
  }, [selectedInstance]);

  const enrolledIds: string[] = useMemo(() => {
    if (!selectedTemplate) return [];
    const base = Array.isArray(selectedTemplate.students) ? selectedTemplate.students.map((s: any) => String(s)) : [];
    const merged = new Set<string>(base);
    presentIdsSet.forEach((id) => merged.add(id));
    return Array.from(merged);
  }, [selectedTemplate, presentIdsSet]);

  const searchMatches = useMemo(() => {
    if (studentSearch.trim().length < 2) return [];
    const pool = allStudentsCache.length > 0 ? allStudentsCache : unitStudents;
    return pool.filter((s) => matchesStudentQuery(s, studentSearch)).slice(0, 15);
  }, [studentSearch, allStudentsCache, unitStudents]);

  const formattedDateLabel = currentDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  const isToday = dateString === getLocalDateStr(new Date());

  return (
    <View className="flex-1 bg-[#f8f9fa] dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Cabeçalho */}
      <View className="bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-white/5">
        <IntranetScreenHeader
          title="Grade e Chamada"
          subtitle={`Unidade ${formatUnitName(selectedUnit)}`}
          currentTab="grade"
          rightAction={
            !isToday ? (
              <TouchableOpacity
                onPress={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/30"
              >
                <Text className="text-xs font-bold text-amber-600 dark:text-amber-400">Ir para Hoje</Text>
              </TouchableOpacity>
            ) : undefined
          }
        />

        <UnitFilterStrip selectedUnit={selectedUnit} onSelectUnit={setSelectedUnit} includeAll={false} />

        {/* Seletor de Data */}
        <View className="flex-row items-center justify-between px-4 py-2.5 border-t border-gray-100 dark:border-white/5">
          <TouchableOpacity
            onPress={() => changeDate(-1)}
            className="p-2 rounded-xl bg-gray-100 dark:bg-[#1a1a1a]"
          >
            <ChevronLeft size={18} color={isDark ? '#fff' : '#111827'} />
          </TouchableOpacity>

          <View className="flex-row items-center gap-2">
            <Calendar size={14} color="#eab308" />
            <Text className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wide">
              {formattedDateLabel}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => changeDate(1)}
            className="p-2 rounded-xl bg-gray-100 dark:bg-[#1a1a1a]"
          >
            <ChevronRight size={18} color={isDark ? '#fff' : '#111827'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de Turmas */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#eab308" size="large" />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {templates.length === 0 ? (
            <View className="bg-white dark:bg-[#141414] rounded-3xl p-8 items-center border border-gray-100 dark:border-white/5 mt-4">
              <Calendar size={32} color="#9ca3af" />
              <Text className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-3 text-center">
                Nenhuma turma programada para este dia.
              </Text>
            </View>
          ) : (
            templates.map((tpl) => {
              const inst = instancesMap[tpl.id];
              const presentCount = Array.isArray(inst?.presentStudents) ? inst.presentStudents.length : 0;
              const trialList: any[] = Array.isArray(inst?.trialStudents) ? inst.trialStudents : [];
              const capacity = tpl.capacity || (Array.isArray(tpl.students) ? tpl.students.length : 20);

              return (
                <TouchableOpacity
                  key={tpl.id}
                  onPress={() => {
                    setSelectedTemplate(tpl);
                    setStudentSearch('');
                    setShowAddTrial(false);
                  }}
                  activeOpacity={0.85}
                  className="bg-white dark:bg-[#141414] rounded-2xl p-4 mb-3 border border-gray-100 dark:border-white/10"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3 flex-1 pr-2">
                      <View className="bg-amber-400/15 border border-amber-400/30 rounded-xl px-3 py-2 items-center justify-center">
                        <Clock size={14} color="#eab308" />
                        <Text className="text-xs font-black text-amber-600 dark:text-amber-400 mt-0.5">
                          {tpl.time || '--:--'}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-black text-gray-900 dark:text-white" numberOfLines={1}>
                          {tpl.name || tpl.category || 'Turma'}
                        </Text>
                        <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {tpl.category || 'Geral'} {tpl.instructorName ? `• ${tpl.instructorName}` : ''}
                        </Text>
                      </View>
                    </View>

                    <View className="items-end">
                      <View className="flex-row items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                        <Users size={12} color="#10b981" />
                        <Text className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                          {presentCount}/{capacity}
                        </Text>
                      </View>
                      {trialList.length > 0 && (
                        <Text className="text-[10px] font-bold text-amber-500 mt-1">
                          {trialList.length} exp.
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal de Chamada da Turma */}
      <Modal
        visible={!!selectedTemplate}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedTemplate(null)}
      >
        <View className="flex-1 bg-[#f8f9fa] dark:bg-[#050505]">
          <View className="bg-white dark:bg-[#0a0a0a] px-5 pt-5 pb-4 border-b border-gray-100 dark:border-white/5 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-lg font-black text-gray-900 dark:text-white" numberOfLines={1}>
                {selectedTemplate?.name || selectedTemplate?.category || 'Chamada'}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {selectedTemplate?.time || '--:--'} • {presentIdsSet.size} presentes • {dateString}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedTemplate(null)}
              className="p-2 rounded-xl bg-gray-100 dark:bg-[#1a1a1a]"
            >
              <X size={20} color={isDark ? '#fff' : '#111827'} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {/* Check-in rápido por busca */}
            <View className="bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10 mb-4">
              <Text className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Adicionar Presença Avulsa (Buscar Aluno)
              </Text>
              <View className="flex-row items-center bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-xl px-3">
                <Search size={16} color="#9ca3af" />
                <TextInput
                  value={studentSearch}
                  onChangeText={(txt) => {
                    setStudentSearch(txt);
                    if (txt.trim().length >= 2) ensureAllSchoolLoadedForSearch();
                  }}
                  placeholder="Nome ou ID do aluno..."
                  placeholderTextColor="#9ca3af"
                  className="flex-1 py-2.5 px-2.5 text-sm text-gray-900 dark:text-white"
                />
                {studentSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setStudentSearch('')}>
                    <X size={16} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>

              {studentSearch.trim().length >= 2 && (
                <View className="mt-2 border-t border-gray-100 dark:border-white/5 pt-2">
                  {loadingStudents && searchMatches.length === 0 ? (
                    <ActivityIndicator color="#eab308" size="small" />
                  ) : searchMatches.length === 0 ? (
                    <Text className="text-xs text-gray-400 text-center py-2">Nenhum aluno encontrado</Text>
                  ) : (
                    searchMatches.map((student) => {
                      const sId = String(student.idMember);
                      const isPresent = presentIdsSet.has(sId);
                      return (
                        <TouchableOpacity
                          key={sId}
                          onPress={() => {
                            toggleStudentPresence(sId, isPresent);
                            setStudentSearch('');
                          }}
                          className="flex-row items-center justify-between py-2.5 border-b border-gray-100 dark:border-white/5 last:border-b-0"
                        >
                          <View className="flex-1 pr-2">
                            <Text className="text-xs font-bold text-gray-900 dark:text-white">
                              {student.firstName} {student.lastName || ''}
                            </Text>
                            <Text className="text-[10px] text-gray-400">
                              ID: {sId} • {formatUnitName(student.branchName || student.unitId)}
                            </Text>
                          </View>
                          <View
                            className={`px-3 py-1 rounded-lg ${
                              isPresent ? 'bg-emerald-500' : 'bg-[#eab308]'
                            }`}
                          >
                            <Text className="text-[11px] font-black text-black">
                              {isPresent ? 'Presente' : 'Marcar'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}
            </View>

            {/* Aulas Experimentais */}
            <View className="bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10 mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  Aulas Experimentais ({(selectedInstance?.trialStudents || []).length})
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAddTrial(!showAddTrial)}
                  className="flex-row items-center gap-1 bg-amber-400/15 px-3 py-1.5 rounded-lg"
                >
                  <UserPlus size={14} color="#eab308" />
                  <Text className="text-xs font-bold text-amber-600 dark:text-amber-400">Nova Exp.</Text>
                </TouchableOpacity>
              </View>

              {showAddTrial && (
                <View className="bg-gray-50 dark:bg-[#0a0a0a] p-3 rounded-xl border border-gray-200 dark:border-white/10 mb-3 gap-2">
                  <TextInput
                    value={trialName}
                    onChangeText={setTrialName}
                    placeholder="Nome completo"
                    placeholderTextColor="#9ca3af"
                    className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white"
                  />
                  <TextInput
                    value={trialPhone}
                    onChangeText={setTrialPhone}
                    placeholder="Telefone / WhatsApp (opcional)"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                    className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white"
                  />
                  <TouchableOpacity
                    onPress={handleAddTrialStudent}
                    disabled={savingTrial}
                    className="bg-[#eab308] py-2.5 rounded-lg items-center"
                  >
                    <Text className="text-xs font-black text-black">
                      {savingTrial ? 'Salvando...' : 'Adicionar Experimental'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {(selectedInstance?.trialStudents || []).length === 0 ? (
                <Text className="text-xs text-gray-400">Nenhuma aula experimental nesta turma.</Text>
              ) : (
                (selectedInstance?.trialStudents || []).map((trial: any, idx: number) => (
                  <TouchableOpacity
                    key={`${trial.name}-${idx}`}
                    onPress={() => toggleTrialAttendance(idx)}
                    className="flex-row items-center justify-between py-2.5 border-b border-gray-100 dark:border-white/5 last:border-b-0"
                  >
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-gray-900 dark:text-white">{trial.name}</Text>
                      {!!trial.phone && <Text className="text-[10px] text-gray-400">{trial.phone}</Text>}
                    </View>
                    <View
                      className={`px-3 py-1 rounded-lg flex-row items-center gap-1 ${
                        trial.compareceu
                          ? 'bg-emerald-500/15 border border-emerald-500/30'
                          : 'bg-gray-100 dark:bg-white/5'
                      }`}
                    >
                      {trial.compareceu && <Check size={12} color="#10b981" />}
                      <Text
                        className={`text-[11px] font-bold ${
                          trial.compareceu ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'
                        }`}
                      >
                        {trial.compareceu ? 'Compareceu' : 'Pendente'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Lista de Alunos da Turma e Presentes */}
            <View className="bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10">
              <Text className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                Lista de Chamada ({presentIdsSet.size} presentes)
              </Text>

              {enrolledIds.length === 0 ? (
                <Text className="text-xs text-gray-400">
                  Nenhum aluno vinculado ou presente ainda. Use a busca acima para marcar presença.
                </Text>
              ) : (
                enrolledIds.map((sId) => {
                  const st = studentsById.get(sId);
                  const displayName = st
                    ? `${st.firstName || ''} ${st.lastName || ''}`.trim()
                    : `Aluno #${sId}`;
                  const isPresent = presentIdsSet.has(sId);
                  const isBusy = submittingId === sId;

                  return (
                    <TouchableOpacity
                      key={sId}
                      disabled={isBusy}
                      onPress={() => toggleStudentPresence(sId, isPresent)}
                      className="flex-row items-center justify-between py-3 border-b border-gray-100 dark:border-white/5 last:border-b-0"
                    >
                      <View className="flex-1 pr-3">
                        <Text className="text-sm font-bold text-gray-900 dark:text-white">{displayName}</Text>
                        <Text className="text-[10px] text-gray-400">ID: {sId}</Text>
                      </View>
                      <View
                        className={`px-3 py-1.5 rounded-xl flex-row items-center gap-1.5 ${
                          isPresent
                            ? 'bg-emerald-500'
                            : 'bg-gray-100 dark:bg-white/10'
                        }`}
                      >
                        {isBusy ? (
                          <ActivityIndicator size="small" color={isPresent ? '#fff' : '#eab308'} />
                        ) : (
                          <>
                            {isPresent && <Check size={14} color="#fff" />}
                            <Text
                              className={`text-xs font-black ${
                                isPresent ? 'text-white' : 'text-gray-600 dark:text-gray-300'
                              }`}
                            >
                              {isPresent ? 'Presente' : 'Falta'}
                            </Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
