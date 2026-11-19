import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { useRouter } from 'expo-router';
import {
  Shield,
  User,
  Menu,
  X,
  LogOut,
  CalendarCheck,
  Users,
  BookOpen,
  Briefcase,
  ShoppingBag,
  BarChart3,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import {
  INTRANET_MODULES,
  IntranetModuleKey,
  IntranetModuleMeta,
  canAccessIntranetModule,
  getFirstAllowedIntranetRoute,
  formatUnitName,
} from '../utils/intranetPermissions';

const MODULE_LABELS: Record<IntranetModuleKey, string> = {
  grade: 'Grade e Chamada',
  alunos: 'Alunos',
  tatame: 'Tatame & Aulas',
  crm: 'CRM / Prospecção',
  store: 'Vendas & Pedidos',
  analise: 'Análise & KPIs',
};

const MODULE_ICONS: Record<IntranetModuleKey, any> = {
  grade: CalendarCheck,
  alunos: Users,
  tatame: BookOpen,
  crm: Briefcase,
  store: ShoppingBag,
  analise: BarChart3,
};

function formatShortUserName(fullName?: string): string {
  if (!fullName) return 'Equipe Kihap';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0];
  const titles = ['mr.', 'mr', 'mrs.', 'mrs', 'ms.', 'ms', 'dr.', 'dr', 'dra.', 'dra', 'prof.', 'prof', 'mestre', 'instrutor', 'instrutora'];
  if (titles.includes(parts[0].toLowerCase()) || parts[0].length <= 2) {
    return `${parts[0]} ${parts[1]}`;
  }
  if (parts.length === 2) return `${parts[0]} ${parts[1]}`;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function SidebarModeSwitcher({ onAfterSwitch }: { onAfterSwitch?: () => void }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { canUseIntranet, appMode, setAppMode, userData } = useAuth();

  if (!canUseIntranet) return null;

  const handleSwitchMode = async (target: 'student' | 'intranet') => {
    onAfterSwitch?.();
    if (target === appMode) return;
    await setAppMode(target);
    if (target === 'intranet') {
      const targetRoute = getFirstAllowedIntranetRoute(userData);
      router.replace(targetRoute as any);
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  return (
    <View className="px-4 py-3 border-b border-gray-100 dark:border-white/5">
      <Text className="text-[9px] font-black text-gray-400 uppercase tracking-[2px] mb-2">
        Modo do Aplicativo
      </Text>
      <View className="flex-row bg-gray-100 dark:bg-[#0f0f0f] p-1 rounded-2xl border border-gray-200/70 dark:border-white/10">
        <TouchableOpacity
          onPress={() => handleSwitchMode('student')}
          activeOpacity={0.85}
          className={`flex-1 flex-row items-center justify-center py-2 px-2 rounded-xl gap-1.5 ${
            appMode === 'student' ? 'bg-white dark:bg-[#2a2a2a]' : ''
          }`}
        >
          <User
            size={13}
            color={appMode === 'student' ? (isDark ? '#ffffff' : '#111827') : (isDark ? '#9ca3af' : '#6b7280')}
          />
          <Text
            numberOfLines={1}
            className={`text-xs font-black tracking-tight ${
              appMode === 'student'
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Aluno
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleSwitchMode('intranet')}
          activeOpacity={0.85}
          className={`flex-1 flex-row items-center justify-center py-2 px-2 rounded-xl gap-1.5 ${
            appMode === 'intranet' ? 'bg-[#eab308]' : ''
          }`}
        >
          <Shield
            size={13}
            color={appMode === 'intranet' ? '#000000' : (isDark ? '#9ca3af' : '#6b7280')}
          />
          <Text
            numberOfLines={1}
            className={`text-xs font-black tracking-tight ${
              appMode === 'intranet'
                ? 'text-black'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Intranet
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export interface IntranetScreenHeaderProps {
  title: string;
  subtitle?: string;
  currentTab: IntranetModuleKey;
  rightAction?: React.ReactNode;
}

export function IntranetScreenHeader({
  title,
  subtitle,
  currentTab,
  rightAction,
}: IntranetScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { userData, signOut, setAppMode } = useAuth();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const allowedModules = useMemo(
    () => INTRANET_MODULES.filter((mod) => canAccessIntranetModule(userData, mod.key)),
    [userData]
  );

  const displayName = userData?.name || userData?.nome || userData?.displayName || 'Equipe Kihap';
  const shortName = formatShortUserName(displayName);
  const rawUnitName = userData?.unidade || userData?.unit || userData?.branchName || userData?.unitId;
  const displayUnit = rawUnitName ? formatUnitName(String(rawUnitName)) : 'Kihap';

  let rawPhoto = userData?.photoURL || userData?.profilePicture || userData?.photoUrl || userData?.avatar;
  if (rawPhoto && rawPhoto.startsWith('/')) {
    rawPhoto = `https://kihap.com.br${rawPhoto}`;
  }
  const defaultProfileImg = require('../../assets/images/default-profile.png');
  const displayPhoto = rawPhoto && !rawPhoto.includes('default-profile.svg') ? { uri: rawPhoto } : defaultProfileImg;

  const handleNavigateModule = (mod: IntranetModuleMeta) => {
    setSidebarOpen(false);
    if (mod.key === currentTab) return;
    router.replace(mod.route as any);
  };

  const handleOpenProfile = async () => {
    setSidebarOpen(false);
    await setAppMode('student');
    router.replace('/(tabs)/perfil' as any);
  };

  return (
    <>
      <View style={{ paddingTop: insets.top || 50 }} className="px-4 pb-2.5">
        <View className="flex-row items-center justify-between pt-1">
          <View className="flex-row items-center flex-1 mr-2">
            <TouchableOpacity
              onPress={() => setSidebarOpen(true)}
              className="p-2 -ml-2 mr-2 rounded-xl active:bg-gray-100 dark:active:bg-white/5"
              accessibilityLabel="Abrir menu da intranet"
            >
              <Menu size={24} color={isDark ? '#ffffff' : '#111827'} />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-xl font-black text-gray-900 dark:text-white tracking-tight" numberOfLines={1}>
                {title}
              </Text>
              {!!subtitle && (
                <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>
          {rightAction}
        </View>
      </View>

      <Modal
        visible={isSidebarOpen}
        animationType="none"
        transparent={true}
        onRequestClose={() => setSidebarOpen(false)}
      >
        <View className="flex-1 flex-row">
          <View className="w-72 bg-white dark:bg-[#1a1a1a] h-full shadow-2xl">
            <View className="flex-1">
              <View style={{ paddingTop: insets.top }}>
                <View className="p-6 border-b border-gray-100 dark:border-white/5 flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 mr-2">
                    <Image
                      source={displayPhoto}
                      className="w-12 h-12 rounded-full border-2 border-yellow-500/30"
                    />
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-black text-gray-900 dark:text-white" numberOfLines={1}>
                        {shortName}
                      </Text>
                      <View className="flex-row items-center mt-0.5">
                        <Shield size={10} color="#eab308" />
                        <Text
                          className="text-[9px] text-amber-600 dark:text-amber-400 font-black uppercase tracking-wider ml-1"
                          numberOfLines={1}
                        >
                          Intranet • {displayUnit}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSidebarOpen(false)}
                    className="p-1.5 rounded-full bg-gray-100 dark:bg-white/10"
                  >
                    <X size={16} color={isDark ? '#d1d5db' : '#4b5563'} />
                  </TouchableOpacity>
                </View>

                <SidebarModeSwitcher onAfterSwitch={() => setSidebarOpen(false)} />
              </View>

              <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
                <Text className="text-[9px] font-black text-gray-400 uppercase tracking-[2px] px-3 mb-2">
                  Módulos da Intranet
                </Text>
                {allowedModules.map((mod) => {
                  const IconComp = MODULE_ICONS[mod.key];
                  const isActive = currentTab === mod.key;
                  return (
                    <TouchableOpacity
                      key={mod.key}
                      onPress={() => handleNavigateModule(mod)}
                      activeOpacity={0.8}
                      className={`flex-row items-center px-4 py-3.5 mb-1.5 rounded-2xl ${
                        isActive
                          ? 'bg-[#eab308]'
                          : 'active:bg-gray-100 dark:active:bg-white/5'
                      }`}
                    >
                      <IconComp
                        size={20}
                        color={isActive ? '#000000' : isDark ? '#e5e7eb' : '#374151'}
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                      <Text
                        className={`ml-4 text-[15px] flex-1 ${
                          isActive
                            ? 'text-black font-black'
                            : 'text-gray-700 dark:text-gray-200 font-bold'
                        }`}
                      >
                        {MODULE_LABELS[mod.key]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <View className="h-[1px] bg-gray-100 dark:bg-white/5 my-3 mx-2" />

                <TouchableOpacity
                  onPress={handleOpenProfile}
                  activeOpacity={0.8}
                  className="flex-row items-center px-4 py-3.5 mb-1 rounded-2xl active:bg-gray-100 dark:active:bg-white/5"
                >
                  <User size={20} color={isDark ? '#9ca3af' : '#4b5563'} />
                  <Text className="ml-4 text-[14px] font-bold text-gray-600 dark:text-gray-300">
                    Meu Perfil
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              <View
                style={{ paddingBottom: Math.max(insets.bottom, 16) }}
                className="px-6 pt-4 border-t border-gray-100 dark:border-white/5"
              >
                <TouchableOpacity
                  onPress={() => {
                    setSidebarOpen(false);
                    signOut?.();
                  }}
                  className="flex-row items-center p-4 bg-red-500/10 rounded-2xl"
                >
                  <LogOut size={20} color="#ef4444" />
                  <View style={{ width: 12 }} />
                  <Text className="text-red-500 font-bold uppercase tracking-widest text-[10px]">
                    Sair da Conta
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setSidebarOpen(false)}
            className="flex-1 bg-black/40"
          />
        </View>
      </Modal>
    </>
  );
}
