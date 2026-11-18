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
  Linking,
  Alert,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { IntranetScreenHeader } from '../../src/components/IntranetModeBar';
import {
  Search,
  X,
  Plus,
  MessageCircle,
  Edit3,
  Briefcase,
} from 'lucide-react-native';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { KIHAP_UNITS, normalizeSearchText } from '../../src/utils/intranetPermissions';
import { UnitFilterStrip } from '../../src/components/UnitFilterStrip';

const KANBAN_COLUMNS = [
  'Novo',
  'Contactado',
  'Aula experimental',
  'Matrícula',
  'Perdido',
];

const COLUMN_STYLES: Record<string, { bg: string; text: string }> = {
  Novo: { bg: 'bg-gray-500/15', text: 'text-gray-600 dark:text-gray-300' },
  Contactado: { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400' },
  'Aula experimental': { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400' },
  Matrícula: { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400' },
  Perdido: { bg: 'bg-red-500/15', text: 'text-red-600 dark:text-red-400' },
};

export default function IntranetCrmScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [prospects, setProspects] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedUnit, setSelectedUnit] = useState('all');
  const [activeColumn, setActiveColumn] = useState('Novo');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Criar/Editar Lead
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formState, setFormState] = useState({
    responsavel: '',
    telefone: '',
    email: '',
    unidade: 'Centro',
    status: 'Novo',
    origemLead: 'WhatsApp',
    observacoes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubProspects = onSnapshot(
      collection(db, 'prospects'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data(), _collection: 'prospects' }))
          .filter((p: any) => !p.pagina || p.pagina === 'Prospecção');
        setProspects(list);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao escutar prospects:', err);
        setLoading(false);
      }
    );

    const unsubLeads = onSnapshot(
      collection(db, 'leads'),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          responsavel: d.data().nome || d.data().responsavel || '',
          status: d.data().status || 'Novo',
          _collection: 'leads',
        }));
        setLeads(list);
      },
      (err) => console.warn('Erro ao escutar leads:', err)
    );

    return () => {
      unsubProspects();
      unsubLeads();
    };
  }, []);

  const combinedLeads = useMemo(() => {
    return [...prospects, ...leads].sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });
  }, [prospects, leads]);

  const unitFilteredLeads = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    return combinedLeads.filter((item) => {
      if (selectedUnit !== 'all') {
        const targetUnit = KIHAP_UNITS.find((u) => u.id === selectedUnit);
        const normItemUnit = normalizeSearchText(item.unidade || item.unitId || '');
        const normTargetId = normalizeSearchText(selectedUnit.replace(/-/g, ' '));
        const normTargetName = normalizeSearchText(targetUnit?.name || '');
        if (!normItemUnit.includes(normTargetId) && (!normTargetName || !normItemUnit.includes(normTargetName))) {
          return false;
        }
      }
      if (!q) return true;
      const haystack = normalizeSearchText(
        `${item.responsavel || ''} ${item.telefone || ''} ${item.email || ''} ${item.unidade || ''}`
      );
      return haystack.includes(q);
    });
  }, [combinedLeads, selectedUnit, searchQuery]);

  const countsByColumn = useMemo(() => {
    const counts: Record<string, number> = {};
    KANBAN_COLUMNS.forEach((col) => {
      counts[col] = 0;
    });
    unitFilteredLeads.forEach((item) => {
      const st = KANBAN_COLUMNS.includes(item.status) ? item.status : 'Novo';
      counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }, [unitFilteredLeads]);

  const visibleLeads = useMemo(() => {
    return unitFilteredLeads.filter((item) => {
      const st = KANBAN_COLUMNS.includes(item.status) ? item.status : 'Novo';
      return st === activeColumn;
    });
  }, [unitFilteredLeads, activeColumn]);

  const openWhatsApp = (phoneStr: string) => {
    const digits = (phoneStr || '').replace(/\D/g, '');
    if (!digits) {
      Alert.alert('Sem telefone', 'Este lead não possui telefone cadastrado.');
      return;
    }
    const full = digits.startsWith('55') ? digits : `55${digits}`;
    Linking.openURL(`https://wa.me/${full}`).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    });
  };

  const handleMoveStatus = async (item: any, newStatus: string) => {
    if (item.status === newStatus) return;
    try {
      const colName = item._collection || 'prospects';
      await updateDoc(doc(db, colName, item.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível mover o lead.');
    }
  };

  const openNewLeadModal = () => {
    setEditingItem(null);
    const unitObj = KIHAP_UNITS.find((u) => u.id === selectedUnit);
    setFormState({
      responsavel: '',
      telefone: '',
      email: '',
      unidade: unitObj?.name || 'Centro',
      status: activeColumn,
      origemLead: 'WhatsApp',
      observacoes: '',
    });
    setModalVisible(true);
  };

  const openEditLeadModal = (item: any) => {
    setEditingItem(item);
    setFormState({
      responsavel: item.responsavel || '',
      telefone: item.telefone || '',
      email: item.email || '',
      unidade: item.unidade || 'Centro',
      status: KANBAN_COLUMNS.includes(item.status) ? item.status : 'Novo',
      origemLead: item.origemLead || 'Site',
      observacoes: item.observacoes || item.notes || '',
    });
    setModalVisible(true);
  };

  const handleSaveLead = async () => {
    if (!formState.responsavel.trim()) {
      Alert.alert('Atenção', 'Informe o nome do contato/responsável.');
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        const colName = editingItem._collection || 'prospects';
        await updateDoc(doc(db, colName, editingItem.id), {
          responsavel: formState.responsavel.trim(),
          telefone: formState.telefone.trim(),
          email: formState.email.trim(),
          unidade: formState.unidade.trim(),
          status: formState.status,
          origemLead: formState.origemLead.trim(),
          observacoes: formState.observacoes.trim(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'prospects'), {
          responsavel: formState.responsavel.trim(),
          telefone: formState.telefone.trim(),
          email: formState.email.trim(),
          unidade: formState.unidade.trim(),
          status: formState.status,
          origemLead: formState.origemLead.trim(),
          observacoes: formState.observacoes.trim(),
          pagina: 'Prospecção',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setModalVisible(false);
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar o lead.');
    } finally {
      setSaving(false);
    }
  };

  const renderLeadCard = ({ item }: { item: any }) => {
    const createdStr = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('pt-BR') : '';
    const style = COLUMN_STYLES[item.status] || COLUMN_STYLES.Novo;

    return (
      <View className="bg-white dark:bg-[#141414] rounded-2xl p-4 mb-3 border border-gray-100 dark:border-white/10">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 pr-2">
            <Text className="text-sm font-black text-gray-900 dark:text-white">
              {item.responsavel || 'Sem nome'}
            </Text>
            <Text className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {item.unidade || 'Sem unidade'} {item.origemLead ? `• ${item.origemLead}` : ''} {createdStr ? `• ${createdStr}` : ''}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            {!!item.telefone && (
              <TouchableOpacity
                onPress={() => openWhatsApp(item.telefone)}
                className="w-8 h-8 rounded-xl bg-emerald-600 items-center justify-center"
              >
                <MessageCircle size={15} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => openEditLeadModal(item)}
              className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-white/10 items-center justify-center"
            >
              <Edit3 size={14} color={isDark ? '#fff' : '#111827'} />
            </TouchableOpacity>
          </View>
        </View>

        {!!item.telefone && (
          <Text className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
            Tel: {item.telefone}
          </Text>
        )}
        {!!(item.observacoes || item.notes) && (
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2" numberOfLines={2}>
            {item.observacoes || item.notes}
          </Text>
        )}

        {/* Ação rápida para mover de etapa */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2 pt-2 border-t border-gray-100 dark:border-white/5" contentContainerStyle={{ gap: 6 }}>
          {KANBAN_COLUMNS.map((col) => {
            const isCurrent = (KANBAN_COLUMNS.includes(item.status) ? item.status : 'Novo') === col;
            return (
              <TouchableOpacity
                key={col}
                onPress={() => handleMoveStatus(item, col)}
                className={`px-2.5 py-1 rounded-lg border ${
                  isCurrent
                    ? `${style.bg} border-transparent`
                    : 'bg-gray-50 dark:bg-[#0a0a0a] border-gray-200 dark:border-white/10'
                }`}
              >
                <Text
                  className={`text-[10px] font-bold ${
                    isCurrent ? style.text : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {col}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#f8f9fa] dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View className="bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-white/5">
        <IntranetScreenHeader
          title="CRM / Prospecção"
          subtitle={`${unitFilteredLeads.length} leads no funil`}
          currentTab="crm"
          rightAction={
            <TouchableOpacity
              onPress={openNewLeadModal}
              className="flex-row items-center gap-1.5 bg-[#eab308] px-3 py-2 rounded-xl"
            >
              <Plus size={15} color="#000" />
              <Text className="text-xs font-black text-black">Novo Lead</Text>
            </TouchableOpacity>
          }
        />

        <View className="px-4 pb-2">
          <View className="flex-row items-center bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl px-3">
            <Search size={16} color="#9ca3af" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar nome ou telefone..."
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

        <UnitFilterStrip selectedUnit={selectedUnit} onSelectUnit={setSelectedUnit} includeAll={true} allLabel="Todas" />

        {/* Colunas do Kanban */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }} className="pb-2.5">
          {KANBAN_COLUMNS.map((col) => {
            const isSelected = activeColumn === col;
            return (
              <TouchableOpacity
                key={col}
                onPress={() => setActiveColumn(col)}
                className={`px-3.5 py-2 rounded-xl flex-row items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white'
                    : 'bg-gray-50 dark:bg-[#141414] border-gray-200 dark:border-white/10'
                }`}
              >
                <Text className={`text-xs font-bold ${isSelected ? 'text-white dark:text-black' : 'text-gray-700 dark:text-gray-300'}`}>
                  {col}
                </Text>
                <View className={`px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-white/20 dark:bg-black/15' : 'bg-gray-200 dark:bg-white/10'}`}>
                  <Text className={`text-[10px] font-black ${isSelected ? 'text-white dark:text-black' : 'text-gray-600 dark:text-gray-300'}`}>
                    {countsByColumn[col] || 0}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#eab308" size="large" />
        </View>
      ) : (
        <FlatList
          data={visibleLeads}
          keyExtractor={(item) => `${item._collection}-${item.id}`}
          renderItem={renderLeadCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View className="bg-white dark:bg-[#141414] rounded-3xl p-8 items-center border border-gray-100 dark:border-white/5 mt-4">
              <Briefcase size={30} color="#9ca3af" />
              <Text className="text-sm font-bold text-gray-600 dark:text-gray-300 mt-3">
                Nenhum lead na etapa "{activeColumn}".
              </Text>
            </View>
          }
        />
      )}

      {/* Modal Criar/Editar Lead */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-[#f8f9fa] dark:bg-[#050505]">
          <View className="bg-white dark:bg-[#0a0a0a] px-5 pt-5 pb-4 border-b border-gray-100 dark:border-white/5 flex-row items-center justify-between">
            <Text className="text-lg font-black text-gray-900 dark:text-white">
              {editingItem ? 'Editar Lead' : 'Novo Lead'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} className="p-2 rounded-xl bg-gray-100 dark:bg-[#1a1a1a]">
              <X size={20} color={isDark ? '#fff' : '#111827'} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
            <View>
              <Text className="text-[10px] font-bold text-gray-500 uppercase mb-1">Nome / Responsável</Text>
              <TextInput
                value={formState.responsavel}
                onChangeText={(v) => setFormState((p) => ({ ...p, responsavel: v }))}
                className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white"
              />
            </View>
            <View>
              <Text className="text-[10px] font-bold text-gray-500 uppercase mb-1">Telefone / WhatsApp</Text>
              <TextInput
                value={formState.telefone}
                onChangeText={(v) => setFormState((p) => ({ ...p, telefone: v }))}
                keyboardType="phone-pad"
                className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white"
              />
            </View>
            <View>
              <Text className="text-[10px] font-bold text-gray-500 uppercase mb-1">Unidade</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {KIHAP_UNITS.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    onPress={() => setFormState((p) => ({ ...p, unidade: u.name }))}
                    className={`px-3 py-2 rounded-xl border ${
                      normalizeSearchText(formState.unidade) === normalizeSearchText(u.name)
                        ? 'bg-[#eab308] border-[#eab308]'
                        : 'bg-white dark:bg-[#141414] border-gray-200 dark:border-white/10'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        normalizeSearchText(formState.unidade) === normalizeSearchText(u.name)
                          ? 'text-black'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {u.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View>
              <Text className="text-[10px] font-bold text-gray-500 uppercase mb-1">Etapa do Funil</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {KANBAN_COLUMNS.map((col) => (
                  <TouchableOpacity
                    key={col}
                    onPress={() => setFormState((p) => ({ ...p, status: col }))}
                    className={`px-3 py-2 rounded-xl border ${
                      formState.status === col
                        ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white'
                        : 'bg-white dark:bg-[#141414] border-gray-200 dark:border-white/10'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        formState.status === col ? 'text-white dark:text-black' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {col}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View>
              <Text className="text-[10px] font-bold text-gray-500 uppercase mb-1">Observações</Text>
              <TextInput
                value={formState.observacoes}
                onChangeText={(v) => setFormState((p) => ({ ...p, observacoes: v }))}
                multiline
                numberOfLines={4}
                className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white min-h-[90px]"
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              onPress={handleSaveLead}
              disabled={saving}
              className="bg-[#eab308] py-3.5 rounded-xl items-center mt-2"
            >
              <Text className="text-sm font-black text-black">
                {saving ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Criar Lead'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
