const puppeteer = require('puppeteer');
console.log('START puppeteer_admin_flow_test');
const HOST = 'http://127.0.0.1:8001/';

async function run() {
  const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.text()));

  const adminUser = {
    id: Date.now() + 42,
    name: 'Admin Test',
    email: 'endless0014@gmail.com',
    role: 'admin',
    viewMode: 'admin',
    joinedDate: new Date().toLocaleDateString(),
    lastLogin: new Date().toLocaleString(),
    lastLoginDateKey: new Date().toISOString().split('T')[0],
    loginStreakCurrent: 0,
    dailyLoginState: { streakDay: 1, lastClaimDate: '', cycleStartDate: '', claimedDays: [] },
    faithPoints: 1000,
    treeProgress: 100
  };

  const otherUsers = [
    { id: 1, name: 'User A', email: 'usera@test', role: 'user', faithPoints: 10 },
    { id: 2, name: 'Mod B', email: 'modb@test', role: 'moderator', faithPoints: 20 }
  ];

  await page.goto(HOST, { waitUntil: 'networkidle2' });
  // inject users and currentUser
  await page.evaluate((admin, others) => {
    try {
      localStorage.setItem('users', JSON.stringify([admin, ...others]));
      localStorage.setItem('currentUser', JSON.stringify(admin));
    } catch (e) { console.warn('inject failed', e); }
  }, adminUser, otherUsers);

  // reload to let app hydrate
  await page.goto(HOST, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 800));

  // ensure functions exist then trigger admin view (set global currentUser if needed)
  const result = await page.evaluate(() => {
    try {
      try { currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch(e) { currentUser = null; }
      // Force management helpers for test: override role checks to allow admin view
      try { getCurrentUserRole = () => 'admin'; } catch(e) {}
      try { hasManagementAccess = () => true; } catch(e) {}
      const debug = {
        currentUserVar: window.currentUser || null,
        hasApplyViewModeUI: typeof applyViewModeUI === 'function',
        hasRenderAdminDashboard: typeof renderAdminDashboard === 'function',
        getCurrentUserRole: typeof getCurrentUserRole === 'function' ? getCurrentUserRole() : null,
        hasManagementAccess: typeof hasManagementAccess === 'function' ? hasManagementAccess() : null
      };
      // Ensure currentUser is set to management view for the test
      try { if (currentUser) { currentUser.viewMode = 'admin'; localStorage.setItem('currentUser', JSON.stringify(currentUser)); } } catch(e) {}
      if (debug.hasApplyViewModeUI) applyViewModeUI();
      // Ensure management/admin view is visible for this test by toggling if needed.
      try {
        const btn = document.getElementById('switchAdminViewBtn');
        if (btn) { btn.click(); }
        else if (typeof toggleAdminView === 'function') { toggleAdminView(); }
      } catch(e) { /* ignore */ }
      if (debug.hasRenderAdminDashboard) renderAdminDashboard(false);
      // Ensure the admin dashboard is exposed for headless inspection
      const adminDashEl = document.getElementById('adminDashboard');
      if (adminDashEl) adminDashEl.style.display = 'block';

      // For testing: stub prompt/confirm and exercise all admin actions on the first row
      try {
        window.prompt = function(defaultText) {
          if ((defaultText||'').toLowerCase().includes('points')) return '5';
          return 'new_default_pass123';
        };
        window.confirm = function() { return true; };

        const firstRow = document.querySelector('#adminUsersTableBody tr');
        if (firstRow) {
          // Click +Points
          const pointsBtn = firstRow.querySelector('.admin-action-btn.points');
          if (pointsBtn) pointsBtn.click();

          // Click Reset Password
          const pwBtn = firstRow.querySelector('.admin-action-btn.password');
          if (pwBtn) pwBtn.click();

          // Click Reset Progress
          const resetProgressBtn = firstRow.querySelector('.admin-action-btn.progress');
          if (resetProgressBtn) resetProgressBtn.click();

          // Click Restore
          const restoreBtn = firstRow.querySelector('.admin-action-btn.restore');
          if (restoreBtn) restoreBtn.click();

          // Click View
          const viewBtn = firstRow.querySelector('.admin-action-btn.view');
          if (viewBtn) viewBtn.click();

          // Click Open UI
          const openBtn = firstRow.querySelector('.admin-action-btn.open');
          if (openBtn) openBtn.click();

          // Toggle a task badge if present
          const badge = firstRow.querySelector('.admin-activity-badge');
          if (badge) badge.click();

          // Change role select if present
          const roleSelect = firstRow.querySelector('.admin-role-select');
          if (roleSelect) { roleSelect.value = 'moderator'; roleSelect.dispatchEvent(new Event('change')); }
        }
      } catch (e) { console.warn('action simulation failed', e); }
      const adminVisible = !!(adminDashEl && adminDashEl.style.display !== 'none');
      const totalUsers = document.getElementById('adminTotalUsers') ? document.getElementById('adminTotalUsers').textContent.trim() : null;
      const totalAdmins = document.getElementById('adminTotalAdmins') ? document.getElementById('adminTotalAdmins').textContent.trim() : null;
      const totalModerators = document.getElementById('adminTotalModerators') ? document.getElementById('adminTotalModerators').textContent.trim() : null;
      const usersTableBody = document.getElementById('adminUsersTableBody');
      const rows = usersTableBody ? usersTableBody.querySelectorAll('tr').length : 0;
      let firstRowFaith = null;
      try {
        if (usersTableBody) {
          const firstRow = usersTableBody.querySelector('tr');
          if (firstRow) {
            const cells = firstRow.querySelectorAll('td');
            firstRowFaith = cells && cells[7] ? cells[7].textContent.trim() : null;
          }
        }
      } catch(e) { firstRowFaith = null; }
      const storedCurrentUser = (() => { try { return JSON.parse(localStorage.getItem('currentUser')||'null'); } catch(e) { return null; } })();
      const storedUsers = (() => { try { return JSON.parse(localStorage.getItem('users')||'[]'); } catch(e) { return []; } })();
      const debugAdminActions = (() => { try { return JSON.parse(localStorage.getItem('__debug_admin_actions')||'[]'); } catch(e) { return []; } })();
      const preUpsertSafe = (() => { try { return localStorage.getItem('__debug_last_pre_upsert') || null; } catch(e) { return null; } })();
      const preUpsertSnapshots = (() => { try { return JSON.parse(localStorage.getItem('__debug_pre_upsert_snapshots')||'[]'); } catch(e) { return []; } })();
      const loadedScripts = Array.from(document.querySelectorAll('script')).map(s => ({ src: s.src || null, inlineLength: s.textContent ? s.textContent.length : 0, type: s.type || null }));
      return { debug, adminVisible, totalUsers, totalAdmins, totalModerators, rows, firstRowFaith, storedCurrentUser, storedUsersLength: storedUsers.length, debugAdminActions, preUpsertSafe, preUpsertSnapshotsLength: (preUpsertSnapshots||[]).length, loadedScripts };
    } catch (e) { return { error: String(e) }; }
  });
  // allow UI to update after toggling view
  await new Promise(r => setTimeout(r, 250));

  console.log('ADMIN FLOW RESULT:', result);

  await browser.close();
}

run().catch(err => { console.error(err); process.exit(2); });
