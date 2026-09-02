/**
 * iOS'ta tab bar, ekranın altından ayrık duran yuvarlak kenarlı ("hap") yüzen bir
 * çubuk olarak çizilir. Ölçüler hem `app/(tabs)/_layout.tsx` (bar'ın kendisi) hem de
 * `hooks/useTabBarBottomInset.ts` (listelerin alt boşluğu) tarafından kullanıldığından
 * tek kaynakta tutuluyor.
 */

/** Yüzen bar'ın yüksekliği (ikon + etiket). */
export const FLOATING_TAB_BAR_HEIGHT = 60;

/**
 * Bar'ın sol/sağ kenarlardan boşluğu.
 * Index'teki maç kartları `mx-4` (16px) kullanıyor; bar 1px daha geniş duruyor.
 */
export const FLOATING_TAB_BAR_SIDE_MARGIN = 14;

/**
 * Köşe yarıçapı. Tam hap (yükseklik / 2 = 30) yerine bir tık daha az oval bırakıldı.
 */
export const FLOATING_TAB_BAR_RADIUS = 24;

/**
 * Bar'ın ekranın altına olan mesafesi. Home indicator'lı cihazlarda safe-area'ya
 * göre biraz yukarıda, indicator'sız cihazlarda sabit bir boşlukla durur.
 */
export function floatingTabBarBottomOffset(safeAreaBottom: number): number {
  return Math.max(safeAreaBottom - 8, 10);
}
