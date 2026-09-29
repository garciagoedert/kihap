import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, Image, Alert, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot, orderBy, limit, addDoc, serverTimestamp, Timestamp, doc, getDoc, setDoc, updateDoc, arrayUnion, getDocs } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { Heart, Award, CreditCard, MessageCircle, Bell, CheckCheck, Flame, Trophy, Calendar, Sparkles, AlertCircle, User, Lock, ArrowLeft, Activity, Plus, ChevronRight, Check, Clock, ChevronDown } from 'lucide-react-native';
export default function NotificacoesScreen() {
  const router = useRouter();
  const { user, userData } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSubTab, setActiveSubTab] = useState<'ofensivas' | 'emblemas' | 'teste-fisico'>('ofensivas');
  const [ofensivaSubTab, setOfensivaSubTab] = useState<'ofensiva' | 'ranking'>('ofensiva');
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // Check-in and Next Class states
  const [classTemplates, setClassTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [todayInstances, setTodayInstances] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [showClassModal, setShowClassModal] = useState(false);
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);

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

  const getLocalDateStr = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const studentId = userData?.evoMemberId || user?.uid;
  const rawUserUnit = (userData?.unitId || userData?.unidadeId || '').toLowerCase();
  const effectiveUnit = (!rawUserUnit || rawUserUnit === 'staff' || rawUserUnit === 'todos') ? 'centro' : rawUserUnit;

  // Listen to class templates for student's unit
  useEffect(() => {
    if (activeSubTab !== 'ofensivas') return;

    setTemplatesLoading(true);
    const templatesRef = collection(db, 'classTemplates');
    const q = query(templatesRef, where('unitId', '==', effectiveUnit));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      setClassTemplates(list);
      setTemplatesLoading(false);
    }, (error) => {
      console.error("Error fetching class templates:", error);
      setTemplatesLoading(false);
    });

    return () => unsubscribe();
  }, [activeSubTab, effectiveUnit]);

  // Listen to today's class instances in real-time
  useEffect(() => {
    if (activeSubTab !== 'ofensivas') return;

    const todayStr = getLocalDateStr(new Date());
    const instancesCol = collection(db, 'classInstances');
    const q = query(
      instancesCol,
      where('unitId', '==', effectiveUnit),
      where('date', '==', todayStr)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setTodayInstances(list);
    }, (error) => {
      console.error("Error fetching today class instances:", error);
    });

    return () => unsubscribe();
  }, [activeSubTab, effectiveUnit]);

  const updateStreak = async (sId: string | number) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    try {
      const instancesCol = collection(db, 'classInstances');
      const qNum = query(instancesCol, where('presentStudents', 'array-contains', Number(sId)));
      const qStr = query(instancesCol, where('presentStudents', 'array-contains', sId.toString()));

      const [snapNum, snapStr] = await Promise.all([getDocs(qNum), getDocs(qStr)]);
      const uniqueDates = new Set<string>();
      snapNum.forEach(d => { if (d.data().date) uniqueDates.add(d.data().date); });
      snapStr.forEach(d => { if (d.data().date) uniqueDates.add(d.data().date); });

      const sortedDates = Array.from(uniqueDates).sort();
      let currentStreak = 0;
      let longestStreak = 0;
      let lastAttendanceDate = null;

      if (sortedDates.length > 0) {
        let current = 0;
        let longest = 0;
        let prevDateStr = null;

        for (const dateStr of sortedDates) {
          if (!prevDateStr) {
            current = 1;
          } else {
            const prev = new Date(prevDateStr + 'T12:00:00');
            const curr = new Date(dateStr + 'T12:00:00');
            const diffTime = Math.abs(curr.getTime() - prev.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 5) {
              current += 1;
            } else {
              current = 1;
            }
          }
          if (current > longest) longest = current;
          prevDateStr = dateStr;
        }

        const lastDateStr = sortedDates[sortedDates.length - 1];
        const lastDate = new Date(lastDateStr + 'T12:00:00');
        const todayStr = getLocalDateStr(new Date());
        const todayDate = new Date(todayStr + 'T12:00:00');
        const diffTimeToday = todayDate.getTime() - lastDate.getTime();
        const diffDaysToday = Math.floor(diffTimeToday / (1000 * 60 * 60 * 24));

        currentStreak = current;
        if (diffDaysToday > 5) {
          currentStreak = 0;
        }
        longestStreak = longest;
        lastAttendanceDate = lastDateStr;
      }

      await updateDoc(userRef, {
        currentStreak,
        longestStreak,
        lastAttendanceDate
      });
    } catch (err) {
      console.error("Error updating streak in notificacoes:", err);
    }
  };

  const handleCheckinClass = async (targetClass: any) => {
    if (!studentId) {
      Alert.alert('Atenção', 'Seu cadastro não possui identificador de aluno (EvoMemberId) configurado.');
      return;
    }
    if (!targetClass) {
      Alert.alert('Erro', 'Nenhuma turma selecionada para check-in.');
      return;
    }

    setCheckinSubmitting(true);
    try {
      const dateString = getLocalDateStr(new Date());
      const instanceId = `${targetClass.id}_${dateString}`;
      const instanceRef = doc(db, 'classInstances', instanceId);

      const instanceDoc = await getDoc(instanceRef);
      const studentIdToSave = studentId.toString();

      if (instanceDoc.exists()) {
        await updateDoc(instanceRef, {
          presentStudents: arrayUnion(studentIdToSave)
        });
      } else {
        await setDoc(instanceRef, {
          templateId: targetClass.id,
          date: dateString,
          unitId: effectiveUnit,
          presentStudents: [studentIdToSave]
        });
      }

      await updateStreak(studentId);

      Alert.alert(
        'Check-in Confirmado! 🔥',
        `Presença registrada na aula "${targetClass.name}". Sua chama está garantida!`,
        [{ text: 'Maravilha!' }]
      );
    } catch (err) {
      console.error("Erro ao registrar presença:", err);
      Alert.alert('Erro', 'Não foi possível confirmar sua presença. Tente novamente.');
    } finally {
      setCheckinSubmitting(false);
      setShowClassModal(false);
    }
  };

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

  // Next class and today checkin calculations
  const today = new Date();
  const todayDay = today.getDay(); // 0 = Dom, 1 = Seg...
  const todayDateStr = getLocalDateStr(today);

  // 1. Classes on today's schedule
  const todayClasses = classTemplates.filter(t => Array.isArray(t.daysOfWeek) && t.daysOfWeek.includes(todayDay));

  // 2. Check if student already checked in today
  const studentAttendedInstanceToday = todayInstances.find(inst => {
    const present = inst.presentStudents || [];
    return studentId && (present.includes(studentId.toString()) || present.includes(Number(studentId)));
  });
  const isCheckedInToday = !!studentAttendedInstanceToday;

  const attendedClassTemplate = studentAttendedInstanceToday
    ? classTemplates.find(t => t.id === studentAttendedInstanceToday.templateId)
    : null;

  // 3. Classes suitable for this student today
  const enrolledTodayClasses = todayClasses.filter(t => 
    studentId && t.students && (t.students.includes(studentId.toString()) || t.students.includes(Number(studentId)))
  );
  const eligibleTodayClasses = enrolledTodayClasses.length > 0 ? enrolledTodayClasses : todayClasses;

  const currentSelectedTodayClass = selectedClassId 
    ? classTemplates.find(t => t.id === selectedClassId) || eligibleTodayClasses[0]
    : eligibleTodayClasses[0];

  // 4. Upcoming class on next days
  let upcomingNextClass: any = null;
  let upcomingDayLabel = '';
  let upcomingDateLabel = '';

  for (let offset = 1; offset <= 7; offset++) {
    const nextD = new Date();
    nextD.setDate(today.getDate() + offset);
    const nextDayNum = nextD.getDay();

    const classesOnNextDay = classTemplates.filter(t => Array.isArray(t.daysOfWeek) && t.daysOfWeek.includes(nextDayNum));
    if (classesOnNextDay.length > 0) {
      const enrolledOnNextDay = classesOnNextDay.filter(t => 
        studentId && t.students && (t.students.includes(studentId.toString()) || t.students.includes(Number(studentId)))
      );
      upcomingNextClass = enrolledOnNextDay.length > 0 ? enrolledOnNextDay[0] : classesOnNextDay[0];

      if (offset === 1) {
        upcomingDayLabel = 'Amanhã';
      } else {
        const rawWd = nextD.toLocaleDateString('pt-BR', { weekday: 'long' });
        upcomingDayLabel = rawWd.charAt(0).toUpperCase() + rawWd.slice(1);
      }
      upcomingDateLabel = nextD.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      break;
    }
  }

  const isClassToday = !isCheckedInToday && !!currentSelectedTodayClass;
  const activeClassToDisplay = isCheckedInToday 
    ? (attendedClassTemplate || currentSelectedTodayClass) 
    : (currentSelectedTodayClass || upcomingNextClass);

  const renderOfensivaSubSelector = () => (
    <View className="mb-4">
      <View className="flex-row bg-gray-100 dark:bg-[#161616] p-1.5 rounded-2xl border border-gray-200/50 dark:border-white/5">
        <TouchableOpacity
          onPress={() => setOfensivaSubTab('ofensiva')}
          style={ofensivaSubTab === 'ofensiva' ? {
            backgroundColor: isDark ? '#262626' : '#000',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.18,
            shadowRadius: 2,
            elevation: 2,
          } : null}
          className="flex-1 py-2 rounded-xl items-center justify-center flex-row px-2"
        >
          <Flame size={14} color={ofensivaSubTab === 'ofensiva' ? '#eab308' : '#888'} style={{ marginRight: 5 }} />
          <Text
            style={{ 
              fontFamily: 'NeueMachina-Ultrabold',
              color: ofensivaSubTab === 'ofensiva' ? '#fff' : '#888',
              paddingRight: 2,
            }}
            className="text-[11px] uppercase tracking-normal"
          >
            Minha Ofensiva
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setOfensivaSubTab('ranking')}
          style={ofensivaSubTab === 'ranking' ? {
            backgroundColor: isDark ? '#262626' : '#000',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.18,
            shadowRadius: 2,
            elevation: 2,
          } : null}
          className="flex-1 py-2 rounded-xl items-center justify-center flex-row px-2"
        >
          <Trophy size={14} color={ofensivaSubTab === 'ranking' ? '#eab308' : '#888'} style={{ marginRight: 5 }} />
          <Text
            style={{ 
              fontFamily: 'NeueMachina-Ultrabold',
              color: ofensivaSubTab === 'ranking' ? '#fff' : '#888',
              paddingRight: 4,
            }}
            className="text-[11px] uppercase tracking-normal"
          >
            Ranking
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, paddingTop: insets.top }} className="flex-1 bg-[#fbfbfa] dark:bg-[#0a0a0a]">
      <View className="px-6 pt-5 pb-2">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text 
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-[11px] uppercase tracking-[3px] text-[#eab308] dark:text-[#f59e0b]"
            >
              KIHAP MARTIAL ARTS
            </Text>
            <Text 
              style={{ fontFamily: 'NeueMachina-Ultrabold' }}
              className="text-3xl text-gray-900 dark:text-white tracking-tight mt-0.5"
            >
              OFENSIVA & ATIVIDADE
            </Text>
          </View>
        </View>

        {/* Sub-tab Selectors (Three-way toggle) */}
        <View className="flex-row bg-gray-100 dark:bg-[#161616] p-1.5 rounded-2xl mb-4 border border-gray-200/50 dark:border-white/5">
          <TouchableOpacity 
            onPress={() => setActiveSubTab('ofensivas')}
            style={activeSubTab === 'ofensivas' ? {
              backgroundColor: isDark ? '#262626' : '#000',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.18,
              shadowRadius: 2,
              elevation: 2,
            } : null}
            className="flex-1 py-2.5 rounded-xl items-center justify-center flex-row px-1"
          >
            <Flame size={14} color={activeSubTab === 'ofensivas' ? '#eab308' : '#888'} style={{ marginRight: 4 }} />
            <Text 
              style={{ 
                fontFamily: 'NeueMachina-Ultrabold',
                color: activeSubTab === 'ofensivas' ? '#fff' : '#888',
                paddingRight: 2,
              }}
              className="text-[10px] uppercase tracking-normal text-center"
              numberOfLines={1}
            >
              Ofensivas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setActiveSubTab('emblemas')}
            style={activeSubTab === 'emblemas' ? {
              backgroundColor: isDark ? '#262626' : '#000',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.18,
              shadowRadius: 2,
              elevation: 2,
            } : null}
            className="flex-1 py-2.5 rounded-xl items-center justify-center flex-row px-1"
          >
            <Award size={14} color={activeSubTab === 'emblemas' ? '#eab308' : '#888'} style={{ marginRight: 4 }} />
            <Text 
              style={{ 
                fontFamily: 'NeueMachina-Ultrabold',
                color: activeSubTab === 'emblemas' ? '#fff' : '#888',
                paddingRight: 2,
              }}
              className="text-[10px] uppercase tracking-normal text-center"
              numberOfLines={1}
            >
              Emblemas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setActiveSubTab('teste-fisico')}
            style={activeSubTab === 'teste-fisico' ? {
              backgroundColor: isDark ? '#262626' : '#000',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.18,
              shadowRadius: 2,
              elevation: 2,
            } : null}
            className="flex-1 py-2.5 rounded-xl items-center justify-center flex-row px-1"
          >
            <Activity size={14} color={activeSubTab === 'teste-fisico' ? '#ef4444' : '#888'} style={{ marginRight: 4 }} />
            <Text 
              style={{ 
                fontFamily: 'NeueMachina-Ultrabold',
                color: activeSubTab === 'teste-fisico' ? '#fff' : '#888',
                paddingRight: 2,
              }}
              className="text-[9.5px] uppercase tracking-normal text-center"
              numberOfLines={1}
            >
              Teste Físico
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeSubTab === 'ofensivas' ? (
        <View className="flex-1">
          {ofensivaSubTab === 'ofensiva' ? (
            <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              {/* Sub-selector: Minha Ofensiva vs Ranking (rolagem conjunta com o conteúdo) */}
              {renderOfensivaSubSelector()}

              {/* Martial Streak Hero Card — Iconic Kihap Brand (Gold & Black) */}
          <View 
            className={`rounded-3xl p-6 shadow-xl relative overflow-hidden border mb-5 ${
              isDark 
                ? 'bg-[#141414] border-yellow-500/30' 
                : 'bg-[#eab308] border-yellow-400 shadow-yellow-500/25'
            }`}
          >
            {/* Top Row: Status (left) & Recorde (right) */}
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <View className={`w-2 h-2 rounded-full mr-1.5 ${isDark ? 'bg-yellow-400' : 'bg-black'}`} />
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className={`text-[10px] uppercase tracking-widest ${
                    isDark ? 'text-yellow-400' : 'text-black/85'
                  }`}
                >
                  {userData?.currentStreak && userData.currentStreak > 0 ? 'OFENSIVA ATIVA' : 'OFENSIVA EM PAUSA'}
                </Text>
              </View>

              <View className={`px-2.5 py-0.5 rounded-full ${isDark ? 'bg-yellow-500/15 border border-yellow-500/30' : 'bg-black/10'}`}>
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className={`text-[9px] uppercase tracking-widest ${
                    isDark ? 'text-yellow-400' : 'text-black'
                  }`}
                >
                  🏆 RECORDE: {userData?.longestStreak || 0} {userData?.longestStreak === 1 ? 'DIA' : 'DIAS'}
                </Text>
              </View>
            </View>

            {/* Flame Visualizer Center */}
            <View className="items-center py-2">
              <View className="relative items-center justify-center">
                {/* Outer concentric rings */}
                <View 
                  className={`w-44 h-44 rounded-full items-center justify-center border ${
                    isDark 
                      ? 'bg-yellow-500/10 border-yellow-500/20' 
                      : 'bg-black/5 border-black/10'
                  }`}
                >
                  <View 
                    className={`w-32 h-32 rounded-full items-center justify-center border ${
                      isDark 
                        ? 'bg-yellow-500/15 border-yellow-500/30' 
                        : 'bg-black/10 border-black/15'
                    }`}
                  >
                    {/* Inner Badge Medal */}
                    <View 
                      style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: isDark ? 0.4 : 0.25,
                        shadowRadius: 8,
                        elevation: 5,
                      }}
                      className={`w-20 h-20 rounded-full items-center justify-center border-2 ${
                        isDark 
                          ? 'bg-[#181818] border-yellow-500/40' 
                          : 'bg-black border-black/30'
                      }`}
                    >
                      <Flame size={44} color="#eab308" />
                    </View>
                  </View>
                </View>
              </View>

              {/* Streak Counter */}
              <Text 
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className={`text-6xl mt-4 mb-0.5 tracking-tight ${
                  isDark ? 'text-white' : 'text-black'
                }`}
              >
                {userData?.currentStreak || 0} {userData?.currentStreak === 1 ? 'DIA' : 'DIAS'}
              </Text>
              <Text 
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className={`text-[10px] uppercase tracking-[3px] text-center ${
                  isDark ? 'text-gray-400' : 'text-black/75'
                }`}
              >
                DE OFENSIVA DE AULAS 🔥
              </Text>
            </View>

            {/* Bottom Integrated Status Advice Bar */}
            <View 
              className={`mt-3 p-3 rounded-2xl flex-row items-center border ${
                isDark 
                  ? 'bg-white/5 border-white/10' 
                  : 'bg-black/10 border-black/10'
              }`}
            >
              <AlertCircle size={15} color={isDark ? '#eab308' : '#000'} style={{ marginRight: 8 }} />
              <Text 
                className={`text-[11px] font-semibold flex-1 leading-snug ${
                  isDark ? 'text-gray-300' : 'text-black'
                }`}
              >
                {getStreakStatus().message}
              </Text>
            </View>
          </View>

          {/* Week Attendance Visualizer */}
          <View className="bg-white dark:bg-[#141414] p-5 rounded-3xl border border-gray-200/70 dark:border-white/10 mb-5 shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Calendar size={14} color="#eab308" />
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-[10px] uppercase tracking-[2px] text-gray-400 dark:text-gray-500 ml-1.5"
                >
                  MINHA SEMANA
                </Text>
              </View>
              <View className="bg-yellow-500/15 dark:bg-yellow-500/20 px-2.5 py-0.5 rounded-full border border-yellow-500/30">
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-[9px] text-[#ca8a04] dark:text-[#facc15] uppercase tracking-wider"
                >
                  {weekDays.filter(d => d.attended).length} DE 7 DIAS
                </Text>
              </View>
            </View>
            {weekLoading ? (
              <ActivityIndicator size="small" color="#eab308" className="py-4" />
            ) : (
              <View className="flex-row justify-between">
                {weekDays.map((day) => {
                  let containerBg = 'transparent';
                  let containerBorder = isDark ? '#262626' : '#f0f0f2';
                  
                  if (day.attended) {
                    containerBg = '#eab308';
                    containerBorder = '#eab308';
                  } else if (day.isToday) {
                    containerBg = isDark ? '#262626' : '#f4f4f5';
                    containerBorder = '#eab308';
                  }

                  return (
                    <View key={day.dateStr} className="items-center flex-1">
                      <Text 
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className={`text-[10px] uppercase mb-2 ${
                          day.isToday ? 'text-black dark:text-yellow-400' : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {day.label}
                      </Text>
                      <View 
                        style={{
                          backgroundColor: containerBg,
                          borderColor: containerBorder,
                          borderWidth: day.isToday && !day.attended ? 2 : 1,
                        }}
                        className="w-10 h-10 rounded-full items-center justify-center shadow-xs"
                      >
                        {day.attended ? (
                          <Flame size={19} color="#000" />
                        ) : (
                          <Text 
                            style={{
                              fontFamily: 'NeueMachina-Ultrabold',
                              color: day.isToday 
                                ? (isDark ? '#fff' : '#111') 
                                : (isDark ? '#444' : '#bbb')
                            }}
                            className="text-xs"
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

          {/* Card Próxima Aula & Check-in */}
          <View className="bg-white dark:bg-[#141414] p-5 rounded-3xl border border-gray-200/70 dark:border-white/10 mb-5 shadow-sm overflow-hidden">
            {/* Header com Tag de Status */}
            <View className="flex-row items-center justify-between mb-3.5">
              <View className="flex-row items-center flex-1 mr-2">
                <View 
                  style={{
                    backgroundColor: isCheckedInToday ? 'rgba(16,185,129,0.1)' : isClassToday ? '#eab308' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(234,179,8,0.1)'),
                    borderColor: isCheckedInToday ? 'rgba(16,185,129,0.2)' : isClassToday ? '#facc15' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(234,179,8,0.2)'),
                    borderWidth: 1,
                  }}
                  className="w-9 h-9 rounded-2xl items-center justify-center mr-2.5"
                >
                  {isCheckedInToday ? (
                    <CheckCheck size={18} color="#10b981" />
                  ) : isClassToday ? (
                    <Flame size={18} color="#000" />
                  ) : (
                    <Flame size={18} color="#eab308" />
                  )}
                </View>
                <View className="flex-1">
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className={`text-[9px] uppercase tracking-wider ${
                      isCheckedInToday ? 'text-emerald-500' : isClassToday ? 'text-[#ca8a04] dark:text-[#facc15]' : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {isCheckedInToday 
                      ? 'PRESENÇA CONFIRMADA HOJE' 
                      : isClassToday 
                        ? 'AULA DISPONÍVEL HOJE' 
                        : 'PRÓXIMA AULA'}
                  </Text>
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-lg uppercase text-gray-900 dark:text-white leading-tight mt-0.5" 
                    numberOfLines={1}
                  >
                    {activeClassToDisplay ? activeClassToDisplay.name : 'Grade da Unidade'}
                  </Text>
                </View>
              </View>

              {isCheckedInToday ? (
                <View className="bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex-row items-center">
                  <Check size={11} color="#10b981" style={{ marginRight: 3 }} />
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-emerald-500 text-[8px] uppercase tracking-wider"
                  >
                    Feito
                  </Text>
                </View>
              ) : isClassToday ? (
                <View className="bg-[#eab308] px-2.5 py-1 rounded-full border border-yellow-400">
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-black text-[8px] uppercase tracking-wider"
                  >
                    Hoje
                  </Text>
                </View>
              ) : upcomingDayLabel ? (
                <View className="bg-gray-100 dark:bg-white/5 px-2.5 py-1 rounded-full border border-gray-200 dark:border-white/5">
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-gray-600 dark:text-gray-400 text-[8px] uppercase tracking-wider"
                  >
                    {upcomingDayLabel}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Informações detalhadas da aula */}
            {activeClassToDisplay ? (
              <View className="bg-gray-50 dark:bg-[#181818] p-3.5 rounded-2xl mb-4 border border-gray-200/60 dark:border-white/5">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 mr-2">
                    <Clock size={13} color={isDark ? '#aaa' : '#666'} style={{ marginRight: 6 }} />
                    <Text className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      {isClassToday || isCheckedInToday ? 'Hoje' : `${upcomingDayLabel} (${upcomingDateLabel})`} às {activeClassToDisplay.time}
                      {activeClassToDisplay.duration ? ` • ${activeClassToDisplay.duration} min` : ''}
                    </Text>
                  </View>
                  {activeClassToDisplay.teacherName ? (
                    <View className="flex-row items-center">
                      <User size={13} color={isDark ? '#aaa' : '#666'} style={{ marginRight: 5 }} />
                      <Text className="text-xs font-bold text-gray-500 dark:text-gray-400" numberOfLines={1}>
                        {activeClassToDisplay.teacherName}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : (
              <View className="bg-gray-50 dark:bg-[#181818] p-3.5 rounded-2xl mb-4 border border-gray-200/60 dark:border-white/5">
                <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Nenhuma aula agendada no momento.
                </Text>
              </View>
            )}

            {/* Botões de Ação */}
            {isCheckedInToday ? (
              <View className="flex-row items-center justify-between pt-1">
                <View className="flex-1 mr-3">
                  <Text className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                    Sua presença já foi confirmada para hoje. Bom treino! 🔥
                  </Text>
                  {upcomingNextClass && (
                    <Text className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                      Próxima aula: {upcomingDayLabel} às {upcomingNextClass.time}
                    </Text>
                  )}
                </View>
                <TouchableOpacity 
                  onPress={() => router.push('/atividades')}
                  activeOpacity={0.8}
                  className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5"
                >
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-[10px] uppercase tracking-wider text-gray-700 dark:text-gray-300"
                  >
                    Grade
                  </Text>
                </TouchableOpacity>
              </View>
            ) : isClassToday ? (
              <View className="space-y-2">
                <TouchableOpacity
                  onPress={() => handleCheckinClass(activeClassToDisplay)}
                  disabled={checkinSubmitting}
                  activeOpacity={0.8}
                  className="w-full py-3.5 rounded-2xl bg-[#eab308] items-center justify-center flex-row shadow-lg shadow-yellow-500/25"
                >
                  {checkinSubmitting ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <>
                      <Flame size={18} color="#000" style={{ marginRight: 8 }} />
                      <Text 
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-black text-xs uppercase tracking-wider"
                      >
                        Fazer Check-in Agora
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {todayClasses.length > 1 && (
                  <TouchableOpacity 
                    onPress={() => setShowClassModal(true)}
                    activeOpacity={0.7}
                    className="py-1.5 items-center justify-center flex-row"
                  >
                    <Text className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                      Irá em outro horário hoje? <Text className="text-[#ca8a04] dark:text-[#facc15] font-extrabold">Trocar turma ({todayClasses.length})</Text>
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View className="flex-row items-center justify-between pt-1">
                <Text className="text-xs text-gray-400 dark:text-gray-500 font-medium flex-1 mr-3 leading-relaxed">
                  O check-in fica disponível no dia de cada aula.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/atividades')}
                  activeOpacity={0.8}
                  className="px-4 py-2.5 rounded-xl bg-black dark:bg-[#eab308] flex-row items-center"
                >
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-white dark:text-black text-[10px] uppercase tracking-wider"
                  >
                    Ver Grade
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Mini Stats Cards */}
          <View className="flex-row justify-between mb-5">
            <View className="w-[48%] bg-white dark:bg-[#141414] p-4 rounded-3xl border border-gray-200/70 dark:border-white/10 items-center shadow-xs">
              <View className="w-10 h-10 rounded-2xl bg-yellow-500/10 dark:bg-yellow-500/15 border border-yellow-500/20 items-center justify-center mb-2">
                <Trophy size={20} color="#eab308" />
              </View>
              <Text 
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 text-center"
              >
                Recorde Máximo
              </Text>
              <Text 
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-lg text-gray-900 dark:text-white uppercase"
              >
                {userData?.longestStreak || 0} {userData?.longestStreak === 1 ? 'Dia' : 'Dias'}
              </Text>
            </View>

            <View className="w-[48%] bg-white dark:bg-[#141414] p-4 rounded-3xl border border-gray-200/70 dark:border-white/10 items-center shadow-xs">
              <View className="w-10 h-10 rounded-2xl bg-yellow-500/10 dark:bg-yellow-500/15 border border-yellow-500/20 items-center justify-center mb-2">
                <Calendar size={20} color="#eab308" />
              </View>
              <Text 
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 text-center"
              >
                Última Aula
              </Text>
              <Text 
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-xs text-gray-900 dark:text-white text-center mt-1 uppercase"
              >
                {userData?.lastAttendanceDate 
                  ? new Date(userData.lastAttendanceDate + 'T12:00:00').toLocaleDateString('pt-BR') 
                  : 'Nenhuma'}
              </Text>
            </View>
          </View>

          {/* Gamified Explanation Banner */}
          <View className="bg-yellow-500/5 dark:bg-yellow-500/10 p-5 rounded-3xl border border-yellow-500/20 mb-6">
            <View className="flex-row items-center mb-2.5">
              <Sparkles size={16} color="#eab308" style={{ marginRight: 7 }} />
              <Text 
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-xs uppercase tracking-wider text-[#ca8a04] dark:text-[#facc15]"
              >
                Como funciona?
              </Text>
            </View>
            <Text className="text-[12px] font-medium text-gray-600 dark:text-gray-400 leading-relaxed">
              Cada check-in de aula realizado acende a sua chama! Você precisa realizar uma nova aula a cada 5 dias para manter a sua chama acesa e aumentar sua ofensiva.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1">
          {rankingLoading ? (
            <View className="flex-1 px-6">
              {renderOfensivaSubSelector()}
              <View className="flex-1 items-center justify-center pt-20">
                <ActivityIndicator size="large" color="#eab308" />
              </View>
            </View>
          ) : (
            <FlatList
              data={ranking}
              keyExtractor={(item) => item.uid}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
              ListHeaderComponent={
                <View className="mb-4">
                  {/* Sub-selector: Minha Ofensiva vs Ranking (rolagem conjunta com a lista) */}
                  {renderOfensivaSubSelector()}

                  {/* Filter 1: Current Streak vs Longest Streak */}
                  <View className="flex-row bg-gray-100 dark:bg-[#161616] p-1.5 rounded-2xl mb-3 border border-gray-200/50 dark:border-white/5">
                    <TouchableOpacity
                      onPress={() => setRankingFilter('current')}
                      style={rankingFilter === 'current' ? {
                        backgroundColor: isDark ? '#262626' : '#000',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.18,
                        shadowRadius: 2,
                        elevation: 2,
                      } : null}
                      className="flex-1 py-2 rounded-xl items-center justify-center"
                    >
                      <Text 
                        style={{ 
                          fontFamily: 'NeueMachina-Ultrabold',
                          color: rankingFilter === 'current' ? '#fff' : '#888',
                          paddingRight: 2,
                        }}
                        className="text-[11px] uppercase tracking-wider"
                      >
                        Ofensiva Atual
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setRankingFilter('longest')}
                      style={rankingFilter === 'longest' ? {
                        backgroundColor: isDark ? '#262626' : '#000',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.18,
                        shadowRadius: 2,
                        elevation: 2,
                      } : null}
                      className="flex-1 py-2 rounded-xl items-center justify-center"
                    >
                      <Text 
                        style={{ 
                          fontFamily: 'NeueMachina-Ultrabold',
                          color: rankingFilter === 'longest' ? '#fff' : '#888',
                          paddingRight: 2,
                        }}
                        className="text-[11px] uppercase tracking-wider"
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
                              ? (isDark ? '#fff' : '#000') 
                              : (isDark ? '#161616' : '#fff'),
                            borderColor: isActive
                              ? (isDark ? '#fff' : '#000')
                              : (isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'),
                            borderWidth: 1,
                          }}
                          className="px-4 py-1.5 rounded-full mr-2"
                        >
                          <Text
                            style={{
                              fontFamily: 'NeueMachina-Ultrabold',
                              color: isActive 
                                ? (isDark ? '#000' : '#fff') 
                                : (isDark ? '#888' : '#666')
                            }}
                            className="text-[10px] uppercase tracking-wider"
                          >
                            {unit.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              }
              renderItem={({ item, index }) => {
                const isMe = item.uid === user?.uid || 
                  (item.evoMemberId && (item.evoMemberId === userData?.evoMemberId || item.evoMemberId === userData?.matricula)) ||
                  (item.email && item.email === (userData?.email || user?.email));
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
                        ? (isDark ? '#1F1B12' : '#FEFDF8')
                        : (isDark ? '#141414' : '#fff'),
                      borderColor: isMe 
                        ? '#eab308' 
                        : (isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'),
                      borderWidth: isMe ? 2 : 1,
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
                          <Text 
                            style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                            className="text-xs text-gray-400 dark:text-gray-500"
                          >
                            #{rankLabel}
                          </Text>
                        )}
                      </View>

                      {/* Avatar */}
                      <View className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 dark:border-white/10 mr-3">
                        <Image source={displayPhoto} className="w-full h-full object-cover" />
                      </View>

                      {/* Name & Unit info */}
                      <View className="flex-1 pr-2">
                        <View className="flex-row items-center">
                          <Text 
                            style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                            className={`text-[13px] uppercase ${isMe ? 'text-[#ca8a04] dark:text-[#facc15]' : 'text-gray-900 dark:text-white'}`}
                            numberOfLines={1}
                          >
                            {item.name || item.nome || 'Aluno'}
                          </Text>
                          {isMe && (
                            <View className="bg-[#eab308] px-2 py-0.5 rounded-full ml-1.5">
                              <Text 
                                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                                className="text-black text-[8px] uppercase tracking-wider"
                              >
                                Você
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                          {capitalizedUnit}
                        </Text>
                      </View>
                    </View>

                    {/* Streak indicator */}
                    <View className="flex-row items-center bg-yellow-500/15 dark:bg-yellow-500/20 px-3 py-1.5 rounded-full border border-yellow-500/30">
                      <Flame size={14} color="#eab308" style={{ marginRight: 4 }} />
                      <Text 
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-xs text-[#ca8a04] dark:text-[#facc15]"
                      >
                        {score}
                      </Text>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center pt-20 px-8">
                  <Trophy size={48} color={isDark ? '#333' : '#ddd'} style={{ marginBottom: 12 }} />
                  <Text className="text-gray-400 text-center font-bold">Nenhum aluno com ofensiva nesta unidade.</Text>
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
                className="bg-white dark:bg-[#141414] p-4 rounded-3xl mb-4 border border-red-500/25 dark:border-red-500/20"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 pr-2">
                    <View className="w-12 h-12 rounded-2xl bg-red-500/10 items-center justify-center mr-3 border border-red-500/20">
                      <Activity size={24} color="#ef4444" />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center mb-0.5">
                        <Text 
                          style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                          className="text-xs text-gray-900 dark:text-white uppercase tracking-wider mr-2"
                        >
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
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-red-500 text-[10px] uppercase mr-1"
                    >
                      Abrir
                    </Text>
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
                  className={`bg-white dark:bg-[#141414] p-4 rounded-3xl items-center justify-center border ${
                    isPhysicalTestBadge
                      ? 'border-red-500/30 dark:border-red-500/20 shadow-sm shadow-red-500/10'
                      : isEarned
                      ? 'border-yellow-500/30 dark:border-yellow-500/20 shadow-sm shadow-black/5'
                      : 'border-gray-200/60 dark:border-white/5 opacity-40'
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
                      <View className="absolute -bottom-1 -right-1 bg-red-500 p-1 rounded-full border border-white dark:border-[#141414]">
                        <Activity size={9} color="#fff" />
                      </View>
                    )}
                  </View>
                  
                  <Text
                    numberOfLines={1}
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className={`text-[10px] text-center uppercase tracking-wider ${
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
          <View className="bg-white dark:bg-[#141414] p-6 rounded-3xl border border-gray-200/70 dark:border-white/10 mb-6 shadow-sm">
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center flex-1">
                <View className="w-14 h-14 rounded-2xl bg-red-500/10 items-center justify-center mr-4 border border-red-500/20">
                  <Activity size={30} color="#ef4444" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-lg text-gray-900 dark:text-white uppercase tracking-tight"
                    >
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
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center"
                >
                  Recorde
                </Text>
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-base text-amber-500 mt-0.5"
                >
                  {maxPhysicalScore} pts
                </Text>
              </View>

              {/* Último */}
              <View className="flex-1 bg-red-500/5 dark:bg-red-500/10 p-3.5 rounded-2xl border border-red-500/20 items-center mr-2">
                <Flame size={18} color="#ef4444" style={{ marginBottom: 4 }} />
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center"
                >
                  Último
                </Text>
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-base text-red-500 mt-0.5"
                >
                  {latestPhysicalTest ? `${latestPhysicalTest.score} pts` : '--'}
                </Text>
              </View>

              {/* Avaliações */}
              <View className="flex-1 bg-blue-500/5 dark:bg-blue-500/10 p-3.5 rounded-2xl border border-blue-500/20 items-center">
                <Calendar size={18} color="#3b82f6" style={{ marginBottom: 4 }} />
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center"
                >
                  Testes
                </Text>
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-base text-blue-500 mt-0.5"
                >
                  {physicalTests.length}
                </Text>
              </View>
            </View>
          </View>

          {/* Card: Adicionar Novo Log de Teste Físico */}
          <View className="bg-white dark:bg-[#141414] p-6 rounded-3xl border border-gray-200/70 dark:border-white/10 mb-6 shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-xl bg-emerald-500/10 items-center justify-center mr-2.5">
                  <Plus size={16} color="#10b981" />
                </View>
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-sm text-gray-900 dark:text-white uppercase tracking-wider"
                >
                  Adicionar Novo Log
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowAddForm(!showAddForm)}
                className="px-3 py-1 rounded-full bg-gray-100 dark:bg-[#252525]"
              >
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-[10px] uppercase text-gray-600 dark:text-gray-300"
                >
                  {showAddForm ? 'Ocultar' : 'Novo Teste'}
                </Text>
              </TouchableOpacity>
            </View>

            {showAddForm && (
              <View className="pt-2 border-t border-gray-100 dark:border-white/5 mt-2">
                {/* Campo Data */}
                <View className="mb-4">
                  <View className="flex-row justify-between items-center mb-1.5">
                    <Text 
                      style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                      className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest"
                    >
                      DATA:
                    </Text>
                    <TouchableOpacity 
                      onPress={() => {
                        const now = new Date();
                        const d = String(now.getDate()).padStart(2, '0');
                        const m = String(now.getMonth() + 1).padStart(2, '0');
                        setTestDateInput(`${d}/${m}/${now.getFullYear()}`);
                      }}
                      className="bg-yellow-500/10 px-2 py-0.5 rounded-md"
                    >
                      <Text 
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-[10px] text-[#ca8a04] dark:text-[#facc15] uppercase"
                      >
                        Hoje
                      </Text>
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
                  <Text 
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5"
                  >
                    PONTUAÇÃO TOTAL:
                  </Text>
                  <TextInput
                    value={testScoreInput}
                    onChangeText={setTestScoreInput}
                    placeholder="Ex: 180"
                    placeholderTextColor="#888"
                    keyboardType="numeric"
                    style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                    className="bg-gray-50 dark:bg-[#111] p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-lg"
                  />
                </View>

                {/* Botão Salvar Log */}
                <TouchableOpacity
                  onPress={handleSaveTest}
                  disabled={savingTest}
                  activeOpacity={0.85}
                  className="bg-[#eab308] py-3.5 rounded-2xl items-center justify-center flex-row shadow-md shadow-yellow-500/20"
                >
                  {savingTest ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Check size={16} color="#000" style={{ marginRight: 6 }} />
                      <Text 
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-black uppercase text-xs tracking-wider"
                      >
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
              <Text 
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest"
              >
                📈 Histórico de Testes
              </Text>
              <Text 
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-[10px] text-gray-400 uppercase tracking-wider"
              >
                {physicalTests.length} {physicalTests.length === 1 ? 'registro' : 'registros'}
              </Text>
            </View>

            {physicalTestsLoading ? (
              <View className="py-12 items-center justify-center">
                <ActivityIndicator size="large" color="#ef4444" />
              </View>
            ) : physicalTests.length === 0 ? (
              <View className="bg-white dark:bg-[#141414] p-8 rounded-3xl border border-gray-200/70 dark:border-white/10 items-center justify-center">
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
                    className="bg-white dark:bg-[#141414] p-4 rounded-3xl border border-gray-200/70 dark:border-white/10 mb-3 shadow-sm flex-row items-center justify-between"
                  >
                    <View className="flex-1 pr-3">
                      <View className="flex-row items-center mb-1">
                        <Calendar size={13} color={isDark ? '#aaa' : '#666'} style={{ marginRight: 5 }} />
                        <Text className="text-xs font-bold text-gray-900 dark:text-white">
                          {formatTestDate(test.date)}
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <View className={`px-2 py-0.5 rounded-full ${isFromStudent ? 'bg-yellow-500/10' : 'bg-purple-500/10'}`}>
                          <Text 
                            style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                            className={`text-[9px] uppercase tracking-wider ${isFromStudent ? 'text-[#ca8a04] dark:text-[#facc15]' : 'text-purple-500'}`}
                          >
                            {isFromStudent ? 'Registrado por Você' : 'Registrado pelo Professor'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="bg-red-500/10 px-4 py-2 rounded-2xl border border-red-500/20 items-center">
                      <Text 
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-[9px] text-red-500 uppercase tracking-wider"
                      >
                        Pontuação
                      </Text>
                      <Text 
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-lg text-red-500"
                      >
                        {test.score}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Modal para Escolher Outra Turma de Hoje */}
      <Modal
        visible={showClassModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClassModal(false)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center p-5">
          <View className="bg-white dark:bg-[#141414] rounded-3xl p-6 w-full max-w-sm border border-gray-200/80 dark:border-white/10 shadow-2xl">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text 
                  style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                  className="text-base text-gray-900 dark:text-white uppercase tracking-tight"
                >
                  Turmas de Hoje
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Selecione o horário para fazer check-in
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowClassModal(false)} className="p-1">
                <Text className="text-gray-400 font-bold text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView className="max-h-80" showsVerticalScrollIndicator={false}>
              {todayClasses.map((cls) => {
                const isSelected = (selectedClassId ? selectedClassId === cls.id : currentSelectedTodayClass?.id === cls.id);
                return (
                  <TouchableOpacity
                    key={cls.id}
                    onPress={() => {
                      setSelectedClassId(cls.id);
                      setShowClassModal(false);
                    }}
                    className={`p-3.5 rounded-2xl mb-2.5 border flex-row items-center justify-between ${
                      isSelected
                        ? 'bg-yellow-500/10 border-yellow-500/30'
                        : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5'
                    }`}
                  >
                    <View className="flex-1 mr-2">
                      <Text 
                        style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                        className="text-xs text-gray-900 dark:text-white uppercase tracking-tight"
                      >
                        {cls.name}
                      </Text>
                      <Text className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {cls.time} {cls.duration ? `(${cls.duration} min)` : ''} • {cls.teacherName || 'Instrutor Kihap'}
                      </Text>
                    </View>
                    {isSelected && (
                      <View className="w-5 h-5 rounded-full bg-[#eab308] items-center justify-center">
                        <Check size={12} color="#000" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowClassModal(false)}
              className="mt-4 py-3 rounded-2xl bg-gray-100 dark:bg-white/5 items-center justify-center"
            >
              <Text 
                style={{ fontFamily: 'NeueMachina-Ultrabold' }}
                className="text-xs uppercase tracking-wider text-gray-600 dark:text-gray-300"
              >
                Fechar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}