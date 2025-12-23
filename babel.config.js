module.exports = function (api) {
  api.cache(true);
  return {
    // NativeWind v4 (react-native-css-interop) preset'tir.
    // jsxImportSource'u manuel set etmeyin; NativeWind preset'i bunu "react-native-css-interop" olarak ayarlar.
    // Ayrıca Reanimated v4 için worklets plugin'i bu preset'in içinde geliyor.
    presets: ["babel-preset-expo", "nativewind/babel"],
    plugins: [],
  };
};
