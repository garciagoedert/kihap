import { Tabs } from 'expo-router';
import React from 'react';
import {
  Home,
  Store,
  Flame,
  Search,
  CalendarCheck,
  Users,
  BookOpen,
  Briefcase,
  ShoppingBag,
  BarChart3,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { View, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { canAccessIntranetModule } from '../../src/utils/intranetPermissions';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { userData, appMode, canUseIntranet } = useAuth();
  const insets = useSafeAreaInsets();

  const activeColor = '#eab308'; // Amarelo Kihap Ativo
  const isIntranetMode = canUseIntranet && appMode === 'intranet';

  // Normalize photo URL for bottom menu
  let rawPhoto = userData?.photoURL || userData?.profilePicture || userData?.photoUrl || userData?.avatar;
  if (rawPhoto && rawPhoto.startsWith('/')) {
    rawPhoto = `https://kihap.com.br${rawPhoto}`;
  }
  const defaultProfileImg = require('../../assets/images/default-profile.png');
  const displayPhoto = rawPhoto && !rawPhoto.includes('default-profile.svg') ? { uri: rawPhoto } : defaultProfileImg;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: isDark ? '#666' : '#999',
        headerShown: false,
        tabBarStyle: isIntranetMode
          ? { display: 'none' }
          : {
              backgroundColor: isDark ? '#0a0a0a' : '#fff',
              borderTopColor: isDark ? '#222' : '#eee',
              height: 60 + (insets.bottom > 10 ? 6 : 0),
              paddingBottom: 10,
              elevation: 0,
              shadowOpacity: 0,
            },
        tabBarLabelStyle: { display: 'none' },
      }}
    >
      {/* Abas Modo Aluno */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          href: isIntranetMode ? null : undefined,
          tabBarIcon: ({ color, focused }) => <Home size={22} color={color} strokeWidth={focused ? 2.5 : 2} />,
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: 'Loja',
          href: isIntranetMode ? null : undefined,
          tabBarIcon: ({ color, focused }) => <Store size={22} color={color} strokeWidth={focused ? 2.5 : 2} />,
        }}
      />
      <Tabs.Screen
        name="notificacoes"
        options={{
          title: 'Ofensivas',
          href: isIntranetMode ? null : undefined,
          tabBarIcon: ({ color, focused }) => <Flame size={22} color={color} strokeWidth={focused ? 2.5 : 2} />,
        }}
      />
      <Tabs.Screen
        name="busca"
        options={{
          title: 'Busca',
          href: isIntranetMode ? null : undefined,
          tabBarIcon: ({ color, focused }) => <Search size={22} color={color} strokeWidth={focused ? 2.5 : 2} />,
        }}
      />

      {/* Abas Modo Intranet (Nativo) */}
      <Tabs.Screen
        name="intranet-grade"
        options={{
          title: 'Grade',
          href: isIntranetMode && canAccessIntranetModule(userData, 'grade') ? undefined : null,
          tabBarIcon: ({ color, focused }) => <CalendarCheck size={20} color={color} strokeWidth={focused ? 2.5 : 2} />,
        }}
      />
      <Tabs.Screen
        name="intranet-alunos"
        options={{
          title: 'Alunos',
          href: isIntranetMode && canAccessIntranetModule(userData, 'alunos') ? undefined : null,
          tabBarIcon: ({ color, focused }) => <Users size={20} color={color} strokeWidth={focused ? 2.5 : 2} />,
        }}
      />
      <Tabs.Screen
        name="intranet-tatame"
        options={{
          title: 'Tatame',
          href: isIntranetMode && canAccessIntranetModule(userData, 'tatame') ? undefined : null,
          tabBarIcon: ({ color, focused }) => <BookOpen size={20} color={color} strokeWidth={focused ? 2.5 : 2} />,
        }}
      />
      <Tabs.Screen
        name="intranet-crm"
        options={{
          title: 'CRM',
          href: isIntranetMode && canAccessIntranetModule(userData, 'crm') ? undefined : null,
          tabBarIcon: ({ color, focused }) => <Briefcase size={20} color={color} strokeWidth={focused ? 2.5 : 2} />,
        }}
      />
      <Tabs.Screen
        name="intranet-store"
        options={{
          title: 'Vendas',
          href: isIntranetMode && canAccessIntranetModule(userData, 'store') ? undefined : null,
          tabBarIcon: ({ color, focused }) => <ShoppingBag size={20} color={color} strokeWidth={focused ? 2.5 : 2} />,
        }}
      />
      <Tabs.Screen
        name="intranet-analise"
        options={{
          title: 'Análise',
          href: isIntranetMode && canAccessIntranetModule(userData, 'analise') ? undefined : null,
          tabBarIcon: ({ color, focused }) => <BarChart3 size={20} color={color} strokeWidth={focused ? 2.5 : 2} />,
        }}
      />

      {/* Perfil visível em ambos os modos */}
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => (
            <View className={`w-8 h-8 rounded-full overflow-hidden border-2 ${focused ? 'border-[#eab308]' : 'border-transparent'}`}>
              <Image source={displayPhoto} className="w-full h-full object-cover" />
            </View>
          ),
        }}
      />

      {/* Rotas ocultas da tab bar */}
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="user/[id]" options={{ href: null }} />
      <Tabs.Screen name="cursos" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
