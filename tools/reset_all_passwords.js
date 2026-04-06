const puppeteer = require('puppeteer');
const HOST = 'http://127.0.0.1:8001/';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.text()));

  try {
    await page.goto(HOST, { waitUntil: 'networkidle2' });

    // Run in-page script to update all users' passwords
    const result = await page.evaluate(async (newPw) => {
      try {
        const out = { usersChecked: 0, updated: 0, saved: false, cloudResults: [], errors: [] };
        let users = [];
        try { users = JSON.parse(localStorage.getItem('users') || '[]'); } catch (e) { users = []; }
        if ((!Array.isArray(users) || users.length === 0) && typeof getStoredUsersSafe === 'function') {
          try { users = getStoredUsersSafe() || []; } catch (e) { users = []; }
        }
        if (!Array.isArray(users)) users = [];
        out.usersChecked = users.length;
        const now = Date.now();
        for (let i = 0; i < users.length; i++) {
          try {
            users[i].password = String(newPw);
            users[i].updatedAt = now;
            users[i].lastActiveAt = now;
            out.updated++;
          } catch (e) { out.errors.push(String(e)); }
        }

        try {
          if (typeof setStoredUsers === 'function') setStoredUsers(users);
          else localStorage.setItem('users', JSON.stringify(users));
          out.saved = true;
        } catch (e) { out.errors.push('saveError:' + String(e)); }

        try { if (typeof persistAllUserState === 'function') persistAllUserState(users, currentUser); } catch (e) { /* ignore */ }

        if (typeof upsertUserInCloud === 'function') {
          for (let i = 0; i < users.length; i++) {
            try {
              const r = await upsertUserInCloud(users[i]);
              out.cloudResults.push({ id: users[i].id, ok: true, serverReturned: !!r });
            } catch (e) {
              out.cloudResults.push({ id: users[i].id, ok: false, err: String(e) });
            }
          }
        }

        return out;
      } catch (err) {
        return { error: String(err) };
      }
    }, 'ABCF123');

    console.log('RESET_ALL_PASSWORDS_RESULT:', JSON.stringify(result, null, 2));
    await browser.close();
    process.exit(result && result.error ? 2 : 0);
  } catch (err) {
    console.error('ERROR:', err && (err.stack || err.message || err));
    try { await browser.close(); } catch (_) {}
    process.exit(2);
  }
})();
