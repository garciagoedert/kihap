import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { Search, ChevronRight, X, Users, RefreshCw } from 'lucide-react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../src/services/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { KIHAP_UNITS, formatUnitName } from '../../src/utils/intranetPermissions';
import { UnitFilterStrip } from '../../src/components/UnitFilterStrip';
import { IntranetScreenHeader } from '../../src/components/IntranetModeBar';
import {
  fetchStudentsByUnit,
  matchesStudentQuery,
  extractStudentEmail,
  extractStudentPhone,
} from '../../src/utils/intranetStudents';

export default function IntranetAlunosScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { userData } = useAuth();

  const defaultUnit = useMemo(() => {
    const raw = String(userData?.unitId || userData?.unidadeId || '').toLowerCase();
    return KIHAP_UNITS.some((u) => u.id === raw) ? raw : 'all';
  }, [userData?.unitId, userData?.unidadeId]);

  const [selectedUnit, setSelectedUnit] = useState<string>(defaultUnit);
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [liveEvoResults, setLiveEvoResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchingLive, setSearchingLive] = useState(false);

  const loadStudents = useCallback(async (unit: string) => {
    setLoading(true);
    setLiveEvoResults(null);
    try {
      const list = await fetchStudentsByUnit(unit);
      setStudents(
        list.filter((s) => !s?.firstName || !String(s.firstName).startsWith('***Dados'))
      );
    } catch (err) {
      console.error('Erro ao carregar alunos:', err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents(selectedUnit);
  }, [selectedUnit, loadStudents]);

  const localMatches = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return students;
    return students.filter((s) => matchesStudentQuery(s, trimmed));
  }, [students, searchQuery]);

  // Fallback em tempo real no EVO caso não encontre no cache local
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2 || localMatches.length > 0 || loading) {
      setLiveEvoResults(null);
      setSearchingLive(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchingLive(true);
      try {
        const listAllMembers = httpsCallable(functions, 'listAllMembers');
        const res = await listAllMembers({
          unitId: selectedUnit || 'all',
          name: trimmed,
          forceRefresh: true,
        });
        if (cancelled) return;
        const data = (res.data as any[]) || [];
        const matches = data.filter(
          (s) =>
            matchesStudentQuery(s, trimmed) &&
            (!s?.firstName || !String(s.firstName).startsWith('***Dados'))
        );
        setLiveEvoResults(matches);
      } catch (err) {
        console.warn('Erro no fallback em tempo real EVO:', err);
        if (!cancelled) setLiveEvoResults([]);
      } finally {
        if (!cancelled) setSearchingLive(false);
      }
    }, 550);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, localMatches.length, selectedUnit, loading]);

  const displayedStudents = useMemo(() => {
    const source = liveEvoResults !== null ? liveEvoResults : localMatches;
    return source.slice(0, 150);
  }, [liveEvoResults, localMatches]);

  const renderStudentCard = ({ item }: { item: any }) => {
    const fullName = `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.name || `Aluno #${item.idMember}`;
    const initials = ((item.firstName?.[0] || '') + (item.lastName?.[0] || '')).toUpperCase() || 'A';
    const email = extractStudentEmail(item);
    const phone = extractStudentPhone(item);
    const photoUrl = item.photoURL || item.photoUrl || item.photo || '';
    const unitLabel = formatUnitName(item.branchName || item.unitId);
    const unitParam = item.unitId || (selectedUnit !== 'all' ? selectedUnit : 'centro');

    return (
      <TouchableOpacity
        onPress={() => router.push(`/intranet/aluno/${item.idMember}?unit=${encodeURIComponent(unitParam)}` as any)}
        activeOpacity={0.8}
        className="bg-white dark:bg-[#141414] rounded-2xl p-4 mb-2.5 border border-gray-100 dark:border-white/10 flex-row items-center justify-between"
      >
        <View className="flex-row items-center gap-3 flex-1 pr-2">
          <View className="w-11 h-11 rounded-full bg-amber-400/15 border border-amber-400/30 items-center justify-center overflow-hidden shrink-0">
            {photoUrl && photoUrl.length > 10 ? (
              <Image source={{ uri: photoUrl }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <Text className="text-sm font-black text-amber-600 dark:text-amber-400">{initials}</Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-sm font-black text-gray-900 dark:text-white" numberOfLines={1}>
              {fullName}
            </Text>
            <Text className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5" numberOfLines={1}>
              {phone || email || `ID: ${item.idMember}`}
            </Text>
            <View className="flex-row items-center gap-2 mt-1">
              <View className="bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-md">
                <Text className="text-[10px] font-bold text-gray-600 dark:text-gray-300">{unitLabel}</Text>
              </View>
              <Text className="text-[10px] text-gray-400 font-semibold">ID {item.idMember}</Text>
            </View>
          </View>
        </View>
        <ChevronRight size={18} color="#9ca3af" />
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-[#f8f9fa] dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View className="bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-white/5">
        <IntranetScreenHeader
          title="Alunos"
          subtitle={loading ? 'Carregando...' : `${(liveEvoResults ?? localMatches).length} encontrados`}
          currentTab="alunos"
          rightAction={
            <TouchableOpacity
              onPress={() => loadStudents(selectedUnit)}
              className="p-2 rounded-xl bg-gray-100 dark:bg-[#1a1a1a]"
              accessibilityLabel="Recarregar alunos"
            >
              <RefreshCw size={16} color={isDark ? '#fff' : '#111827'} />
            </TouchableOpacity>
          }
        />

        {/* Barra de busca */}
        <View className="px-4 pb-2">
          <View className="flex-row items-center bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl px-3">
            <Search size={16} color="#9ca3af" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar por nome ou ID..."
              placeholderTextColor="#9ca3af"
              className="flex-1 py-2.5 px-2.5 text-sm text-gray-900 dark:text-white"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <UnitFilterStrip
          selectedUnit={selectedUnit}
          onSelectUnit={(u) => setSelectedUnit(u)}
          includeAll={true}
          allLabel="Todas"
        />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#eab308" size="large" />
        </View>
      ) : searchingLive ? (
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator color="#eab308" size="large" />
          <Text className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-3 text-center">
            Buscando diretamente no EVO...
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedStudents}
          keyExtractor={(item, idx) => `${item.idMember || idx}`}
          renderItem={renderStudentCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View className="bg-white dark:bg-[#141414] rounded-3xl p-8 items-center border border-gray-100 dark:border-white/5 mt-4">
              <Users size={30} color="#9ca3af" />
              <Text className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-3 text-center">
                Nenhum aluno encontrado com os filtros aplicados.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
