import { useRef, useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, ScrollView, Keyboard, Dimensions, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/services/supabase";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, runOnJS } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AuthScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardWasOpened, setKeyboardWasOpened] = useState(false); // Klavye bir kere açıldı mı?
  const [isFormExpanded, setIsFormExpanded] = useState(false); // Form genişletilmiş mi?
  const [keyboardHeight, setKeyboardHeight] = useState(0); // iOS için klavye yüksekliği
  
  const passwordInputRef = useRef<TextInput>(null);

  // Form yukarı kayma animasyonu - başlangıçta içerik aşağıda (görünmez)
  const formContentTranslateY = useSharedValue(200);
  const formContentOpacity = useSharedValue(0);
  // Form container yükseklik animasyonu - başlangıçta küçük
  const MIN_FORM_HEIGHT = Platform.OS === 'ios' ? 160 : 180;
  const formHeight = useSharedValue(MIN_FORM_HEIGHT);

  // Pan gesture handler
  const startHeight = useSharedValue(MIN_FORM_HEIGHT);
  
  const panGesture = Gesture.Pan()
    .onStart(() => {
      startHeight.value = formHeight.value;
    })
    .onUpdate((event) => {
      // Yukarı çekme (negatif translationY) formu büyütür
      // Aşağı çekme (pozitif translationY) formu küçültür
      const newHeight = startHeight.value - event.translationY;
      // Minimum ve maksimum yükseklik limitleri
      const maxHeight = Platform.OS === 'ios' 
        ? SCREEN_HEIGHT * 0.42  // iOS için daha küçük
        : SCREEN_HEIGHT * 0.55; // Android için
      if (newHeight >= MIN_FORM_HEIGHT && newHeight <= maxHeight) {
        formHeight.value = newHeight;
        // İçerik pozisyonunu da güncelle
        const progress = (newHeight - MIN_FORM_HEIGHT) / (maxHeight - MIN_FORM_HEIGHT);
        formContentTranslateY.value = 200 * (1 - progress);
        formContentOpacity.value = progress;
      }
    })
    .onEnd((event) => {
      // Eğer yukarı çekilmişse (threshold: -50) formu genişlet
      if (event.translationY < -50) {
        const maxHeight = Platform.OS === 'ios' 
          ? SCREEN_HEIGHT * 0.42  // iOS için daha küçük
          : SCREEN_HEIGHT * 0.55; // Android için
        formHeight.value = withTiming(maxHeight, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        formContentTranslateY.value = withTiming(0, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        formContentOpacity.value = withTiming(1, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        runOnJS(setIsFormExpanded)(true);
      } else {
        // Aşağı indir
        formHeight.value = withTiming(MIN_FORM_HEIGHT, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        formContentTranslateY.value = withTiming(200, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        formContentOpacity.value = withTiming(0, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        runOnJS(setIsFormExpanded)(false);
      }
    });

  // Form içeriği animasyon style'ı
  const formContentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: formContentTranslateY.value }],
    opacity: formContentOpacity.value,
  }));
  
  // Form container yükseklik animasyon style'ı
  const formContainerAnimatedStyle = useAnimatedStyle(() => ({
    height: formHeight.value,
  }));

  // Formu genişletme fonksiyonu
  const expandForm = () => {
    if (!isFormExpanded) {
      const maxHeight = Platform.OS === 'ios' 
        ? SCREEN_HEIGHT * 0.42
        : SCREEN_HEIGHT * 0.55;
      formHeight.value = withTiming(maxHeight, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      formContentTranslateY.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      formContentOpacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      setIsFormExpanded(true);
    }
  };

  // Klavye durumunu dinle
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardVisible(true);
      setKeyboardWasOpened(true); // Klavye açıldı, flag'i set et
      // iOS'ta klavye yüksekliğini al
      if (Platform.OS === 'ios') {
        setKeyboardHeight(e.endCoordinates.height);
      }
    });
    const keyboardDidHideListener = Keyboard.addListener("keyboardDidHide", () => {
      // Android'de footer butonlarıyla klavye kapatıldığında da tetiklenmesi için kısa bir gecikme
      if (Platform.OS === 'android') {
        setTimeout(() => {
          setKeyboardVisible(false);
        }, 150);
      } else {
        setKeyboardVisible(false);
        setKeyboardHeight(0); // iOS'ta klavye kapandığında yüksekliği sıfırla
      }
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // İngilizce hata mesajlarını Türkçeye çeviren fonksiyon
  const translateError = (errorMessage: string): string => {
    const translations: Record<string, string> = {
      "Password should be at least 6 characters": "Şifre en az 6 karakter olmalıdır.",
      "Email format is invalid": "Geçersiz e-posta formatı.",
      "User already registered": "Bu e-posta ile kayıtlı bir kullanıcı zaten var.",
      "Invalid login credentials": "E-posta veya şifre hatalı.",
      "Email not confirmed": "E-posta adresinizi doğrulamanız gerekiyor.",
      "User not found": "Kullanıcı bulunamadı.",
      "AuthApiError: User already exists": "Bu e-posta adresiyle bir hesap zaten var.",
      "AuthApiError: Password should be at least 6 characters": "Şifreniz en az 6 karakter olmalıdır.",
    };

    return translations[errorMessage] || `Hata: ${errorMessage}`;
  };

 

  // Başarılı giriş sonrası geçiş
  const navigateTo = (destination: string) => {
    console.log("navigateTo çağrıldı:", destination);
    setIsLoading(false);
    router.replace(destination as any);
  };

  const handleAuth = async () => {
    Keyboard.dismiss();
    
    if (!email.trim() || !password.trim()) {
      return Alert.alert("Hata", "Lütfen tüm alanları doldurun.");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Alert.alert("Hata", "Geçersiz e-posta formatı.");
    }

    if (password.length < 6) {
      return Alert.alert("Hata", "Şifre en az 6 karakter olmalıdır.");
    }

    setIsLoading(true);

    try {
      let data, error;

      if (isLogin) {
        ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
      } else {
        const redirectUrl = Linking.createURL("/email-confirmed");
        ({ data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl },
        }));

        // Kayıt başarılı olduysa users tablosuna eklemeyi dene
        // (Trigger varsa otomatik oluşur, yoksa ilk girişte oluşturulacak)
        if (!error && data?.user) {
          console.log("Kayıt başarılı, users tablosuna ekleme deneniyor...");
          const { error: insertError } = await supabase.from("users").insert([
            {
              id: data.user.id,
              email: data.user.email,
              name: "Yeni Kullanıcı",
              surname: "",
              age: null,
              height: null,
              weight: null,
              description: "",
              created_at: new Date(),
            },
          ]);

          if (insertError) {
            console.log("Kayıt sırasında users tablosuna eklenemedi (normal, ilk girişte oluşturulacak):", insertError.message);
            // Hata normal, çünkü kullanıcı henüz authenticated değil
            // İlk girişte otomatik oluşturulacak
          } else {
            console.log("Kullanıcı kaydı başarıyla oluşturuldu!");
          }
        }
      }

      if (error) throw error;

      console.log("Auth başarılı, isLogin:", isLogin, "data:", data);
      
      if (isLogin && data?.user) {
        console.log("Login başarılı, user:", data.user.id);
        // Kullanıcı ID'sini AsyncStorage içine kaydet
        await AsyncStorage.setItem("userId", data.user.id);

        // Kullanıcının bilgilerini çek
        const { data: userInfo, error: userError } = await supabase
          .from("users")
          .select("name, surname, age, height, weight, description")
          .eq("id", data.user.id)
          .single();

        // Eğer kullanıcı kaydı yoksa oluştur
        if (userError && userError.code === 'PGRST116') {
          console.log("Kullanıcı kaydı bulunamadı, oluşturuluyor...");
          const { error: insertError } = await supabase.from("users").insert([
            {
              id: data.user.id,
              email: data.user.email,
              name: "Yeni Kullanıcı",
              surname: "",
              age: null,
              height: null,
              weight: null,
              description: "",
              created_at: new Date(),
            },
          ]);

          if (insertError) {
            console.error("Kullanıcı bilgileri eklenirken hata oluştu:", insertError.message);
            Alert.alert("Hata", "Kullanıcı kaydı oluşturulamadı. Lütfen tekrar deneyin.");
            setIsLoading(false);
            return;
          }

          // Yeni oluşturulan kullanıcıyı firstLogin ile yönlendir
          navigateTo("/(tabs)/profile?firstLogin=true");
          return;
        }

        if (userError) {
          console.error("Kullanıcı bilgileri alınırken hata oluştu:", userError.message);
          // Kullanıcı bilgileri alınamadıysa da firstLogin ile yönlendir
          navigateTo("/(tabs)/profile?firstLogin=true");
          return;
        }

        const hasMissingFields = !userInfo?.name || !userInfo?.surname || !userInfo?.age ||
          !userInfo?.height || !userInfo?.weight || !userInfo?.description;

        if (hasMissingFields) {
          navigateTo("/(tabs)/profile?firstLogin=true");
        } else {
          navigateTo("/(tabs)/profile");
        }
      } else {
        // Kayıt başarılı
        setIsLoading(false);
        Alert.alert("Başarılı", "Kayıt başarılı! E-postanızı doğrulamanız gerekmektedir. E-postanızı kontrol ederek mail adresinizi doğrulayınız!");
      }
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert("Hata", translateError(error?.message || "Bilinmeyen hata"));
    }
  };

  return (
    // ÖNEMLİ: NativeWind herhangi bir sebeple çalışmasa bile ekranın "0 yükseklik" kalmaması için
    // kritik layout değerlerini inline style ile garanti ediyoruz. (Beyaz ekranı keser)
    <SafeAreaView
      className="flex-1 bg-gray-100"
      style={{ flex: 1, backgroundColor: "#f3f4f6" }}
      edges={["top"]}
    >
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Arka plan içeriği - ScrollView içinde */}
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          scrollEnabled={false}
        >
          {/* Header */}
          <View 
            className="bg-green-700 px-2"
            style={{
              height: 90,
              position: 'relative',
              overflow: 'hidden',
            }}>
            {/* Futbol sahası çizgileri efekti */}
            <View 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: 0.8,
              }}>
              {/* Üst dış çizgi - 1px boşluk ile */}
              <View style={{ 
                position: 'absolute', 
                top: 1, 
                left: 1, 
                right: 1, 
                height: 2, 
                backgroundColor: 'white',
              }} />
              
              {/* Alt dış çizgi - 1px boşluk ile */}
              <View style={{ 
                position: 'absolute', 
                bottom: 1, 
                left: 1, 
                right: 1, 
                height: 2, 
                backgroundColor: 'white',
              }} />
              
              {/* Sol dış çizgi - 1px boşluk ile */}
              <View style={{ 
                position: 'absolute', 
                top: 1, 
                bottom: 1, 
                left: 1, 
                width: 2, 
                backgroundColor: 'white',
              }} />
              
              {/* Sağ dış çizgi - 1px boşluk ile */}
              <View style={{ 
                position: 'absolute', 
                top: 1, 
                bottom: 1, 
                right: 1, 
                width: 2, 
                backgroundColor: 'white',
              }} />
              
              {/* Orta saha çizgisi */}
              <View style={{ 
                position: 'absolute', 
                left: '50%', 
                top: 1, 
                bottom: 1, 
                width: 2, 
                backgroundColor: 'white',
                transform: [{ translateX: -1 }]
              }} />
              
              {/* Orta yuvarlak */}
              <View style={{ 
                position: 'absolute', 
                top: '50%', 
                left: '50%', 
                width: 60, 
                height: 60, 
                borderWidth: 2, 
                borderColor: 'white',
                borderRadius: 30,
                transform: [{ translateX: -30 }, { translateY: -30 }]
              }} />
              
              {/* Sol kale - İç çizgiler (file gibi) */}
              <View style={{
                position: 'absolute',
                left: 1,
                top: '25%',
                bottom: '25%',
                width: 25,
                borderWidth: 2,
                borderColor: 'white',
                borderRightWidth: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
              }} />
              
              {/* Sol ceza sahası - Yan çizgiler (kale yan çizgisinden ayrı) */}
              <View style={{
                position: 'absolute',
                left: 3,
                top: '15%',
                width: 40,
                height: 2,
                backgroundColor: 'white',
              }} />
              <View style={{
                position: 'absolute',
                left: 3,
                bottom: '15%',
                width: 40,
                height: 2,
                backgroundColor: 'white',
              }} />
              
              {/* Sol ceza sahası - Ön çizgi (dikey) */}
              <View style={{
                position: 'absolute',
                left: 42,
                top: '15%',
                bottom: '15%',
                width: 2,
                backgroundColor: 'white',
              }} />
              
              {/* Sol penaltı noktası */}
              <View style={{
                position: 'absolute',
                left: 32,
                top: '50%',
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'white',
                transform: [{ translateX: -2 }, { translateY: -2 }],
              }} />
              
              {/* Sağ kale - İç çizgiler (file gibi) */}
              <View style={{
                position: 'absolute',
                right: 1,
                top: '25%',
                bottom: '25%',
                width: 25,
                borderWidth: 2,
                borderColor: 'white',
                borderLeftWidth: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
              }} />
              
              {/* Sağ ceza sahası - Yan çizgiler (kale yan çizgisinden ayrı) */}
              <View style={{
                position: 'absolute',
                right: 3,
                top: '15%',
                width: 40,
                height: 2,
                backgroundColor: 'white',
              }} />
              <View style={{
                position: 'absolute',
                right: 3,
                bottom: '15%',
                width: 40,
                height: 2,
                backgroundColor: 'white',
              }} />
              
              {/* Sağ ceza sahası - Ön çizgi (dikey) */}
              <View style={{
                position: 'absolute',
                right: 42,
                top: '15%',
                bottom: '15%',
                width: 2,
                backgroundColor: 'white',
              }} />
              
              {/* Sağ penaltı noktası */}
              <View style={{
                position: 'absolute',
                right: 32,
                top: '50%',
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'white',
                transform: [{ translateX: 2 }, { translateY: -2 }],
              }} />
            </View>
            
            {/* İçerik */}
            <View style={{ width: '100%', height: '100%', zIndex: 1, position: 'relative' }}>
              {/* Orta nokta işareti */}
              <View style={{ 
                position: 'absolute', 
                top: '50%', 
                left: '50%',
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: 'white',
                transform: [{ translateX: -3 }, { translateY: -3 }],
              }} />
              
              {/* "SAHAYA" yazısı - Kalenin ön çizgisi ile orta saha çizgisinin ortasında */}
              <Text
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '26%',
                  fontSize: 20,
                  color: 'white',
                  fontWeight: 'bold',
                  transform: [{ translateX: -35 }, { translateY: -8 }],
                }}
              >
                SAHAYA
              </Text>
              
              {/* "BAK" yazısı - Orta saha çizgisi ile kalenin ön çizgisinin ortasında */}
              <Text
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: '25%',
                  fontSize: 20,
                  color: 'white',
                  fontWeight: 'bold',
                  transform: [{ translateX: 15 }, { translateY: -8 }],
                }}
              >
                BAK
              </Text>
            </View>
          </View>
          
          {/* Fake arka plan içeriği */}
          <View className="flex-1 px-4 pt-4">
            {/* Fake kondisyon kartı */}
            <View className="bg-white rounded-xl p-4 shadow-sm opacity-75 mb-4">
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 bg-gray-200 rounded-full" />
                  <View className="ml-3">
                    <View className="w-24 h-3 bg-gray-200 rounded mb-1" />
                    <View className="w-16 h-2 bg-gray-200 rounded" />
                  </View>
                </View>
                <View className="w-12 h-12 bg-gray-200 rounded-full" />
              </View>
            </View>
            
            {/* Fake maç kartları */}
            {[1, 2].map((i) => (
              <View key={i} className="bg-white rounded-xl p-4 shadow-sm opacity-75 mb-2">
                <View className="flex-row justify-between">
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 bg-gray-200 rounded-full" />
                    <View className="ml-3">
                      <View className="w-24 h-3 bg-gray-200 rounded mb-2" />
                      <View className="w-16 h-2 bg-gray-200 rounded" />
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Giriş Formu - ScrollView dışında, altta sabit - Animasyonlu */}
        <GestureDetector gesture={panGesture}>
          <Animated.View 
            className="bg-white rounded-t-3xl shadow-2xl"
            style={[
              formContainerAnimatedStyle,
              { 
                position: 'absolute',
                bottom: Platform.OS === 'ios' ? keyboardHeight : 0,
                left: 0,
                right: 0,
                paddingBottom: Platform.OS === 'ios' 
                  ? (keyboardVisible ? 30 : 30)
                  : (keyboardVisible ? 0 : (keyboardWasOpened ? 30 : 30)),
                overflow: 'hidden'
              }
            ]}
          >
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: isFormExpanded ? 16 : 12,
              paddingBottom: Platform.OS === 'ios' && keyboardVisible && isFormExpanded ? 10 : 0,
            }}
          >
              {/* Drag indicator */}
              <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-2" />
              
              {/* Logo ve Başlık - Her zaman görünür */}
              <Pressable onPress={expandForm} disabled={isFormExpanded}>
                <View className="items-center" style={{ marginBottom: isFormExpanded ? 12 : 8 }}>
                  <View className="w-16 h-16 bg-green-700 rounded-full items-center justify-center mt-2 mb-3">
                    <Ionicons name="football" size={36} color="white" />
                  </View>
                  <Text className="text-2xl font-bold text-gray-800">
                    {isLogin ? "Hoş Geldin" : "Aramıza Katıl!"}
                  </Text>
                  <Text className="text-gray-700 mt-1">
                    {isLogin ? (
                      <>Sahaya çıkmak için <Text className="text-green-700 font-semibold">giriş yap</Text></>
                    ) : (
                      "Yeni bir hesap oluştur"
                    )}
                  </Text>
                </View>
              </Pressable>

              {/* Form içeriği - Animasyonla yukarı kayacak */}
              <Animated.View style={formContentAnimatedStyle}>
              {/* E-Posta Girişi */}
              <View className="mb-3">
                <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                  <Ionicons name="mail-outline" size={20} color="#6B7280" />
                  <TextInput
                    className="flex-1 ml-3 text-gray-800"
                    placeholder="E-posta adresin"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    autoComplete="email"
                    value={email}
                    onChangeText={setEmail}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    onFocus={() => {
                      // iOS'ta input'a tıklandığında formu genişlet
                      if (Platform.OS === 'ios' && !isFormExpanded) {
                        expandForm();
                      }
                    }}
                    onBlur={() => {
                      // Android'de input focus kaybettiğinde klavye durumunu kontrol et
                      if (Platform.OS === 'android') {
                        setTimeout(() => {
                          Keyboard.dismiss();
                          setKeyboardVisible(false);
                        }, 100);
                      }
                    }}
                  />
                </View>
              </View>

              {/* Şifre Girişi */}
              <View className="mb-4">
                <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                  <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
                  <TextInput
                    ref={passwordInputRef}
                    className="flex-1 ml-3 text-gray-800"
                    placeholder="Şifren"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    textContentType="password"
                    autoComplete="password"
                    autoCorrect={false}
                    value={password}
                    onChangeText={setPassword}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    onSubmitEditing={handleAuth}
                    onFocus={() => {
                      // iOS'ta input'a tıklandığında formu genişlet
                      if (Platform.OS === 'ios' && !isFormExpanded) {
                        expandForm();
                      }
                    }}
                    onBlur={() => {
                      // Android'de input focus kaybettiğinde klavye durumunu kontrol et
                      if (Platform.OS === 'android') {
                        setTimeout(() => {
                          Keyboard.dismiss();
                          setKeyboardVisible(false);
                        }, 100);
                      }
                    }}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons 
                      name={showPassword ? "eye-outline" : "eye-off-outline"} 
                      size={20} 
                      color="#6B7280" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Giriş / Kayıt Butonu */}
              <Pressable 
                className="bg-green-700 py-4 rounded-xl flex-row items-center justify-center"
                onPress={handleAuth}
                disabled={isLoading}
                style={({ pressed }) => pressed && { opacity: 0.8 }}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Text className="text-white font-bold text-lg">
                      {isLogin ? "Giriş Yap" : "Kayıt Ol"}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
                  </>
                )}
              </Pressable>

              {/* Kayıt / Giriş arasında geçiş */}
              <TouchableOpacity 
                className="mb-0" 
                style={{ 
                  marginTop: Platform.OS === 'ios' && keyboardVisible ? 15 : (Platform.OS === 'android' && keyboardVisible ? 24 : 12),
                  paddingBottom: Platform.OS === 'ios' && keyboardVisible ? 8 : (Platform.OS === 'android' && keyboardVisible ? 0 : 12)
                }}
                onPress={() => setIsLogin(!isLogin)}
              >
                <Text className="text-center text-gray-600">
                  {isLogin ? (
                    <>Hesabın yok mu? <Text className="text-green-700 font-semibold">Kayıt ol</Text></>
                  ) : (
                    <>Zaten hesabın var mı? <Text className="text-green-700 font-semibold">Giriş yap</Text></>
                  )}
                </Text>
              </TouchableOpacity>
              </Animated.View>
          </View>
        </Animated.View>
        </GestureDetector>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
