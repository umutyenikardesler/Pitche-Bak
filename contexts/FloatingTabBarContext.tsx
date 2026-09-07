import { createContext, useContext } from 'react';

/**
 * Ekranda yüzen hap menü var mı?
 *
 * Eskiden bu bilgi `@react-navigation/bottom-tabs`'ın `BottomTabBarHeightContext`
 * değerinden çıkarılıyordu. Sekmeler kaydırmalı navigatöre (material-top-tabs)
 * taşınınca o context artık sağlanmıyor ve alt boşluk hesabı sessizce sıfıra
 * düşüyordu; menünün altında kalan butonlar/liste sonları bundan kaynaklandı.
 *
 * Bu yüzden bilgi artık kütüphaneden değil, doğrudan sekme düzeninden geliyor.
 */
export const FloatingTabBarContext = createContext(false);

export function useHasFloatingTabBar(): boolean {
  return useContext(FloatingTabBarContext);
}
