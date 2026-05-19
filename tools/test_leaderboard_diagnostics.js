/**
 * Leaderboard Diagnostics Test
 * 
 * This script tests the leaderboard and ranking functionality
 * Run with: node test_leaderboard_diagnostics.js
 */

const fs = require('fs');
const path = require('path');

// Read the JavaScript files
const gameJsPath = path.join(__dirname, '../kingdom-roots/js-modular/game.js');
const utilsJsPath = path.join(__dirname, '../kingdom-roots/js-modular/utils.js');
const configJsPath = path.join(__dirname, '../kingdom-roots/js-modular/config.js');

const gameJs = fs.readFileSync(gameJsPath, 'utf-8');
const utilsJs = fs.readFileSync(utilsJsPath, 'utf-8');
const configJs = fs.readFileSync(configJsPath, 'utf-8');

// Check for function definitions
const tests = [
  {
    name: 'renderPublicBoardList function exists',
    check: () => gameJs.includes('function renderPublicBoardList(boardType)')
  },
  {
    name: 'getPublicBoardUsers function exists',
    check: () => utilsJs.includes('function getPublicBoardUsers()')
  },
  {
    name: 'isPublicBoardUser function exists',
    check: () => utilsJs.includes('function isPublicBoardUser(user)')
  },
  {
    name: 'getUserLongestLoginStreak function exists',
    check: () => utilsJs.includes('function getUserLongestLoginStreak(user)')
  },
  {
    name: 'NON_USER_ROLES_FOR_PUBLIC_BOARDS defined',
    check: () => configJs.includes('NON_USER_ROLES_FOR_PUBLIC_BOARDS')
  },
  {
    name: 'renderPublicBoardList checks for boardBody element',
    check: () => gameJs.includes("document.getElementById('publicBoardBody')")
  },
  {
    name: 'renderPublicBoardList filters users correctly',
    check: () => {
      const match = gameJs.match(/renderPublicBoardList\(boardType\) \{[\s\S]*?const users = getPublicBoardUsers\(\)\.filter\(/);
      return !!match;
    }
  },
  {
    name: 'renderPublicBoardList handles empty users list',
    check: () => gameJs.includes("if (sortedUsers.length === 0)")
  },
  {
    name: 'Leaderboard modal HTML has required elements',
    check: () => {
      const indexHtml = fs.readFileSync(path.join(__dirname, '../kingdom-roots/index.html'), 'utf-8');
      return indexHtml.includes('id="leaderboardModal"') &&
             indexHtml.includes('id="publicBoardBody"') &&
             indexHtml.includes('id="publicBoardTitle"') &&
             indexHtml.includes('id="publicBoardLeaderboardTab"') &&
             indexHtml.includes('id="publicBoardRankingTab"');
    }
  }
];

console.log('\n=== LEADERBOARD FUNCTIONALITY DIAGNOSTICS ===\n');

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  try {
    const result = test.check();
    const status = result ? '✓ PASS' : '✗ FAIL';
    console.log(`${index + 1}. ${status}: ${test.name}`);
    result ? passed++ : failed++;
  } catch (e) {
    console.log(`${index + 1}. ✗ ERROR: ${test.name}`);
    console.log(`   ${e.message}`);
    failed++;
  }
});

console.log(`\n=== RESULTS ===`);
console.log(`Passed: ${passed}/${tests.length}`);
console.log(`Failed: ${failed}/${tests.length}\n`);

// Additional analysis
console.log('=== CODE ANALYSIS ===\n');

// Check for the double filter issue
const doubleFilterMatch = gameJs.match(/getPublicBoardUsers\(\)\.filter\(user => \{[\s\S]*?const isRanking/);
if (doubleFilterMatch) {
  console.log('⚠ WARNING: Double filtering detected in renderPublicBoardList');
  console.log('  - getPublicBoardUsers() already filters users via isPublicBoardUser()');
  console.log('  - Additional filter in renderPublicBoardList may be redundant\n');
}

// Check for the Android version which has correct filtering
const androidGameJsPath = path.join(__dirname, '../android/app/src/main/assets/public/js-modular/game.js');
if (fs.existsSync(androidGameJsPath)) {
  const androidGameJs = fs.readFileSync(androidGameJsPath, 'utf-8');
  const androidCorrectFilter = androidGameJs.includes('getPublicBoardUsers().filter(isPublicBoardUser)');
  if (androidCorrectFilter) {
    console.log('✓ INFO: Android version uses correct filter pattern');
    console.log('  - Pattern: getPublicBoardUsers().filter(isPublicBoardUser)\n');
  }
}

// Check getUserLongestLoginStreak implementation
const getLongestStreakRegex = /function getUserLongestLoginStreak\(user\) \{([\s\S]*?)\}/;
const getLongestStreakMatch = utilsJs.match(getLongestStreakRegex);
if (getLongestStreakMatch) {
  console.log('✓ getUserLongestLoginStreak implementation found');
  const impl = getLongestStreakMatch[1].trim().substring(0, 100);
  console.log(`  Snippet: ${impl}...\n`);
}

console.log('=== RECOMMENDATIONS ===\n');
console.log('1. Remove the redundant filter in renderPublicBoardList()');
console.log('2. Use consistent filter: getPublicBoardUsers().filter(isPublicBoardUser)');
console.log('3. Add console.log() to debug user list at render time');
console.log('4. Verify localStorage contains users with proper treeProgress and loginStreak fields\n');
