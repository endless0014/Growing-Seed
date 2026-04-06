const puppeteer = require('puppeteer');
const HOST = 'http://127.0.0.1:8001/';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.text()));

  const adminUser = {
    id: Date.now(),
    name: 'Puppet Admin',
    email: 'admin@puppet.local',
    password: 'adminpw',
    role: 'admin',
    viewMode: 'admin',
    joinedDate: new Date().toLocaleDateString(),
    lastLogin: '',
    lastLoginDateKey: '',
    lastActiveAt: Date.now(),
    faithPoints: 0,
    treeProgress: 0,
    passiveRate: 1,
    taskCompletions: {},
    dailyLoginState: { streakDay: 1, lastClaimDate: '', cycleStartDate: '', claimedDays: [] }
  };

  try {
    // initialize localStorage and load the app
    await page.goto(HOST, { waitUntil: 'networkidle2' });
    await page.evaluate((u) => {
      localStorage.setItem('users', JSON.stringify([u]));
      localStorage.setItem('currentUser', JSON.stringify(u));
    }, adminUser);
    await page.goto(HOST, { waitUntil: 'networkidle2' });

    // give app a short moment to render admin UI (compatible wait)
    await new Promise(r => setTimeout(r, 600));

    let adminVisible = await page.evaluate(() => {
      const el = document.getElementById('adminDashboard');
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && el.offsetParent !== null;
    });

    if (!adminVisible) {
      // try toggling admin view (profile switch) or rendering dashboard directly
      await page.evaluate(() => {
        try {
          if (typeof toggleAdminView === 'function') toggleAdminView();
          else if (typeof renderAdminDashboard === 'function') renderAdminDashboard(true);
        } catch (e) {}
      });
      await new Promise(r => setTimeout(r, 400));
      adminVisible = await page.evaluate(() => {
        const el = document.getElementById('adminDashboard');
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style && style.display !== 'none' && el.offsetParent !== null;
      });
    }

    // If still not visible, force-set the module-scoped `currentUser` and apply admin view UI
    if (!adminVisible) {
      await page.evaluate((u) => {
        try { currentUser = u; } catch (e) {}
        try { currentUser.viewMode = 'admin'; } catch (e) {}
        try { applyViewModeUI(); } catch (e) {}
        try { saveUserData(); } catch (e) {}
      }, adminUser);
      await new Promise(r => setTimeout(r, 400));
      adminVisible = await page.evaluate(() => {
        const el = document.getElementById('adminDashboard');
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style && style.display !== 'none' && el.offsetParent !== null;
      });
    }

    const adminFuncs = await page.evaluate(() => {
      return Object.keys(window || {}).filter(k => k.startsWith('admin') && typeof window[k] === 'function').sort();
    });

    const selectors = await page.evaluate(() => ({
      adminUsersTableBody: !!document.getElementById('adminUsersTableBody'),
      adminDashboardEl: !!document.getElementById('adminDashboard'),
      adminTable: !!document.querySelector('.admin-table')
    }));

    console.log('ADMIN_DASHBOARD_VISIBLE:', adminVisible);
    console.log('ADMIN_FUNCS:', adminFuncs);
    console.log('ADMIN_UI_SELECTORS_PRESENT:', selectors);

    // Run a few admin actions programmatically (override confirm/prompt)
    const actionsResult = await page.evaluate((id) => {
      const result = { errors: {} };
      try { window.confirm = () => true; } catch (e) { result.errors.confirm = String(e); }
      try { window.prompt = (t, d) => (d || 'changeme123'); } catch (e) { result.errors.prompt = String(e); }
      try { if (typeof adminSetFaithPoints === 'function') adminSetFaithPoints(id, 123); } catch (e) { result.errors.setFaith = String(e); }
      try { if (typeof adminSetTreeProgress === 'function') adminSetTreeProgress(id, 555); } catch (e) { result.errors.setTree = String(e); }
      try { if (typeof adminSetEmail === 'function') adminSetEmail(id, 'admin+new@puppet.local'); } catch (e) { result.errors.setEmail = String(e); }
      try { if (typeof adminSetRealLoginStreak === 'function') adminSetRealLoginStreak(id, 5); } catch (e) { result.errors.setStreak = String(e); }
      try { if (typeof adminResetProgress === 'function') adminResetProgress(id); } catch (e) { result.errors.resetProgress = String(e); }
      // read final user state
      try {
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const u = users.find(x => Number(x.id) === id) || null;
        result.user = u;
      } catch (e) { result.errors.readBack = String(e); }
      return result;
    }, adminUser.id);

    console.log('ADMIN_ACTIONS_RESULT:', JSON.stringify(actionsResult));

    // Additional individual admin flow checks (separate fresh states)
    const extraTests = {};

    // Helper to run a single action with fresh users (admin + target)
    async function runActionWithFreshUsers(actionName, actionFn) {
      const targetId = Date.now() + Math.floor(Math.random() * 1000);
      const targetUser = {
        id: targetId,
        name: `Target ${actionName}`,
        email: `target+${actionName}@puppet.local`,
        password: 'pw',
        role: 'user',
        viewMode: 'user',
        joinedDate: new Date().toLocaleDateString(),
        lastActiveAt: Date.now(),
        faithPoints: 0,
        treeProgress: 0,
        dailyLoginState: { streakDay: 1, lastClaimDate: '', cycleStartDate: '', claimedDays: [] }
      };
      // reset storage
      await page.evaluate((admin, target) => {
        try { localStorage.setItem('users', JSON.stringify([admin, target])); } catch (e) {}
        try { localStorage.setItem('currentUser', JSON.stringify(admin)); } catch (e) {}
        try { currentUser = admin; } catch (e) {}
        try { applyViewModeUI(); } catch (e) {}
      }, adminUser, targetUser);
      // run action
      const res = await actionFn(targetId, targetUser.email);
      // read back target user
      const readBack = await page.evaluate((id) => {
        try { return JSON.parse(localStorage.getItem('users') || '[]').find(u => Number(u.id) === id) || null; } catch (e) { return { __readError: String(e) }; }
      }, targetId);
      return { result: res, user: readBack };
    }

    // adminAddPoints (uses prompt)
    extraTests.addPoints = await runActionWithFreshUsers('addPoints', async (targetId) => {
      return await page.evaluate((id) => {
        try { window.prompt = (t,d) => '7'; window.confirm = () => true; } catch (e) {}
        try { adminAddPoints(id); return { ok: true }; } catch (e) { return { ok: false, err: String(e) }; }
      }, targetId);
    });

    // adminResetPassword (uses prompt)
    extraTests.resetPassword = await runActionWithFreshUsers('resetPassword', async (targetId) => {
      return await page.evaluate((id) => {
        try { window.prompt = (t,d) => 'newpass456'; window.confirm = () => true; } catch (e) {}
        try { return (typeof adminResetPassword === 'function') ? (adminResetPassword(id), { ok: true }) : { ok: false, err: 'no-fn' }; } catch (e) { return { ok: false, err: String(e) }; }
      }, targetId);
    });

    // adminChangeUserRole
    extraTests.changeRole = await runActionWithFreshUsers('changeRole', async (targetId) => {
      return await page.evaluate((id) => {
        try { window.confirm = () => true; } catch (e) {}
        try { adminChangeUserRole(id, 'moderator'); return { ok: true }; } catch (e) { return { ok: false, err: String(e) }; }
      }, targetId);
    });

    // adminDeleteUser
    extraTests.deleteUser = await runActionWithFreshUsers('deleteUser', async (targetId) => {
      return await page.evaluate((id) => {
        try { window.confirm = () => true; } catch (e) {}
        try { if (typeof adminDeleteUser === 'function') { adminDeleteUser(id); return { ok: true }; } return { ok: false, err: 'no-fn' }; } catch (e) { return { ok: false, err: String(e) }; }
      }, targetId);
    });

    // adminGrantAdmin
    extraTests.grantAdmin = await runActionWithFreshUsers('grantAdmin', async (targetId, targetEmail) => {
      return await page.evaluate((email) => {
        try { return (typeof adminGrantAdmin === 'function') ? (adminGrantAdmin(email), { ok: true }) : { ok: false, err: 'no-fn' }; } catch (e) { return { ok: false, err: String(e) }; }
      }, targetEmail);
    });

    console.log('EXTRA_ADMIN_TESTS:', JSON.stringify(extraTests));

    await browser.close();

    // consider the smoke test passed when admin functions exist and no action errors
    const hasFuncs = Array.isArray(adminFuncs) && adminFuncs.length > 0;
    const actionErrors = actionsResult && actionsResult.errors && Object.keys(actionsResult.errors).length > 0;
    const passed = hasFuncs && !actionErrors;
    process.exit(passed ? 0 : 2);
  } catch (e) {
    console.error('ERROR:', e && (e.stack || e.message || e));
    try { await browser.close(); } catch (_) {}
    process.exit(2);
  }
})();
