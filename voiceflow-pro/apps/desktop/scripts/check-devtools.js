#!/usr/bin/env node

/**
 * Script to check if React DevTools extension is properly installed
 * Run this while the Electron app is running
 */

const { session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

console.log('🔍 Checking React DevTools Installation...\n');

// Check Electron extensions directory
const extensionsPath = path.join(
  os.homedir(),
  process.platform === 'darwin'
    ? 'Library/Application Support/Electron/extensions'
    : process.platform === 'win32'
    ? 'AppData/Roaming/Electron/extensions'
    : '.config/Electron/extensions'
);

console.log(`📁 Extensions directory: ${extensionsPath}`);

if (fs.existsSync(extensionsPath)) {
  const extensions = fs.readdirSync(extensionsPath);
  console.log(`✅ Found ${extensions.length} extension(s):`);
  extensions.forEach(ext => {
    console.log(`   - ${ext}`);
    // Check if it's React DevTools
    if (ext.includes('react') || ext.includes('fmkadmapgofadopljbjfkapdkoienihi')) {
      console.log(`      ✨ This looks like React DevTools!`);
    }
  });
} else {
  console.log('❌ Extensions directory does not exist');
}

console.log('\n💡 Next steps:');
console.log('1. Restart the Electron app: npm run dev');
console.log('2. Look for "✅ React DevTools installed" in terminal');
console.log('3. Open DevTools (Cmd+Opt+I) and check for Components tab');
console.log('4. If still not working, try clearing cache:');
console.log(`   rm -rf "${extensionsPath}"`);
