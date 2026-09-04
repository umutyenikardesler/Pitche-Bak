import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useTabBarBottomInset } from '@/hooks/useTabBarBottomInset';

type Options = {
  /** Ölçüm tamamlanana kadar kullanılan ilk tahmin. */
  initialVisible?: number;
  /** Her kaydırmada eklenecek satır sayısı. */
  pageSize?: number;
  /** Satırlara verilen ek dikey aralık (fit hesabında kullanılır). */
  rowGap?: number;
  /** Listenin üst dolgusu (fit hesabında kullanılır). */
  listPaddingTop?: number;
  /**
   * Ekrana sığmasa bile en az bu kadar satır tam gösterilir. Bir bölümün (ör. yapılacak
   * maçlar) fit hesabıyla kesilmemesi gerektiğinde kullanılır; soluk sınır böylece bir
   * sonraki bölümün başına düşer.
   */
  minVisible?: number;
};

/** Listenin sonuna bu kadar yaklaşınca bir sonraki sayfa yüklenir. */
const LOAD_MORE_THRESHOLD = 120;

/**
 * Yüzen hap tab bar ile uyumlu kademeli liste yüklemesi.
 *
 * Hap menünün üstünde TAM sığan satır sayısını ölçerek bulur; taşan ilk satır
 * "sınır" kabul edilip soluk (pasif) gösterilir. Kullanıcı listeyi aşağı çektikçe
 * her seferinde `pageSize` kadar satır eklenir.
 *
 * Satır yükseklikleri sabit varsayılmaz: kart türleri farklı yükseklikte olabildiği
 * için her satır ölçülüp kümülatif toplanır.
 */
export function useTabBarAwarePagination<T>(items: T[], options: Options = {}) {
  const {
    initialVisible = 7,
    pageSize = 5,
    rowGap = 0,
    listPaddingTop = 0,
    minVisible = 0,
  } = options;

  const tabBarInset = useTabBarBottomInset();

  const [visibleCount, setVisibleCount] = useState(Math.max(initialVisible, minVisible));
  const [listHeight, setListHeight] = useState(0);
  const rowHeightsRef = useRef<number[]>([]);
  // Kullanıcı bir kez sayfa yüklediyse otomatik fit hesabı görünen sayıyı geri çekmesin.
  const hasPagedRef = useRef(false);
  // Yeni sayfa yüklendikten sonra liste yeniden ölçülene kadar tekrar yükleme yapma.
  const pendingLoadRef = useRef(false);
  const recomputeScheduledRef = useRef(false);

  const recomputeVisibleFit = useCallback(() => {
    if (hasPagedRef.current || !listHeight) return;

    const usable = listHeight - tabBarInset - listPaddingTop;
    if (usable <= 0) return;

    const heights = rowHeightsRef.current;
    let used = 0;
    let fit = 0;
    for (let i = 0; i < heights.length; i++) {
      const h = heights[i];
      if (h === undefined) break; // bu satır henüz ölçülmedi
      if (used + h > usable) break; // bu satır hap menü hizasına taşıyor
      used += h + rowGap;
      fit++;
    }

    // minVisible, bir bölümün fit hesabıyla ortadan kesilmesini engeller.
    const next = Math.max(fit, minVisible);
    if (next > 0) setVisibleCount(next);
  }, [listHeight, tabBarInset, listPaddingTop, rowGap, minVisible]);

  useEffect(() => {
    recomputeVisibleFit();
  }, [recomputeVisibleFit]);

  const handleRowLayout = useCallback(
    (index: number, height: number) => {
      const prev = rowHeightsRef.current[index];
      if (prev !== undefined && Math.abs(prev - height) < 0.5) return;
      rowHeightsRef.current[index] = height;

      // Aynı karede gelen çok sayıda onLayout için tek hesap yeterli.
      if (recomputeScheduledRef.current) return;
      recomputeScheduledRef.current = true;
      requestAnimationFrame(() => {
        recomputeScheduledRef.current = false;
        recomputeVisibleFit();
      });
    },
    [recomputeVisibleFit]
  );

  const handleListLayout = useCallback((e: LayoutChangeEvent) => {
    setListHeight(e.nativeEvent.layout.height);
  }, []);

  // onEndReached her içerik uzunluğu için yalnızca bir kez tetiklendiğinden güvenilmez
  // (açılışta bir kez tetiklenip bir daha çalışmıyor). Kaydırma konumunu ölçüyoruz.
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pendingLoadRef.current) return;
      if (visibleCount >= items.length) return;
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (distanceFromBottom > LOAD_MORE_THRESHOLD) return;
      pendingLoadRef.current = true;
      hasPagedRef.current = true;
      setVisibleCount((prev) => prev + pageSize);
    },
    [items.length, visibleCount, pageSize]
  );

  const handleContentSizeChange = useCallback(() => {
    pendingLoadRef.current = false;
  }, []);

  /** Aşağı çekip yenilemede çağrılır: sayaç ve ölçümler sıfırlanır. */
  const reset = useCallback(() => {
    setVisibleCount(Math.max(initialVisible, minVisible));
    pendingLoadRef.current = false;
    hasPagedRef.current = false;
    rowHeightsRef.current = [];
  }, [initialVisible, minVisible]);

  // Sınırdaki satır soluk görünsün diye görünen sayının 1 fazlasını render ediyoruz.
  const visibleItems = useMemo(
    () => items.slice(0, visibleCount + 1),
    [items, visibleCount]
  );

  const isFaded = useCallback((index: number) => index >= visibleCount, [visibleCount]);

  /** Doğrudan FlatList'e yayılabilir. */
  const listProps = {
    onLayout: handleListLayout,
    onScroll: handleScroll,
    scrollEventThrottle: 16,
    onContentSizeChange: handleContentSizeChange,
  };

  return { visibleItems, visibleCount, isFaded, reset, handleRowLayout, listProps };
}
