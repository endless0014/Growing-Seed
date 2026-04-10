const puppeteer = require('puppeteer');
const HOST = process.env.HOST || 'http://127.0.0.1:8001/';
const emails = [
  'dojieannmanticahon@gmail.com',
  'nicolenavarrosa27@gmail.com'
];

(async function run(){
  console.log('START puppeteer_make_moderators');
  const PUPPETEER_PROFILE = process.env.PUPPETEER_PROFILE || '/tmp/puppeteer_profile';
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox'],
    userDataDir: PUPPETEER_PROFILE
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.text()));

  await page.goto(HOST, { waitUntil: 'networkidle2' });

  // inject admin currentUser and ensure users exist
  await page.evaluate((emails) => {
    try {
      const adminUser = { id: Date.now()+999, name: 'Local Admin', email: 'localadmin@test', role: 'admin', viewMode: 'admin' };
      let stored = [];
      try { stored = JSON.parse(localStorage.getItem('users')||'[]'); } catch(e) { stored = []; }
      emails.forEach((em, idx) => {
        const norm = String(em).trim();
        if (!stored.some(u => String(u.email||'') === norm)) {
          stored.push({ id: Date.now()+idx+1, email: norm, name: norm.split('@')[0], role: 'user', faithPoints: 0, treeProgress: 0 });
        }
      });
      localStorage.setItem('users', JSON.stringify(stored));
      localStorage.setItem('currentUser', JSON.stringify(adminUser));
    } catch(e) { console.warn('inject err', e); }
  }, emails);

  // reload so app hydrates
  await page.goto(HOST, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 800));

  const result = await page.evaluate((emails) => {
    try {
      try { currentUser = JSON.parse(localStorage.getItem('currentUser')||'null'); } catch(e) { currentUser = null; }
      try { getCurrentUserRole = () => 'admin'; } catch(e) {}
      try { hasManagementAccess = () => true; } catch(e) {}
      if (typeof adminMakeModerators === 'function') {
        const r = adminMakeModerators(emails);
        return { ok: true, report: r };
      }
      return { ok: false, error: 'adminMakeModerators not available' };
    } catch(e) { return { ok: false, error: String(e) }; }
  }, emails);

  // read back users
  const usersAfter = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('users')||'[]'); } catch(e) { return []; } });

  console.log('MAKE_MOD_RESULT:', result);
  console.log('USERS_AFTER_COUNT:', usersAfter.length);
  const found = (usersAfter || [])
    .filter(u => emails.includes(String(u.email || '').trim()))
    .map(u => ({ email: u.email, role: u.role }));
  console.log('MATCHING_USERS:', JSON.stringify(found, null, 2));

  await browser.close();
})();
