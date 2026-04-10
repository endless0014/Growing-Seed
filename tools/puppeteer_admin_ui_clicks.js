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

  const targetUser = {
    id: Date.now() + 1111,
    name: 'UI Target',
    email: 'ui-target@puppet.local',
    password: 'pw',
    role: 'user',
    viewMode: 'user',
    joinedDate: new Date().toLocaleDateString(),
    lastActiveAt: Date.now(),
    faithPoints: 0,
    treeProgress: 0,
    dailyLoginState: { streakDay: 1, lastClaimDate: '', cycleStartDate: '', claimedDays: [] }
  };

  try {
    await page.goto(HOST, { waitUntil: 'networkidle2' });
    // initialize storage with admin + target
    await page.evaluate((a, t) => {
      try { localStorage.setItem('users', JSON.stringify([a, t])); } catch (e) {}
      try { localStorage.setItem('currentUser', JSON.stringify(a)); } catch (e) {}
    }, adminUser, targetUser);
    await page.goto(HOST, { waitUntil: 'networkidle2' });

    // give app time to hydrate
    await new Promise(r => setTimeout(r, 700));

    // ensure admin view is active
    await page.evaluate(() => {
      try { if (typeof applyViewModeUI === 'function') applyViewModeUI(); } catch (e) {}
      try { if (typeof renderAdminDashboard === 'function') renderAdminDashboard(true); } catch (e) {}
    });

    await new Promise(r => setTimeout(r, 500));

    // stub confirm/prompt so clicks proceed
    await page.evaluate(() => {
      try { window.confirm = () => true; } catch (e) {}
      try { window.prompt = (t, d) => d || 'changeme123'; } catch (e) {}
    });

    const result = await page.evaluate((targetEmail) => {
      const out = { found: false, clicks: {}, usersBefore: null, usersAfter: null };
      try {
        out.usersBefore = JSON.parse(localStorage.getItem('users') || '[]');
      } catch (e) { out.usersBefore = { error: String(e) }; }

      const tbody = document.getElementById('adminUsersTableBody');
      if (!tbody) return { error: 'no-admin-table' };
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const row = rows.find(r => (r.cells[5] && r.cells[5].textContent || '').includes(targetEmail));
      if (!row) return { error: 'target-row-not-found', emails: rows.map(r => (r.cells[5] && r.cells[5].textContent||'').trim()) };
      out.found = true;

      try {
        const btnPoints = row.querySelector('button.admin-action-btn.points');
        if (btnPoints) { btnPoints.click(); out.clicks.addPoints = true; }
      } catch (e) { out.clicks.addPoints = String(e); }

      try {
        const btnPassword = row.querySelector('button.admin-action-btn.password');
        if (btnPassword) { btnPassword.click(); out.clicks.resetPassword = true; }
      } catch (e) { out.clicks.resetPassword = String(e); }

      try {
        const btnDelete = row.querySelector('button.admin-action-btn.delete');
        if (btnDelete) { btnDelete.click(); out.clicks.delete = true; }
      } catch (e) { out.clicks.delete = String(e); }

      try { out.usersAfter = JSON.parse(localStorage.getItem('users') || '[]'); } catch (e) { out.usersAfter = { error: String(e) }; }
      return out;
    }, targetUser.email);

    console.log('UI_CLICK_RESULT:', JSON.stringify(result, null, 2));

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err && (err.stack || err.message || err));
    try { await browser.close(); } catch (_) {}
    process.exit(2);
  }
})();
