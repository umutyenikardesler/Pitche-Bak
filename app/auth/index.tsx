import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from '@/services/supabase';
import { Ionicons } from '@expo/vector-icons';
import '@/global.css';

export default function AuthScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true); // Giriş / Kayıt değişimi

  // Kullanıcı giriş ve kayıt işlemi
  const handleAuth = async () => {
    if (!email || !password) return Alert.alert("Hata", "Lütfen tüm alanları doldurun.");
    
    try {
      let response;
      if (isLogin) {
        response = await supabase.auth.signInWithPassword({ email, password });
      } else {
        response = await supabase.auth.signUp({ email, password });
      }

      if (response.error) throw response.error;
      Alert.alert("Başarılı", isLogin ? "Giriş başarılı!" : "Kayıt başarılı, e-posta doğrulama gerekli.");
      if (isLogin) router.push("/"); // Ana sayfaya yönlendirme
    } catch (error) {
      Alert.alert("Hata", error.message);
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
