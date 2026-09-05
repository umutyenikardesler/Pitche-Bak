/**
 * Header ölçüleri. Hem CustomHeader hem de açılış animasyonu
 * (LaunchLogoOverlay) logonun konumunu BURADAN türetir; iki taraf ayrı ayrı
 * hesap yaparsa kaçınılmaz olarak birbirinden sapıyor.
 *
 * NEDEN yükseklik açıkça veriliyor: React Navigation'ın varsayılan header
 * yüksekliği (getDefaultHeaderHeight) Dynamic Island'lı iPhone'larda durum
 * çubuğunu `insets.top - (5 + 1/PixelRatio)` olarak sayıyor, ama üstteki
 * boşluğu (headerStatusBarHeight) tam `insets.top` kadar bırakıyor. Sonuçta
 * içerik alanı 44px değil ~38.7px kalıyor ve içindeki her şey birkaç piksel
 * yukarı kayıyor. Yüksekliği `insets.top + HEADER_CONTENT_HEIGHT` olarak
 * sabitleyince içerik alanı her cihazda tam olarak HEADER_CONTENT_HEIGHT olur
 * ve logonun konumu hesaplanabilir hale gelir.
 */

/** Durum çubuğunun altında kalan header içerik alanının yüksekliği. */
export const HEADER_CONTENT_HEIGHT = 44;

/** Header'daki logonun ölçüleri. */
export const HEADER_LOGO_WIDTH = 130;
export const HEADER_LOGO_HEIGHT = 40;

/** headerStyle.height: durum çubuğu + içerik alanı. */
export function headerTotalHeight(safeAreaTop: number): number {
  return safeAreaTop + HEADER_CONTENT_HEIGHT;
}

/** Header'daki logonun ekranın üst kenarına olan uzaklığı. */
export function headerLogoTop(safeAreaTop: number): number {
  return safeAreaTop + (HEADER_CONTENT_HEIGHT - HEADER_LOGO_HEIGHT) / 2;
}

/** Header'daki logonun ekranın sol kenarına olan uzaklığı (tam ortalı). */
export function headerLogoLeft(screenWidth: number): number {
  return screenWidth / 2 - HEADER_LOGO_WIDTH / 2;
}
