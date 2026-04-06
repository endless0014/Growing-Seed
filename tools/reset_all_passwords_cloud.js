const puppeteer = require('puppeteer');
const HOST = 'http://127.0.0.1:8001/';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => {
    try { console.log('PAGE:', msg.text()); } catch (e) { /* ignore */ }
  });

  try {
    await page.goto(HOST, { waitUntil: 'networkidle2', timeout: 60000 });

    const result = await page.evaluate(async (newPw) => {
      const out = { docsFound: 0, updated: 0, errors: [] };
      try {
        if (typeof firebase === 'undefined' || !firebase.firestore) {
          out.errors.push('Firebase SDK not available on page');
          return out;
        }

        // Attempt to initialize app if not already initialized
        try {
          if (!firebase.apps || !firebase.apps.length) {
            if (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG) {
              firebase.initializeApp(FIREBASE_CONFIG);
            } else if (window.FIREBASE_LOCAL_CONFIG) {
              firebase.initializeApp(window.FIREBASE_LOCAL_CONFIG);
            }
          }
        } catch (e) {
          out.errors.push('firebase.initializeApp failed: ' + String(e));
          return out;
        }

        const db = firebase.firestore();
        const collName = (typeof CLOUD_USERS_COLLECTION !== 'undefined' && CLOUD_USERS_COLLECTION) ? CLOUD_USERS_COLLECTION : 'users';

        const snapshot = await db.collection(collName).get();
        out.docsFound = snapshot.size;
        const ids = snapshot.docs.map(d => d.id);
        const batchSize = 500;
        let updated = 0;

        for (let i = 0; i < ids.length; i += batchSize) {
          const chunk = ids.slice(i, i + batchSize);
          const batch = db.batch();
          chunk.forEach(id => {
            const ref = db.collection(collName).doc(id);
            batch.update(ref, { password: String(newPw), updatedAt: Date.now() });
          });
          try {
            await batch.commit();
            updated += chunk.length;
          } catch (e) {
            out.errors.push('batch commit failed: ' + String(e));
            // Fallback: try individual updates
            for (const id of chunk) {
              try {
                await db.collection(collName).doc(id).update({ password: String(newPw), updatedAt: Date.now() });
                updated++;
              } catch (err) {
                out.errors.push('update failed for ' + id + ': ' + String(err));
              }
            }
          }
        }

        out.updated = updated;
        return out;
      } catch (err) {
        out.errors.push(String(err));
        return out;
      }
    }, 'ABCF123');

    console.log('RESET_ALL_PASSWORDS_CLOUD_RESULT:', JSON.stringify(result, null, 2));
    await browser.close();
    process.exit(result && result.errors && result.errors.length ? 2 : 0);
  } catch (err) {
    console.error('ERROR:', err && (err.stack || err.message || err));
    try { await browser.close(); } catch (_) {}
    process.exit(2);
  }
})();
