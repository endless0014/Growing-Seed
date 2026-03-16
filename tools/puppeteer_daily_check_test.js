const puppeteer = require('puppeteer');
const HOST = 'http://127.0.0.1:8001/';

function dateKeyForOffset(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

(async () => {
  const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.text()));

  // Prepare a sample legacy user with password so handleLogin can use legacy fallback
  const sampleUser = {
    id: Date.now(),
    name: 'Puppeteer Test',
    email: 'puppet@test.local',
    password: 'pass123',
    role: 'user',
    viewMode: 'user',
    joinedDate: new Date().toLocaleDateString(),
    lastLogin: '',
    lastLoginDateKey: dateKeyForOffset(-1), // yesterday so login increments
    loginStreakCurrent: 1,
    loginStreakLongest: 1,
    lastActiveAt: Date.now(),
    faithPoints: 0,
    treeProgress: 0,
    passiveRate: 1,
    taskCompletions: {},
    dailyLoginState: { streakDay: 1, lastClaimDate: '', cycleStartDate: '', claimedDays: [] }
  };

  await page.goto(HOST, { waitUntil: 'networkidle2' });
  // inject users into localStorage before app initializes fully
  await page.evaluate((u) => {
    localStorage.setItem('users', JSON.stringify([u]));
    localStorage.removeItem('currentUser');
  }, sampleUser);

  // reload to pick up localStorage
  await page.goto(HOST, { waitUntil: 'networkidle2' });

  // wait for login form
  await page.waitForSelector('#loginForm');

  // Fill login form and submit
  await page.type('#loginEmail', sampleUser.email, {delay: 20});
  await page.type('#loginPassword', sampleUser.password, {delay: 20});
  await Promise.all([
    page.click('#loginForm button[type=submit]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(()=>{})
  ]);

  // give app time to process
  await new Promise(r => setTimeout(r, 1000));

  // Read back currentUser from localStorage
  const afterLogin = await page.evaluate(() => ({ currentUser: JSON.parse(localStorage.getItem('currentUser') || '{}'), dailyLoginState: window.dailyLoginState, taskCompletions: window.taskCompletions }));
  console.log('After login snapshot:', afterLogin.currentUser ? { loginStreakCurrent: afterLogin.currentUser.loginStreakCurrent, lastLoginDateKey: afterLogin.currentUser.lastLoginDateKey } : null);

  // Check that login streak incremented (from 1 -> 2)
  const streakAfterLogin = Number(afterLogin.currentUser.loginStreakCurrent || 0);

  // Now call renderDailyLoginCalendar and attempt to claim day 1 (check-in)
  await page.evaluate(() => {
    if (typeof renderDailyLoginCalendar === 'function') renderDailyLoginCalendar();
  });
  await new Promise(r => setTimeout(r, 400));

  // (no debug logging)

  // Click Day 1 tile if enabled
  const claimResult = await page.evaluate(async () => {
    const tile = document.querySelector('.daily-login-tile[data-day="1"]');
    if (!tile) return { ok: false, reason: 'no-tile' };
    if (tile.disabled || tile.getAttribute('disabled') !== null) return { ok: false, reason: 'disabled' };
    // trigger click
    tile.click();
    // allow app to process
    await new Promise(r => setTimeout(r, 600));
    return { ok: true, dailyLoginState: window.dailyLoginState, currentUser: JSON.parse(localStorage.getItem('currentUser') || '{}') };
  });

  console.log('Claim attempt result:', claimResult);

  // verify that login streak not affected by daily checkin
  const finalUser = claimResult.currentUser || afterLogin.currentUser;
  console.log('Final loginStreakCurrent:', finalUser.loginStreakCurrent);

  // Now simulate missed day: update stored currentUser.dailyLoginState.lastClaimDate
  // then rehydrate in-page state and refresh the calendar behavior
  await page.evaluate((dk) => {
    try {
      const curRaw = localStorage.getItem('currentUser');
      if (curRaw) {
        const parsed = JSON.parse(curRaw);
        parsed.dailyLoginState = parsed.dailyLoginState || {};
        parsed.dailyLoginState.lastClaimDate = dk;
        localStorage.setItem('currentUser', JSON.stringify(parsed));
        // Rehydrate in-page currentUser and state
        try {
          currentUser = JSON.parse(localStorage.getItem('currentUser'));
        } catch (e) {
          // ignore
        }
        if (typeof loadUserData === 'function') loadUserData();
        if (typeof updateDisplay === 'function') updateDisplay({ persist: false });
        if (typeof renderDailyLoginCalendar === 'function') renderDailyLoginCalendar();
      }
    } catch (e) {
      // no-op
    }
  }, dateKeyForOffset(-2));
  await new Promise(r => setTimeout(r, 400));
  const afterMissed = await page.evaluate(() => {
    const cur = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return { currentUser: cur, dailyLoginState: cur.dailyLoginState };
  });
  console.log('After missed-day simulation:', afterMissed.dailyLoginState);

  await browser.close();

  // Assertions for summary
  const passed = {
    streakIncrementedOnLogin: streakAfterLogin >= 2,
    claimPerformed: claimResult.ok === true,
    streakUnaffectedByClaim: Number(finalUser.loginStreakCurrent) === streakAfterLogin,
    checkinResetOnMissed: Array.isArray(afterMissed.dailyLoginState.claimedDays) && afterMissed.dailyLoginState.claimedDays.length === 0
  };
  console.log('TEST SUMMARY:', passed);
  process.exit(passed.streakIncrementedOnLogin && passed.claimPerformed && passed.streakUnaffectedByClaim && passed.checkinResetOnMissed ? 0 : 2);
})();