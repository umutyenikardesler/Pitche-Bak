import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Dil türleri
export type Language = 'tr' | 'en';

// Dil context interface'i
interface LanguageContextType {
  currentLanguage: Language;
  changeLanguage: (language: Language) => Promise<void>;
  t: (key: string) => string; // Çeviri fonksiyonu
}

// Dil context'i oluştur
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Çeviri anahtarları
const translations = {
  tr: {
    // Ana Sayfa
    'home.title': 'Ana Sayfa',
    'home.findMatch': 'Maç Bul',
    'home.createMatch': 'Maç Oluştur',
    'home.myMatches': 'Maçlarım',
    'home.otherMatches': 'Diğer Maçlar',
    'home.noMatchesFound': 'Maç bulunamadı',
    'home.loading': 'Yükleniyor...',
    'home.refresh': 'Yenile',
    'home.matchDetails': 'Maç Detayları',
    'home.matchTitle': 'Maç Başlığı',
    'home.matchDate': 'Tarih',
    'home.matchTime': 'Saat',
    'home.matchLocation': 'Konum',
    'home.matchPrice': 'Fiyat',
    'home.matchPlayers': 'Oyuncular',
    'home.joinMatch': 'Maça Katıl',
    'home.leaveMatch': 'Maçtan Ayrıl',
    'home.matchFull': 'Maç Dolu',
    'home.matchCancelled': 'Maç İptal',
    'home.condition': 'KONDİSYONUN',
    'home.conditionNeed3Matches': 'Kondisyon kazanman için en az 3 maç yapman lazım!',
    'home.conditionNextMatch80': 'Eğer 1 maç daha yaparsan kondisyonun 80\'e yükselecek',
    'home.conditionNextMatch90': 'Eğer 1 maç daha yaparsan kondisyonun 90\'a yükselecek',
    'home.conditionFirst5Complete': 'İlk 5 maçını tamamladın. Spor yapmaya devam ☺️',
    'home.conditionAchieved': 'Gerekli kondisyonu kazandın. Sağlıklı günler 👏',
    'home.matchSummary': 'MAÇ ÖZETİ',
    'home.missingSquads': 'Eksik Kadrolar',
    'home.matchCreatedBy': 'Maçı oluşturan:',
    'home.pitchSummary': 'HALI SAHA ÖZETİ',
    'home.openAddress': 'Açık Adres',
    'home.pitchPrice': 'Saha Ücreti',
    'home.pitchFeatures': 'Sahanın Özellikleri',
    'home.matchPlaying': 'Maç oynanıyor',
    'home.waitingMatches': 'SENİ BEKLEYEN MAÇLAR',
    'home.noMatchesCreated': 'Oluşturduğun Maç Yok!',
    'home.createMatchNow': 'Hemen Maç Oluştur',
    'home.matchesLoading': 'Maç Listesi Yükleniyor..',
    'home.incompleteSquadMatches': 'KADROSU EKSİK MAÇLAR',
    'home.noIncompleteSquadMatches': 'Başkaları Tarafından Oluşturulan Kadrosu Eksik Maç Yok!',
    
    // Profil
    'profile.title': 'Profil',
    'profile.settings': 'Ayarlar',
    'profile.logout': 'Çıkış Yap',
    'profile.editProfile': 'Kişisel Bilgilerini Tamamla',
    'profile.name': 'Adınız',
    'profile.surname': 'Soyadınız',
    'profile.age': 'Yaş',
    'profile.height': 'Boy',
    'profile.weight': 'Kilo',
    'profile.description': 'Mevki / Biyografi',
    'profile.save': 'Kaydet',
    'profile.cancel': 'İptal Et',
    'profile.followers': 'Takipçi',
    'profile.following': 'Takip',
    'profile.follow': 'Takip Et',
    'profile.followingYou': 'Seni takip ediyor',
    'profile.youFollowing': 'Takip ediyorsun',
    'profile.profileImage': 'Profil Fotoğrafı',
    'profile.changePhoto': 'Fotoğraf Değiştir',
    'profile.personalInfo': 'Kişisel Bilgiler',
    'profile.profileUpdated': 'Profil güncellendi',
    'profile.updateError': 'Profil güncellenirken hata oluştu',
    'profile.logoutError': 'Çıkış yapılamadı',
    'profile.logoutErrorMsg': 'Bir hata oluştu',
    'profile.noFollowersYet': 'Henüz takipçi yok',
    'profile.followRequestSent': 'Takip isteğin gönderildi',
    'profile.userSessionNotFound': 'Kullanıcı oturumu bulunamadı',
    'profile.ownUserDataNotFound': 'Kendi kullanıcı bilgilerin alınamadı',
    'profile.unfollowed': 'Takipten çıkıldı',
    'profile.unfollowError': 'Takipten çıkılırken bir hata oluştu. Lütfen tekrar deneyin.',
    'profile.followRequestError': 'Takip isteği gönderilirken bir hata oluştu. Lütfen tekrar deneyin.',
    'profile.alreadyFollowingOrRequested': 'Zaten takip isteği gönderdiniz veya takip ediyorsunuz.',
    'profile.followRequestSentSuccess': 'Takip isteği gönderildi',
    'profile.noDescription': 'Açıklama Yok',
    'profile.noName': 'İsim Yok',
    'profile.editProfileInfo': 'Profil Bilgilerimi Düzenle',
    'profile.completePersonalInfo': 'Kişisel Bilgilerini Tamamla',
    'profile.position': 'Mevki',
    'profile.myMatches': 'MAÇLARIM',
    'profile.matches': 'Maç',
    'profile.condition': 'KONDİSYONUN',
    'profile.conditionNeed3Matches': 'Kondisyon kazanman için en az 3 maç yapman lazım!',
    'profile.conditionNextMatch80': 'Eğer 1 maç daha yaparsan kondisyonun 80\'e yükselecek',
    'profile.conditionNextMatch90': 'Eğer 1 maç daha yaparsan kondisyonun 90\'a yükselecek',
    'profile.conditionFirst5Complete': 'İlk 5 maçını tamamladın. Spor yapmaya devam ☺️',
    'profile.conditionAchieved': 'Gerekli kondisyonu kazandın. Sağlıklı günler 👏',
    'profile.notFollowingAnyoneYet': 'Henüz kimseyi takip etmiyor',
    
    // Maç Oluştur
    'create.title': 'Maç Oluştur',
    'create.matchTitle': 'Maç Başlığı',
    'create.matchTitlePlaceholder': 'Maç Başlığı Giriniz',
    'create.location': 'Saha Seç',
    'create.selectDistrict': 'İlçe Seçiniz',
    'create.selectPitch': 'Halı Saha Seçiniz',
    'create.price': 'Fiyat',
    'create.pricePlaceholder': 'Halı Sahanın Fiyatı',
    'create.dateTime': 'Tarih ve Saat',
    'create.createMatch': 'Maç Oluştur',
    'create.squadIncomplete': 'Kadro Eksik mi?',
    'create.selectMissingPositions': 'Eksik Mevkileri Seçin',
    'create.goalkeeper': 'Kaleci',
    'create.defender': 'Defans',
    'create.midfielder': 'Orta Saha',
    'create.forward': 'Forvet',
    'create.howManyMissing': 'Kaç {position} eksik?',
    'create.selectDistrictPlaceholder': 'İlçe Seçiniz',
    'create.selectPitchPlaceholder': 'Halı Saha Seçiniz',
    'create.squadIncompleteQuestion': 'Kadro Eksik mi?',
    'create.selectMissingPositionsTitle': 'Eksik Mevkileri Seçin',
    'create.howManyMissingQuestion': 'Kaç {position} eksik?',
    'create.goalkeeperShort': 'K',
    'create.defenderShort': 'D',
    'create.midfielderShort': 'O',
    'create.forwardShort': 'F',
    'create.locationTitle': 'Saha Seç',
    'create.districtTitle': 'İlçe',
    'create.pitchTitle': 'Halı Saha',
    'create.priceTitle': 'Fiyat',
    'create.dateTimeTitle': 'Tarih ve Saat',
    'create.dateTitle': 'Tarih',
    'create.timeTitle': 'Saat',
    'create.selectDatePlaceholder': 'Tarih Seçiniz',
    'create.selectTimePlaceholder': 'Saat Seçiniz',
    'create.morning': 'Sabah',
    'create.afternoon': 'Öğleden Sonra',
    'create.evening': 'Akşam',
    'create.night': 'Gece',
    
    // Halı Sahalar
    'pitches.title': 'Sahalar',
    'pitches.selectDistrict': 'İlçe Seçiniz',
    'pitches.selectPitch': 'Halı Saha Seçiniz',
    'pitches.noPitchesFound': 'Bu ilçede halı saha bulunamadı',
    'pitches.selectDistrictFirst': 'Önce ilçe seçiniz',
    'pitches.pitchPrice': 'Saha Ücreti',
    'pitches.selectPitchFirst': 'Önce halı saha seçiniz',
    'pitches.locationPermissionRequired': 'Konum izni gerekli',
    'pitches.locationPermissionMessage': 'Uygulamayı kullanmak için konum izni vermeniz gerekiyor.',
    'pitches.addressNotFound': 'Adres bulunamadı.',
    'pitches.addressCouldNotBeRetrieved': 'Adres alınamadı.',
    'pitches.locationCouldNotBeRetrieved': 'Konum alınamadı.',
    'pitches.locationError': 'Konum Hatası',
    'pitches.locationInfoCouldNotBeRetrieved': 'Konum bilgisi alınamadı.',
    'pitches.permissionCheckError': 'İzin kontrolünde hata',
    'pitches.dataFetchError': 'Veri çekme hatası',
    'pitches.listPitchesByLocation': 'Konumuna Göre Halı Sahaları Listele',
    'pitches.yourAddress': 'Adresin',
    'pitches.findYourLocation': 'Konumunu Bul',
    'pitches.pitchSummary': 'HALI SAHA ÖZETİ',
    'pitches.openAddress': 'Açık Adres',
    'pitches.pitchFeatures': 'Sahanın Özellikleri',
    
    // Mesajlar
    'messages.title': 'Mesajlar',
    
    // Bildirimler
    'notifications.title': 'Bildirimler',
    'notifications.loadingError': 'Bildirimler yüklenirken hata',
    'notifications.followRequestError': 'Takip isteği işlenirken hata',
    'notifications.sentFollowRequest': 'sana takip isteği gönderdi.',
    'notifications.noNotificationsYet': 'Henüz bildiriminiz yok',
    
    // Genel
    'general.close': 'Kapat',
    'general.cancel': 'İptal',
    'general.save': 'Kaydet',
    'general.edit': 'Düzenle',
    'general.delete': 'Sil',
    'general.yes': 'Evet',
    'general.no': 'Hayır',
    'general.ok': 'Tamam',
    'general.error': 'Hata',
    'general.success': 'Başarılı',
    'general.loading': 'Yükleniyor...',
    'general.back': 'Geri dön',
    'general.notifications': 'Bildirimler',
    'general.notificationCount': 'Bildirim Sayısı',
    'general.reject': 'Reddet',
    'general.accept': 'Kabul Et',
    
    // Dil Ayarları
    'language.settings': 'Dil Ayarları',
    'language.turkish': 'Türkçe',
    'language.english': 'İngilizce',
    'language.changed': 'Dil değiştirildi',
    'language.changedToTurkish': 'Dil Türkçe olarak ayarlandı',
    'language.changedToEnglish': 'Language set to English',
    
    // Maç
    'match.createSuccess': 'Tebrikler 🎉\nMaçınız başarılı bir şekilde oluşturulmuştur.',
    'match.createError': 'Maç oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.',
    'match.title': 'Maç Başlığı',
    'match.date': 'Tarih',
    'match.time': 'Saat',
    'match.location': 'Konum',
    'match.price': 'Fiyat',
    'match.players': 'Oyuncular',
    'match.selectDate': 'Tarih Seçin',
    'match.selectTime': 'Saat Seçin',
    'match.today': 'Bugün',
    'match.tomorrow': 'Yarın',
    'match.thisWeek': 'Bu Hafta',
    'match.nextWeek': 'Gelecek Hafta',
    'match.morning': 'Sabah',
    'match.afternoon': 'Öğleden Sonra',
    'match.evening': 'Akşam',
    'match.night': 'Gece',
    'dateFormat.day': 'Gün',
    'dateFormat.month': 'Ay',
    'dateFormat.year': 'Yıl',
    'dateFormat.today': 'Bugün',
    'dateFormat.tomorrow': 'Yarın',
    'dateFormat.thisWeek': 'Bu Hafta',
    'dateFormat.nextWeek': 'Gelecek Hafta',
  },
  
  en: {
    // Home
    'home.title': 'Home',
    'home.findMatch': 'Find',
    'home.createMatch': 'Create Match',
    'home.myMatches': 'My Matches',
    'home.otherMatches': 'Other Matches',
    'home.noMatchesFound': 'No matches found',
    'home.loading': 'Loading...',
    'home.refresh': 'Refresh',
    'home.matchDetails': 'Match Details',
    'home.matchTitle': 'Match Title',
    'home.matchDate': 'Date',
    'home.matchTime': 'Time',
    'home.matchLocation': 'Location',
    'home.matchPrice': 'Price',
    'home.matchPlayers': 'Players',
    'home.joinMatch': 'Join Match',
    'home.leaveMatch': 'Leave Match',
    'home.matchFull': 'Match Full',
    'home.matchCancelled': 'Match Cancelled',
    'home.condition': 'CONDITION',
    'home.conditionNeed3Matches': 'You need to play at least 3 matches to gain condition!',
    'home.conditionNextMatch80': 'If you play 1 more match, your condition will rise to 80',
    'home.conditionNextMatch90': 'If you play 1 more match, your condition will rise to 90',
    'home.conditionFirst5Complete': 'You completed your first 5 matches. Keep exercising ☺️',
    'home.conditionAchieved': 'You have achieved the required condition. Healthy days 👏',
    'home.matchSummary': 'MATCH SUMMARY',
    'home.missingSquads': 'Missing Squads',
    'home.matchCreatedBy': 'Match created by:',
    'home.pitchSummary': 'PITCH SUMMARY',
    'home.openAddress': 'Open Address',
    'home.pitchPrice': 'Pitch Price',
    'home.pitchFeatures': 'Pitch Features',
    'home.matchPlaying': 'Match Playing',
    'home.waitingMatches': 'MATCHES WAITING FOR YOU',
    'home.noMatchesCreated': 'No Matches Created!',
    'home.createMatchNow': 'Create Match Now',
    'home.matchesLoading': 'Matches Loading..',
    'home.incompleteSquadMatches': 'INCOMPLETE SQUAD MATCHES',
    'home.noIncompleteSquadMatches': 'No Incomplete Squad Matches Created by Others!',
    
    // Profile
    'profile.title': 'Profile',
    'profile.settings': 'Settings',
    'profile.logout': 'Logout',
    'profile.editProfile': 'Complete Personal Information',
    'profile.name': 'Your Name',
    'profile.surname': 'Your Surname',
    'profile.age': 'Age',
    'profile.height': 'Height',
    'profile.weight': 'Weight',
    'profile.description': 'Position / Biography',
    'profile.save': 'Save',
    'profile.cancel': 'Cancel',
    'profile.followers': 'Followers',
    'profile.following': 'Following',
    'profile.follow': 'Follow',
    'profile.followingYou': 'Following you',
    'profile.youFollowing': 'You are following',
    'profile.profileImage': 'Profile Image',
    'profile.changePhoto': 'Change Photo',
    'profile.personalInfo': 'Personal Information',
    'profile.profileUpdated': 'Profile updated',
    'profile.updateError': 'Error updating profile',
    'profile.logoutError': 'Logout failed',
    'profile.logoutErrorMsg': 'An error occurred',
    'profile.noFollowersYet': 'No followers yet',
    'profile.followRequestSent': 'Follow request sent',
    'profile.userSessionNotFound': 'User session not found',
    'profile.ownUserDataNotFound': 'Your own user data could not be retrieved',
    'profile.unfollowed': 'Unfollowed',
    'profile.unfollowError': 'An error occurred while unfollowing. Please try again.',
    'profile.followRequestError': 'An error occurred while sending follow request. Please try again.',
    'profile.alreadyFollowingOrRequested': 'You have already sent a follow request or are following.',
    'profile.followRequestSentSuccess': 'Follow request sent',
    'profile.noDescription': 'No Description',
    'profile.noName': 'No Name',
    'profile.editProfileInfo': 'Edit My Profile Info',
    'profile.completePersonalInfo': 'Complete Your Personal Information',
    'profile.position': 'Position',
    'profile.myMatches': 'MY MATCHES',
    'profile.matches': 'Matches',
    'profile.condition': 'CONDITION',
    'profile.conditionNeed3Matches': 'You need to play at least 3 matches to gain condition!',
    'profile.conditionNextMatch80': 'If you play 1 more match, your condition will rise to 80',
    'profile.conditionNextMatch90': 'If you play 1 more match, your condition will rise to 90',
    'profile.conditionFirst5Complete': 'You completed your first 5 matches. Keep exercising ☺️',
    'profile.conditionAchieved': 'You have gained the necessary condition. Healthy days 👏',
    'profile.notFollowingAnyoneYet': 'Not following anyone yet',
    
    // Create Match
    'create.title': 'Create',
    'create.matchTitle': 'Match Title',
    'create.matchTitlePlaceholder': 'Enter Match Title',
    'create.location': 'Select Pitch',
    'create.selectDistrict': 'Select District',
    'create.selectPitch': 'Select Pitch',
    'create.price': 'Price',
    'create.pricePlaceholder': 'Pitch Price',
    'create.dateTime': 'Date and Time',
    'create.createMatch': 'Create Match',
    'create.squadIncomplete': 'Is Squad Incomplete?',
    'create.selectMissingPositions': 'Select Missing Positions',
    'create.goalkeeper': 'Goalkeeper',
    'create.defender': 'Defender',
    'create.midfielder': 'Midfielder',
    'create.forward': 'Forward',
    'create.howManyMissing': 'How many {position} missing?',
    'create.selectDistrictPlaceholder': 'Select District',
    'create.selectPitchPlaceholder': 'Select Pitch',
    'create.squadIncompleteQuestion': 'Is Squad Incomplete?',
    'create.selectMissingPositionsTitle': 'Select Missing Positions',
    'create.howManyMissingQuestion': 'How many {position} missing?',
    'create.goalkeeperShort': 'G',
    'create.defenderShort': 'D',
    'create.midfielderShort': 'M',
    'create.forwardShort': 'F',
    'create.locationTitle': 'Select Pitch',
    'create.districtTitle': 'District',
    'create.pitchTitle': 'Pitch',
    'create.priceTitle': 'Price',
    'create.dateTimeTitle': 'Date and Time',
    'create.dateTitle': 'Date',
    'create.timeTitle': 'Time',
    'create.selectDatePlaceholder': 'Select Date',
    'create.selectTimePlaceholder': 'Select Time',
    'create.morning': 'Morning',
    'create.afternoon': 'Afternoon',
    'create.evening': 'Evening',
    'create.night': 'Night',
    
    // Pitches
    'pitches.title': 'Pitches',
    'pitches.selectDistrict': 'Select District',
    'pitches.selectPitch': 'Select Pitch',
    'pitches.noPitchesFound': 'No pitches found in this district',
    'pitches.selectDistrictFirst': 'Select district first',
    'pitches.pitchPrice': 'Price',
    'pitches.selectPitchFirst': 'Select pitch first',
    'pitches.locationPermissionRequired': 'Location permission required',
    'pitches.locationPermissionMessage': 'You need to grant location permission to use the app.',
    'pitches.addressNotFound': 'Address not found.',
    'pitches.addressCouldNotBeRetrieved': 'Address could not be retrieved.',
    'pitches.locationCouldNotBeRetrieved': 'Location could not be retrieved.',
    'pitches.locationError': 'Location Error',
    'pitches.locationInfoCouldNotBeRetrieved': 'Location information could not be retrieved.',
    'pitches.permissionCheckError': 'Permission check error',
    'pitches.dataFetchError': 'Data fetch error',
    'pitches.listPitchesByLocation': 'List Pitches by Your Location',
    'pitches.yourAddress': 'Your Address',
    'pitches.findYourLocation': 'Find Your Location',
    'pitches.pitchSummary': 'PITCH SUMMARY',
    'pitches.openAddress': 'Open Address',
    'pitches.pitchFeatures': 'Pitch Features',
    
    // Messages
    'messages.title': 'Messages',
    
    // Notifications
    'notifications.title': 'Notifications',
    'notifications.loadingError': 'Error loading notifications',
    'notifications.followRequestError': 'Error processing follow request',
    'notifications.sentFollowRequest': 'sent you a follow request.',
    'notifications.noNotificationsYet': 'You have no notifications yet',
    
    // General
    'general.close': 'Close',
    'general.cancel': 'Cancel',
    'general.save': 'Save',
    'general.edit': 'Edit',
    'general.delete': 'Delete',
    'general.yes': 'Yes',
    'general.no': 'No',
    'general.ok': 'OK',
    'general.error': 'Error',
    'general.success': 'Success',
    'general.loading': 'Loading...',
    'general.back': 'Back',
    'general.notifications': 'Notifications',
    'general.notificationCount': 'Notification Count',
    'general.reject': 'Reject',
    'general.accept': 'Accept',
    
    // Language Settings
    'language.settings': 'Language Settings',
    'language.turkish': 'Turkish',
    'language.english': 'English',
    'language.changed': 'Language changed',
    'language.changedToTurkish': 'Language set to Turkish',
    'language.changedToEnglish': 'Language set to English',
    
    // Match
    'match.createSuccess': 'Congratulations 🎉\nYour match has been created successfully.',
    'match.createError': 'An error occurred while creating the match. Please try again.',
    'match.title': 'Match Title',
    'match.date': 'Date',
    'match.time': 'Time',
    'match.location': 'Location',
    'match.price': 'Price',
    'match.players': 'Players',
    'match.selectDate': 'Select Date',
    'match.selectTime': 'Select Time',
    'match.today': 'Today',
    'match.tomorrow': 'Tomorrow',
    'match.thisWeek': 'This Week',
    'match.nextWeek': 'Next Week',
    'match.morning': 'Morning',
    'match.afternoon': 'Afternoon',
    'match.evening': 'Evening',
    'match.night': 'Night',
    'dateFormat.day': 'Day',
    'dateFormat.month': 'Month',
    'dateFormat.year': 'Year',
    'dateFormat.today': 'Today',
    'dateFormat.tomorrow': 'Tomorrow',
    'dateFormat.thisWeek': 'This Week',
    'dateFormat.nextWeek': 'Next Week',
  }
};

// Dil context provider
export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<Language>('tr');

  // Uygulama başladığında kaydedilen dili yükle
  useEffect(() => {
    loadSavedLanguage();
  }, []);

  // Kaydedilen dili yükle
  const loadSavedLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('selectedLanguage');
      if (savedLanguage && (savedLanguage === 'tr' || savedLanguage === 'en')) {
        setCurrentLanguage(savedLanguage as Language);
      }
    } catch (error) {
      console.error('Dil yüklenirken hata:', error);
    }
  };

  // Dili değiştir
  const changeLanguage = async (language: Language) => {
    try {
      await AsyncStorage.setItem('selectedLanguage', language);
      setCurrentLanguage(language);
    } catch (error) {
      console.error('Dil değiştirilirken hata:', error);
      throw error;
    }
  };

  // Çeviri fonksiyonu
  const t = (key: string): string => {
    const translation = translations[currentLanguage][key as keyof typeof translations[typeof currentLanguage]];
    if (!translation) {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
    return translation;
  };

  const value: LanguageContextType = {
    currentLanguage,
    changeLanguage,
    t,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// Dil context hook'u
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
