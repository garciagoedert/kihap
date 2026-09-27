import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, Image, Alert, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot, orderBy, limit, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { Heart, Award, CreditCard, MessageCircle, Bell, CheckCheck, Flame, Trophy, Calendar, Sparkles, AlertCircle, User, Lock, ArrowLeft, Activity, Plus, ChevronRight, Check } from 'lucide-react-native';
export default function NotificacoesScreen() {
  const { user, userData } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSubTab, setActiveSubTab] = useState<'ofensivas' | 'emblemas' | 'teste-fisico'>('ofensivas');
  const [ofensivaSubTab, setOfensivaSubTab] = useState<'ofensiva' | 'ranking'>('ofensiva');
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [weekDays, setWeekDays] = useState<any[]>([]);
  const [weekLoading, setWeekLoading] = useState(true);

  // Ranking states
  const [ranking, setRanking] = useState<any[]>([]);
  const [rankingFilter, setRankingFilter] = useState<'current' | 'longest'>('current');
  const [rankingUnit, setRankingUnit] = useState<string>('todos');
  const [rankingLoading, setRankingLoading] = useState(false);

  const filters = [
    { id: 'all', label: 'Tudo' },
    { id: 'system', label: 'Sistema' },
    { id: 'conversas', label: 'Conversas' },
    { id: 'eventos', label: 'Eventos' },
  ];

  const isStaff = !!(
    userData?.isAdmin || 
    userData?.isInstructor || 
    userData?.isRH || 
    userData?.isFinanceiro || 
    userData?.isAdministrativo || 
    userData?.isStore || 
    userData?.isAcademy || 
    userData?.isJuridico || 
    userData?.isSuporte || 
    userData?.unitId === 'staff' || 
    userData?.unidadeId === 'staff'
  );

  const units = [
    { id: 'todos', label: 'Todas Unidades' },
    ...(isStaff ? [{ id: 'staff', label: 'Staff' }] : []),
    { id: 'centro', label: 'Centro' },
    { id: 'coqueiros', label: 'Coqueiros' },
    { id: 'santa-monica', label: 'Santa Mônica' },
    { id: 'asa-sul', label: 'Asa Sul' },
    { id: 'sudoeste', label: 'Sudoeste' },
    { id: 'lago-sul', label: 'Lago Sul' },
    { id: 'pontos-de-ensino', label: 'Pontos de Ensino' },
    { id: 'jardim-botanico', label: 'Jardim Botânico' },
    { id: 'dourados', label: 'Dourados' },
    { id: 'noroeste', label: 'Noroeste' },
  ];

  // Generate week days (Monday to Sunday)
  useEffect(() => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 Sunday, 1 Monday...
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        dateStr,
        label: d.toLocaleDateString('pt-BR', { weekday: 'narrow' }), // S, T, Q, Q, S, S, D
        dayNum: d.getDate(),
        isToday: dateStr === today.toISOString().split('T')[0],
        attended: false,
      });
    }
    setWeekDays(days);
  }, []);

  // Fetch class attendance for current week
  useEffect(() => {
    if (!userData?.evoMemberId || weekDays.length === 0) {
      setWeekLoading(false);
      return;
    }

    const startOfWeek = weekDays[0].dateStr;
    const endOfWeek = weekDays[6].dateStr;

    const instancesCol = collection(db, 'classInstances');
    const q = query(
      instancesCol,
      where('date', '>=', startOfWeek),
      where('date', '<=', endOfWeek)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const attendedDates = new Set<string>();
      const studentId = userData.evoMemberId;

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const presentStudents = data.presentStudents || [];
        const isPresent = presentStudents.includes(studentId.toString()) || presentStudents.includes(Number(studentId));
        if (isPresent && data.date) {
          attendedDates.add(data.date);
        }
      });

      setWeekDays(prev => prev.map(day => ({
        ...day,
        attended: attendedDates.has(day.dateStr)
      })));
      setWeekLoading(false);
    }, (error) => {
      console.error("Error fetching week class instances:", error);
      setWeekLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.evoMemberId, weekDays.length]);

  // Fetch ranking list from Firestore (filtered in memory by unit for safety against missing index crashes)
  useEffect(() => {
    if (activeSubTab !== 'ofensivas') return;

    setRankingLoading(true);
    const usersCol = collection(db, 'users');
    const orderField = rankingFilter === 'current' ? 'currentStreak' : 'longestStreak';
    
    // Fetch users with a streak > 0, ordered descending, limit to 150
    const q = query(
      usersCol,
      where(orderField, '>', 0),
      orderBy(orderField, 'desc'),
      limit(150)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let rankingList = snapshot.docs.map(docSnap => ({
        uid: docSnap.id,
        ...docSnap.data()
      }));

      // Filter by unitId/unidadeId/unit/unidade in JavaScript
      if (rankingUnit !== 'todos') {
        rankingList = rankingList.filter((u: any) => {
          const userUnit = (u.unitId || u.unidadeId || u.unit || u.unidade || '').toLowerCase();
          return userUnit === rankingUnit.toLowerCase();
        });
      }

      setRanking(rankingList);
      setRankingLoading(false);
    }, (error) => {
      console.error("Error fetching ranking:", error);
      setRankingLoading(false);
    });

    return () => unsubscribe();
  }, [activeSubTab, rankingFilter, rankingUnit]);

  // Fetch notifications
  useEffect(() => {
    if (!user) return;

    const notifsCollection = collection(db, 'notifications');
    const q = query(
      notifsCollection,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifList = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setNotifications(notifList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notifications:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch all badges
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(true);

  useEffect(() => {
    const badgesCol = collection(db, 'badges');
    const unsubscribe = onSnapshot(badgesCol, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setAllBadges(list);
      setBadgesLoading(false);
    }, (error) => {
      console.error("Error fetching badges:", error);
      setBadgesLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Physical Tests states & listeners
  const [physicalTests, setPhysicalTests] = useState<any[]>([]);
  const [physicalTestsLoading, setPhysicalTestsLoading] = useState(true);
  const [testDateInput, setTestDateInput] = useState(() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${now.getFullYear()}`;
  });
  const [testScoreInput, setTestScoreInput] = useState('');
  const [savingTest, setSavingTest] = useState(false);
  const [showAddForm, setShowAddForm] = useState(true);

  useEffect(() => {
    if (!user) {
      setPhysicalTestsLoading(false);
      return;
    }

    const evoId = userData?.evoMemberId;
    const evoIdNum = evoId && !isNaN(Number(evoId)) ? Number(evoId) : null;
    const testsCol = collection(db, 'physicalTests');

    let unsubEvo: (() => void) | null = null;
    let unsubUser: (() => void) | null = null;

    let evoTests: any[] = [];
    let userTests: any[] = [];

    const mergeAndSetTests = () => {
      const map = new Map<string, any>();
      [...evoTests, ...userTests].forEach(item => {
        if (item.id) map.set(item.id, item);
      });
      const list = Array.from(map.values());
      list.sort((a, b) => {
        const dateA = a.date?.toMillis ? a.date.toMillis() : (a.date?.seconds ? a.date.seconds * 1000 : (a.date ? new Date(a.date).getTime() : 0));
        const dateB = b.date?.toMillis ? b.date.toMillis() : (b.date?.seconds ? b.date.seconds * 1000 : (b.date ? new Date(b.date).getTime() : 0));
        return dateB - dateA;
      });
      setPhysicalTests(list);
      setPhysicalTestsLoading(false);
    };

    if (evoIdNum !== null) {
      const qEvo = query(
        testsCol,
        where('evoMemberId', '==', evoIdNum),
        limit(50)
      );
      unsubEvo = onSnapshot(qEvo, (snapshot) => {
        evoTests = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        mergeAndSetTests();
      }, (err) => {
        console.error("Error fetching evo physical tests:", err);
        setPhysicalTestsLoading(false);
      });
    }

    const qUser = query(
      testsCol,
      where('userId', '==', user.uid),
      limit(50)
    );
    unsubUser = onSnapshot(qUser, (snapshot) => {
      userTests = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      mergeAndSetTests();
    }, (err) => {
      console.error("Error fetching user physical tests:", err);
      setPhysicalTestsLoading(false);
    });

    return () => {
      if (unsubEvo) unsubEvo();
      if (unsubUser) unsubUser();
    };
  }, [user?.uid, userData?.evoMemberId]);

  const handleSaveTest = async () => {
    if (!testScoreInput.trim()) {
      Alert.alert("Atenção", "Por favor, digite a pontuação do teste físico.");
      return;
    }

    const scoreNum = parseFloat(testScoreInput.replace(',', '.'));
    if (isNaN(scoreNum) || scoreNum < 0) {
      Alert.alert("Pontuação inválida", "Por favor, digite um número válido para a pontuação.");
      return;
    }

    const parts = testDateInput.trim().split('/');
    if (parts.length !== 3) {
      Alert.alert("Data inválida", "Informe a data no formato DD/MM/AAAA (ex: 26/09/2026).");
      return;
    }

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const dateObj = new Date(year, month, day, 12, 0, 0);

    if (isNaN(dateObj.getTime()) || year < 2000 || year > 2100 || month < 0 || month > 11 || day < 1 || day > 31) {
      Alert.alert("Data inválida", "Verifique o dia, mês e ano informados.");
      return;
    }

    setSavingTest(true);
    try {
      const evoId = userData?.evoMemberId;
      const evoIdNum = evoId && !isNaN(Number(evoId)) ? Number(evoId) : null;

      await addDoc(collection(db, 'physicalTests'), {
        date: Timestamp.fromDate(dateObj),
        score: scoreNum,
        evoMemberId: evoIdNum,
        userId: user?.uid || null,
        studentName: userData?.name || userData?.nome || user?.displayName || 'Aluno',
        createdBy: 'student',
        createdAt: serverTimestamp()
      });

      setTestScoreInput('');
      const now = new Date();
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      setTestDateInput(`${d}/${m}/${now.getFullYear()}`);
      Alert.alert("Sucesso! 🥋", "Seu teste físico foi registrado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao salvar teste físico:", err);
      Alert.alert("Erro", `Não foi possível salvar o teste físico: ${err.message || 'Erro de permissão'}`);
    } finally {
      setSavingTest(false);
    }
  };

  const formatTestDate = (rawDate: any) => {
    if (!rawDate) return 'Data não informada';
    let d: Date;
    if (rawDate.toDate) {
      d = rawDate.toDate();
    } else if (rawDate.seconds) {
      d = new Date(rawDate.seconds * 1000);
    } else if (typeof rawDate === 'string') {
      d = new Date(rawDate);
    } else if (rawDate instanceof Date) {
      d = rawDate;
    } else {
      return 'Data não informada';
    }
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const maxPhysicalScore = physicalTests.length > 0
    ? Math.max(...physicalTests.map(t => Number(t.score) || 0))
    : 0;
  const latestPhysicalTest = physicalTests.length > 0 ? physicalTests[0] : null;


  const getIcon = (type: string) => {
    switch (type) {
      case 'chat': return MessageCircle;
      case 'award': return Award;
      case 'payment': return CreditCard;
      default: return Bell;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'chat': return '#014fa4';
      case 'award': return '#eab308';
      case 'payment': return '#22c55e';
      default: return '#666';
    }
  };

  const getStreakStatus = () => {
    const lastDateStr = userData?.lastAttendanceDate;
    if (!lastDateStr) {
      return {
        message: "Faça seu primeiro check-in de aula para iniciar sua ofensiva! 🥋",
        urgencyColor: "text-blue-500",
        bgClass: "bg-blue-500/10 border-blue-500/20",
        iconColor: "#3b82f6"
      };
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    if (lastDateStr === todayStr) {
      return {
        message: "Excelente! Você fez aula hoje. Ofensiva garantida por mais 5 dias! 🛡️",
        urgencyColor: "text-emerald-500",
        bgClass: "bg-emerald-500/10 border-emerald-500/20",
        iconColor: "#10b981"
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
        bgClass: "bg-orange-500/10 border-orange-500/20",
        iconColor: "#f97316"
      };
    } else if (daysRemaining === 1) {
      return {
        message: "Atenção: Você tem apenas 1 dia para fazer aula ou sua ofensiva será zerada! ⚠️",
        urgencyColor: "text-rose-500",
        bgClass: "bg-rose-500/10 border-rose-500/20",
        iconColor: "#f43f5e"
      };
    } else {
      return {
        message: "Sua ofensiva expirou. Faça check-in na próxima aula para recomeçar! 🔄",
        urgencyColor: "text-gray-500",
        bgClass: "bg-gray-500/10 border-gray-500/20",
        iconColor: "#6b7280"
      };
    }
  };

  const filteredNotifs = notifications.filter(n => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'system') return ['admin', 'system'].includes(n.type);
    if (activeFilter === 'conversas') return n.type === 'chat';
    if (activeFilter === 'eventos') return n.type === 'event';
    return true;
  });

  return (
    <View style={{ flex: 1, paddingTop: insets.top }} className="flex-1 bg-white dark:bg-[#0a0a0a]">
      <View className="px-6 pt-8 pb-2">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Atividade</Text>
          {activeSubTab === 'emblemas' && (
            <View className="bg-yellow-500/10 px-3.5 py-1.5 rounded-full border border-yellow-500/20">
              <Text className="text-yellow-605 dark:text-yellow-500 text-[10px] font-black uppercase tracking-wider">
                {(userData?.earnedBadges || []).length} Conquistados
              </Text>
            </View>
          )}
          {activeSubTab === 'teste-fisico' && (
            <View className="bg-red-500/10 px-3.5 py-1.5 rounded-full border border-red-500/20">
              <Text className="text-red-500 text-[10px] font-black uppercase tracking-wider">
                {physicalTests.length} {physicalTests.length === 1 ? 'Avaliação' : 'Avaliações'}
              </Text>
            </View>
          )}
        </View>

        {/* Sub-tab Selectors (Three-way toggle) */}
        <View className="flex-row bg-gray-100 dark:bg-[#1a1a1a] p-1 rounded-2xl mb-4">
          <TouchableOpacity 
            onPress={() => setActiveSubTab('ofensivas')}
            style={activeSubTab === 'ofensivas' ? {
              backgroundColor: isDark ? '#2b2b2b' : '#fff',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.15,
              shadowRadius: 1.5,
              elevation: 2,
            } : null}
            className="flex-1 py-2.5 rounded-xl items-center justify-center flex-row px-1"
          >
            <Flame size={15} color={activeSubTab === 'ofensivas' ? '#f97316' : '#888'} style={{ marginRight: 4 }} />
            <Text 
              style={{ color: activeSubTab === 'ofensivas' ? (isDark ? '#fff' : '#111') : '#999' }}
              className="text-[11px] font-black uppercase tracking-tight text-center"
              numberOfLines={1}
            >
              Ofensivas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setActiveSubTab('emblemas')}
            style={activeSubTab === 'emblemas' ? {
              backgroundColor: isDark ? '#2b2b2b' : '#fff',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.15,
              shadowRadius: 1.5,
              elevation: 2,
            } : null}
            className="flex-1 py-2.5 rounded-xl items-center justify-center flex-row px-1"
          >
            <Award size={15} color={activeSubTab === 'emblemas' ? '#eab308' : '#888'} style={{ marginRight: 4 }} />
            <Text 
              style={{ color: activeSubTab === 'emblemas' ? (isDark ? '#fff' : '#111') : '#999' }}
              className="text-[11px] font-black uppercase tracking-tight text-center"
              numberOfLines={1}
            >
              Emblemas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setActiveSubTab('teste-fisico')}
            style={activeSubTab === 'teste-fisico' ? {
              backgroundColor: isDark ? '#2b2b2b' : '#fff',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.15,
              shadowRadius: 1.5,
              elevation: 2,
            } : null}
            className="flex-1 py-2.5 rounded-xl items-center justify-center flex-row px-1"
          >
            <Activity size={15} color={activeSubTab === 'teste-fisico' ? '#ef4444' : '#888'} style={{ marginRight: 4 }} />
            <Text 
              style={{ color: activeSubTab === 'teste-fisico' ? (isDark ? '#fff' : '#111') : '#999' }}
              className="text-[11px] font-black uppercase tracking-tight text-center"
              numberOfLines={1}
            >
              Teste Físico
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeSubTab === 'ofensivas' ? (
        <View className="flex-1">
          {/* Sub-selector: Minha Ofensiva vs Ranking */}
          <View className="px-6 mb-3">
            <View className="flex-row bg-gray-100 dark:bg-[#1a1a1a] p-1 rounded-2xl">
              <TouchableOpacity
                onPress={() => setOfensivaSubTab('ofensiva')}
                style={ofensivaSubTab === 'ofensiva' ? {
                  backgroundColor: isDark ? '#2b2b2b' : '#fff',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.12,
                  shadowRadius: 1.5,
                  elevation: 2,
                } : null}
                className="flex-1 py-2 rounded-xl items-center justify-center flex-row"
              >
                <Flame size={14} color={ofensivaSubTab === 'ofensiva' ? '#f97316' : '#888'} style={{ marginRight: 6 }} />
                <Text
                  style={{ color: ofensivaSubTab === 'ofensiva' ? (isDark ? '#fff' : '#111') : '#888' }}
                  className="text-xs font-black uppercase tracking-tight"
                >
                  Minha Ofensiva
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setOfensivaSubTab('ranking')}
                style={ofensivaSubTab === 'ranking' ? {
                  backgroundColor: isDark ? '#2b2b2b' : '#fff',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.12,
                  shadowRadius: 1.5,
                  elevation: 2,
                } : null}
                className="flex-1 py-2 rounded-xl items-center justify-center flex-row"
              >
                <Trophy size={14} color={ofensivaSubTab === 'ranking' ? '#eab308' : '#888'} style={{ marginRight: 6 }} />
                <Text
                  style={{ color: ofensivaSubTab === 'ranking' ? (isDark ? '#fff' : '#111') : '#888' }}
                  className="text-xs font-black uppercase tracking-tight"
                >
                  Ranking
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {ofensivaSubTab === 'ofensiva' ? (
            <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Flame Circle Visualizer */}
          <View className="items-center py-6">
            <View className="relative items-center justify-center">
              {/* Outer Glow Circles */}
              <View className="w-44 h-44 rounded-full bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/10 items-center justify-center">
                <View className="w-36 h-36 rounded-full bg-orange-500/10 dark:bg-orange-500/20 border border-orange-500/20 items-center justify-center">
                  <Flame size={80} color="#f97316" />
                </View>
              </View>
            </View>
            <Text className="text-5xl font-black text-gray-900 dark:text-white mt-6 mb-1">
              {userData?.currentStreak || 0} {userData?.currentStreak === 1 ? 'Dia' : 'Dias'}
            </Text>
            <Text className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[2px] text-center">
              De Ofensiva de Aulas 🔥
            </Text>
          </View>

          {/* Week Attendance Visualizer */}
          <View className="bg-white dark:bg-[#1a1a1a] p-6 rounded-3xl border border-gray-100 dark:border-white/5 mb-6 shadow-sm">
            <Text className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
              📅 Minha Semana
            </Text>
            {weekLoading ? (
              <ActivityIndicator size="small" color="#f97316" className="py-4" />
            ) : (
              <View className="flex-row justify-between">
                {weekDays.map((day) => {
                  let containerBg = 'transparent';
                  let containerBorder = isDark ? '#333' : '#eee';
                  
                  if (day.attended) {
                    containerBg = isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(249, 115, 22, 0.1)';
                    containerBorder = 'rgba(249, 115, 22, 0.2)';
                  } else if (day.isToday) {
                    containerBg = isDark ? '#2b2b2b' : '#f3f4f6';
                    containerBorder = isDark ? '#444' : '#d1d5db';
                  }

                  return (
                    <View key={day.dateStr} className="items-center flex-1">
                      <Text className="text-[10px] font-bold text-gray-400 uppercase mb-2">{day.label}</Text>
                      <View 
                        style={{
                          backgroundColor: containerBg,
                          borderColor: containerBorder,
                        }}
                        className="w-10 h-10 rounded-full items-center justify-center border"
                      >
                        {day.attended ? (
                          <Flame size={20} color="#f97316" />
                        ) : (
                          <Text 
                            style={{
                              color: day.isToday 
                                ? (isDark ? '#fff' : '#111') 
                                : (isDark ? '#444' : '#ccc')
                            }}
                            className="text-xs font-extrabold"
                          >
                            {day.dayNum}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Streak Status Advice Alert */}
          {(() => {
            const status = getStreakStatus();
            let bgCol = isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 246, 255, 0.2)';
            let borderCol = isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)';
            let textCol = '#3b82f6';

            if (status.urgencyColor.includes('emerald')) {
              bgCol = isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(240, 253, 250, 0.2)';
              borderCol = isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)';
              textCol = '#10b981';
            } else if (status.urgencyColor.includes('orange')) {
              bgCol = isDark ? 'rgba(249, 115, 22, 0.1)' : 'rgba(255, 247, 237, 0.2)';
              borderCol = isDark ? 'rgba(249, 115, 22, 0.2)' : 'rgba(249, 115, 22, 0.15)';
              textCol = '#f97316';
            } else if (status.urgencyColor.includes('rose')) {
              bgCol = isDark ? 'rgba(244, 63, 94, 0.1)' : 'rgba(255, 241, 242, 0.2)';
              borderCol = isDark ? 'rgba(244, 63, 94, 0.2)' : 'rgba(244, 63, 94, 0.15)';
              textCol = '#f43f5e';
            } else if (status.urgencyColor.includes('gray')) {
              bgCol = isDark ? 'rgba(107, 114, 128, 0.1)' : 'rgba(249, 250, 251, 0.2)';
              borderCol = isDark ? 'rgba(107, 114, 128, 0.2)' : 'rgba(107, 114, 128, 0.15)';
              textCol = '#6b7280';
            }

            return (
              <View 
                style={{
                  backgroundColor: bgCol,
                  borderColor: borderCol,
                }}
                className="p-5 rounded-3xl border flex-row items-center mb-6"
              >
                <AlertCircle size={24} color={status.iconColor} style={{ marginRight: 14 }} />
                <View className="flex-1">
                  <Text 
                    style={{ color: textCol }}
                    className="text-[10px] font-black uppercase tracking-wider mb-0.5"
                  >
                    Status da Chama
                  </Text>
                  <Text className="text-[13px] font-bold text-gray-750 dark:text-gray-300 leading-relaxed">
                    {status.message}
                  </Text>
                </View>
              </View>
            );
          })()}

          {/* Mini Stats Cards */}
          <View className="flex-row justify-between mb-6">
            <View className="w-[48%] bg-white dark:bg-[#1a1a1a] p-5 rounded-3xl border border-gray-100 dark:border-white/5 items-center">
              <Trophy size={28} color="#eab308" style={{ marginBottom: 8 }} />
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 text-center">Recorde Máximo</Text>
              <Text className="text-xl font-black text-gray-900 dark:text-white">{userData?.longestStreak || 0} Dias</Text>
            </View>

            <View className="w-[48%] bg-white dark:bg-[#1a1a1a] p-5 rounded-3xl border border-gray-100 dark:border-white/5 items-center">
              <Calendar size={28} color="#014fa4" style={{ marginBottom: 8 }} />
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 text-center">Última Aula</Text>
              <Text className="text-xs font-black text-gray-900 dark:text-white text-center mt-1">
                {userData?.lastAttendanceDate 
                  ? new Date(userData.lastAttendanceDate + 'T12:00:00').toLocaleDateString('pt-BR') 
                  : 'Nenhuma'}
              </Text>
            </View>
          </View>

          {/* Gamified Explanation Banner */}
          <View className="bg-blue-500/5 p-6 rounded-3xl border border-blue-500/10 mb-6">
            <View className="flex-row items-center mb-3">
              <Sparkles size={18} color="#014fa4" style={{ marginRight: 8 }} />
              <Text className="text-xs font-black text-[#014fa4] uppercase tracking-wider">Como funciona?</Text>
            </View>
            <Text className="text-[12px] font-medium text-gray-600 dark:text-gray-400 leading-relaxed">
              Cada check-in de aula realizado acende a sua chama! Você precisa realizar uma nova aula a cada 5 dias para manter a sua chama acesa e aumentar sua ofensiva.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1">
          {/* Ranking Header Filters */}
          <View className="px-6 mb-4">
            {/* Filter 1: Current Streak vs Longest Streak */}
            <View className="flex-row bg-gray-100 dark:bg-[#151515] p-1 rounded-xl mb-3 border border-gray-200/50 dark:border-white/5">
              <TouchableOpacity
                onPress={() => setRankingFilter('current')}
                style={rankingFilter === 'current' ? {
                  backgroundColor: isDark ? '#2b2b2b' : '#fff',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 1,
                  elevation: 1,
                } : null}
                className="flex-1 py-2 rounded-lg items-center justify-center"
              >
                <Text 
                  style={{ color: rankingFilter === 'current' ? (isDark ? '#fff' : '#111') : '#777' }}
                  className="text-xs font-bold"
                >
                  Ofensiva Atual
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setRankingFilter('longest')}
                style={rankingFilter === 'longest' ? {
                  backgroundColor: isDark ? '#2b2b2b' : '#fff',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 1,
                  elevation: 1,
                } : null}
                className="flex-1 py-2 rounded-lg items-center justify-center"
              >
                <Text 
                  style={{ color: rankingFilter === 'longest' ? (isDark ? '#fff' : '#111') : '#777' }}
                  className="text-xs font-bold"
                >
                  Recorde Histórico
                </Text>
              </TouchableOpacity>
            </View>

            {/* Filter 2: Unit scroll list */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
              {units.map((unit) => {
                const isActive = rankingUnit === unit.id;
                return (
                  <TouchableOpacity
                    key={unit.id}
                    onPress={() => setRankingUnit(unit.id)}
                    style={{
                      backgroundColor: isActive 
                        ? (isDark ? '#fff' : '#111') 
                        : (isDark ? '#1a1a1a' : '#fff'),
                      borderColor: isActive
                        ? (isDark ? '#fff' : '#111')
                        : (isDark ? '#333' : '#eee'),
                      borderWidth: 1,
                    }}
                    className="px-4 py-1.5 rounded-full mr-2"
                  >
                    <Text
                      style={{
                        color: isActive 
                          ? (isDark ? '#000' : '#fff') 
                          : (isDark ? '#888' : '#666')
                      }}
                      className="text-[11px] font-bold"
                    >
                      {unit.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {rankingLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#eab308" />
            </View>
          ) : (
            <FlatList
              data={ranking}
              keyExtractor={(item) => item.uid}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
              renderItem={({ item, index }) => {
                const isMe = item.uid === user?.uid;
                const score = rankingFilter === 'current' ? item.currentStreak : item.longestStreak;
                
                // Rank medal or display text
                let rankLabel: string = (index + 1).toString();
                let isMedal = false;
                if (index === 0) {
                  rankLabel = '🥇';
                  isMedal = true;
                } else if (index === 1) {
                  rankLabel = '🥈';
                  isMedal = true;
                } else if (index === 2) {
                  rankLabel = '🥉';
                  isMedal = true;
                }

                // Resolve photo
                let rawPhoto = item.photoURL || item.profilePicture || item.photoUrl || item.avatar;
                if (rawPhoto && rawPhoto.startsWith('/')) {
                  rawPhoto = `https://kihap.com.br${rawPhoto}`;
                }
                const defaultProfileImg = require('../../assets/images/default-profile.png');
                const displayPhoto = rawPhoto && !rawPhoto.includes('default-profile.svg') ? { uri: rawPhoto } : defaultProfileImg;

                // Resolve unit display label
                const displayUnit = item.unitId || item.unidadeId || item.unit || item.unidade || 'KIHAP';
                const capitalizedUnit = displayUnit.charAt(0).toUpperCase() + displayUnit.slice(1);

                return (
                  <View
                    style={{
                      backgroundColor: isMe 
                        ? (isDark ? '#2B2619' : '#FEFBF3')
                        : (isDark ? '#1a1a1a' : '#fff'),
                      borderColor: isMe 
                        ? '#eab308' 
                        : (isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6'),
                      borderWidth: isMe ? 1.5 : 1,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isMe ? 0.08 : 0.02,
                      shadowRadius: 1.5,
                      elevation: isMe ? 2 : 0.5,
                    }}
                    className="flex-row items-center px-4 py-3 rounded-2xl mb-2.5 justify-between"
                  >
                    <View className="flex-row items-center flex-1">
                      {/* Rank Indicator */}
                      <View className="w-8 items-center justify-center mr-2">
                        {isMedal ? (
                          <Text className="text-xl">{rankLabel}</Text>
                        ) : (
                          <Text className="text-sm font-black text-gray-400 dark:text-gray-500">#{rankLabel}</Text>
                        )}
                      </View>

                      {/* Avatar */}
                      <View className="w-10 h-10 rounded-full overflow-hidden border border-gray-100 dark:border-white/5 mr-3">
                        <Image source={displayPhoto} className="w-full h-full object-cover" />
                      </View>

                      {/* Name & Unit info */}
                      <View className="flex-1 pr-2">
                        <Text 
                          style={isMe ? { fontWeight: '900' } : { fontWeight: '700' }}
                          className="text-[14px] text-gray-900 dark:text-white"
                          numberOfLines={1}
                        >
                          {item.name || item.nome || 'Aluno'} {isMe && '(Você)'}
                        </Text>
                        <Text className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                          {capitalizedUnit}
                        </Text>
                      </View>
                    </View>

                    {/* Streak indicator */}
                    <View className="flex-row items-center bg-orange-500/5 px-3 py-1.5 rounded-full border border-orange-500/10">
                      <Flame size={14} color="#f97316" style={{ marginRight: 4 }} />
                      <Text className="text-xs font-black text-orange-500">{score}</Text>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center pt-20 px-8">
                  <Trophy size={48} color={isDark ? '#333' : '#ddd'} style={{ marginBottom: 12 }} />
                  <Text className="text-gray-450 text-center font-bold">Nenhum aluno com ofensiva nesta unidade.</Text>
                </View>
              }
            />
          )}
        </View>
      )}
    </View>
  ) : activeSubTab === 'emblemas' ? (
        badgesLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#eab308" />
          </View>
        ) : (
          <FlatList
            data={allBadges}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            columnWrapperStyle={{ justifyContent: 'flex-start' }}
            ListHeaderComponent={
              <TouchableOpacity
                onPress={() => setActiveSubTab('teste-fisico')}
                activeOpacity={0.8}
                style={{
                  shadowColor: '#ef4444',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                  elevation: 2,
                }}
                className="bg-white dark:bg-[#1a1a1a] p-4 rounded-3xl mb-4 border border-red-500/25 dark:border-red-500/20"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 pr-2">
                    <View className="w-12 h-12 rounded-2xl bg-red-500/10 items-center justify-center mr-3 border border-red-500/20">
                      <Activity size={24} color="#ef4444" />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center mb-0.5">
                        <Text className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mr-2">
                          Teste Físico
                        </Text>
                      </View>
                      <Text className="text-[11px] font-semibold text-gray-500 dark:text-gray-400" numberOfLines={1}>
                        {latestPhysicalTest
                          ? `Último registro: ${latestPhysicalTest.score} pts • Toque para ver histórico`
                          : 'Toque para registrar ou ver seu histórico'}
                      </Text>
                    </View>
                  </View>
                  <View className="bg-red-500/10 px-3 py-1.5 rounded-full flex-row items-center border border-red-500/20">
                    <Text className="text-red-500 text-[10px] font-black uppercase mr-1">Abrir</Text>
                    <ChevronRight size={12} color="#ef4444" />
                  </View>
                </View>
              </TouchableOpacity>
            }
            renderItem={({ item: badge }) => {
              const isPhysicalTestBadge = 
                badge.id === 'teste-fisico' || 
                (badge.name && badge.name.toLowerCase().includes('teste f')) ||
                (badge.name && badge.name.toLowerCase().includes('teste fisico'));

              const isEarned = isPhysicalTestBadge || (userData?.earnedBadges || []).includes(badge.id);
              
              let imageUri = badge.imageUrl || '';
              if (imageUri && imageUri.startsWith('/')) {
                imageUri = `https://kihap.com.br${imageUri}`;
              }

              return (
                <TouchableOpacity
                  onPress={() => {
                    if (isPhysicalTestBadge) {
                      setActiveSubTab('teste-fisico');
                      return;
                    }
                    Alert.alert(
                      badge.name || "Emblema",
                      badge.description || "Sem descrição disponível para este emblema.",
                      [{ text: "Entendido", style: "default" }]
                    );
                  }}
                  style={{
                    width: '30.33%',
                    margin: '1.5%',
                  }}
                  className={`bg-white dark:bg-[#1a1a1a] p-4 rounded-3xl items-center justify-center border ${
                    isPhysicalTestBadge
                      ? 'border-red-500/30 dark:border-red-500/20 shadow-sm shadow-red-500/10'
                      : isEarned
                      ? 'border-yellow-500/30 dark:border-yellow-500/20 shadow-sm shadow-black/5'
                      : 'border-gray-100 dark:border-white/5 opacity-40'
                  }`}
                >
                  <View className="relative w-14 h-14 items-center justify-center mb-2.5">
                    {imageUri ? (
                      <Image
                        source={{ uri: imageUri }}
                        className="w-full h-full object-contain"
                        resizeMode="contain"
                      />
                    ) : (
                      <Award size={36} color={isPhysicalTestBadge ? "#ef4444" : isEarned ? "#eab308" : "#888"} />
                    )}
                    
                    {!isEarned && !isPhysicalTestBadge && (
                      <View className="absolute bottom-0 right-0 bg-black/60 dark:bg-black/80 p-1 rounded-full border border-white/20">
                        <Lock size={10} color="#fff" />
                      </View>
                    )}

                    {isPhysicalTestBadge && (
                      <View className="absolute -bottom-1 -right-1 bg-red-500 p-1 rounded-full border border-white dark:border-[#1a1a1a]">
                        <Activity size={9} color="#fff" />
                      </View>
                    )}
                  </View>
                  
                  <Text
                    numberOfLines={1}
                    className={`text-[10px] text-center font-black uppercase tracking-wider ${
                      isPhysicalTestBadge 
                        ? 'text-red-500 dark:text-red-400' 
                        : isEarned 
                        ? 'text-gray-900 dark:text-white' 
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {badge.name || "Emblema"}
                  </Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center pt-20 px-8">
                <Award size={48} color={isDark ? '#333' : '#ddd'} style={{ marginBottom: 12 }} />
                <Text className="text-gray-400 text-center font-bold">Nenhum emblema cadastrado no sistema.</Text>
              </View>
            }
          />
        )
      ) : (
        /* Teste Físico View */
        <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Hero Card com Emblema e Estatísticas */}
          <View className="bg-white dark:bg-[#1a1a1a] p-6 rounded-3xl border border-gray-100 dark:border-white/5 mb-6 shadow-sm">
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center flex-1">
                <View className="w-14 h-14 rounded-2xl bg-red-500/10 items-center justify-center mr-4 border border-red-500/20">
                  <Activity size={30} color="#ef4444" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                      Teste Físico
                    </Text>
                  </View>
                  <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 mt-0.5">
                    Acompanhe seu condicionamento e evolução
                  </Text>
                </View>
              </View>
            </View>

            {/* 3 Metric Cards */}
            <View className="flex-row justify-between">
              {/* Recorde */}
              <View className="flex-1 bg-amber-500/5 dark:bg-amber-500/10 p-3.5 rounded-2xl border border-amber-500/20 items-center mr-2">
                <Trophy size={18} color="#eab308" style={{ marginBottom: 4 }} />
                <Text className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">Recorde</Text>
                <Text className="text-base font-black text-amber-500 mt-0.5">{maxPhysicalScore} pts</Text>
              </View>

              {/* Último */}
              <View className="flex-1 bg-red-500/5 dark:bg-red-500/10 p-3.5 rounded-2xl border border-red-500/20 items-center mr-2">
                <Flame size={18} color="#ef4444" style={{ marginBottom: 4 }} />
                <Text className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">Último</Text>
                <Text className="text-base font-black text-red-500 mt-0.5">{latestPhysicalTest ? `${latestPhysicalTest.score} pts` : '--'}</Text>
              </View>

              {/* Avaliações */}
              <View className="flex-1 bg-blue-500/5 dark:bg-blue-500/10 p-3.5 rounded-2xl border border-blue-500/20 items-center">
                <Calendar size={18} color="#3b82f6" style={{ marginBottom: 4 }} />
                <Text className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">Testes</Text>
                <Text className="text-base font-black text-blue-500 mt-0.5">{physicalTests.length}</Text>
              </View>
            </View>
          </View>

          {/* Card: Adicionar Novo Log de Teste Físico (estilo Intranet) */}
          <View className="bg-white dark:bg-[#1a1a1a] p-6 rounded-3xl border border-gray-100 dark:border-white/5 mb-6 shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-xl bg-emerald-500/10 items-center justify-center mr-2.5">
                  <Plus size={16} color="#10b981" />
                </View>
                <Text className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  Adicionar Novo Log
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowAddForm(!showAddForm)}
                className="px-3 py-1 rounded-full bg-gray-100 dark:bg-[#252525]"
              >
                <Text className="text-[10px] font-bold text-gray-600 dark:text-gray-300">
                  {showAddForm ? 'Ocultar' : 'Novo Teste'}
                </Text>
              </TouchableOpacity>
            </View>

            {showAddForm && (
              <View className="pt-2 border-t border-gray-100 dark:border-white/5 mt-2">
                {/* Campo Data */}
                <View className="mb-4">
                  <View className="flex-row justify-between items-center mb-1.5">
                    <Text className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                      DATA:
                    </Text>
                    <TouchableOpacity 
                      onPress={() => {
                        const now = new Date();
                        const d = String(now.getDate()).padStart(2, '0');
                        const m = String(now.getMonth() + 1).padStart(2, '0');
                        setTestDateInput(`${d}/${m}/${now.getFullYear()}`);
                      }}
                      className="bg-blue-500/10 px-2 py-0.5 rounded-md"
                    >
                      <Text className="text-[10px] font-bold text-blue-500">Hoje</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={testDateInput}
                    onChangeText={setTestDateInput}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor="#888"
                    keyboardType="numbers-and-punctuation"
                    className="bg-gray-50 dark:bg-[#111] p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white font-bold text-sm"
                  />
                </View>

                {/* Campo Pontuação Total */}
                <View className="mb-5">
                  <Text className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">
                    PONTUAÇÃO TOTAL:
                  </Text>
                  <TextInput
                    value={testScoreInput}
                    onChangeText={setTestScoreInput}
                    placeholder="Ex: 180"
                    placeholderTextColor="#888"
                    keyboardType="numeric"
                    className="bg-gray-50 dark:bg-[#111] p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white font-black text-lg"
                  />
                </View>

                {/* Botão Salvar Log */}
                <TouchableOpacity
                  onPress={handleSaveTest}
                  disabled={savingTest}
                  activeOpacity={0.85}
                  className="bg-emerald-500 py-3.5 rounded-2xl items-center justify-center flex-row shadow-md shadow-emerald-500/20"
                >
                  {savingTest ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Check size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text className="text-white font-black uppercase text-xs tracking-wider">
                        Adicionar Log
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Histórico de Testes */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-4 px-1">
              <Text className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                📈 Histórico de Testes
              </Text>
              <Text className="text-[10px] font-bold text-gray-400">
                {physicalTests.length} {physicalTests.length === 1 ? 'registro' : 'registros'}
              </Text>
            </View>

            {physicalTestsLoading ? (
              <View className="py-12 items-center justify-center">
                <ActivityIndicator size="large" color="#ef4444" />
              </View>
            ) : physicalTests.length === 0 ? (
              <View className="bg-white dark:bg-[#1a1a1a] p-8 rounded-3xl border border-gray-100 dark:border-white/5 items-center justify-center">
                <Activity size={40} color={isDark ? '#333' : '#ddd'} style={{ marginBottom: 12 }} />
                <Text className="text-sm font-bold text-gray-800 dark:text-gray-200 text-center mb-1">
                  Nenhum teste físico registrado.
                </Text>
                <Text className="text-xs text-gray-400 dark:text-gray-500 text-center leading-relaxed max-w-xs">
                  Seus professores podem registrar seus testes na intranet ou você pode adicionar sua pontuação acima!
                </Text>
              </View>
            ) : (
              physicalTests.map((test, index) => {
                const isFromStudent = test.createdBy === 'student';
                return (
                  <View
                    key={test.id || index}
                    className="bg-white dark:bg-[#1a1a1a] p-4 rounded-3xl border border-gray-100 dark:border-white/5 mb-3 shadow-sm flex-row items-center justify-between"
                  >
                    <View className="flex-1 pr-3">
                      <View className="flex-row items-center mb-1">
                        <Calendar size={13} color="#888" style={{ marginRight: 5 }} />
                        <Text className="text-xs font-bold text-gray-900 dark:text-white">
                          {formatTestDate(test.date)}
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <View className={`px-2 py-0.5 rounded-full ${isFromStudent ? 'bg-blue-500/10' : 'bg-purple-500/10'}`}>
                          <Text className={`text-[9px] font-black uppercase ${isFromStudent ? 'text-blue-500' : 'text-purple-500'}`}>
                            {isFromStudent ? 'Registrado por Você' : 'Registrado pelo Professor'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="bg-red-500/10 px-4 py-2 rounded-2xl border border-red-500/20 items-center">
                      <Text className="text-[9px] font-black text-red-500 uppercase">Pontuação</Text>
                      <Text className="text-lg font-black text-red-500">{test.score}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}