import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Açık klavyenin yüksekliği (kapalıyken 0).
 *
 * Tam ekran `Modal` içinde `KeyboardAvoidingView` çalışmıyor, `ScrollView`in
 * kendi klavye payı da yalnızca odaklanılan alanı görünür yapıyor: altındaki
 * buton klavyenin arkasında kalıyor. Bu yüzden modalın gövdesi bu yükseklik
 * kadar kısaltılıyor ve içerik bütünüyle klavyenin üstünde kalıyor.
 *
 * iOS'ta `will` olayları kullanılıyor: klavye animasyonuyla aynı karede
 * başlıyor, böylece yerleşim sıçramıyor.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
