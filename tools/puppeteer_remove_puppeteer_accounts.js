const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8001', { waitUntil: 'networkidle2' });

  // Ensure an admin session in localStorage so admin actions are allowed
  const admin = {
    id: Date.now(),
    email: 'admin+new@puppet.local',
    role: 'admin',
    viewMode: 'admin',
    name: 'Puppet Admin'
  };

  await page.evaluate(a => {
    try { localStorage.setItem('currentUser', JSON.stringify(a)); } catch (e) {}
    try { window.currentUser = a; } catch (e) {}
  }, admin);

  // Allow app to pick up the change
  await new Promise(r => setTimeout(r, 500));

  const res = await page.evaluate(() => {
    try {
      try { applyViewModeUI(); } catch (e) {}
      try { renderAdminDashboard(false); } catch (e) {}
      const r = adminRemovePuppeteerAccounts();
      return { ok: true, value: r };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  console.log('adminRemovePuppeteerAccounts result:', JSON.stringify(res, null, 2));
  await browser.close();
  if (!res.ok) process.exit(2);
})();
