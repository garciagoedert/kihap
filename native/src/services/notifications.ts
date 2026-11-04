import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// Comportamento quando o app está aberto em primeiro plano (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Configura o canal de notificação para Android
 */
export async function setupAndroidNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Kihap Geral',
      description: 'Notificações de treinos, avisos e comunicados da Kihap',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#eab308',
      enableVibrate: true,
      showBadge: true,
    });
  }
}

/**
 * Solicita permissões e registra o token de notificação Push
 */
export async function registerForPushNotificationsAsync(userId?: string): Promise<string | null> {
  let token: string | null = null;

  await setupAndroidNotificationChannel();

  if (!Device.isDevice) {
    console.log('[Push] Notificações push só funcionam em dispositivos físicos.');
    return null;
  }

  // Verifica permissão existente
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Se não concedida, solicita ao usuário
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permissão de notificação negada pelo usuário.');
    return null;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    const expoTokenObj = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    token = expoTokenObj.data;
    console.log('[Push] Expo Push Token obtido:', token);

    let devicePushToken: string | null = null;
    try {
      const deviceTokenObj = await Notifications.getDevicePushTokenAsync();
      devicePushToken = deviceTokenObj.data;
      console.log('[Push] Native Device Push Token (FCM/APNs):', devicePushToken);
    } catch (e) {
      console.warn('[Push] Erro ao obter token nativo FCM:', e);
    }

    // Salva o token no Firestore para o usuário autenticado
    if (userId && token) {
      await savePushTokenToFirestore(userId, token, devicePushToken);
    }
  } catch (error) {
    console.error('[Push] Erro ao obter Push Token:', error);
  }

  return token;
}

/**
 * Salva o token de push no documento do usuário no Firestore
 */
export async function savePushTokenToFirestore(
  userId: string,
  expoPushToken: string,
  deviceToken: string | null = null
) {
  try {
    const userRef = doc(db, 'users', userId);
    const updates: Record<string, any> = {
      pushTokens: arrayUnion(expoPushToken),
      lastPushTokenUpdate: serverTimestamp(),
      platform: Platform.OS,
    };

    if (deviceToken) {
      updates.fcmTokens = arrayUnion(deviceToken);
    }

    await updateDoc(userRef, updates);
    console.log(`[Push] Token registrado com sucesso para o usuário ${userId}`);
  } catch (error) {
    console.warn(`[Push] Erro ao salvar token no Firestore:`, error);
  }
}

