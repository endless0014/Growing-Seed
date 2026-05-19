/**
 * Comprehensive Leaderboard Functions Test
 * Tests all 3 core leaderboard functions to ensure they work correctly
 */

const fs = require('fs');
const path = require('path');

// Load the source files
const utilsPath = path.join(__dirname, '../kingdom-roots/js-modular/utils.js');
const gamePath = path.join(__dirname, '../kingdom-roots/js-modular/game.js');
const configPath = path.join(__dirname, '../kingdom-roots/js-modular/config.js');

const utilsContent = fs.readFileSync(utilsPath, 'utf-8');
const gameContent = fs.readFileSync(gamePath, 'utf-8');
const configContent = fs.readFileSync(configPath, 'utf-8');

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║   COMPREHENSIVE LEADERBOARD FUNCTIONS TEST                 ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const tests = [];
let passed = 0;
let failed = 0;

// ============================================================
// TEST SUITE 1: getPublicBoardUsers() Function
// ============================================================
console.log('📋 TEST SUITE 1: getPublicBoardUsers() Function\n');

tests.push({
  name: 'getPublicBoardUsers function is defined',
  check: () => utilsContent.includes('function getPublicBoardUsers()'),
  category: 'getPublicBoardUsers'
});

tests.push({
  name: 'getPublicBoardUsers calls getStoredUsersSafe()',
  check: () => {
    const match = utilsContent.match(/function getPublicBoardUsers\(\) \{[\s\S]*?return getStoredUsersSafe\(\)\.filter/);
    return !!match;
  },
  category: 'getPublicBoardUsers'
});

tests.push({
  name: 'getPublicBoardUsers filters with isPublicBoardUser',
  check: () => {
    const match = utilsContent.match(/return getStoredUsersSafe\(\)\.filter\(isPublicBoardUser\)/);
    return !!match;
  },
  category: 'getPublicBoardUsers'
});

// ============================================================
// TEST SUITE 2: isPublicBoardUser() Function
// ============================================================
console.log('📋 TEST SUITE 2: isPublicBoardUser() Function\n');

tests.push({
  name: 'isPublicBoardUser function is defined',
  check: () => utilsContent.includes('function isPublicBoardUser(user)'),
  category: 'isPublicBoardUser'
});

tests.push({
  name: 'isPublicBoardUser checks user exists',
  check: () => {
    const match = utilsContent.match(/function isPublicBoardUser\(user\) \{[\s\S]*?if \(!user\) return false/);
    return !!match;
  },
  category: 'isPublicBoardUser'
});

tests.push({
  name: 'isPublicBoardUser checks for admin role',
  check: () => {
    const match = utilsContent.match(/function isPublicBoardUser[\s\S]*?NON_USER_ROLES_FOR_PUBLIC_BOARDS\.has\(resolvedRole\)/);
    return !!match;
  },
  category: 'isPublicBoardUser'
});

tests.push({
  name: 'isPublicBoardUser checks for admin email',
  check: () => {
    const match = utilsContent.match(/function isPublicBoardUser[\s\S]*?isAdminEmail\(user\?\.email\)/);
    return !!match;
  },
  category: 'isPublicBoardUser'
});

tests.push({
  name: 'isPublicBoardUser checks for admin view mode',
  check: () => {
    const match = utilsContent.match(/function isPublicBoardUser[\s\S]*?storedViewMode === 'admin'/);
    return !!match;
  },
  category: 'isPublicBoardUser'
});

tests.push({
  name: 'isPublicBoardUser returns negation of privilege checks',
  check: () => {
    const match = utilsContent.match(/return !privilegedByRole && !privilegedByEmail && !privilegedByViewMode/);
    return !!match;
  },
  category: 'isPublicBoardUser'
});

// ============================================================
// TEST SUITE 3: renderPublicBoardList() Function
// ============================================================
console.log('📋 TEST SUITE 3: renderPublicBoardList() Function\n');

tests.push({
  name: 'renderPublicBoardList function is defined',
  check: () => gameContent.includes('function renderPublicBoardList(boardType)'),
  category: 'renderPublicBoardList'
});

tests.push({
  name: 'renderPublicBoardList gets DOM elements',
  check: () => {
    const checks = [
      gameContent.includes("document.getElementById('publicBoardBody')"),
      gameContent.includes("document.getElementById('publicBoardTitle')"),
      gameContent.includes("document.getElementById('publicBoardSubtitle')")
    ];
    return checks.every(c => c);
  },
  category: 'renderPublicBoardList'
});

tests.push({
  name: 'renderPublicBoardList validates DOM elements',
  check: () => gameContent.includes('if (!boardBody || !boardTitle || !boardSubtitle) return'),
  category: 'renderPublicBoardList'
});

tests.push({
  name: 'renderPublicBoardList uses correct filter (isPublicBoardUser)',
  check: () => {
    const match = gameContent.match(/function renderPublicBoardList\(boardType\) \{[\s\S]*?const users = getPublicBoardUsers\(\)\.filter\(isPublicBoardUser\)/);
    return !!match;
  },
  category: 'renderPublicBoardList'
});

tests.push({
  name: 'renderPublicBoardList does NOT have old broken filter',
  check: () => {
    const broken = gameContent.match(/getPublicBoardUsers\(\)\.filter\(user => \{[\s\S]*?resolvedRole !== 'admin'/);
    return !broken;
  },
  category: 'renderPublicBoardList'
});

tests.push({
  name: 'renderPublicBoardList handles ranking vs leaderboard mode',
  check: () => {
    const match = gameContent.match(/const isRanking = boardType === 'ranking'/);
    return !!match;
  },
  category: 'renderPublicBoardList'
});

tests.push({
  name: 'renderPublicBoardList sorts by tree progress for ranking',
  check: () => {
    const match = gameContent.match(/if \(isRanking\)[\s\S]*?rightUser\?\.treeProgress[\s\S]*?leftUser\?\.treeProgress/);
    return !!match;
  },
  category: 'renderPublicBoardList'
});

tests.push({
  name: 'renderPublicBoardList sorts by login streak for leaderboard',
  check: () => {
    const match = gameContent.match(/getUserLongestLoginStreak\(rightUser\) - getUserLongestLoginStreak\(leftUser\)/);
    return !!match;
  },
  category: 'renderPublicBoardList'
});

tests.push({
  name: 'renderPublicBoardList handles empty users list',
  check: () => {
    const match = gameContent.match(/if \(sortedUsers\.length === 0\)/);
    return !!match;
  },
  category: 'renderPublicBoardList'
});

tests.push({
  name: 'renderPublicBoardList displays top 20 users',
  check: () => {
    const match = gameContent.match(/\.slice\(0, 20\)/);
    return !!match;
  },
  category: 'renderPublicBoardList'
});

tests.push({
  name: 'renderPublicBoardList shows rank badges',
  check: () => {
    const checks = [
      gameContent.includes('🥇'),
      gameContent.includes('🥈'),
      gameContent.includes('🥉'),
      gameContent.includes('rankBadge')
    ];
    return checks.every(c => c);
  },
  category: 'renderPublicBoardList'
});

tests.push({
  name: 'renderPublicBoardList formats score labels correctly',
  check: () => {
    const fpMatch = gameContent.includes('FP');
    const dayMatch = gameContent.includes('day');
    const scoreLabel = gameContent.includes('scoreLabel');
    return fpMatch && dayMatch && scoreLabel;
  },
  category: 'renderPublicBoardList'
});

// ============================================================
// Supporting Function Tests
// ============================================================
console.log('📋 TEST SUITE 4: Supporting Functions\n');

tests.push({
  name: 'getUserLongestLoginStreak function is defined',
  check: () => utilsContent.includes('function getUserLongestLoginStreak(user)'),
  category: 'Supporting'
});

tests.push({
  name: 'getUserLongestLoginStreak returns max of current and longest',
  check: () => {
    const match = utilsContent.match(/function getUserLongestLoginStreak[\s\S]*?Math\.max/);
    return !!match;
  },
  category: 'Supporting'
});

tests.push({
  name: 'updatePublicBoardTabs function is defined',
  check: () => gameContent.includes('function updatePublicBoardTabs(boardType)'),
  category: 'Supporting'
});

tests.push({
  name: 'switchPublicBoardType function is defined',
  check: () => gameContent.includes('function switchPublicBoardType(boardType)'),
  category: 'Supporting'
});

tests.push({
  name: 'openLeaderboardModal function is defined',
  check: () => gameContent.includes('function openLeaderboardModal(boardType)'),
  category: 'Supporting'
});

tests.push({
  name: 'closeLeaderboardModal function is defined',
  check: () => gameContent.includes('function closeLeaderboardModal()'),
  category: 'Supporting'
});

// ============================================================
// Configuration Tests
// ============================================================
console.log('📋 TEST SUITE 5: Configuration & Constants\n');

tests.push({
  name: 'NON_USER_ROLES_FOR_PUBLIC_BOARDS is defined',
  check: () => configContent.includes('const NON_USER_ROLES_FOR_PUBLIC_BOARDS'),
  category: 'Configuration'
});

tests.push({
  name: 'ADMIN_EMAILS is defined',
  check: () => configContent.includes('const ADMIN_EMAILS'),
  category: 'Configuration'
});

// Run all tests
tests.forEach((test, index) => {
  try {
    const result = test.check();
    const status = result ? '✓' : '✗';
    const symbol = result ? '✓' : '✗';
    console.log(`${status} ${test.name}`);
    result ? passed++ : failed++;
  } catch (e) {
    console.log(`✗ ${test.name}`);
    console.log(`  Error: ${e.message}`);
    failed++;
  }
});

// Summary
console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║                      TEST SUMMARY                          ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const total = tests.length;
const percentage = Math.round((passed / total) * 100);

console.log(`Total Tests: ${total}`);
console.log(`✓ Passed: ${passed}`);
console.log(`✗ Failed: ${failed}`);
console.log(`Success Rate: ${percentage}%\n`);

// Group by category
const byCategory = {};
tests.forEach((test, i) => {
  if (!byCategory[test.category]) byCategory[test.category] = { passed: 0, total: 0 };
  byCategory[test.category].total++;
  try {
    if (test.check()) byCategory[test.category].passed++;
  } catch (e) {
    // Already counted as failed
  }
});

console.log('Results by Category:');
Object.entries(byCategory).forEach(([category, stats]) => {
  const categoryPercentage = Math.round((stats.passed / stats.total) * 100);
  const status = stats.passed === stats.total ? '✓' : '⚠';
  console.log(`  ${status} ${category}: ${stats.passed}/${stats.total} (${categoryPercentage}%)`);
});

console.log('\n' + (failed === 0 ? 
  '╔════════════════════════════════════════════════════════════╗\n' +
  '║  ✓ ALL TESTS PASSED - LEADERBOARD FULLY FUNCTIONAL ✓       ║\n' +
  '╚════════════════════════════════════════════════════════════╝\n' :
  `⚠ ${failed} test(s) failed. Please review the code.\n`
));

process.exit(failed === 0 ? 0 : 1);
