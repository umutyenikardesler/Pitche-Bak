import React from 'react';
import { View, TouchableOpacity, Text, Image, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useNotification } from './NotificationContext';
import { useRouter, usePathname } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { width: windowWidth } = useWindowDimensions();
  
  const handleNotificationsPress = () => {
    // Eğer zaten notifications sayfasındaysak, hiçbir şey yapma
    if (pathname === '/(tabs)/notifications' || pathname === '/notifications') {
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
                      style={{ fontSize: 18, fontWeight: '800', color: '#15803d' }}
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
                <Ionicons name="heart-outline" size={24} color="green" />
                {badgeCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      backgroundColor: 'red',
                      borderRadius: 10,
                      minWidth: 18,
                      height: 18,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 4,
                      zIndex: 1,
                    }}
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
        // Native: mevcut davranışı koru (logo ortada)
        <View className="flex-row justify-between items-center w-full -mx-0">
          {/* Sol: Başlık */}
          <TouchableOpacity onPress={handleTitlePress} activeOpacity={0.7}>
            <Text className="text-lg font-bold text-green-700">{title}</Text>
          </TouchableOpacity>

          {/* Orta: Logo (mutlak konumda ortalanmış) */}
          <View
            className="ml-1 mb-1"
            style={{
              position: 'absolute',
              left: windowWidth / 2 - 85, // yarı genişlik - yarı logo genişliği
            }}
          >
            <Image
              source={require("@/assets/images/logo.png")}
              style={{ width: 130, height: 40, resizeMode: 'contain' }}
            />
          </View>

          {/* Sağ: Bildirim ikonu */}
          <View style={{ alignItems: 'flex-end' }}>
            {showNotificationIcon && (
              <TouchableOpacity
                onPress={handleNotificationsPress}
                style={{ position: 'relative' }}
                activeOpacity={isOnNotificationsPage ? 1 : 0.7}
                disabled={isOnNotificationsPage}
                accessibilityLabel={t('general.notifications')}
                accessibilityHint={t('general.notificationCount')}
              >
                <Ionicons name="heart-outline" size={24} color="green" />
                {badgeCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      backgroundColor: 'red',
                      borderRadius: 10,
                      minWidth: 18,
                      height: 18,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 4,
                      zIndex: 1,
                    }}
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
