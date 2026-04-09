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
  // Disable cloud sync to avoid Firebase Auth/Firestore interference in tests
  await page.evaluate((u) => {
    localStorage.setItem('TEST_DISABLE_CLOUD_SYNC', '1');
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
  await page.click('#loginForm button[type=submit]');
  // Wait until the app UI shows the main app container (logged-in state)
  await page.waitForSelector('#appContainer', { visible: true, timeout: 10000 });

  // Read back currentUser preferring in-page variable (fallback to localStorage)
  const afterLogin = await page.evaluate(() => {
    const cur = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : JSON.parse(localStorage.getItem('currentUser') || '{}');
    const lastPreUpsert = window.__LAST_PRE_UPSERT_SNAPSHOT || null;
    return { currentUser: cur, lastPreUpsert };
  });
  console.log('After login snapshot:', afterLogin.currentUser ? { loginStreakCurrent: afterLogin.currentUser.loginStreakCurrent, lastLoginDateKey: afterLogin.currentUser.lastLoginDateKey } : null);

  // Check that login streak incremented (from 1 -> 2)
  const streakAfterLogin = Number(afterLogin.currentUser.loginStreakCurrent || 0);

  // Now call renderDailyLoginCalendar and attempt to claim day 1 (check-in)
  await page.evaluate(() => {
    if (typeof renderDailyLoginCalendar === 'function') renderDailyLoginCalendar();
  });
  await new Promise(r => setTimeout(r, 400));

  // (no debug logging)

  // Click Day 1 tile if enabled (perform DOM click from page context, wait for updates from Node)
  let claimResult = { ok: false, reason: 'no-tile' };
  const tileHandle = await page.$('.daily-login-tile[data-day="1"]');
  if (!tileHandle) {
    claimResult = { ok: false, reason: 'no-tile' };
  } else {
    const isDisabled = await page.evaluate((sel) => {
      const t = document.querySelector(sel);
      return !t || t.disabled || t.getAttribute('disabled') !== null;
    }, '.daily-login-tile[data-day="1"]');
    if (isDisabled) {
      claimResult = { ok: false, reason: 'disabled' };
    } else {
      // capture lastPersistAt before clicking so we can wait for a completed persist
      const prevPersist = await page.evaluate(() => Number(localStorage.getItem('lastPersistAt') || '0'));
      await page.evaluate((sel) => { const t = document.querySelector(sel); if (t) t.click(); }, '.daily-login-tile[data-day="1"]');
      // wait for persist to update (or visual change) with a short polling loop
      const maxWait = 8000;
      const pollInterval = 200;
      let elapsed = 0;
      while (elapsed < maxWait) {
        const curPersist = await page.evaluate(() => Number(localStorage.getItem('lastPersistAt') || '0'));
        if (curPersist > prevPersist) break;
        await new Promise(r => setTimeout(r, pollInterval));
        elapsed += pollInterval;
      }
      const currentUser = await page.evaluate(() => (typeof currentUser !== 'undefined' && currentUser) ? currentUser : JSON.parse(localStorage.getItem('currentUser') || '{}'));
      const lastPreUpsert = await page.evaluate(() => window.__LAST_PRE_UPSERT_SNAPSHOT || null);
      const dailyLoginState = (currentUser && currentUser.dailyLoginState) ? currentUser.dailyLoginState : (lastPreUpsert && lastPreUpsert.payload ? lastPreUpsert.payload.dailyLoginState : undefined);
      claimResult = { ok: true, dailyLoginState, currentUser, lastPreUpsert };
    }
  }

  console.log('Claim attempt result:', claimResult);

  // verify that login streak not affected by daily checkin
  const finalUser = claimResult.currentUser || afterLogin.currentUser;
  console.log('Final loginStreakCurrent:', finalUser.loginStreakCurrent);

  // Now simulate missed day: update stored currentUser.dailyLoginState.lastClaimDate
  // then rehydrate in-page state and refresh the calendar behavior
  await page.evaluate((dk) => {
    try {
      let parsed = null;
      const curRaw = localStorage.getItem('currentUser');
      if (curRaw) {
        try { parsed = JSON.parse(curRaw); } catch (e) { parsed = null; }
      }
      if (!parsed && (typeof currentUser !== 'undefined' && currentUser)) {
        try { parsed = JSON.parse(JSON.stringify(currentUser)); } catch (e) { parsed = currentUser; }
      }
      if (parsed) {
        parsed.dailyLoginState = parsed.dailyLoginState || {};
        parsed.dailyLoginState.lastClaimDate = dk;
        localStorage.setItem('currentUser', JSON.stringify(parsed));
        try { currentUser = JSON.parse(localStorage.getItem('currentUser')); } catch (e) { currentUser = parsed; }
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
    const cur = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : JSON.parse(localStorage.getItem('currentUser') || '{}');
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