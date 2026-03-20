const puppeteer = require('puppeteer');
(async () => {
  const HOST = 'http://127.0.0.1:8001/';
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.text()));
  try {
    await page.goto(HOST, { waitUntil: 'networkidle2' });
  } catch (e) {
    // ignore navigation errors for the dump
  }
  const result = await page.evaluate(() => {
    try {
      const usersRaw = localStorage.getItem('users');
      const currentRaw = localStorage.getItem('currentUser');
      return {
        usersRaw: usersRaw || null,
        currentRaw: currentRaw || null
      };
    } catch (e) {
      return { error: String(e) };
    }
  });
  if (result.error) {
    console.error('EVAL_ERROR', result.error);
  } else {
    const usersLen = result.usersRaw ? (() => { try { return JSON.parse(result.usersRaw).length; } catch (e) { return 'PARSE_ERR'; } })() : 0;
    console.log('STORED_USERS_LEN:', usersLen);
    console.log('STORED_USERS_PREVIEW:', result.usersRaw ? (result.usersRaw.substring(0, 1000)) : 'null');
    console.log('CURRENT_USER_PREVIEW:', result.currentRaw ? (result.currentRaw.substring(0, 1000)) : 'null');
  }
  await browser.close();
})();
