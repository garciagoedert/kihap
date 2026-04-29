import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';

export default function PedidosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className="flex-1 bg-white dark:bg-[#050505]">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View 
        style={{ paddingTop: insets.top || 50 }}
        className="bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-white/5"
      >
        <View className="flex-row items-center px-6 pb-4 pt-2">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color={isDark ? '#fff' : '#333'} />
          </TouchableOpacity>
          <Text className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Meus Pedidos</Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <iframe 
          src="https://kihap.com.br/members/pedidos.html" 
          style={{ 
            width: '100%', 
            height: '100%', 
            border: 'none' 
          }} 
          title="Pedidos"
        />
      </View>
    </View>
  );
}
