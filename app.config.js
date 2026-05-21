const base = require('./app.json').expo;

const variant = (process.env.APP_VARIANT || 'prod').toLowerCase();
const isDev = variant === 'dev';
const devName = 'SahayaBak Dev';
const devScheme = 'myapp-dev';
const devIosBundleIdentifier = 'com.tumurelsedrakiney.PitcheBak.dev';
const devAndroidPackage = 'com.tumurelsedrakiney.pitchebak.dev';

module.exports = () => ({
  ...base,
  name: isDev ? devName : 'SahayaBak',
  scheme: isDev ? devScheme : base.scheme,
  ios: {
    ...base.ios,
    bundleIdentifier: isDev
      ? devIosBundleIdentifier
      : 'com.tumurelsedrakiney.PitcheBak',
    infoPlist: {
      ...(base.ios?.infoPlist || {}),
      CFBundleDisplayName: isDev ? devName : 'SahayaBak',
      UIBackgroundModes: ['remote-notification'],
    },
  },
  android: {
    ...base.android,
    label: isDev ? devName : 'SahayaBak',
    package: isDev
      ? devAndroidPackage
      : 'com.tumurelsedrakiney.pitchebak',
  },
  extra: {
    ...(base.extra || {}),
    appVariant: variant,
  },
});

