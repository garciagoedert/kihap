import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { collection, addDoc, doc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from './firebase';

const LAST_ACCESS_LOG_KEY = '@kihap_last_app_access_ts';
const SESSION_THROTTLE_MS = 15 * 60 * 1000; // 15 minutos de intervalo para nova sessão

/**
 * Registra o acesso do usuário ao aplicativo no Firestore
 * Gera log na coleção 'app_access_logs' e atualiza 'users/{uid}'
 */
export async function trackAppAccess(user: any, userData?: any): Promise<void> {
  if (!user || !user.uid) return;

  try {
    const now = Date.now();
    const lastAccessStr = await AsyncStorage.getItem(LAST_ACCESS_LOG_KEY);
    const lastAccessTs = lastAccessStr ? parseInt(lastAccessStr, 10) : 0;

    // Se já foi registrado nos últimos 15 minutos, não inflar contadores
    if (now - lastAccessTs < SESSION_THROTTLE_MS) {
      return;
    }

    const todayDateStr = new Date().toISOString().split('T')[0];
    const appVersion = Constants.expoConfig?.version || '4.2';
    const platform = Platform.OS; // 'ios' | 'android'

    const userName = userData?.name || user.displayName || 'Aluno Kihap';
    const userEmail = user.email || userData?.email || '';
    const unitId = userData?.unitId || 'geral';

    // 1. Grava o log detalhado de acesso
    await addDoc(collection(db, 'app_access_logs'), {
      userId: user.uid,
      userName,
      userEmail,
      unitId,
      platform,
      appVersion,
      dateStr: todayDateStr,
      timestamp: serverTimestamp(),
      type: 'session_start'
    });

    // 2. Atualiza o perfil do usuário para agregações rápidas
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      lastAppAccess: serverTimestamp(),
      lastAppPlatform: platform,
      lastAppVersion: appVersion,
      appAccessCount: increment(1)
    });

    // Salva o timestamp local da sessão apenas após sucesso
    await AsyncStorage.setItem(LAST_ACCESS_LOG_KEY, String(now));

    console.log('[Analytics] App access tracked successfully for:', user.uid);
  } catch (error) {
    console.warn('[Analytics] Failed to track app access:', error);
  }
}
