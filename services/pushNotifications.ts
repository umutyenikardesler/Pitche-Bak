import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/** Kullanıcının "telefona bildirim gelsin mi" tercihi (Ayarlar > Bildirimler). */
const PUSH_ENABLED_KEY = 'pushNotificationsEnabled';

const EAS_PROJECT_ID =
  Constants.expoConfig?.extra?.eas?.projectId ??
  Constants.easConfig?.projectId ??
  'bcaeff72-7e2a-4511-8ad1-73798a478d1a';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Bildirim tercihi. Varsayılan AÇIK: daha önce hiç ayar yapılmamış kullanıcılar
 * mevcut davranışı görmeye devam etsin.
 */
export async function getPushEnabled(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(PUSH_ENABLED_KEY);
    return stored === null ? true : stored === '1';
  } catch {
    return true;
  }
}

/**
 * Tercihi kaydeder ve token'ı buna göre ekler/siler.
 * Kapatıldığında token silindiği için sunucu bu cihaza push göndermez.
 */
export async function setPushEnabled(enabled: boolean, userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PUSH_ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    // Kalıcı yazma başarısız olsa bile aşağıdaki işlem yapılsın.
  }

  if (enabled) {
    await registerPushToken(userId);
  } else {
    await unregisterPushToken(userId);
  }
}

export async function registerPushToken(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  // ÖNEMLİ: Uygulama açılışta ve her öne gelişte bu fonksiyonu çağırıyor
  // (bkz. app/_layout.tsx). Tercih kontrol edilmezse kullanıcının kapattığı
  // bildirimler bir sonraki açılışta sessizce geri açılırdı.
  if (!(await getPushEnabled())) {
    return null;
  }

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Bildirimler',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#16a34a',
        sound: 'default',
      });
    }

    let token: string;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: EAS_PROJECT_ID,
      });
      token = tokenData.data;
    } catch (tokenError) {
      // Android dev build'lerde FCM yapılandırması eksik olabilir; uygulama akışını kesme.
      console.warn('[Push] Token alınamadı (FCM/APNs yapılandırması kontrol edin):', tokenError);
      return null;
    }

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
        },
        { onConflict: 'user_id,token' },
      );

    if (error) {
      console.warn('[Push] Token kaydedilemedi:', error.message);
      return null;
    }

    return token;
  } catch (err) {
    console.warn('[Push] Kayıt atlandı:', err);
    return null;
  }
}

export async function unregisterPushToken(userId: string): Promise<void> {
  if (!Device.isDevice) return;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: EAS_PROJECT_ID,
    });
    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', tokenData.data);
  } catch {
    // Sessizce geç
  }
}
