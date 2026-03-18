const puppeteer = require('puppeteer');

(async () => {
  // Load the local web app directly to avoid the root redirect to GitHub Pages
  const url = 'http://127.0.0.1:8001/kingdom-roots/index.html';
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const pageConsoleLogs = [];
  page.on('console', msg => {
    try {
      pageConsoleLogs.push({ type: msg.type(), text: msg.text() });
    } catch (e) {}
    try { console.log('PAGE:', msg.text()); } catch (e) {}
  });

  // Prepare a test user
  const testUser = {
    id: 999900,
    email: 'puppeteer.faith@test',
    name: 'Puppeteer Faith',
    password: 'x',
    faithPoints: Number(process.env.INITIAL_FP || 0),
    treeProgress: 0,
    taskCompletions: {},
    dailyLoginState: {},
    lastActiveAt: Date.now(),
    updatedAt: Date.now()
  };

  await page.goto(url, { waitUntil: 'networkidle2' });

  // Seed localStorage with the test user and set a flag to disable cloud sync during tests
  await page.evaluate(user => {
    // Do NOT disable cloud sync here; allow cloud sync to run so we can test server interactions
    localStorage.setItem('users', JSON.stringify([user]));
    localStorage.setItem('currentUser', JSON.stringify(user));
  }, testUser);

  await page.reload({ waitUntil: 'networkidle2' });

  // Wait for app to initialize
  await page.waitForSelector('#faithPoints');
  // Ensure the app has exposed `saveUserData` and hydrated session
  await page.waitForFunction(() => typeof window.saveUserData === 'function' && !!localStorage.getItem('currentUser'));

  // Fetch and log the loaded script sources and a short preview of their contents
  try {
    const loadedScripts = await page.evaluate(async () => {
      const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.getAttribute('src'));
      const out = [];
      for (const src of scripts) {
        try {
          const resp = await fetch(src, { cache: 'no-store' });
          const txt = await resp.text();
          out.push({ src, ok: resp.ok, length: txt.length, preview: txt.slice(0, 800) });
        } catch (e) {
          out.push({ src, ok: false, error: String(e) });
        }
      }
      return out;
    });
    console.log('LOADED_SCRIPTS', JSON.stringify(loadedScripts));
  } catch (e) {
    console.log('LOADED_SCRIPTS_ERROR', String(e));
  }

  const tasks = ['pray', 'bible', 'devotion', 'smallgroup', 'attendService'];
  const results = {};

  for (const taskKey of tasks) {
    const prevPersist = await page.evaluate(() => Number(localStorage.getItem('lastPersistAt') || 0));

    const res = await page.evaluate(async (taskKey) => {
      // Ensure functions exist
      if (typeof canCompleteTask !== 'function' || typeof markTaskCompleted !== 'function') {
        return { error: 'missing api' };
      }

      const check = canCompleteTask(taskKey);
      if (!check || !check.allowed) {
        return { allowed: false, message: check && check.message };
      }

      const reward = (actionRewards && actionRewards[taskKey]) ? actionRewards[taskKey].fp : 0;
      // Prefer using the app's API to add progress so module-scoped state updates
      try {
        if (typeof applyTreeProgress === 'function') {
          applyTreeProgress(Number(reward || 0));
        } else {
          faithPoints = Number(faithPoints || 0) + Number(reward || 0);
        }
      } catch (e) {
        faithPoints = Number(faithPoints || 0) + Number(reward || 0);
      }
      markTaskCompleted(taskKey, check.periodKey);
      // Ensure the UI reflects the new in-memory state before persisting
      try { if (typeof updateDisplay === 'function') { updateDisplay(); } } catch (e) { /* ignore */ }
      try { if (typeof updateTaskBadges === 'function') { updateTaskBadges(); } } catch (e) { /* ignore */ }
      try { if (typeof window.saveUserData === 'function') { window.saveUserData(); } else if (typeof saveUserData === 'function') { saveUserData(); } } catch (e) { /* ignore */ }

      // Capture immediate stored state for debugging
      const stored = {
        currentUser: JSON.parse(localStorage.getItem('currentUser') || '{}'),
        users: JSON.parse(localStorage.getItem('users') || '[]')
      };

      const fpDom = document.getElementById('faithPoints');
      const buttonId = (taskButtonBindings && taskButtonBindings[taskKey] && taskButtonBindings[taskKey].buttonId) || null;
      const btn = buttonId ? document.getElementById(buttonId) : null;
      const doneClass = btn ? btn.classList.contains('task-done') : null;

      return { allowed: true, reward, fp: Number(fpDom ? fpDom.textContent : faithPoints), doneClass, stored };
    }, taskKey);

    results[taskKey] = res;
    console.log('Completed', taskKey, res);
    // Wait briefly for persistence to be observable via `lastPersistAt`
    try {
      await page.waitForFunction(prev => Number(localStorage.getItem('lastPersistAt') || 0) > prev, { timeout: 8000 }, prevPersist);
    } catch (e) {
      // ignore timestamp timeout; continue to poll actual persisted FP
    }

    // Additionally poll persisted currentUser.faithPoints until it matches DOM value or timeout
    try {
      const expectedFp = await page.evaluate(() => Number(document.getElementById('faithPoints')?.textContent || 0));
      await page.waitForFunction(
        exp => {
          const cur = JSON.parse(localStorage.getItem('currentUser') || '{}');
          return Number(cur.faithPoints || 0) === Number(exp);
        },
        { timeout: 8000 },
        expectedFp
      );
    } catch (e) {
      // ignore if persisted FP doesn't match in time
    }
  }

  // Capture FP after completions (DOM) and stored values in localStorage
  const fpAfter = await page.evaluate(() => document.getElementById('faithPoints').textContent);
  const storedTotals = await page.evaluate(() => {
    const cur = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const myEmail = cur.email;
    const found = users.find(u => u && u.email && u.email === myEmail);
    return {
      currentUserFaithPoints: cur.faithPoints ?? null,
      storedUsersFaithPoints: found ? found.faithPoints : null
    };
  });

  // Capture any durable pre-upsert snapshots the client writes for debugging.
  // Poll localStorage for up to 15s to allow client code time to write the snapshots.
  const preUpsertSnapshots = await page.evaluate(async () => {
    const key = '__debug_pre_upsert_snapshots';
    const timeoutMs = 15000;
    const pollInterval = 200;
    const start = Date.now();
    while (Date.now() - start <timeoutMs) {
      try {
        const raw = localStorage.getItem(key) || '[]';
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) return arr;
      } catch (e) {
        // ignore parse errors and continue polling
      }
      await new Promise(r => setTimeout(r, pollInterval));
    }
    // final attempt, return whatever is present (possibly empty)
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
  });

  // Also attempt to read a DOM mirror if the client wrote one (avoids localStorage race).
  const domPreUpsertMirror = await page.evaluate(() => {
    try {
      return document.getElementById('__debug_pre_upsert_dom')?.textContent || null;
    } catch (e) { return null; }
  });

  // Also capture the last snapshot exported to window by instrumentation (if present)
  const windowPreUpsert = await page.evaluate(() => {
    try { return window.__LAST_PRE_UPSERT_SNAPSHOT || null; } catch (e) { return null; }
  });

  // Simulate next day by setting stored task completions to an old key
  await page.evaluate(() => {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const cur = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const oldKey = '1970-1-1';
    const taskKeys = Object.keys(taskRecurrenceRules || {});
    taskKeys.forEach(k => {
      if (cur) cur.taskCompletions = cur.taskCompletions || {};
      if (users && users[0]) users[0].taskCompletions = users[0].taskCompletions || {};
      if (cur) cur.taskCompletions[k] = oldKey;
      if (users && users[0]) users[0].taskCompletions[k] = oldKey;
    });
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify(cur));
  });

  await page.reload({ waitUntil: 'networkidle2' });
  // Ensure cloud sync is active after reload if available
  try { await page.evaluate(() => { if (typeof startCurrentUserCloudSync === 'function') startCurrentUserCloudSync(); }); } catch (e) { }
  await new Promise(res => setTimeout(res, 500));

  // Check task badges after simulated day rollover
  const resetChecks = await page.evaluate(() => {
    const taskKeys = Object.keys(taskRecurrenceRules || {});
    const out = {};
    taskKeys.forEach(k => {
      const binding = (taskButtonBindings && taskButtonBindings[k]) || null;
      const btn = binding ? document.getElementById(binding.buttonId) : null;
      out[k] = { isDone: !!(btn && btn.classList.contains('task-done')), buttonId: binding ? binding.buttonId : null };
    });
    return out;
  });

  console.log('FP after completions (DOM):', fpAfter);
  console.log('Stored totals after completions:', storedTotals);
  console.log('Reset checks after simulated day rollover:', resetChecks);

  // Attempt an Upgrade (open modal + confirm) and record result
  const upgradeResult = await page.evaluate(() => {
    try {
      if (typeof handleUpgradeRootsClick === 'function') handleUpgradeRootsClick();
    } catch (e) {}
    try { if (typeof confirmUpgrade === 'function') confirmUpgrade(); } catch (e) {}
    try { if (typeof saveUserData === 'function') saveUserData(); } catch (e) {}
    return {
      faithPoints: Number(document.getElementById('faithPoints')?.textContent || 0),
      currentUser: JSON.parse(localStorage.getItem('currentUser') || '{}')
    };
  });

  // Claim Daily Login reward (open modal + claim current streak day)
  const dailyLoginResult = await page.evaluate(() => {
    try { if (typeof openDailyLoginModal === 'function') openDailyLoginModal(); } catch (e) {}
    try {
      const day = (typeof dailyLoginState !== 'undefined' && dailyLoginState && dailyLoginState.streakDay) ? dailyLoginState.streakDay : 1;
      if (typeof claimDailyLogin === 'function') claimDailyLogin(Number(day));
    } catch (e) {}
    try { if (typeof saveUserData === 'function') saveUserData(); } catch (e) {}
    return {
      faithPoints: Number(document.getElementById('faithPoints')?.textContent || 0),
      dailyLoginState: (typeof dailyLoginState !== 'undefined') ? dailyLoginState : (JSON.parse(localStorage.getItem('currentUser')||'{}').dailyLoginState || {}) ,
      currentUser: JSON.parse(localStorage.getItem('currentUser') || '{}')
    };
  });

  await browser.close();

  // Print consolidated result to stdout for external parsing
  console.log('RESULT', JSON.stringify({ completed: results, fpAfter, storedTotals, resetChecks, upgradeResult, dailyLoginResult, preUpsertSnapshots, domPreUpsertMirror, windowPreUpsert, pageConsoleLogs }));
  process.exit(0);
})();
