import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import {
  Users,
  Activity,
  ShoppingBag,
  UserMinus,
  Undo2,
  UserCheck,
  Clock,
  Search,
  ChevronRight,
  X,
} from 'lucide-react-native';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { KIHAP_UNITS, formatUnitName, normalizeSearchText } from '../../src/utils/intranetPermissions';
import { UnitFilterStrip } from '../../src/components/UnitFilterStrip';
import { IntranetScreenHeader } from '../../src/components/IntranetModeBar';
import {
  fetchStudentsByUnit,
  matchesStudentUnit,
  analyzeStudentContracts,
  getChurnPeriodBounds,
  isDateWithinBounds,
  formatGapDuration,
  ChurnPeriodKey,
} from '../../src/utils/intranetStudents';

const VERIFIED_UNITS: Record<string, number> = {
  'lago-sul': 162,
  centro: 32,
  'santa-monica': 128,
  coqueiros: 35,
  'asa-sul': 155,
  sudoeste: 149,
  'pontos-de-ensino': 46,
  'jardim-botanico': 81,
  dourados: 53,
  noroeste: 113,
};

const PERIOD_OPTIONS: { key: ChurnPeriodKey; label: string }[] = [
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: 'this_month', label: 'Este Mês' },
  { key: 'this_year', label: 'Este Ano' },
  { key: 'all', label: 'Histórico' },
];

export default function IntranetAnaliseScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [selectedUnit, setSelectedUnit] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState<ChurnPeriodKey>('this_year');
  const [activeListTab, setActiveListTab] = useState<'returns' | 'churn'>('returns');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [syncStatuses, setSyncStatuses] = useState<Record<string, any>>({});
  const [todayGradeCount, setTodayGradeCount] = useState<Record<string, number>>({});
  const [todaySales, setTodaySales] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);

  const loadAnalytics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;
      const todayStart = new Date(y, now.getMonth(), now.getDate(), 0, 0, 0, 0);

      const [syncSnap, instancesSnap, salesSnap, studentsList] = await Promise.all([
        getDocs(collection(db, 'evo_sync_status')),
        getDocs(query(collection(db, 'classInstances'), where('date', '==', todayStr))),
        getDocs(query(collection(db, 'inscricoesFaixaPreta'), where('created', '>=', Timestamp.fromDate(todayStart)))),
        fetchStudentsByUnit('all'),
      ]);

      const syncMap: Record<string, any> = {};
      syncSnap.docs.forEach((docSnap) => {
        syncMap[docSnap.id.toLowerCase().trim()] = docSnap.data();
      });
      setSyncStatuses(syncMap);

      // Check-ins de hoje na Grade por unidade
      const setsByUnit: Record<string, Set<string>> = {};
      instancesSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const uid = String(data.unitId || 'geral').toLowerCase().trim();
        if (!setsByUnit[uid]) setsByUnit[uid] = new Set();
        (data.presentStudents || []).forEach((id: any) => setsByUnit[uid].add(String(id)));
        (data.trialStudents || []).forEach((trial: any) => {
          if (trial.compareceu === true) {
            setsByUnit[uid].add(`trial-${trial.email || trial.phone || trial.name}`);
          }
        });
      });
      const countsByUnit: Record<string, number> = {};
      Object.entries(setsByUnit).forEach(([uid, set]) => {
        countsByUnit[uid] = set.size;
      });
      setTodayGradeCount(countsByUnit);

      setTodaySales(salesSnap.docs.map((docSnap) => docSnap.data()));
      setAllStudents(studentsList);
    } catch (err) {
      console.error('Erro ao carregar análise na intranet mobile:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics(false);
  }, [loadAnalytics]);

  // Top KPIs
  const topKpis = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isAll = selectedUnit === 'all';
    const target = selectedUnit.toLowerCase().trim();

    let totalContracts = 0;
    if (isAll) {
      KIHAP_UNITS.forEach((u) => {
        const st = syncStatuses[u.id];
        totalContracts += Number(st?.activeStudents) || VERIFIED_UNITS[u.id] || 0;
      });
    } else {
      const st = syncStatuses[target];
      totalContracts = Number(st?.activeStudents) || VERIFIED_UNITS[target] || 0;
    }

    let dailyActives = 0;
    if (isAll) {
      Object.values(todayGradeCount).forEach((v) => {
        dailyActives += v;
      });
      Object.values(syncStatuses).forEach((st: any) => {
        if (st?.todayDate === todayStr) dailyActives += Number(st.todayEntries) || 0;
      });
    } else {
      dailyActives = (todayGradeCount[target] || 0) + (syncStatuses[target]?.todayDate === todayStr ? Number(syncStatuses[target]?.todayEntries) || 0 : 0);
    }

    const filteredTodaySales = isAll
      ? todaySales
      : todaySales.filter((s) => String(s.userUnit || '').toLowerCase().trim() === target);
    const todayRevenueCentavos = filteredTodaySales.reduce((acc, s) => acc + (s.amountTotal || 0), 0);

    return {
      totalContracts,
      dailyActives,
      todaySalesCount: filteredTodaySales.length,
      todayRevenue: (todayRevenueCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    };
  }, [selectedUnit, syncStatuses, todayGradeCount, todaySales]);

  // Baixas e Retornos
  const churnAnalysis = useMemo(() => {
    const unitStudents = allStudents.filter((s) => matchesStudentUnit(s, selectedUnit));
    const bounds = getChurnPeriodBounds(selectedPeriod);
    const normSearch = normalizeSearchText(searchQuery);

    let activeCount = 0;
    let activeReturnedCount = 0;
    let totalInactiveAllTime = 0;
    let returnedEverCount = 0;
    let withMembershipsCount = 0;

    const baixasInPeriod: any[] = [];
    const returnsInPeriod: any[] = [];

    for (const student of unitStudents) {
      const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.name || `Aluno #${student.idMember}`;
      if (fullName.startsWith('***Dados')) continue;
      if (Array.isArray(student.memberships) && student.memberships.length > 0) {
        withMembershipsCount++;
      }

      const res = analyzeStudentContracts(student);
      if (res.isActive) activeCount++;
      if (!res.hasContracts) continue;

      if (res.returnEvents.length > 0) {
        returnedEverCount++;
        if (res.isActive) activeReturnedCount++;

        const matchingReturns = res.returnEvents.filter((ev) => isDateWithinBounds(ev.returnDate, bounds));
        if (matchingReturns.length > 0) {
          const latest = matchingReturns[matchingReturns.length - 1];
          returnsInPeriod.push({
            idMember: student.idMember,
            unitId: student.unitId || '',
            unitName: formatUnitName(student.branchName || student.unitId),
            name: fullName,
            isActive: res.isActive,
            baixaDate: latest.baixaDate,
            returnDate: latest.returnDate,
            gapDays: latest.gapDays,
            prevPlan: latest.prevPlan,
            currentPlan: latest.currentPlan,
          });
        }
      }

      if (!res.isActive && res.baixa) {
        totalInactiveAllTime++;
        if (isDateWithinBounds(res.baixa.baixaDate, bounds)) {
          baixasInPeriod.push({
            idMember: student.idMember,
            unitId: student.unitId || '',
            unitName: formatUnitName(student.branchName || student.unitId),
            name: fullName,
            lastPlan: res.baixa.lastPlan,
            baixaDate: res.baixa.baixaDate,
            wasCanceled: res.baixa.wasCanceled,
          });
        }
      }
    }

    returnsInPeriod.sort((a, b) => b.returnDate.getTime() - a.returnDate.getTime());
    baixasInPeriod.sort((a, b) => b.baixaDate.getTime() - a.baixaDate.getTime());

    const avgGapDays =
      returnsInPeriod.length > 0
        ? Math.round(returnsInPeriod.reduce((s, r) => s + r.gapDays, 0) / returnsInPeriod.length)
        : 0;

    const filteredReturns = normSearch
      ? returnsInPeriod.filter((r) =>
          normalizeSearchText(`${r.name} ${r.currentPlan} ${r.unitName} ${r.idMember}`).includes(normSearch)
        )
      : returnsInPeriod;

    const filteredBaixas = normSearch
      ? baixasInPeriod.filter((b) =>
          normalizeSearchText(`${b.name} ${b.lastPlan} ${b.unitName} ${b.idMember}`).includes(normSearch)
        )
      : baixasInPeriod;

    const canceledCount = baixasInPeriod.filter((b) => b.wasCanceled).length;
    const totalEver = totalInactiveAllTime + returnedEverCount;
    const recoveryRate = totalEver > 0 ? ((returnedEverCount / totalEver) * 100).toFixed(1).replace('.', ',') : '0,0';

    return {
      withMembershipsCount,
      baixasTotal: baixasInPeriod.length,
      canceledCount,
      expiredCount: baixasInPeriod.length - canceledCount,
      returnsTotal: returnsInPeriod.length,
      activeCount,
      activeReturnedCount,
      avgGapDays,
      recoveryRate,
      filteredReturns,
      filteredBaixas,
    };
  }, [allStudents, selectedUnit, selectedPeriod, searchQuery]);

  const activeRows = activeListTab === 'returns' ? churnAnalysis.filteredReturns : churnAnalysis.filteredBaixas;
  const visibleRows = activeRows.slice(0, 60);

  return (
    <View className="flex-1 bg-[#f8f9fa] dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View className="bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-white/5">
        <IntranetScreenHeader
          title="Análise & KPIs"
          subtitle={selectedUnit === 'all' ? 'Visão Geral (Todas as Unidades)' : `Unidade ${formatUnitName(selectedUnit)}`}
          currentTab="analise"
        />
        <UnitFilterStrip selectedUnit={selectedUnit} onSelectUnit={setSelectedUnit} includeAll={true} allLabel="Visão Geral" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#eab308" size="large" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAnalytics(true)} tintColor="#eab308" />}
        >
          {/* KPIs Principais */}
          <View className="flex-row gap-3 mb-3">
            <View className="flex-1 bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10">
              <View className="flex-row items-center gap-2 mb-1">
                <Users size={15} color="#3b82f6" />
                <Text className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Contratos Ativos</Text>
              </View>
              <Text className="text-2xl font-black text-gray-900 dark:text-white">
                {topKpis.totalContracts.toLocaleString('pt-BR')}
              </Text>
            </View>
            <View className="flex-1 bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10">
              <View className="flex-row items-center gap-2 mb-1">
                <Activity size={15} color="#10b981" />
                <Text className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Ativos Hoje</Text>
              </View>
              <Text className="text-2xl font-black text-gray-900 dark:text-white">
                {topKpis.dailyActives.toLocaleString('pt-BR')}
              </Text>
            </View>
          </View>

          <View className="bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10 mb-5 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-amber-400/15 items-center justify-center">
                <ShoppingBag size={18} color="#eab308" />
              </View>
              <View>
                <Text className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Store Hoje ({topKpis.todaySalesCount} vendas)</Text>
                <Text className="text-lg font-black text-gray-900 dark:text-white">{topKpis.todayRevenue}</Text>
              </View>
            </View>
          </View>

          {/* Seção Baixas e Retornos */}
          <View className="mb-3">
            <Text className="text-base font-black text-gray-900 dark:text-white">Baixas e Retornos (EVO)</Text>
            <Text className="text-[11px] text-gray-500 dark:text-gray-400">
              Base com contratos sincronizados: {churnAnalysis.withMembershipsCount.toLocaleString('pt-BR')} alunos
            </Text>
          </View>

          {/* Filtro de Período */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} className="mb-4">
            {PERIOD_OPTIONS.map((p) => {
              const isSelected = selectedPeriod === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => setSelectedPeriod(p.key)}
                  className={`px-3.5 py-1.5 rounded-xl border ${
                    isSelected
                      ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white'
                      : 'bg-white dark:bg-[#141414] border-gray-200 dark:border-white/10'
                  }`}
                >
                  <Text className={`text-xs font-bold ${isSelected ? 'text-white dark:text-black' : 'text-gray-600 dark:text-gray-300'}`}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Grid 2x2 KPIs de Baixas e Retornos */}
          <View className="flex-row gap-3 mb-3">
            <View className="flex-1 bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10">
              <View className="flex-row items-center gap-1.5 mb-1">
                <UserMinus size={14} color="#ef4444" />
                <Text className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Baixas</Text>
              </View>
              <Text className="text-2xl font-black text-gray-900 dark:text-white">{churnAnalysis.baixasTotal}</Text>
              <Text className="text-[10px] text-gray-400 mt-0.5">
                {churnAnalysis.canceledCount} canc. | {churnAnalysis.expiredCount} exp.
              </Text>
            </View>
            <View className="flex-1 bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Undo2 size={14} color="#10b981" />
                <Text className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Retornos</Text>
              </View>
              <Text className="text-2xl font-black text-gray-900 dark:text-white">{churnAnalysis.returnsTotal}</Text>
              <Text className="text-[10px] text-gray-400 mt-0.5">Reativados no período</Text>
            </View>
          </View>

          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10">
              <View className="flex-row items-center gap-1.5 mb-1">
                <UserCheck size={14} color="#3b82f6" />
                <Text className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Ativos que Retornaram</Text>
              </View>
              <Text className="text-2xl font-black text-gray-900 dark:text-white">{churnAnalysis.activeReturnedCount}</Text>
              <Text className="text-[10px] text-gray-400 mt-0.5">De {churnAnalysis.activeCount} ativos hoje</Text>
            </View>
            <View className="flex-1 bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Clock size={14} color="#eab308" />
                <Text className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Tempo Médio Retorno</Text>
              </View>
              <Text className="text-lg font-black text-gray-900 dark:text-white">
                {churnAnalysis.returnsTotal > 0 ? formatGapDuration(churnAnalysis.avgGapDays) : '-'}
              </Text>
              <Text className="text-[10px] text-gray-400 mt-0.5">Recuperação: {churnAnalysis.recoveryRate}%</Text>
            </View>
          </View>

          {/* Sub-abas Lista de Retornos / Baixas */}
          <View className="flex-row gap-2 mb-3">
            <TouchableOpacity
              onPress={() => setActiveListTab('returns')}
              className={`flex-1 py-2.5 rounded-xl items-center border ${
                activeListTab === 'returns'
                  ? 'bg-[#eab308] border-[#eab308]'
                  : 'bg-white dark:bg-[#141414] border-gray-200 dark:border-white/10'
              }`}
            >
              <Text className={`text-xs font-black ${activeListTab === 'returns' ? 'text-black' : 'text-gray-700 dark:text-gray-300'}`}>
                Retornos ({churnAnalysis.filteredReturns.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveListTab('churn')}
              className={`flex-1 py-2.5 rounded-xl items-center border ${
                activeListTab === 'churn'
                  ? 'bg-[#eab308] border-[#eab308]'
                  : 'bg-white dark:bg-[#141414] border-gray-200 dark:border-white/10'
              }`}
            >
              <Text className={`text-xs font-black ${activeListTab === 'churn' ? 'text-black' : 'text-gray-700 dark:text-gray-300'}`}>
                Baixas ({churnAnalysis.filteredBaixas.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Busca rápida na lista */}
          <View className="flex-row items-center bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl px-3 mb-3">
            <Search size={15} color="#9ca3af" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar aluno ou plano..."
              placeholderTextColor="#9ca3af"
              className="flex-1 py-2 px-2 text-xs text-gray-900 dark:text-white"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={15} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          {visibleRows.length === 0 ? (
            <View className="bg-white dark:bg-[#141414] rounded-2xl p-6 items-center border border-gray-100 dark:border-white/10">
              <Text className="text-xs font-bold text-gray-500">Nenhum registro para este filtro.</Text>
            </View>
          ) : (
            visibleRows.map((item) => (
              <TouchableOpacity
                key={`${activeListTab}-${item.idMember}`}
                onPress={() => router.push(`/intranet/aluno/${item.idMember}?unit=${encodeURIComponent(item.unitId)}` as any)}
                activeOpacity={0.85}
                className="bg-white dark:bg-[#141414] rounded-2xl p-3.5 mb-2 border border-gray-100 dark:border-white/10 flex-row items-center justify-between"
              >
                <View className="flex-1 pr-2">
                  <Text className="text-xs font-black text-gray-900 dark:text-white" numberOfLines={1}>
                    {item.name}
                  </Text>
                  {activeListTab === 'returns' ? (
                    <>
                      <Text className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5" numberOfLines={1}>
                        {item.unitName} • Retornou em {item.returnDate.toLocaleDateString('pt-BR')} ({formatGapDuration(item.gapDays)})
                      </Text>
                      <Text className="text-[10px] text-gray-400 mt-0.5" numberOfLines={1}>
                        {item.currentPlan}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5" numberOfLines={1}>
                        {item.unitName} • Baixa em {item.baixaDate.toLocaleDateString('pt-BR')} • {item.wasCanceled ? 'Cancelamento' : 'Expirado'}
                      </Text>
                      <Text className="text-[10px] text-gray-400 mt-0.5" numberOfLines={1}>
                        {item.lastPlan}
                      </Text>
                    </>
                  )}
                </View>
                <ChevronRight size={16} color="#9ca3af" />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
