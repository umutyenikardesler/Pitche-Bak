const { execSync } = require('child_process');
const path = require('path');

const arg = process.argv[2];
if (arg === 'dev' || arg === 'prod') {
  process.env.APP_VARIANT = arg;
}

const scriptsDir = __dirname;

function run(scriptName) {
  const scriptPath = path.join(scriptsDir, scriptName);
  execSync(`node "${scriptPath}"`, {
    stdio: 'inherit',
    env: process.env,
  });
}

run('configure-ios-variant.js');
run('configure-android-variant.js');
