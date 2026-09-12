/**
 * Auth deep link'lerinin KÖK dinleyici (bkz. app/_layout.tsx) tarafından
 * işlenmesini geçici olarak durdurur.
 *
 * İki ayrı ihtiyaç için kullanılıyor:
 *  1. Bazı tarayıcılar aynı deep link'i iki kez tetikliyor; ikincisi yok sayılsın.
 *  2. OAuth akışını BAŞLATAN ekran dönüşü kendisi işleyecekse, kök dinleyici
 *     araya girmemeli. Aksi halde tek kullanımlık PKCE kodunu iki taraf birden
 *     tüketmeye çalışıyor ve kaybeden taraf oturumsuz kalıyor ("Auth session
 *     missing!"). Bu yarış özellikle Android'de görülüyor.
 */
let lockUntilMs = 0;

export function lockAuthCallbackFor(ms: number) {
  lockUntilMs = Math.max(lockUntilMs, Date.now() + ms);
}

export function isAuthCallbackLocked() {
  return Date.now() < lockUntilMs;
}

/**
 * Kilidi hemen bırakır.
 *
 * Süreyle kilitlemek OAuth için yeterli değil: akış kullanıcının ne kadar
 * süreceğine bağlı. Uzun bir süre vermek de sonrasındaki meşru deep link'leri
 * (ör. e-postadan gelen şifre sıfırlama) yutardı. Bu yüzden başlatan ekran
 * işini bitirince kilidi açıkça bırakıyor.
 */
export function releaseAuthCallbackLock() {
  lockUntilMs = 0;
}
