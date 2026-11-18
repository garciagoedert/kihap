import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { Search, X, ShoppingBag, RefreshCw, Armchair, CheckCircle2 } from 'lucide-react-native';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { formatUnitName, normalizeSearchText } from '../../src/utils/intranetPermissions';
import { formatKitSelectionLines } from '../../src/utils/pricing';
import { UnitFilterStrip } from '../../src/components/UnitFilterStrip';
import { IntranetScreenHeader } from '../../src/components/IntranetModeBar';

const FULFILLMENT_OPTIONS = [
  { key: 'pending', label: 'Pendente' },
  { key: 'processing', label: 'Em Preparação' },
  { key: 'shipped', label: 'Enviado' },
  { key: 'delivered', label: 'Entregue' },
  { key: 'canceled', label: 'Cancelado' },
];

function getFulfillmentLabel(status?: string): string {
  return FULFILLMENT_OPTIONS.find((f) => f.key === status)?.label || 'Pendente';
}

function getSeatLabel(sale: any): string {
  if (!sale) return '';
  if (sale.seatId && String(sale.seatId).trim()) return String(sale.seatId).trim();
  if (Array.isArray(sale.selectedSeats) && sale.selectedSeats.length > 0) {
    return sale.selectedSeats.filter(Boolean).join(', ');
  }
  if (Array.isArray(sale.seats) && sale.seats.length > 0) {
    return sale.seats.filter(Boolean).join(', ');
  }
  return '';
}

export default function IntranetStoreScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'inscricoesFaixaPreta'), orderBy('created', 'desc'), limit(250));
      const snap = await getDocs(q);
      setSales(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Erro ao carregar vendas da Store:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const filteredSales = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    return sales.filter((s) => {
      if (selectedUnit !== 'all') {
        const u = normalizeSearchText(s.userUnit || s.unitId || '');
        if (u !== normalizeSearchText(selectedUnit)) return false;
      }
      if (paymentFilter !== 'all' && s.paymentStatus !== paymentFilter) return false;
      if (fulfillmentFilter !== 'all') {
        const fs = s.fulfillmentStatus || 'pending';
        if (fs !== fulfillmentFilter) return false;
      }
      if (!q) return true;
      const seat = getSeatLabel(s);
      const haystack = normalizeSearchText(
        `${s.userName || ''} ${s.userEmail || ''} ${s.productName || ''} ${seat} ${s.sessionLabel || ''}`
      );
      return haystack.includes(q);
    });
  }, [sales, selectedUnit, paymentFilter, fulfillmentFilter, searchQuery]);

  const handleUpdateFulfillment = async (newStatus: string) => {
    if (!selectedSale) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'inscricoesFaixaPreta', selectedSale.id), {
        fulfillmentStatus: newStatus,
        lastModifiedAt: serverTimestamp(),
      });
      setSelectedSale((prev: any) => (prev ? { ...prev, fulfillmentStatus: newStatus } : prev));
      setSales((prev) =>
        prev.map((item) => (item.id === selectedSale.id ? { ...item, fulfillmentStatus: newStatus } : item))
      );
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível atualizar a entrega.');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleCheckin = async () => {
    if (!selectedSale) return;
    const nextStatus = selectedSale.checkinStatus === 'realizado' ? 'pendente' : 'realizado';
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'inscricoesFaixaPreta', selectedSale.id), {
        checkinStatus: nextStatus,
        lastModifiedAt: serverTimestamp(),
      });
      setSelectedSale((prev: any) => (prev ? { ...prev, checkinStatus: nextStatus } : prev));
      setSales((prev) =>
        prev.map((item) => (item.id === selectedSale.id ? { ...item, checkinStatus: nextStatus } : item))
      );
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível atualizar o check-in.');
    } finally {
      setUpdating(false);
    }
  };

  const renderSaleCard = ({ item }: { item: any }) => {
    const amount = ((item.amountTotal || 0) / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: item.currency || 'BRL',
    });
    const dateStr = item.created?.toDate ? item.created.toDate().toLocaleDateString('pt-BR') : 'N/A';
    const seat = getSeatLabel(item);
    const isPaid = item.paymentStatus === 'paid' || item.paymentStatus === 'approved';
    const kitLines = item.kitSelections ? formatKitSelectionLines(item.kitSelections) : [];

    return (
      <TouchableOpacity
        onPress={() => setSelectedSale(item)}
        activeOpacity={0.85}
        className="bg-white dark:bg-[#141414] rounded-2xl p-4 mb-2.5 border border-gray-100 dark:border-white/10"
      >
        <View className="flex-row items-start justify-between mb-1.5">
          <View className="flex-1 pr-2">
            <Text className="text-sm font-black text-gray-900 dark:text-white" numberOfLines={1}>
              {item.userName || 'Cliente'}
            </Text>
            <Text className="text-[11px] text-gray-500 dark:text-gray-400" numberOfLines={1}>
              {item.productName || 'Produto'}
            </Text>
          </View>
          <Text className="text-sm font-black text-emerald-600 dark:text-emerald-400">{amount}</Text>
        </View>

        {!!item.userSize && (
          <Text className="text-[11px] text-gray-500 dark:text-gray-400">Tamanho: {item.userSize}</Text>
        )}
        {kitLines.length > 0 && (
          <Text className="text-[11px] text-gray-500 dark:text-gray-400" numberOfLines={2}>
            {kitLines.join(' | ')}
          </Text>
        )}

        {(seat || item.sessionLabel) && (
          <View className="flex-row flex-wrap items-center gap-1.5 mt-1.5">
            {!!item.sessionLabel && (
              <View className="bg-blue-500/15 px-2 py-0.5 rounded-md">
                <Text className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{item.sessionLabel}</Text>
              </View>
            )}
            {!!seat && (
              <View className="bg-amber-400/20 px-2 py-0.5 rounded-md flex-row items-center gap-1">
                <Armchair size={10} color="#d97706" />
                <Text className="text-[10px] font-black text-amber-700 dark:text-amber-300">Cadeira {seat}</Text>
              </View>
            )}
          </View>
        )}

        <View className="flex-row items-center justify-between mt-2.5 pt-2 border-t border-gray-100 dark:border-white/5">
          <View className="flex-row items-center gap-1.5">
            <View className={`px-2 py-0.5 rounded-md ${isPaid ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
              <Text className={`text-[10px] font-black ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {isPaid ? 'Pago' : 'Pendente'}
              </Text>
            </View>
            <View className="bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-md">
              <Text className="text-[10px] font-bold text-gray-600 dark:text-gray-300">
                {getFulfillmentLabel(item.fulfillmentStatus)}
              </Text>
            </View>
            {item.checkinStatus === 'realizado' && (
              <View className="bg-emerald-500/15 px-2 py-0.5 rounded-md flex-row items-center gap-1">
                <CheckCircle2 size={10} color="#10b981" />
                <Text className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Check-in</Text>
              </View>
            )}
          </View>
          <Text className="text-[10px] text-gray-400 font-semibold">
            {formatUnitName(item.userUnit)} • {dateStr}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-[#f8f9fa] dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View className="bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-white/5">
        <IntranetScreenHeader
          title="Vendas & Pedidos"
          subtitle={`${filteredSales.length} pedidos exibidos`}
          currentTab="store"
          rightAction={
            <TouchableOpacity onPress={loadSales} className="p-2 rounded-xl bg-gray-100 dark:bg-[#1a1a1a]">
              <RefreshCw size={16} color={isDark ? '#fff' : '#111827'} />
            </TouchableOpacity>
          }
        />

        <View className="px-4 pb-2">
          <View className="flex-row items-center bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl px-3">
            <Search size={16} color="#9ca3af" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Cliente, produto ou cadeira..."
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

        {/* Filtros de Pagamento & Entrega */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }} className="pb-2.5">
          {[
            { key: 'all', label: 'Pgto: Todos' },
            { key: 'paid', label: 'Pagos' },
            { key: 'pending', label: 'Pendentes' },
          ].map((pf) => (
            <TouchableOpacity
              key={pf.key}
              onPress={() => setPaymentFilter(pf.key as any)}
              className={`px-3 py-1.5 rounded-xl border ${
                paymentFilter === pf.key
                  ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white'
                  : 'bg-white dark:bg-[#141414] border-gray-200 dark:border-white/10'
              }`}
            >
              <Text className={`text-[11px] font-bold ${paymentFilter === pf.key ? 'text-white dark:text-black' : 'text-gray-600 dark:text-gray-300'}`}>
                {pf.label}
              </Text>
            </TouchableOpacity>
          ))}
          {FULFILLMENT_OPTIONS.slice(0, 4).map((ff) => (
            <TouchableOpacity
              key={ff.key}
              onPress={() => setFulfillmentFilter((prev) => (prev === ff.key ? 'all' : ff.key))}
              className={`px-3 py-1.5 rounded-xl border ${
                fulfillmentFilter === ff.key
                  ? 'bg-blue-600 border-blue-600'
                  : 'bg-white dark:bg-[#141414] border-gray-200 dark:border-white/10'
              }`}
            >
              <Text className={`text-[11px] font-bold ${fulfillmentFilter === ff.key ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                {ff.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#eab308" size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredSales}
          keyExtractor={(item) => item.id}
          renderItem={renderSaleCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View className="bg-white dark:bg-[#141414] rounded-3xl p-8 items-center border border-gray-100 dark:border-white/5 mt-4">
              <ShoppingBag size={30} color="#9ca3af" />
              <Text className="text-sm font-bold text-gray-500 mt-3">Nenhum pedido encontrado.</Text>
            </View>
          }
        />
      )}

      {/* Modal de Detalhes do Pedido */}
      <Modal
        visible={!!selectedSale}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedSale(null)}
      >
        <View className="flex-1 bg-[#f8f9fa] dark:bg-[#050505]">
          <View className="bg-white dark:bg-[#0a0a0a] px-5 pt-5 pb-4 border-b border-gray-100 dark:border-white/5 flex-row items-center justify-between">
            <Text className="text-lg font-black text-gray-900 dark:text-white">Detalhes do Pedido</Text>
            <TouchableOpacity onPress={() => setSelectedSale(null)} className="p-2 rounded-xl bg-gray-100 dark:bg-[#1a1a1a]">
              <X size={20} color={isDark ? '#fff' : '#111827'} />
            </TouchableOpacity>
          </View>

          {!!selectedSale && (
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
              <View className="bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10 gap-1.5">
                <Text className="text-[10px] font-bold text-gray-400 uppercase">Cliente</Text>
                <Text className="text-base font-black text-gray-900 dark:text-white">{selectedSale.userName || 'N/A'}</Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">{selectedSale.userEmail || 'Sem e-mail'}</Text>
                {!!selectedSale.userPhone && (
                  <Text className="text-xs text-gray-500 dark:text-gray-400">Tel: {selectedSale.userPhone}</Text>
                )}
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  Unidade: {formatUnitName(selectedSale.userUnit)}
                </Text>
              </View>

              <View className="bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10 gap-2">
                <Text className="text-[10px] font-bold text-gray-400 uppercase">Item & Especificações</Text>
                <Text className="text-sm font-black text-gray-900 dark:text-white">{selectedSale.productName}</Text>
                {!!selectedSale.userSize && (
                  <Text className="text-xs text-gray-600 dark:text-gray-300">Tamanho: {selectedSale.userSize}</Text>
                )}
                {!!selectedSale.sessionLabel && (
                  <Text className="text-xs text-blue-600 dark:text-blue-400 font-bold">Sessão: {selectedSale.sessionLabel}</Text>
                )}
                {!!getSeatLabel(selectedSale) && (
                  <Text className="text-xs text-amber-600 dark:text-amber-400 font-black">
                    Assento / Cadeira: {getSeatLabel(selectedSale)}
                  </Text>
                )}
                {selectedSale.kitSelections &&
                  formatKitSelectionLines(selectedSale.kitSelections).map((line, i) => (
                    <Text key={i} className="text-xs text-gray-600 dark:text-gray-300">
                      • {line}
                    </Text>
                  ))}
              </View>

              {/* Atualizar Entrega */}
              <View className="bg-white dark:bg-[#141414] rounded-2xl p-4 border border-gray-100 dark:border-white/10">
                <Text className="text-[10px] font-bold text-gray-400 uppercase mb-3">Status de Entrega</Text>
                <View className="flex-row flex-wrap gap-2">
                  {FULFILLMENT_OPTIONS.map((opt) => {
                    const isCurrent = (selectedSale.fulfillmentStatus || 'pending') === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        disabled={updating}
                        onPress={() => handleUpdateFulfillment(opt.key)}
                        className={`px-3.5 py-2 rounded-xl border ${
                          isCurrent
                            ? 'bg-[#eab308] border-[#eab308]'
                            : 'bg-gray-50 dark:bg-[#0a0a0a] border-gray-200 dark:border-white/10'
                        }`}
                      >
                        <Text className={`text-xs font-bold ${isCurrent ? 'text-black' : 'text-gray-700 dark:text-gray-300'}`}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Check-in de Evento */}
              <TouchableOpacity
                onPress={handleToggleCheckin}
                disabled={updating}
                className={`py-3.5 rounded-2xl items-center border ${
                  selectedSale.checkinStatus === 'realizado'
                    ? 'bg-emerald-600 border-emerald-600'
                    : 'bg-white dark:bg-[#141414] border-gray-200 dark:border-white/10'
                }`}
              >
                <Text
                  className={`text-xs font-black uppercase ${
                    selectedSale.checkinStatus === 'realizado'
                      ? 'text-white'
                      : 'text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {selectedSale.checkinStatus === 'realizado'
                    ? 'Check-in Realizado (tocar para reverter)'
                    : 'Confirmar Check-in do Pedido'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}
