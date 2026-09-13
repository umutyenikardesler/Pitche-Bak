import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { isUserBlockedByMe } from '@/services/blocks';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Engellenen kişiye mesaj gönderilmesini engelleyen ortak kontrol.
 *
 * Engelleme tek yönlü ve YEREL bir filtre: engellenen kişinin mesajları hem
 * mesajlar listesinde (app/(tabs)/message.tsx) hem de sohbet ekranında
 * (app/message/chat.tsx) eleniyor. Bu yüzden engellediğin birine mesaj
 * yazabilmek sessiz bir çıkmaz üretiyordu — mesaj gidiyor, gelen cevap ise
 * hiç görünmüyordu. Kontrol, sohbeti BAŞLATAN her noktada çağrılmalı.
 *
 * Uyarı, engeli kaldırabileceği listeye yönlendiren bir buton da içeriyor;
 * aksi halde kullanıcının engeli kaldırmak için gideceği yer belli olmuyor.
 *
 * @returns Engelliyse `true` (ve uyarıyı gösterir); değilse `false`.
 */
export function useBlockedUserGuard() {
  const { t } = useLanguage();
  const router = useRouter();

  return useCallback(
    async (otherUserId: string | null | undefined): Promise<boolean> => {
      if (!otherUserId) return false;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const blocked = await isUserBlockedByMe(user.id, otherUserId);
      if (!blocked) return false;

      Alert.alert(t('blocked.guardTitle'), t('blocked.guardMessage'), [
        { text: t('general.cancel'), style: 'cancel' },
        { text: t('blocked.goToList'), onPress: () => router.push('/blocked-users' as any) },
      ]);
      return true;
    },
    [t, router]
  );
}
