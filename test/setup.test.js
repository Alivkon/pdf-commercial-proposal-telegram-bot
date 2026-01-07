// Simple test to verify environment setup
const fs = require('fs');
const path = require('path');

console.log('Testing environment setup...');

// Check if required files exist
const requiredFiles = [
  '.env',
  'package.json',
  'src/index.js',
  'src/prompts/system.txt'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✓ ${file} exists`);
  } else {
    console.log(`✗ ${file} is missing`);
    allFilesExist = false;
  }
});

// Check if required environment variables are set
// Note: We can't load dotenv without npm, so we'll just check if .env file has content
try {
  const envContent = fs.readFileSync('.env', 'utf8');
  if (envContent.includes('TELEGRAM_BOT_TOKEN') && envContent.includes('OPENAI_API_KEY')) {
    console.log('✓ Environment variables are defined in .env file');
  } else {
    console.log('✗ Required environment variables not found in .env file');
    allFilesExist = false;
  }
} catch (err) {
  console.log('✗ Could not read .env file');
  allFilesExist = false;
}

if (allFilesExist) {
  console.log('\n✓ Setup verification passed! You\'re ready to run the bot.');
  console.log('Note: You\'ll need to install dependencies with either:');
  console.log('  - npm install (using npm)');
  console.log('  - yarn install (using yarn)');
  process.exit(0);
} else {
  console.log('\n✗ Setup verification failed. Please check the issues above.');
  process.exit(1);
}