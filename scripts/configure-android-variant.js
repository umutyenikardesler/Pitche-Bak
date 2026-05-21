const fs = require('fs');
const path = require('path');

const variant = (process.env.APP_VARIANT || 'prod').toLowerCase();
const isDev = variant === 'dev';

const projectRoot = __dirname ? path.resolve(__dirname, '..') : process.cwd();
const buildGradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle');
const stringsPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
const manifestPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const settingsGradlePath = path.join(projectRoot, 'android', 'settings.gradle');

const appName = isDev ? 'SahayaBak Dev' : 'SahayaBak';
const applicationId = isDev
  ? 'com.tumurelsedrakiney.pitchebak.dev'
  : 'com.tumurelsedrakiney.pitchebak';
const namespace = 'com.tumurelsedrakiney.pitchebak';
const scheme = isDev ? 'myapp-dev' : 'myapp';

function replaceOrThrow(content, pattern, replacement, label) {
  if (!pattern.test(content)) {
    throw new Error(`Could not update ${label}`);
  }
  return content.replace(pattern, replacement);
}

function updateBuildGradle() {
  let content = fs.readFileSync(buildGradlePath, 'utf8');

  content = replaceOrThrow(
    content,
    /namespace '[^']+'/,
    `namespace '${namespace}'`,
    'namespace'
  );

  content = replaceOrThrow(
    content,
    /applicationId '[^']+'/,
    `applicationId '${applicationId}'`,
    'applicationId'
  );

  fs.writeFileSync(buildGradlePath, content, 'utf8');
}

function updateStrings() {
  let content = fs.readFileSync(stringsPath, 'utf8');

  content = replaceOrThrow(
    content,
    /(<string name="app_name">)(.*?)(<\/string>)/,
    `$1${appName}$3`,
    'app_name'
  );

  fs.writeFileSync(stringsPath, content, 'utf8');
}

function updateManifest() {
  let content = fs.readFileSync(manifestPath, 'utf8');

  content = content.replace(
    /<data android:scheme="myapp(-dev)?"\/>/g,
    ''
  );

  content = replaceOrThrow(
    content,
    /(<data android:scheme="exp\+pitche-bak"\/>)/,
    `<data android:scheme="${scheme}"/>\n        $1`,
    'android:scheme'
  );

  fs.writeFileSync(manifestPath, content, 'utf8');
}

function updateSettingsGradle() {
  let content = fs.readFileSync(settingsGradlePath, 'utf8');

  content = replaceOrThrow(
    content,
    /rootProject\.name = '[^']+'/,
    `rootProject.name = '${appName}'`,
    'rootProject.name'
  );

  fs.writeFileSync(settingsGradlePath, content, 'utf8');
}

function main() {
  if (!fs.existsSync(buildGradlePath)) {
    console.log('Android native project not found, skipping variant configuration.');
    return;
  }

  updateBuildGradle();
  updateStrings();
  updateManifest();
  updateSettingsGradle();

  console.log(`Configured Android variant: ${variant}`);
  console.log(`App name: ${appName}`);
  console.log(`Application ID: ${applicationId}`);
  console.log(`Scheme: ${scheme}`);
}

main();
