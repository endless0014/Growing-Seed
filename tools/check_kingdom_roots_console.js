const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true });
  const page = await browser.newPage();

  page.on('console', msg => {
    const args = msg.args();
    Promise.all(args.map(a => a.jsonValue().catch(() => a.toString())))
      .then(vals => console.log('PAGE_CONSOLE', msg.type(), ...vals))
      .catch(() => console.log('PAGE_CONSOLE', msg.type(), msg.text()));
  });

  page.on('pageerror', err => {
    console.log('PAGE_ERROR', err.stack || err.toString());
  });

  page.on('requestfailed', req => {
    const failure = req.failure();
    console.log('REQUEST_FAILED', req.url(), failure && failure.errorText);
  });

  page.on('response', async res => {
    const status = res.status();
    if (status >= 400) {
      console.log('RESPONSE_ERROR', status, res.url());
    }
  });

  page.on('request', req => {
    // log requests for debugging
    console.log('REQUEST', req.method(), req.url());
  });

  try {
    const resp = await page.goto('http://localhost:8000/kingdom-roots/', { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('MAIN_RESPONSE_STATUS', resp && resp.status());
    // extra wait to capture async console messages
    await new Promise(r => setTimeout(r, 1500));
    try {
      const evalResult = await page.evaluate(() => ({
        sendResetCode: typeof window.sendResetCode,
        resetPasswordWithCode: typeof window.resetPasswordWithCode,
        goBackToForgot: typeof window.goBackToForgot,
        showNotification: typeof window.showNotification
      }));
      console.log('EVAL_RESULT', evalResult);
    } catch (e) {
      console.log('EVAL_ERROR', e && e.toString());
    }
  } catch (err) {
    console.error('LOAD_ERROR', err.toString());
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error('UNCAUGHT', err);
  process.exit(1);
});
