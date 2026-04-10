const puppeteer = require('puppeteer');
(async () => {
  const HOST = 'http://127.0.0.1:8001/kingdom-roots/index.html';
  try {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE:', msg.text()));
    await page.goto(HOST, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1500));
    const res = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('users') || '[]';
        const users = JSON.parse(raw);
        if (!Array.isArray(users)) return { error: 'users not array', raw };
        const summary = users.map(u => ({ id: u.id, email: u.email, name: u.name, faithPoints: u.faithPoints || 0, treeProgress: u.treeProgress || 0, lastLogin: u.lastLogin || '', lastLoginDateKey: u.lastLoginDateKey || '', loginStreakCurrent: u.loginStreakCurrent || 0, hasPassword: typeof u.password !== 'undefined' }));
        return { count: summary.length, users: summary.slice(0,500) };
      } catch (e) { return { error: String(e) }; }
    });
    console.log(JSON.stringify(res, null, 2));
    await browser.close();
  } catch (e) {
    console.error('ERR', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
