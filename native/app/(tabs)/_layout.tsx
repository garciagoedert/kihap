import { Tabs } from 'expo-router';
import React from 'react';
import { Home, Send, Heart, Search } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { View, Image } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { userData } = useAuth();

  const activeColor = '#eab308'; // Amarelo Kihap Ativo

  // Normalize photo URL for bottom menu
  let rawPhoto = userData?.photoURL || userData?.profilePicture || userData?.photoUrl || userData?.avatar;
  if (rawPhoto && rawPhoto.startsWith('/')) {
    rawPhoto = `https://kihap.com.br${rawPhoto}`;
  }
  const displayPhoto = rawPhoto || 'https://kihap.com.br/intranet/default-profile.svg';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: isDark ? '#666' : '#999',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#0a0a0a' : '#fff',
          borderTopColor: isDark ? '#222' : '#eee',
          height: 60,
          paddingBottom: 10,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          display: 'none',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, focused }) => <Home size={22} color={color} strokeWidth={focused ? 2.5 : 2} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => <Send size={22} color={color} strokeWidth={focused ? 2.5 : 2} />,
        }}
      />
      <Tabs.Screen
        name="notificacoes"
        options={{
          title: 'Notificações',
          tabBarIcon: ({ color, focused }) => <Heart size={22} color={color} strokeWidth={focused ? 2.5 : 2} />,
        }}
      />
      <Tabs.Screen
        name="busca"
        options={{
          title: 'Busca',
          tabBarIcon: ({ color, focused }) => <Search size={22} color={color} strokeWidth={focused ? 2.5 : 2} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => (
            <View className={`w-8 h-8 rounded-full overflow-hidden border-2 ${focused ? 'border-[#eab308]' : 'border-transparent'}`}>
              <Image 
                source={{ uri: displayPhoto }} 
                className="w-full h-full object-cover"
              />
            </View>
          ),
        }}
      />
      {/* Hide specific routes from tab bar but keep in layout */}
      <Tabs.Screen name="user/[id]" options={{ href: null }} />
      <Tabs.Screen name="cursos" options={{ href: null }} />
      <Tabs.Screen name="store" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
