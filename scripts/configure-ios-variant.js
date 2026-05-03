const fs = require('fs');
const path = require('path');

const variant = (process.env.APP_VARIANT || 'prod').toLowerCase();
const isDev = variant === 'dev';

const projectRoot = __dirname ? path.resolve(__dirname, '..') : process.cwd();
const infoPlistPath = path.join(projectRoot, 'ios', 'SahayaBak', 'Info.plist');
const pbxprojPath = path.join(projectRoot, 'ios', 'SahayaBak.xcodeproj', 'project.pbxproj');

const displayName = isDev ? 'SahayaBak Dev' : 'SahayaBak';
const bundleId = isDev
  ? 'com.tumurelsedrakiney.PitcheBak.dev'
  : 'com.tumurelsedrakiney.PitcheBak';

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

function main() {
  if (!fs.existsSync(infoPlistPath) || !fs.existsSync(pbxprojPath)) {
    console.log('iOS native project not found, skipping variant configuration.');
    return;
  }

  updateInfoPlist();
  updateProjectFile();

  console.log(`Configured iOS variant: ${variant}`);
  console.log(`Display name: ${displayName}`);
  console.log(`Bundle ID: ${bundleId}`);
}

main();
