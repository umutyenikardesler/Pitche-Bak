import React from 'react';
import { View, TouchableOpacity, Text, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useNotification } from './NotificationContext';
import { useRouter, usePathname } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestAuthAlert } from '@/contexts/GuestAuthModalContext';
import {
  HEADER_CONTENT_HEIGHT,
  HEADER_LOGO_HEIGHT,
  HEADER_LOGO_WIDTH,
} from '@/constants/header';

/**
 * Başlığın soldan, bildirim ikonunun sağdan iç boşluğu. Maç kartlarındaki
 * `mx-4` (16px) ile aynı olsun diye bu değer kullanılıyor; header içeriği
 * kartlarla aynı hizada duruyor.
 */
const SIDE_PADDING = 16;

// Add type for props
interface CustomHeaderProps {
  title: string;
  showNotificationIcon?: boolean;
  onTitlePress?: () => void;
}

const CustomHeader = ({ title, showNotificationIcon = true, onTitlePress }: CustomHeaderProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { badgeCount } = useNotification();
  const { t } = useLanguage();
  const { colors, isDark } = useAppTheme();
  const { isGuest } = useAuth();
  const { showGuestAuthAlert } = useGuestAuthAlert();
  const handleNotificationsPress = () => {
    // Eğer zaten notifications sayfasındaysak, hiçbir şey yapma
    if (pathname === '/(tabs)/notifications' || pathname === '/notifications') {
      return;
    }
    // Misafir kullanıcıyı bildirimlere HİÇ göndermiyoruz; sekmelerdeki tabPress
    // korumasının aynısı. Aksi halde rota geçmişe giriyor, giriş ekranından geri
    // dönüldüğünde koruma yeniden tetiklenip giriş ekranı tekrar açılıyordu.
    if (isGuest) {
      showGuestAuthAlert(t('auth.guestNotifications'));
      return;
    }
    router.push('/notifications');
  };
  
  // Bildirimler sayfasındayken opacity değişmesin
  const isOnNotificationsPage = pathname === '/(tabs)/notifications' || pathname === '/notifications';

  const handleTitlePress = () => {
    console.log('CustomHeader başlığına tıklandı:', title);
    console.log('Mevcut pathname:', pathname);
    
    // Eğer özel onTitlePress fonksiyonu varsa onu kullan
    if (onTitlePress) {
      onTitlePress();
    } else {
      // Varsayılan davranış: Mevcut sayfayı yeniden yükle (sayfanın başına döner)
      router.replace(pathname as any);
    }
  };

  const badgeStyle = {
    position: 'absolute' as const,
    top: -6,
    right: -6,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 4,
    zIndex: 1,
    borderWidth: 1,
    borderColor: colors.surface,
  };

  return (
    <View style={{ width: '100%' }}>
      {Platform.OS === 'web' ? (
        // Web: Sol/sağ kolon genişliği eşit olmalı ki logo optik olarak tam ortada dursun.
        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
          {(() => {
            const SIDE_WIDTH = 160; // sol ve sağ aynı olmalı
            return (
              <>
                {/* Sol */}
                <View style={{ width: SIDE_WIDTH, justifyContent: 'center', paddingLeft: 5 }}>
                  <TouchableOpacity onPress={handleTitlePress} activeOpacity={0.7}>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 18, fontWeight: '800', color: colors.primaryDark }}
                    >
                      {title}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Orta */}
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Image
                    source={require("@/assets/images/logo.png")}
                    style={{ width: 130, height: 40, resizeMode: 'contain' }}
                  />
                </View>

                {/* Sağ */}
                <View style={{ width: SIDE_WIDTH, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 5 }}>
            {showNotificationIcon ? (
              <TouchableOpacity
                onPress={handleNotificationsPress}
                style={{ position: 'relative' }}
                activeOpacity={isOnNotificationsPage ? 1 : 0.7}
                disabled={isOnNotificationsPage}
                accessibilityLabel={t('general.notifications')}
                accessibilityHint={t('general.notificationCount')}
              >
                <Ionicons name="heart-outline" size={24} color={colors.primary} />
                {badgeCount > 0 && (
                  <View
                    style={badgeStyle}
                  >
                    <Text
                      style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}
                      accessibilityLabel={`${t('general.notificationCount')}: ${badgeCount}`}
                    >
                      {badgeCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : null}
                </View>
              </>
            );
          })()}
        </View>
      ) : (
        // Native: başlık (sol) - logo (orta) - bildirim (sağ).
        // Mutlak konumlandırma yerine gerçek kolonlar kullanılıyor.
        // Orta kolon logo genişliğinde SABİT, yan kolonlar EŞİT esniyor; bu
        // simetri logonun ekranda matematiksel olarak tam ortada durmasını
        // garanti ediyor. (Sabit %25 verilseydi "Bildirimler" / "Maç Oluştur"
        // gibi başlıklar kolona sığmayıp kırpılıyordu.)
        // Kapsayıcının tam genişlik alması için bkz. app/(tabs)/_layout.tsx
        // içindeki headerTitleContainerStyle.
        <View className="flex-row items-center w-full">
          {/* Sol: Başlık — sola dayalı, kartlarla aynı hizada */}
          {/* minWidth: 0 -> uzun başlık kolonu genişletmesin, kendi içinde kırpılsın
              (Yoga'da flex item varsayılan olarak içeriğinin altına inmez). */}
          <View
            style={{
              flex: 1,
              minWidth: 0,
              alignItems: 'flex-start',
              justifyContent: 'center',
              paddingLeft: SIDE_PADDING,
            }}
          >
            <TouchableOpacity onPress={handleTitlePress} activeOpacity={0.7}>
              {/* Yazı tipi index'teki başlıklarla aynı: KONDİSYONUN ile aynı
                  `font-bold` sınıfı (bkz. components/index/IndexCondition.tsx). */}
              <Text
                className="font-bold"
                numberOfLines={1}
                style={{ fontSize: 16, color: colors.primaryDark }}
              >
                {title}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Orta: Logo — tam ortalı.
              Kolon yüksekliği header içerik yüksekliğine eşit ve logo bunun
              içinde ortalı; böylece logonun dikey konumu hesaplanabilir oluyor
              ve açılış animasyonu aynı formülü kullanabiliyor
              (bkz. constants/header.ts). Eskiden `mb-1` ile ortalama
              kaydırılıyordu, o yüzden konum tahmin edilemiyordu. */}
          <View
            style={{
              width: HEADER_LOGO_WIDTH,
              height: HEADER_CONTENT_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image
              source={require("@/assets/images/logo.png")}
              style={{ width: HEADER_LOGO_WIDTH, height: HEADER_LOGO_HEIGHT, resizeMode: 'contain' }}
            />
          </View>

          {/* Sağ: Bildirim ikonu — sağa dayalı, kartlarla aynı hizada */}
          <View
            style={{
              flex: 1,
              minWidth: 0,
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingRight: SIDE_PADDING,
            }}
          >
            {showNotificationIcon && (
              <TouchableOpacity
                onPress={handleNotificationsPress}
                style={{ position: 'relative' }}
                activeOpacity={isOnNotificationsPage ? 1 : 0.7}
                disabled={isOnNotificationsPage}
                accessibilityLabel={t('general.notifications')}
                accessibilityHint={t('general.notificationCount')}
              >
                <Ionicons name="heart-outline" size={24} color={colors.primary} />
                {badgeCount > 0 && (
                  <View
                    style={badgeStyle}
                  >
                    <Text
                      style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}
                      accessibilityLabel={`${t('general.notificationCount')}: ${badgeCount}`}
                    >
                      {badgeCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

export default CustomHeader;
