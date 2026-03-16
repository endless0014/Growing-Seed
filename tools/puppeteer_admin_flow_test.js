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
      try { window.currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch(e) {}
      // Force management helpers for test: override role checks to allow admin view
      try { window.getCurrentUserRole = () => 'admin'; } catch(e) {}
      try { window.hasManagementAccess = () => true; } catch(e) {}
      const debug = {
        currentUserVar: window.currentUser || null,
        hasApplyViewModeUI: typeof applyViewModeUI === 'function',
        hasRenderAdminDashboard: typeof renderAdminDashboard === 'function',
        getCurrentUserRole: typeof getCurrentUserRole === 'function' ? getCurrentUserRole() : null,
        hasManagementAccess: typeof hasManagementAccess === 'function' ? hasManagementAccess() : null
      };
      if (debug.hasApplyViewModeUI) applyViewModeUI();
      if (debug.hasRenderAdminDashboard) renderAdminDashboard(false);
      const adminVisible = !!(document.getElementById('adminDashboard') && document.getElementById('adminDashboard').style.display !== 'none');
      const totalUsers = document.getElementById('adminTotalUsers') ? document.getElementById('adminTotalUsers').textContent.trim() : null;
      const totalAdmins = document.getElementById('adminTotalAdmins') ? document.getElementById('adminTotalAdmins').textContent.trim() : null;
      const totalModerators = document.getElementById('adminTotalModerators') ? document.getElementById('adminTotalModerators').textContent.trim() : null;
      const usersTableBody = document.getElementById('adminUsersTableBody');
      const rows = usersTableBody ? usersTableBody.querySelectorAll('tr').length : 0;
      return { debug, adminVisible, totalUsers, totalAdmins, totalModerators, rows };
    } catch (e) { return { error: String(e) }; }
  });

  console.log('ADMIN FLOW RESULT:', result);

  await browser.close();
}

run().catch(err => { console.error(err); process.exit(2); });
