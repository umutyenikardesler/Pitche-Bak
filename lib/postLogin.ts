import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import {
  AUTH_REDIRECT_TO_LOGIN_AFTER_VERIFY_KEY,
  PENDING_VERIFICATION_EMAIL_KEY,
} from '@/lib/authVerification';

/**
 * Başarılı girişten sonra ortak adımlar: yerel kullanıcı kaydı, `users`
 * satırının varlığını garanti etme ve gidilecek rotayı belirleme.
 *
 * Hem giriş ekranındaki akış hem de OAuth dönüşünü işleyen callback ekranı
 * kullanıyor. İkisinde ayrı kopyalar olsaydı, ilk kez Google ile giren
 * kullanıcının profil satırı bir yolda oluşup diğerinde oluşmazdı.
 */
export async function completeLoginAndGetRoute(
  userId: string,
  userEmail?: string | null
): Promise<string> {
  await AsyncStorage.setItem('userId', userId);
  // Giriş akışında sözleşme onayı alınıyor; Mesajlar sayfasında tekrar sorulmasın.
  await AsyncStorage.setItem(`ugc_messaging_agreed_${userId}`, '1');
  // "E-posta doğrulandı, şifrenle giriş yap" bayrağı kalıcı yazılıyor ve giriş
  // ekranı onu query parametresi olmadan da okuyor. Başarılı girişten sonra
  // anlamı kalmadığı için temizleniyor; yoksa eski bir denemeden kalan bayrak
  // sonraki açılışlarda o uyarıyı göstermeye devam ediyor.
  await AsyncStorage.multiRemove([
    AUTH_REDIRECT_TO_LOGIN_AFTER_VERIFY_KEY,
    PENDING_VERIFICATION_EMAIL_KEY,
  ]);

  const { data: userInfo, error: userError } = await supabase
    .from('users')
    .select('name, surname, age, height, weight, description')
    .eq('id', userId)
    .single();

  // PGRST116 = satır yok. İlk girişte profil kaydı burada oluşuyor.
  if (userError && (userError as any).code === 'PGRST116') {
    const { error: insertError } = await supabase.from('users').insert([
      {
        id: userId,
        email: userEmail ?? null,
        name: 'Yeni Kullanıcı',
        surname: '',
        age: null,
        height: null,
        weight: null,
        description: '',
        created_at: new Date(),
      },
    ]);
    if (insertError) throw insertError;
    return '/(tabs)/profile?firstLogin=true';
  }

  if (userError) {
    // Okuma hatası: profili tamamlatmaya yönlendir, akışı kesme.
    return '/(tabs)/profile?firstLogin=true';
  }

  const hasMissingFields =
    !userInfo?.name ||
    !userInfo?.surname ||
    !userInfo?.age ||
    !userInfo?.height ||
    !userInfo?.weight ||
    !userInfo?.description;

  // Eksik bilgi varsa profile git ve "Profil Bilgilerimi Düzenle" modalı açılsın
  // (firstLogin=true bayrağını app/(tabs)/profile.tsx okuyor). İlk kez Google ile
  // giren kullanıcının satırı yukarıda 'Yeni Kullanıcı' ile oluşturulduğu için bu
  // dal ona da denk geliyor.
  //
  // Bilgileri tam olan, yani daha önce giriş yapmış kullanıcı ise ANA SAYFAYA
  // gider; her girişte profil sayfasında karşılanmasının bir sebebi yok.
  return hasMissingFields ? '/(tabs)/profile?firstLogin=true' : '/(tabs)';
}
