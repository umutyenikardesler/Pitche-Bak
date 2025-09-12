module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      [
        "react-native-worklets/plugin",
        {
          reanimatedAlias: "react-native-reanimated", // Eski import uyumluluğu
        },
      ],
    ],
  };
};
