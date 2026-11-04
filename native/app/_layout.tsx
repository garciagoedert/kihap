import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import '../global.css';

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '../src/services/notifications';

import { SafeAreaProvider } from 'react-native-safe-area-context';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Registra Push Notifications quando o usuário estiver autenticado
  useEffect(() => {
    if (user?.uid) {
      registerForPushNotificationsAsync(user.uid);
    }
  }, [user?.uid]);

  // Listener para quando o usuário toca na notificação recebida
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.url) {
        try {
          router.push(data.url as any);
        } catch (e) {
          router.push('/(tabs)/notificacoes');
        }
      } else {
        router.push('/(tabs)/notificacoes');
      }
    });

    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated and not in auth group
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Redirect to home if authenticated and in auth group
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  return (
    <Stack initialRouteName="(tabs)" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="emblema/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="store/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="calendario" options={{ headerShown: false }} />
      <Stack.Screen name="cart" options={{ headerShown: false }} />
      <Stack.Screen name="checkout" options={{ headerShown: false }} />
      <Stack.Screen name="pedidos" options={{ headerShown: false }} />
      <Stack.Screen name="atividades" options={{ headerShown: false }} />
      <Stack.Screen name="littles" options={{ headerShown: false }} />
      <Stack.Screen name="player" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}

import { CartProvider } from '../src/context/CartContext';
import { useFonts } from 'expo-font';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded, fontError] = useFonts({
    'NeueMachina-Regular': require('../assets/fonts/NeueMachina-Regular.otf'),
    'NeueMachina-Ultrabold': require('../assets/fonts/NeueMachina-Ultrabold.otf'),
    'NeueMachina-Ultrabold_bold': require('../assets/fonts/NeueMachina-Ultrabold_bold.otf'),
    'NeueMachina-Regular_bold': require('../assets/fonts/NeueMachina-Regular_bold.otf'),
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <RootLayoutNav />
            <StatusBar style="auto" />
          </ThemeProvider>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
