const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname)

// Bazı platformlarda Metro asset uzantılarını case-sensitive ele alabiliyor.
// Repo'daki screenshot dosyaları .PNG olduğu için bunu asset listesine ekliyoruz.
config.resolver.assetExts = Array.from(new Set([...(config.resolver.assetExts || []), 'PNG']));

module.exports = withNativeWind(config, { input: './global.css' })