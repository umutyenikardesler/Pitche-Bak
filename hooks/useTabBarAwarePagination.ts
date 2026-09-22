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
  /**
   * Değiştiğinde hook tüm durumunu (sayaç, ölçülen liste yüksekliği ve satır
   * yükseklikleri) sıfırlar. Farklı listeler arasında geçişte (ör. sekmeler)
   * verilmelidir; aksi halde önceki listenin ölçümleriyle hesap yapılır.
   * Sıfırlama render sırasında yapılır, böylece yeni listenin ölçümünden önce olur.
   */
  resetKey?: string | number;
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
    resetKey,
  } = options;

  const tabBarInset = useTabBarBottomInset();
  const itemCount = items.length;

  const [visibleCount, setVisibleCount] = useState(Math.max(initialVisible, minVisible));
  const [listHeight, setListHeight] = useState(0);
  const rowHeightsRef = useRef<number[]>([]);
  // Kullanıcı bir kez sayfa yüklediyse otomatik fit hesabı görünen sayıyı geri çekmesin.
  const hasPagedRef = useRef(false);
  // Yeni sayfa yüklendikten sonra liste yeniden ölçülene kadar tekrar yükleme yapma.
  const pendingLoadRef = useRef(false);
  const recomputeScheduledRef = useRef(false);

  // `resetKey` değişince durumu RENDER SIRASINDA sıfırla. Effect ile yapmak sıralama
  // riski taşıyor: yeni liste kendini ölçtükten sonra çalışırsa yüksekliği sıfırlayıp
  // hesabı kalıcı olarak durdurabilir.
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setVisibleCount(Math.max(initialVisible, minVisible));
    setListHeight(0);
    rowHeightsRef.current = [];
    hasPagedRef.current = false;
    pendingLoadRef.current = false;
  }

  const recomputeVisibleFit = useCallback(() => {
    if (hasPagedRef.current || !listHeight) return;

    const usable = listHeight - tabBarInset - listPaddingTop;
    if (usable <= 0) return;

    const heights = rowHeightsRef.current;
    // Ölçülebilen satırlar yalnızca render edilenlerdir; hesabın üst sınırı bu.
    const renderedCount = Math.min(itemCount, visibleCount + 1);

    let used = 0;
    let fit = 0;
    let outOfMeasurements = false;
    for (let i = 0; i < itemCount; i++) {
      const h = heights[i];
      if (h === undefined) {
        outOfMeasurements = true; // bu satır henüz ölçülmedi
        break;
      }
      if (used + h > usable) break; // bu satır hap menü hizasına taşıyor
      used += h + rowGap;
      fit++;
    }

    if (outOfMeasurements) {
      // Render edilen her satır ekrana sığdıysa hesap eksik kalmış demektir:
      // "sığan satır sayısı" değil, "render edilen satır sayısı" bulunmuştur.
      // Büyük ekranlarda (iPad) ilk tahmin ekranı doldurmadığı için liste
      // ekranın ortasında kesiliyordu. Bir tur daha satır render edip
      // ölçtürüyoruz; hesap ekran dolana kadar kendini tekrarlıyor.
      if (fit >= renderedCount && renderedCount < itemCount) {
        setVisibleCount(renderedCount + pageSize);
      }
      // Ölçüm tamamlanmadan sığan satır sayısına karar verilmez.
      return;
    }

    // minVisible, bir bölümün fit hesabıyla ortadan kesilmesini engeller.
    const next = Math.max(fit, minVisible);
    if (next > 0) setVisibleCount(next);
  }, [listHeight, tabBarInset, listPaddingTop, rowGap, minVisible, itemCount, visibleCount, pageSize]);

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

  /**
   * Aşağı çekip yenilemede çağrılır. `listHeight` BİLEREK korunur: liste yeniden
   * monte olmadığı için `onLayout` tekrar tetiklenmez, sıfırlarsak hesap kalıcı
   * olarak durur.
   */
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
