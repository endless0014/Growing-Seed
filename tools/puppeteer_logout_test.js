const puppeteer = require('puppeteer');
const HOST = 'http://127.0.0.1:8001/kingdom-roots/index.html';

async function run() {
  console.log('START puppeteer_logout_test');
  const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.text()));

  const user = {
    id: 9999,
    name: 'Logout Tester',
    email: 'logout@test',
    role: 'user',
    viewMode: 'user',
    joinedDate: new Date().toLocaleDateString(),
    lastLogin: new Date().toLocaleString(),
    faithPoints: 10,
    treeProgress: 5
  };

  await page.goto(HOST, { waitUntil: 'networkidle2' });
  await page.evaluate(u => {
    localStorage.setItem('users', JSON.stringify([u]));
    localStorage.setItem('currentUser', JSON.stringify(u));
  }, user);

  await page.goto(HOST, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 500));

  // Open profile modal and click logout (stub confirm)
  const res = await page.evaluate(() => {
    try {
      window.currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
      window.confirm = () => true;
      if (typeof openProfileModal === 'function') openProfileModal();
      const logoutBtn = Array.from(document.querySelectorAll('.settings-btn')).find(b => b.textContent.trim().toLowerCase() === 'logout');
      if (logoutBtn) logoutBtn.click();
      return {
        afterLocalStorageCurrentUser: localStorage.getItem('currentUser'),
        authVisible: !!(document.getElementById('authContainer') && document.getElementById('authContainer').style.display !== 'none'),
        appVisible: !!(document.getElementById('appContainer') && document.getElementById('appContainer').style.display !== 'none')
      };
    } catch (e) { return { error: String(e) }; }
  });

  console.log('Logout click result:', res);

  // Now simulate auto-logout by calling performLogout({auto:true}) and check
  const autoRes = await page.evaluate(() => {
    try {
      // restore a currentUser for auto-logout test
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const u = users[0] || null;
      if (u) localStorage.setItem('currentUser', JSON.stringify(u));
      if (typeof performLogout === 'function') performLogout({ auto: true, message: 'Auto logout test' });
      return { afterAutoLocalStorageCurrentUser: localStorage.getItem('currentUser') };
    } catch (e) { return { error: String(e) }; }
  });

  console.log('Auto-logout result:', autoRes);

  await browser.close();
}

run().catch(err => { console.error(err); process.exit(2); });
