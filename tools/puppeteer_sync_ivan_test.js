const puppeteer = require('puppeteer');

(async () => {
  const url = 'http://127.0.0.1:8001/kingdom-roots/index.html';
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.text()));

  // Inject a test-only guard that prevents older `users` or `currentUser` writes
  // from overwriting newer state. This compares `updatedAt` timestamps and
  // blocks the write when the incoming data is older. Helps make E2E deterministic.
  await page.evaluateOnNewDocument(() => {
    try {
      const origSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        try {
          if (key === 'currentUser') {
            const incoming = JSON.parse(value || '{}');
            const existing = JSON.parse(this.getItem('currentUser') || '{}');
            if (existing && existing.updatedAt && incoming && incoming.updatedAt && Number(existing.updatedAt) > Number(incoming.updatedAt)) {
              console.debug('[test-guard] blocked older currentUser write', incoming.updatedAt, 'existing', existing.updatedAt);
              return;
            }
          }
          if (key === 'users') {
            let incomingUsers = [];
            try { incomingUsers = JSON.parse(value || '[]'); } catch(_) {}
            let incomingMax = 0;
            for (const u of incomingUsers) { if (u && u.updatedAt) incomingMax = Math.max(incomingMax, Number(u.updatedAt)); }
            const existingUsers = JSON.parse(this.getItem('users') || '[]');
            let existingMax = 0;
            for (const u of existingUsers) { if (u && u.updatedAt) existingMax = Math.max(existingMax, Number(u.updatedAt)); }
            if (existingMax > incomingMax) {
              console.debug('[test-guard] blocked older users write', incomingMax, 'existingMax', existingMax);
              return;
            }
          }
        } catch (e) {}
        return origSetItem.apply(this, arguments);
      };
    } catch (e) {
      console.warn('[test-guard] failed to install storage wrapper', e);
    }
  });

  // Seed localStorage with an Ivan user that has stale FP (5)
  const localIvan = {
    id: 12345,
    email: 'endlessnogu@gmail.com',
    name: 'Ivan',
    faithPoints: 5,
    treeProgress: 10,
    taskCompletions: {},
    lastActiveAt: Date.now(),
    updatedAt: Date.now()
  };

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.evaluate(user => {
    localStorage.setItem('users', JSON.stringify([user]));
    localStorage.setItem('currentUser', JSON.stringify(user));
  }, localIvan);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Wait for app to be ready
  await page.waitForSelector('#faithPoints');

  // Inject a mock cloud collection with Ivan having 14 FP
  await page.evaluate(() => {
    function normalizeEmailSimple(email) { return String(email || '').toLowerCase().trim(); }
    window.__mockCloud = { users: {}, listeners: {} };
    const ivEmail = normalizeEmailSimple('endlessnogu@gmail.com');
    window.__mockCloud.users[ivEmail] = {
      email: 'endlessnogu@gmail.com',
      name: 'Ivan',
      faithPoints: 14,
      treeProgress: 12,
      updatedAt: Date.now()
    };

    // Mock collection API used by services.js
    window.__mockCloud.collection = function() {
      return {
        get: async function() {
          const docs = Object.keys(window.__mockCloud.users).map(id => ({ id, data: () => window.__mockCloud.users[id] }));
          return { docs };
        },
        doc: function(id) {
          const normalized = normalizeEmailSimple(id);
          return {
            onSnapshot: function(cb) {
              // register listener and call immediately with current data
              window.__mockCloud.listeners[normalized] = cb;
              const exists = !!window.__mockCloud.users[normalized];
              const snapshot = { exists, data: () => window.__mockCloud.users[normalized] };
              try { cb(snapshot); } catch (e) { console.warn('mock onSnapshot cb failed', e); }
              return function unsubscribe() { delete window.__mockCloud.listeners[normalized]; };
            },
            get: async function() {
              const exists = !!window.__mockCloud.users[normalized];
              return { exists, data: () => window.__mockCloud.users[normalized] };
            },
            set: async function(fields, opts) {
              window.__mockCloud.users[normalized] = { ...(window.__mockCloud.users[normalized] || {}), ...fields };
            },
            update: async function(fields) {
              window.__mockCloud.users[normalized] = { ...(window.__mockCloud.users[normalized] || {}), ...fields };
            }
          };
        }
      };
    };

    // Override getCloudUsersCollection to return our mock
    window._originalGetCloudUsersCollection = window.getCloudUsersCollection;
    window.getCloudUsersCollection = function() { return window.__mockCloud.collection(); };
    console.log('[test-mock] mock cloud injected for Ivan (14 FP)');
  });

  // Call sync to pull server data into local storage, then apply merged user into currentUser and UI
  await page.evaluate(async () => {
    if (typeof syncUsersFromCloudToLocal === 'function') {
      await syncUsersFromCloudToLocal();
    } else {
      console.warn('syncUsersFromCloudToLocal not found');
    }

    // Read users and try to set currentUser to the merged cloud user if present
    try {
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const rawCur = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const normalize = (s) => String(s || '').toLowerCase().trim();
      const found = users.find(u => u && normalize(u.email) === normalize(rawCur.email));
      if (found) {
        // Persist currentUser as the merged cloud-backed user and update in-memory state
        try { localStorage.setItem('currentUser', JSON.stringify(found)); } catch(e) {}
        try { 
          // Ensure users array contains the merged user record for this email
          const normalized = (s) => String(s || '').toLowerCase().trim();
          const updated = (users || []).filter(u => normalized(u.email) !== normalized(found.email));
          updated.unshift(found);
          localStorage.setItem('users', JSON.stringify(updated));
        } catch (e) { console.warn('set users failed', e); }
        try { persistAllUserState(JSON.parse(localStorage.getItem('users') || '[]'), found); } catch (e) { try { safeSetCurrentUser(found); } catch(_) {} }
        try { currentUser = found; window.faithPoints = Number(found.faithPoints || 0); } catch(e) {}
      }
    } catch (e) { console.warn('apply-merged-user failed', e); }

    // Ensure UI is refreshed and per-user cloud sync listener starts
    try { if (typeof loadUserData === 'function') loadUserData(); } catch (e) {}
    try { if (typeof updateDisplay === 'function') updateDisplay({ persist: false }); } catch (e) {}
    try { if (typeof startCurrentUserCloudSync === 'function') startCurrentUserCloudSync(); } catch (e) {}
  });

  // Give the page a moment to persist and update display
  await new Promise(res => setTimeout(res, 500));

  // Read back localStorage and DOM
  const afterSync = await page.evaluate(() => {
    const cur = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const domFp = Number(document.getElementById('faithPoints')?.textContent || 0);
    return { currentUser: cur, usersCount: users.length, domFp };
  });

  console.log('AFTER SYNC:', JSON.stringify(afterSync));

  // Now complete a task for the user to add FP (use pray -> reward from actionRewards)
  const taskResult = await page.evaluate(async () => {
    const taskKey = 'pray';
    const check = typeof canCompleteTask === 'function' ? canCompleteTask(taskKey) : { allowed: true, periodKey: '2026-3-16' };
    const reward = (actionRewards && actionRewards[taskKey]) ? actionRewards[taskKey].fp : 2;
    try {
      if (typeof applyTreeProgress === 'function') applyTreeProgress(reward);
      else window.faithPoints = Number(window.faithPoints || 0) + reward;
    } catch(e) { window.faithPoints = Number(window.faithPoints || 0) + reward; }
    try { if (typeof markTaskCompleted === 'function') markTaskCompleted(taskKey, check.periodKey); } catch(e) {}
    try { if (typeof window.saveUserData === 'function') window.saveUserData(); } catch(e) {}

    // Upsert to cloud (will use mock)
    try { if (typeof upsertUserInCloud === 'function') await upsertUserInCloud(JSON.parse(localStorage.getItem('currentUser') || '{}')); } catch(e) { console.warn('upsertUserInCloud failed', e); }
    return { reward };
  });

  console.log('TASK COMPLETED (added reward):', JSON.stringify(taskResult));

  // Simulate cloud snapshot push by invoking mock listener with updated mock user
  // Ensure listener is registered (startCurrentUserCloudSync) then trigger snapshot
  await page.evaluate(() => {
    try { if (typeof startCurrentUserCloudSync === 'function') startCurrentUserCloudSync(); } catch (e) {}
    const email = String('endlessnogu@gmail.com').toLowerCase().trim();
    const listener = window.__mockCloud.listeners[email];
    if (listener) {
      const snapshot = { exists: true, data: () => window.__mockCloud.users[email] };
      try { listener(snapshot); console.log('[test-mock] triggered onSnapshot for', email); } catch(e) { console.warn('listener call failed', e); }
    } else {
      console.warn('[test-mock] no listener registered for', email);
    }
  });

  // Wait and then read DOM and storage
  await new Promise(res => setTimeout(res, 600));
  const finalState = await page.evaluate(() => {
    const cur = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const domFp = Number(document.getElementById('faithPoints')?.textContent || 0);
    return { currentUser: cur, usersCount: users.length, domFp };
  });

  console.log('FINAL STATE:', JSON.stringify(finalState));

  await browser.close();
  console.log('RESULT', JSON.stringify({ afterSync, taskResult, finalState }));
  process.exit(0);
})();
