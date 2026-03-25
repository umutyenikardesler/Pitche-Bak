/** Kayıt sonrası e-posta doğrulama beklenirken saklanır; deep link başarısız olunca girişte doldurulur */
export const PENDING_VERIFICATION_EMAIL_KEY = "@sahayabak/pending_verification_email";

/**
 * URL ?afterVerify= güvenilir olmayabilir (Expo Router). Giriş ekranı bu bayrağı okur.
 */
export const AUTH_REDIRECT_TO_LOGIN_AFTER_VERIFY_KEY = "@sahayabak/redirect_login_after_verify";
