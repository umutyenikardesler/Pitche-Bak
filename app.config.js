const base = require('./app.json').expo;

const variant = (process.env.APP_VARIANT || 'prod').toLowerCase();
const isDev = variant === 'dev';

module.exports = () => ({
  ...base,
  name: isDev ? 'SahayaBak Dev' : 'SahayaBak',
  ios: {
    ...base.ios,
    bundleIdentifier: isDev
      ? 'com.tumurelsedrakiney.PitcheBak.dev'
      : 'com.tumurelsedrakiney.PitcheBak',
    infoPlist: {
      ...(base.ios?.infoPlist || {}),
      CFBundleDisplayName: isDev ? 'SahayaBak Dev' : 'SahayaBak',
    },
  },
  android: {
    ...base.android,
    label: isDev ? 'SahayaBak Dev' : 'SahayaBak',
    package: isDev
      ? 'com.tumurelsedrakiney.pitchebak.dev'
      : 'com.tumurelsedrakiney.pitchebak',
  },
  extra: {
    ...(base.extra || {}),
    appVariant: variant,
  },
});

