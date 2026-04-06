#!/usr/bin/env node
'use strict';
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

(async function main() {
  try {
    const keyPath = path.resolve(__dirname, '..', 'keys', 'firebase-service-account.json');
    if (!fs.existsSync(keyPath)) {
      console.error('ERROR: service account key not found at ' + keyPath);
      process.exit(2);
    }

    // Load service account (do not print its contents)
    const serviceAccount = require(keyPath);

    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const db = admin.firestore();

    const previewPath = path.resolve(__dirname, 'users_passwords_reset_preview.json');
    if (!fs.existsSync(previewPath)) {
      console.error('ERROR: preview file not found at ' + previewPath);
      process.exit(2);
    }

    const preview = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
    if (!Array.isArray(preview) || preview.length === 0) {
      console.log('No users found to process.');
      process.exit(0);
    }

    const collName = 'users';
    const BATCH_SIZE = 500;
    let processed = 0;
    let updated = 0;
    const errors = [];

    for (let i = 0; i < preview.length; i += BATCH_SIZE) {
      const chunk = preview.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const u of chunk) {
        try {
          const email = (u.email || '').trim().toLowerCase();
          if (!email) continue;
          const docRef = db.collection(collName).doc(email);
          batch.set(docRef, { password: String(u.password), updatedAt: Date.now() }, { merge: true });
          processed++;
        } catch (e) {
          errors.push('prepareFailed:' + String(e));
        }
      }

      try {
        await batch.commit();
        updated += chunk.length;
      } catch (e) {
        errors.push('batchCommitFailed:' + String(e));
        // fallback to individual updates
        for (const u of chunk) {
          try {
            const email = (u.email || '').trim().toLowerCase();
            if (!email) continue;
            await db.collection(collName).doc(email).set({ password: String(u.password), updatedAt: Date.now() }, { merge: true });
            updated++;
          } catch (err) {
            errors.push('updateFailed:' + (u.email || '') + '::' + String(err));
          }
        }
      }
    }

    const result = { processed, updated, errors };
    console.log('ADMIN_RESET_RESULT:', JSON.stringify(result, null, 2));
    process.exit(errors.length ? 2 : 0);
  } catch (err) {
    console.error('ERROR:', err && (err.stack || err.message || err));
    process.exit(2);
  }
})();
