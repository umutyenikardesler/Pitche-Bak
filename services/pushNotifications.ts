import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Bildirimler ön plandayken nasıl gösterilsin
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Kullanıcıdan bildirim izni ister, Expo Push Token alır
 * ve Supabase'deki push_tokens tablosuna kaydeder.
 * Gerçek bir cihaz gerektirir (simulator'da Expo Push Token alınamaz).
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    // Simulator / emulator üzerinde push token alınamaz
    return null;
  }

  // Mevcut izin durumunu kontrol et
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // Android için bildirim kanalı oluştur
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Bildirimler',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#16a34a',
    });
  }

  // Expo Push Token al (projectId EAS project ID'si)
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'bcaeff72-7e2a-4511-8ad1-73798a478d1a',
  });
  const token = tokenData.data;

  // Token'ı Supabase'e kaydet (varsa güncelle, yoksa ekle)
  await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
      { onConflict: 'user_id,token' }
    );

  return token;
}

/**
 * Kullanıcı çıkış yaptığında token'ı sil.
 */
export async function unregisterPushToken(userId: string): Promise<void> {
  if (!Device.isDevice) return;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'bcaeff72-7e2a-4511-8ad1-73798a478d1a',
    });
    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', tokenData.data);
  } catch {
    // Token alınamazsa sessizce geç
  }
}
