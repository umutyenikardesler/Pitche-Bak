import { useRef, useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, ScrollView, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/services/supabase";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";

export default function AuthScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardWasOpened, setKeyboardWasOpened] = useState(false); // Klavye bir kere açıldı mı?
  
  const passwordInputRef = useRef<TextInput>(null);

  // Sistem fontunu kullan (her 2 platform için)
  const fontFamily = 'sans-serif';

  // Animasyon için harfleri ayır
  const text = "SAHAYABAK";
  const letters = text.split("");
  
  // Yanıp sönme animasyonu (react-native-reanimated)
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.5, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // Sonsuz döngü
      true // Reverse (geriye doğru da animasyon yap)
    );
  }, []);

  // Animated style'ı component seviyesinde tanımla
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // Klavye durumunu dinle (Android için)
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
      setKeyboardWasOpened(true); // Klavye açıldı, flag'i set et
    });
    const keyboardDidHideListener = Keyboard.addListener("keyboardDidHide", () => {
      // Android'de footer butonlarıyla klavye kapatıldığında da tetiklenmesi için kısa bir gecikme
      if (Platform.OS === 'android') {
        setTimeout(() => {
          setKeyboardVisible(false);
        }, 150);
      } else {
        setKeyboardVisible(false);
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

        if (!error && data?.user) {
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
          }
        }
      }

      if (error) throw error;

      console.log("Auth başarılı, isLogin:", isLogin, "data:", data);
      
      if (isLogin && data?.user) {
        console.log("Login başarılı, user:", data.user.id);
        // Kullanıcı ID'sini AsyncStorage içine kaydet
        await AsyncStorage.setItem("userId", data.user.id);

        // Kullanıcının bilgilerini çek ve eksik olup olmadığını kontrol et
        const { data: userInfo, error: userError } = await supabase
          .from("users")
          .select("name, surname, age, height, weight, description")
          .eq("id", data.user.id)
          .single();

        if (userError) {
          console.error("Kullanıcı bilgileri alınırken hata oluştu:", userError.message);
          navigateTo("/(tabs)/profile");
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
    <SafeAreaView className="flex-1 bg-gray-100" edges={['top']}>
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
            className="bg-green-700 pb-4 px-4 pt-4">
            <View className="flex-row items-center justify-center" style={{ height: 30 }}>
              {letters.map((letter, index) => (
                <Animated.View
                  key={index}
                  style={[
                    animatedStyle,
                    {
                      marginHorizontal: 2,
                      position: 'relative',
                    }
                  ]}
                >
                  {/* Siyah outline için arka plan katmanları - 8 yöne (ince kenarlık) */}
                  <Text
                    style={{
                      position: 'absolute',
                      left: -2,
                      top: 0,
                      fontSize: 20,
                      color: 'black',
                      fontFamily: fontFamily,
                    }}
                  >
                    {letter}
                  </Text>
                  <Text
                    style={{
                      position: 'absolute',
                      left: 2,
                      top: 0,
                      fontSize: 20,
                      color: 'black',
                      fontFamily: fontFamily,
                    }}
                  >
                    {letter}
                  </Text>
                  <Text
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: -2,
                      fontSize: 20,
                      color: 'black',
                      fontFamily: fontFamily,
                    }}
                  >
                    {letter}
                  </Text>
                  <Text
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 2,
                      fontSize: 20,
                      color: 'black',
                      fontFamily: fontFamily,
                    }}
                  >
                    {letter}
                  </Text>
                  {/* Köşeler */}
                  <Text
                    style={{
                      position: 'absolute',
                      left: -1,
                      top: -1,
                      fontSize: 20,
                      color: 'black',
                      fontFamily: fontFamily,
                    }}
                  >
                    {letter}
                  </Text>
                  <Text
                    style={{
                      position: 'absolute',
                      left: 1,
                      top: -1,
                      fontSize: 20,
                      color: 'black',
                      fontFamily: fontFamily,
                    }}
                  >
                    {letter}
                  </Text>
                  <Text
                    style={{
                      position: 'absolute',
                      left: -1,
                      top: 1,
                      fontSize: 20,
                      color: 'black',
                      fontFamily: fontFamily,
                    }}
                  >
                    {letter}
                  </Text>
                  <Text
                    style={{
                      position: 'absolute',
                      left: 1,
                      top: 1,
                      fontSize: 20,
                      color: 'black',
                      fontFamily: fontFamily,
                    }}
                  >
                    {letter}
                  </Text>
                  {/* Ana beyaz metin */}
                  <Text
                    style={{
                      fontSize: 20,
                      color: 'white',
                      fontFamily: fontFamily,
                    }}
                  >
                    {letter}
                  </Text>
                </Animated.View>
              ))}
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

        {/* Giriş Formu - ScrollView dışında, altta sabit */}
        <View 
          className="bg-white rounded-t-3xl px-6 pt-6 shadow-2xl"
          style={{ 
            paddingBottom: Platform.OS === 'ios' 
              ? 20 
              : (keyboardVisible ? 20 : (keyboardWasOpened ? 20 : 50))
          }}
        >
              {/* Drag indicator */}
              <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />
              
              {/* Logo ve Başlık */}
              <View className="items-center mb-6">
                <View className="w-16 h-16 bg-green-700 rounded-full items-center justify-center mb-3">
                  <Ionicons name="football" size={36} color="white" />
                </View>
                <Text className="text-2xl font-bold text-gray-800">
                  {isLogin ? "Hoş Geldin!" : "Aramıza Katıl!"}
                </Text>
                <Text className="text-gray-500 mt-1">
                  {isLogin ? "Sahaya çıkmak için giriş yap" : "Yeni bir hesap oluştur"}
                </Text>
              </View>

              {/* E-Posta Girişi */}
              <View className="mb-4">
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
              <View className="mb-6">
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
              <TouchableOpacity className="mt-5" onPress={() => setIsLogin(!isLogin)}>
                <Text className="text-center text-gray-600">
                  {isLogin ? (
                    <>Hesabın yok mu? <Text className="text-green-700 font-semibold">Kayıt ol</Text></>
                  ) : (
                    <>Zaten hesabın var mı? <Text className="text-green-700 font-semibold">Giriş yap</Text></>
                  )}
                </Text>
              </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
