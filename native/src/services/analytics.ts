import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { collection, addDoc, doc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from './firebase';

const LAST_ACCESS_LOG_KEY = '@kihap_last_app_access_ts';
const SESSION_THROTTLE_MS = 15 * 60 * 1000; // 15 minutos de intervalo para nova sessão

let inMemoryLastTracked = 0;

function parseEvoMemberLevel(memberLevel: any): { belt: string | null; rankType: string | null; collar: string | null } | null {
  if (!Array.isArray(memberLevel) || memberLevel.length === 0) return null;
  let belt: string | null = null;
  let rankType: string | null = null;
  let collar: string | null = null;

  for (const item of memberLevel) {
    const group = String(item?.levelGroupName || '').trim();
    const level = String(item?.currentLevelName || '').trim();
    if (/colarinho/i.test(group) || /colarinho/i.test(level)) {
      collar = level;
      continue;
    }
    if (group) {
      rankType = group.replace(/^Kihap\s*-\s*/i, '').trim();
    }
    if (level) {
      let cleanBelt = level.replace(/^Faixa\s+/i, '').trim();
      cleanBelt = cleanBelt.replace(/\bdecidida\b/gi, 'Decidida');
      cleanBelt = cleanBelt.replace(/(\d+)\s*[º°]?\s*DAN/i, '$1º Dan');
      belt = cleanBelt;
    }
  }

  if (!belt && !rankType && !collar) return null;
  return { belt, rankType, collar };
}

async function fetchEvoLevelUpdate(user: any, userData?: any): Promise<Record<string, any>> {
  const evoMemberId = userData?.evoMemberId;
  if (!evoMemberId || typeof user?.getIdToken !== 'function') return {};

  try {
    const token = await user.getIdToken();
    const response = await fetch('https://us-central1-intranet-kihap.cloudfunctions.net/getMemberDetails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        data: {
          memberId: Number(evoMemberId),
          unitId: userData?.unitId || userData?.unit || undefined
        }
      })
    });

    if (!response.ok) return {};
    const result = await response.json();
    const member = result?.data;
    if (!member) return {};

    const parsed = parseEvoMemberLevel(member.memberLevel);
    const belt = member.belt || parsed?.belt || null;
    const rankType = member.rankType || parsed?.rankType || null;
    const collar = member.collar || parsed?.collar || null;

    const updates: Record<string, any> = {};
    if (belt) {
      updates.belt = belt;
      updates.graduacao = belt;
    }
    if (rankType) updates.rankType = rankType;
    if (collar) updates.collar = collar;
    if (Array.isArray(member.memberLevel) && member.memberLevel.length > 0) {
      updates.memberLevel = member.memberLevel;
    }
    return updates;
  } catch (err) {
    console.warn('[Analytics] Could not sync EVO memberLevel:', err);
    return {};
  }
}

/**
 * Registra o acesso do usuário ao aplicativo no Firestore
 * Gera log na coleção 'app_access_logs' e atualiza 'users/{uid}'
 */
export async function trackAppAccess(user: any, userData?: any): Promise<void> {
  if (!user || !user.uid) return;

  const now = Date.now();
  if (now - inMemoryLastTracked < SESSION_THROTTLE_MS) {
    return;
  }
  inMemoryLastTracked = now;

  try {
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

    // 2. Atualiza o perfil do usuário para agregações rápidas e sincroniza nível da EVO
    const evoUpdates = await fetchEvoLevelUpdate(user, userData);
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      lastAppAccess: serverTimestamp(),
      lastAppPlatform: platform,
      lastAppVersion: appVersion,
      appAccessCount: increment(1),
      ...evoUpdates
    });

    // Salva o timestamp local da sessão apenas após sucesso
    await AsyncStorage.setItem(LAST_ACCESS_LOG_KEY, String(now));

    console.log('[Analytics] App access tracked successfully for:', user.uid);
  } catch (error) {
    console.warn('[Analytics] Failed to track app access:', error);
  }
}
