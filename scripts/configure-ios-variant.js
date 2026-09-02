const fs = require('fs');
const path = require('path');

const variant = (process.env.APP_VARIANT || 'prod').toLowerCase();
const isDev = variant === 'dev';

const projectRoot = __dirname ? path.resolve(__dirname, '..') : process.cwd();
const infoPlistPath = path.join(projectRoot, 'ios', 'SahayaBak', 'Info.plist');
const pbxprojPath = path.join(projectRoot, 'ios', 'SahayaBak.xcodeproj', 'project.pbxproj');
const entitlementsPath = path.join(projectRoot, 'ios', 'SahayaBak', 'SahayaBak.entitlements');

// Push bildirimleri için APNs ortamı. Bu anahtar imzalanan uygulamada yoksa iOS token
// üretmeyi reddediyor ("aps-environment yetki anahtarı bulunamadı").
// expo-notifications eklentisi bunu yalnızca DOSYADA YOKSA ekliyor; native ios/ klasörü
// repoda izlendiği için o adıma güvenmek yerine varyanta göre burada yazıyoruz.
const apsEnvironment = isDev ? 'development' : 'production';
const displayName = isDev ? 'SahayaBak Dev' : 'SahayaBak';
const bundleId = isDev
  ? 'com.tumurelsedrakiney.PitcheBak.dev'
  : 'com.tumurelsedrakiney.PitcheBak';
const scheme = isDev ? 'myapp-dev' : 'myapp';

function replaceOrThrow(content, pattern, replacement, label) {
  if (!pattern.test(content)) {
    throw new Error(`Could not update ${label}`);
  }
  return content.replace(pattern, replacement);
}

function updateInfoPlist() {
  let content = fs.readFileSync(infoPlistPath, 'utf8');

  content = replaceOrThrow(
    content,
    /(<key>CFBundleDisplayName<\/key>\s*<string>)(.*?)(<\/string>)/s,
    `$1${displayName}$3`,
    'CFBundleDisplayName'
  );

  content = replaceOrThrow(
    content,
    /(<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>)(.*?)(<\/string>\s*<string>)(.*?)(<\/string>\s*<\/array>)/s,
    `$1${scheme}$3${bundleId}$5`,
    'CFBundleURLSchemes'
  );

  fs.writeFileSync(infoPlistPath, content, 'utf8');
}

function updateProjectFile() {
  let content = fs.readFileSync(pbxprojPath, 'utf8');

  const bundlePattern = /PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g;
  if (!bundlePattern.test(content)) {
    throw new Error('Could not update PRODUCT_BUNDLE_IDENTIFIER');
  }

  content = content.replace(bundlePattern, `PRODUCT_BUNDLE_IDENTIFIER = ${bundleId};`);
  fs.writeFileSync(pbxprojPath, content, 'utf8');
}

function updateEntitlements() {
  if (!fs.existsSync(entitlementsPath)) {
    console.log('Entitlements file not found, skipping aps-environment.');
    return;
  }

  let content = fs.readFileSync(entitlementsPath, 'utf8');

  if (/<key>aps-environment<\/key>/.test(content)) {
    content = content.replace(
      /(<key>aps-environment<\/key>\s*<string>)(.*?)(<\/string>)/s,
      `$1${apsEnvironment}$3`
    );
  } else {
    // Sözlüğün açılışına ekle; girinti dosyanın mevcut biçimiyle uyumlu.
    content = replaceOrThrow(
      content,
      /(<dict>\s*\n)/,
      `$1    <key>aps-environment</key>\n    <string>${apsEnvironment}</string>\n`,
      'aps-environment entitlement'
    );
  }

  fs.writeFileSync(entitlementsPath, content, 'utf8');
}

function main() {
  if (!fs.existsSync(infoPlistPath) || !fs.existsSync(pbxprojPath)) {
    console.log('iOS native project not found, skipping variant configuration.');
    return;
  }

  updateInfoPlist();
  updateProjectFile();
  updateEntitlements();

  console.log(`Configured iOS variant: ${variant}`);
  console.log(`Display name: ${displayName}`);
  console.log(`Bundle ID: ${bundleId}`);
  console.log(`Scheme: ${scheme}`);
  console.log(`aps-environment: ${apsEnvironment}`);
}

main();
