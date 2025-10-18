const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directories to remove
const directoriesToRemove = [
  '.next',
  '.vercel',
  'node_modules/.cache'
];

console.log('Cleaning cache before build...');

// Remove directories
directoriesToRemove.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  
  if (fs.existsSync(dirPath)) {
    console.log(`Removing ${dir}...`);
    try {
      if (process.platform === 'win32') {
        // Use rimraf-like approach for Windows
        execSync(`rmdir /s /q "${dirPath}"`, { stdio: 'inherit' });
      } else {
        // Use rm -rf for Unix-like systems
        execSync(`rm -rf "${dirPath}"`, { stdio: 'inherit' });
      }
      console.log(`✓ Removed ${dir}`);
    } catch (error) {
      console.error(`Error removing ${dir}:`, error.message);
    }
  } else {
    console.log(`✓ ${dir} does not exist, skipping`);
  }
});

console.log('Cache cleaning completed');
