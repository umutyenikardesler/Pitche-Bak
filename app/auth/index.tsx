import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/services/supabase";
import * as Linking from "expo-linking";

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
    };

    return translations[errorMessage] || "Bilinmeyen bir hata oluştu.";
  };

  const handleAuth = async () => {
    if (!email || !password) {
      return Alert.alert("Hata", "Lütfen tüm alanları doldurun.");
    }

    try {
      let response;

      if (isLogin) {
        response = await supabase.auth.signInWithPassword({ email, password });
      } else {
        const redirectUrl = Linking.createURL("/");
        response = await supabase.auth.signUp({
          email,
          password,
          options: { redirectTo: redirectUrl },
        });

        if (!response.error) {
          const { data: user } = response;
          if (user?.user) {
            const { error: insertError } = await supabase.from("users").insert([
              {
                id: user.user.id,
                email: user.user.email,
                name: "Yeni Kullanıcı",
                surname: "",
                created_at: new Date(),
              },
            ]);

            if (insertError) {
              console.error("Kullanıcı bilgileri eklenirken hata oluştu:", insertError.message);
            }
          }
        }
      }

      if (response.error) throw response.error;

      Alert.alert("Başarılı", isLogin ? "Giriş başarılı!" : "Kayıt başarılı, e-posta doğrulama gerekli.");
      
      if (isLogin) router.replace("/(tabs)/profile?firstLogin=true");
    } catch (error) {
      Alert.alert("Hata", translateError(error.message));
    }
  };

  return (
    <View className="flex-1 justify-center items-center bg-gray-100 px-6">
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
    </View>
  );
}
