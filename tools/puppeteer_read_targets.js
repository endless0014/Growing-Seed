const puppeteer = require('puppeteer');
const HOST = process.env.HOST || 'http://127.0.0.1:8001/';
const targets = [
  'dojieannmanticahon@gmail.com',
  'nicolenavarrosa27@gmail.com'
];

(async function run(){
  console.log('START puppeteer_read_targets');
  const PUPPETEER_PROFILE = process.env.PUPPETEER_PROFILE || '/tmp/puppeteer_profile';
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox'],
    userDataDir: PUPPETEER_PROFILE
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.text()));

  await page.goto(HOST, { waitUntil: 'networkidle2' });
  // allow app to hydrate
  await new Promise(r => setTimeout(r, 800));

  // wait for a persistence marker set by the admin flow
  const WAIT_TIMEOUT = Number(process.env.WAIT_TIMEOUT_MS) || 8000;
  try {
    await page.waitForFunction(() => {
      return !!(localStorage.getItem('__debug_last_make_mod') || localStorage.getItem('lastPersistAt'));
    }, { timeout: WAIT_TIMEOUT });
    // give the renderer a short moment to settle after marker appears
    await new Promise(r => setTimeout(r, 200));
  } catch (e) {
    console.log('WARN: timed out waiting for persist marker, continuing read');
  }

  const res = await page.evaluate((targets) => {
    try {
      const storedUsers = (() => { try { return JSON.parse(localStorage.getItem('users')||'[]'); } catch(e){ return [];} })();
      const matches = (storedUsers||[]).filter(u => targets.includes(String(u.email||'').trim()));
      const debugAdminActions = (() => { try { return JSON.parse(localStorage.getItem('__debug_admin_actions')||'[]'); } catch(e){ return []; } })();
      const preUpsert = localStorage.getItem('__debug_last_pre_upsert') || null;
      return { matches, matchesCount: matches.length, storedUsersCount: (storedUsers||[]).length, debugAdminActions, preUpsert };
    } catch (e) { return { error: String(e) }; }
  }, targets);

  console.log('READ TARGETS RESULT:', JSON.stringify(res, null, 2));

  await browser.close();
})();
