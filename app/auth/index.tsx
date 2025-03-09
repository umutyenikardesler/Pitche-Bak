import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/services/supabase";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage"; // Kullanıcı ID'sini saklamak için eklendi

export default function AuthScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true); // Giriş / Kayıt değişimi

  // İngilizce hata mesajlarını Türkçeye çeviren fonksiyon
  const translateError = (errorMessage) => {
    const translations = {
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

  // const [keyboardVisible, setKeyboardVisible] = useState(false);

  // useEffect(() => {
  //   const keyboardDidShowListener = Keyboard.addListener("keyboardDidShow", () => {
  //     setKeyboardVisible(true);
  //   });
  //   const keyboardDidHideListener = Keyboard.addListener("keyboardDidHide", () => {
  //     setKeyboardVisible(false);
  //   });

  //   return () => {
  //     keyboardDidShowListener.remove();
  //     keyboardDidHideListener.remove();
  //   };
  // }, []);

  const handleAuth = async () => {
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

    try {
      let data, error;

      if (isLogin) {
        ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
      } else {
        const redirectUrl = Linking.createURL("/email-confirmed");
        ({ data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { redirectTo: redirectUrl },
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

      Alert.alert("Başarılı", isLogin ? "Giriş başarılı 🎉" : "Kayıt başarılı, e-postanızı doğrulamanız gerekmektedir. E-postanızı kontrol ederek mail adresinizi doğrulayınız!");

      if (isLogin && data?.user) {

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
          router.replace("/(tabs)/profile"); // Hata olursa sadece profile yönlendir
          return;
        }

        const hasMissingFields = !userInfo?.name || !userInfo?.surname || !userInfo?.age ||
          !userInfo?.height || !userInfo?.weight || !userInfo?.description;

        if (hasMissingFields) {
          router.replace("/(tabs)/profile?firstLogin=true");
        } else {
          router.replace("/(tabs)/profile");
        }
      }
    } catch (error) {
      Alert.alert("Hata", translateError(error.message));
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 justify-center items-center bg-gray-100 px-6">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="w-full"
        >
          <ScrollView
            contentContainerStyle={{ justifyContent: "center", alignItems: "center", padding:25 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="w-full bg-white p-6 rounded-lg shadow-lg">
              <Text className="text-2xl font-bold text-center text-green-700 mb-4">
                {isLogin ? "Giriş Yap" : "Kayıt Ol"}
              </Text>

              {/* E-Posta Girişi */}
              <View className="mb-3">
                <Text className="text-gray-700 font-semibold mb-1">E-Posta</Text>
                <TextInput
                  className="border border-gray-300 rounded p-2"
                  placeholder="E-posta adresiniz"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              {/* Şifre Girişi */}
              <View className="mb-3">
                <Text className="text-gray-700 font-semibold mb-1">Şifre</Text>
                <TextInput
                  className="border border-gray-300 rounded p-2"
                  placeholder="Şifreniz"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              {/* Giriş / Kayıt Butonu */}
              <TouchableOpacity className="bg-green-700 p-3 rounded-lg" onPress={handleAuth}>
                <Text className="text-white font-bold text-center">
                  {isLogin ? "Giriş Yap" : "Kayıt Ol"}
                </Text>
              </TouchableOpacity>

              {/* Kayıt / Giriş arasında geçiş */}
              <TouchableOpacity className="mt-4" onPress={() => setIsLogin(!isLogin)}>
                <Text className="text-center text-blue-500">
                  {isLogin ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView >
      </View>
    </TouchableWithoutFeedback>

  );
};
