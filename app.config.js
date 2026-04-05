// Dynamic Expo config to support multiple app variants (dev/prod).
// Usage: set APP_VARIANT=dev in EAS build profile.
const base = require("./app.json").expo;

const variant = (process.env.APP_VARIANT || "prod").toLowerCase();
const isDev = variant === "dev";

const DEV_NAME = "SahayaBak Dev";
const DEV_SCHEME = "myapp-dev";
const DEV_IOS_BUNDLE = "com.tumurelsedrakiney.PitcheBak.dev";
const DEV_ANDROID_PACKAGE = "com.tumurelsedrakiney.pitchebak.dev";

module.exports = () => {
  const name = isDev ? DEV_NAME : base.name;
  const scheme = isDev ? DEV_SCHEME : base.scheme;

  const plugins = Array.isArray(base.plugins) ? base.plugins : [];
  const hasBuildProps = plugins.some((p) => (Array.isArray(p) ? p[0] : p) === "expo-build-properties");

  return {
    ...base,
    name,
    scheme,
    plugins: hasBuildProps ? plugins : [...plugins, "expo-build-properties"],
    ios: {
      ...base.ios,
      bundleIdentifier: isDev ? DEV_IOS_BUNDLE : base.ios?.bundleIdentifier,
      infoPlist: {
        ...(base.ios?.infoPlist || {}),
        CFBundleDisplayName: isDev ? DEV_NAME : (base.ios?.infoPlist?.CFBundleDisplayName || base.name),
      },
    },
    android: {
      ...base.android,
      package: isDev ? DEV_ANDROID_PACKAGE : base.android?.package,
      label: isDev ? DEV_NAME : base.android?.label,
    },
    extra: {
      ...(base.extra || {}),
      appVariant: variant,
    },
  };
};

