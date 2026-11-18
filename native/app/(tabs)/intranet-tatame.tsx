import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { BookOpen, ClipboardList, Search, X, Calendar, Video } from 'lucide-react-native';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { normalizeSearchText } from '../../src/utils/intranetPermissions';
import { IntranetScreenHeader } from '../../src/components/IntranetModeBar';

type TatameSubTab = 'planificador' | 'conteudos';

const AGE_FILTERS = ['Todos', 'Baby Littles', 'Littles', 'Kids', 'Adultos'];

function detectPlanAgeGroup(plan: any): string {
  if (plan?.ageGroup) return plan.ageGroup;
  const title = (plan?.title || '').toLowerCase();
  if (title.includes('baby littles') || title.includes('baby')) return 'Baby Littles';
  if (title.includes('littles')) return 'Littles';
  if (title.includes('kids')) return 'Kids';
  if (title.includes('adulto') || title.includes('adultos')) return 'Adultos';
  return '';
}

export default function IntranetTatameScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [activeTab, setActiveTab] = useState<TatameSubTab>('planificador');
  const [searchQuery, setSearchQuery] = useState('');
  const [ageFilter, setAgeFilter] = useState('Todos');

  const [plans, setPlans] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [plansSnap, tatameSnap] = await Promise.all([
          getDocs(query(collection(db, 'plans'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'tatame_conteudos'), orderBy('createdAt', 'desc'))),
        ]);
        if (!active) return;
        setPlans(plansSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setArticles(tatameSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Erro ao carregar Tatame & Planificador:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const filteredPlans = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    return plans.filter((plan) => {
      const detectedAge = detectPlanAgeGroup(plan);
      if (ageFilter !== 'Todos' && detectedAge !== ageFilter) return false;
      if (!q) return true;

      let extraText = '';
      if (Array.isArray(plan.blocks)) {
        extraText += plan.blocks.map((b: any) => `${b.title || ''} ${b.content || ''}`).join(' ');
      }
      if (Array.isArray(plan.weeks)) {
        extraText += plan.weeks
          .map((w: any) => `${w.title || ''} ${w.contents ? Object.values(w.contents).join(' ') : ''}`)
          .join(' ');
      }

      const haystack = normalizeSearchText(
        `${plan.title || ''} ${plan.authorName || ''} ${plan.category || ''} ${detectedAge} ${plan.content || ''} ${extraText}`
      );
      return haystack.includes(q);
    });
  }, [plans, ageFilter, searchQuery]);

  const filteredArticles = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    if (!q) return articles;
    return articles.filter((art) =>
      normalizeSearchText(`${art.title || ''} ${art.author || ''} ${art.category || ''}`).includes(q)
    );
  }, [articles, searchQuery]);

  const renderPlanItem = ({ item }: { item: any }) => {
    const ageLabel = detectPlanAgeGroup(item);
    const createdStr = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('pt-BR') : '';

    return (
      <TouchableOpacity
        onPress={() => setSelectedPlan(item)}
        activeOpacity={0.85}
        className="bg-white dark:bg-[#141414] rounded-2xl p-4 mb-3 border border-gray-100 dark:border-white/10"
      >
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-2">
            {!!item.category && (
              <View className="bg-amber-400/15 border border-amber-400/30 px-2.5 py-0.5 rounded-lg">
                <Text className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase">
                  Cat. {item.category}
                </Text>
              </View>
            )}
            {!!ageLabel && (
              <View className="bg-gray-100 dark:bg-white/10 px-2.5 py-0.5 rounded-lg">
                <Text className="text-[10px] font-bold text-gray-600 dark:text-gray-300">{ageLabel}</Text>
              </View>
            )}
          </View>
          {!!createdStr && (
            <View className="flex-row items-center gap-1">
              <Calendar size={11} color="#9ca3af" />
              <Text className="text-[10px] text-gray-400 font-semibold">{createdStr}</Text>
            </View>
          )}
        </View>

        <Text className="text-sm font-black text-gray-900 dark:text-white mb-1" numberOfLines={2}>
          {item.title || 'Plano de Aula'}
        </Text>
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          {item.authorName ? `Instrutor: ${item.authorName}` : 'Equipe Kihap'}
          {Array.isArray(item.weeks) && item.weeks.length > 0
            ? ` • ${item.weeks.length} blocos/linhas`
            : Array.isArray(item.blocks) && item.blocks.length > 0
            ? ` • ${item.blocks.length} blocos`
            : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderArticleItem = ({ item }: { item: any }) => {
    const hasImage = item.heroImageUrl && String(item.heroImageUrl).startsWith('http');
    const createdStr = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('pt-BR') : '';

    return (
      <TouchableOpacity
        onPress={() => router.push(`/user/tatame/${item.id}` as any)}
        activeOpacity={0.85}
        className="bg-white dark:bg-[#141414] rounded-2xl mb-3 border border-gray-100 dark:border-white/10 overflow-hidden"
      >
        {hasImage && (
          <Image source={{ uri: item.heroImageUrl }} className="w-full h-36 bg-gray-100 dark:bg-white/5" resizeMode="cover" />
        )}
        <View className="p-4">
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-[10px] font-black text-amber-500 uppercase tracking-wider">Tatame Kihap</Text>
            <View className="flex-row items-center gap-2">
              {!!item.youtubeUrl && (
                <View className="bg-red-500/15 px-2 py-0.5 rounded-md flex-row items-center gap-1">
                  <Video size={10} color="#ef4444" />
                  <Text className="text-[9px] font-black text-red-500 uppercase">Vídeo</Text>
                </View>
              )}
              {!!createdStr && <Text className="text-[10px] text-gray-400">{createdStr}</Text>}
            </View>
          </View>
          <Text className="text-sm font-black text-gray-900 dark:text-white" numberOfLines={2}>
            {item.title}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-[#f8f9fa] dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View className="bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-white/5">
        <IntranetScreenHeader
          title="Tatame & Aulas"
          subtitle="Planificador de aulas e materiais técnicos"
          currentTab="tatame"
        />

        {/* Sub-abas */}
        <View className="px-4 pb-2 flex-row gap-2">
          <TouchableOpacity
            onPress={() => setActiveTab('planificador')}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center gap-1.5 border ${
              activeTab === 'planificador'
                ? 'bg-[#eab308] border-[#eab308]'
                : 'bg-gray-50 dark:bg-[#141414] border-gray-200 dark:border-white/10'
            }`}
          >
            <ClipboardList size={14} color={activeTab === 'planificador' ? '#000' : isDark ? '#d1d5db' : '#4b5563'} />
            <Text className={`text-xs font-black ${activeTab === 'planificador' ? 'text-black' : 'text-gray-700 dark:text-gray-300'}`}>
              Planificador ({plans.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('conteudos')}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center gap-1.5 border ${
              activeTab === 'conteudos'
                ? 'bg-[#eab308] border-[#eab308]'
                : 'bg-gray-50 dark:bg-[#141414] border-gray-200 dark:border-white/10'
            }`}
          >
            <BookOpen size={14} color={activeTab === 'conteudos' ? '#000' : isDark ? '#d1d5db' : '#4b5563'} />
            <Text className={`text-xs font-black ${activeTab === 'conteudos' ? 'text-black' : 'text-gray-700 dark:text-gray-300'}`}>
              Tatame ({articles.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Busca */}
        <View className="px-4 pb-2">
          <View className="flex-row items-center bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl px-3">
            <Search size={16} color="#9ca3af" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={activeTab === 'planificador' ? 'Buscar plano, tema ou técnica...' : 'Buscar conteúdo...'}
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

        {/* Filtro de faixa etária no Planificador */}
        {activeTab === 'planificador' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }} className="pb-2.5">
            {AGE_FILTERS.map((age) => {
              const selected = ageFilter === age;
              return (
                <TouchableOpacity
                  key={age}
                  onPress={() => setAgeFilter(age)}
                  className={`px-3 py-1.5 rounded-xl border ${
                    selected
                      ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white'
                      : 'bg-white dark:bg-[#141414] border-gray-200 dark:border-white/10'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      selected ? 'text-white dark:text-black' : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {age}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#eab308" size="large" />
        </View>
      ) : activeTab === 'planificador' ? (
        <FlatList
          data={filteredPlans}
          keyExtractor={(item) => item.id}
          renderItem={renderPlanItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View className="bg-white dark:bg-[#141414] rounded-3xl p-8 items-center border border-gray-100 dark:border-white/5 mt-4">
              <Text className="text-sm font-bold text-gray-500">Nenhum plano encontrado.</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredArticles}
          keyExtractor={(item) => item.id}
          renderItem={renderArticleItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View className="bg-white dark:bg-[#141414] rounded-3xl p-8 items-center border border-gray-100 dark:border-white/5 mt-4">
              <Text className="text-sm font-bold text-gray-500">Nenhum material encontrado.</Text>
            </View>
          }
        />
      )}

      {/* Modal de Visualização do Plano de Aula */}
      <Modal
        visible={!!selectedPlan}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedPlan(null)}
      >
        <View className="flex-1 bg-[#f8f9fa] dark:bg-[#050505]">
          <View className="bg-white dark:bg-[#0a0a0a] px-5 pt-5 pb-4 border-b border-gray-100 dark:border-white/5 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-base font-black text-gray-900 dark:text-white" numberOfLines={2}>
                {selectedPlan?.title || 'Plano de Aula'}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {detectPlanAgeGroup(selectedPlan) || 'Geral'}
                {selectedPlan?.category ? ` • Categoria ${selectedPlan.category}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedPlan(null)} className="p-2 rounded-xl bg-gray-100 dark:bg-[#1a1a1a]">
              <X size={20} color={isDark ? '#fff' : '#111827'} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
            {!!selectedPlan?.content && (
              <View className="bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10">
                <Text className="text-xs font-black text-amber-500 uppercase tracking-wider mb-2">Descrição</Text>
                <Text className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  {String(selectedPlan.content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}
                </Text>
              </View>
            )}

            {Array.isArray(selectedPlan?.blocks) &&
              selectedPlan.blocks.map((block: any, idx: number) => (
                <View key={idx} className="bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10">
                  <Text className="text-xs font-black text-amber-500 uppercase tracking-wider mb-1">
                    {block.title || `Bloco ${idx + 1}`}
                  </Text>
                  <Text className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                    {String(block.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'Sem conteúdo.'}
                  </Text>
                </View>
              ))}

            {Array.isArray(selectedPlan?.weeks) &&
              selectedPlan.weeks.map((week: any, idx: number) => {
                const columns = Array.isArray(selectedPlan.columns) ? selectedPlan.columns : [];
                const contentsObj = week.contents || {};
                return (
                  <View key={idx} className="bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10">
                    <Text className="text-sm font-black text-gray-900 dark:text-white mb-2">
                      {week.title || `Bloco / Semana ${idx + 1}`}
                    </Text>
                    {Object.entries(contentsObj).map(([colKey, val], colIdx) => {
                      const colMeta = columns.find((c: any) => String(c.id || c.key) === String(colKey)) || columns[colIdx];
                      const colLabel = colMeta?.title || colMeta?.name || `Parte ${colIdx + 1}`;
                      const cleanVal = String(val || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                      if (!cleanVal) return null;
                      return (
                        <View key={colKey} className="mb-2 last:mb-0 bg-gray-50 dark:bg-[#0a0a0a] p-3 rounded-xl">
                          <Text className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase mb-0.5">
                            {colLabel}
                          </Text>
                          <Text className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{cleanVal}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
