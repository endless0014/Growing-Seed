const puppeteer = require('puppeteer');
(async () => {
  const HOST = 'http://127.0.0.1:8001/';
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
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
  // Inject users/currentUser before navigation so app hydrates them on load
  await page.goto(HOST, { waitUntil: 'networkidle2' }).catch(()=>{});
  await page.evaluate((admin, others) => {
    try {
      localStorage.setItem('users', JSON.stringify([admin, ...others]));
      localStorage.setItem('currentUser', JSON.stringify(admin));
    } catch (e) { console.warn('inject failed', e); }
  }, adminUser, otherUsers);
  try {
    await page.goto(HOST, { waitUntil: 'networkidle2' });
  } catch (e) {}
  // Ensure runtime `currentUser` variable is set and admin view applied
  await page.evaluate(() => {
    try { window.currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch (e) { window.currentUser = null; }
    try { currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch (e) { /* ignore */ }
    try { if (currentUser) currentUser.viewMode = 'admin'; } catch (e) {}
    try { if (typeof applyViewModeUI === 'function') applyViewModeUI(); } catch (e) {}
    try { if (typeof renderAdminDashboard === 'function') renderAdminDashboard(false); } catch (e) {}
  });
  const diag = await page.evaluate(() => {
    const res = { error: null };
    try {
      res.localStorageUsersRaw = localStorage.getItem('users') || null;
      try { res.parsedLocalUsersLen = res.localStorageUsersRaw ? JSON.parse(res.localStorageUsersRaw).length : 0; } catch(e){ res.parsedLocalUsersLen = 'PARSE_ERR'; }
      try { res.getStoredUsersSafeType = typeof getStoredUsersSafe; } catch(e) { res.getStoredUsersSafeType = 'undefined'; }
      try { res.safeUsers = (typeof getStoredUsersSafe === 'function') ? getStoredUsersSafe().slice(0,5) : null; } catch(e){ res.safeUsersError = String(e); }
      try { res.currentUserVar = window.currentUser ? { id: window.currentUser.id, email: window.currentUser.email, role: window.currentUser.role, viewMode: window.currentUser.viewMode } : null; } catch(e) { res.currentUserVar = null; }
      try { res.localCurrentRaw = localStorage.getItem('currentUser') || null; } catch(e){ res.localCurrentRaw = 'ERR'; }
      try { res.getCurrentViewMode = typeof getCurrentViewMode === 'function' ? getCurrentViewMode() : null; } catch(e){ res.getCurrentViewMode = 'ERR'; }
      try { res.hasManagementAccess = typeof hasManagementAccess === 'function' ? hasManagementAccess() : null; } catch(e){ res.hasManagementAccess = 'ERR'; }
      try { res.loadedScripts = Array.from(document.scripts || []).map(s => s.src || s.getAttribute('data-src') || s.getAttribute('src') || '').filter(Boolean); } catch(e) { res.loadedScripts = []; }
      try { res.renderAdminDashboardSource = (typeof renderAdminDashboard === 'function') ? renderAdminDashboard.toString().slice(0,400) : null; } catch(e){ res.renderAdminDashboardSource = 'ERR'; }
    } catch (e) { res.error = String(e); }
    return res;
  });
  console.log('DIAG:', JSON.stringify(diag, null, 2));
  await browser.close();
})();