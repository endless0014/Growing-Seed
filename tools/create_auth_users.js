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

    const serviceAccount = require(keyPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const auth = admin.auth();

    const previewPath = path.resolve(__dirname, 'users_passwords_reset_preview.json');
    if (!fs.existsSync(previewPath)) {
      console.error('ERROR: preview file not found at ' + previewPath);
      process.exit(2);
    }

    const users = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
    if (!Array.isArray(users) || users.length === 0) {
      console.log('No users to process.');
      process.exit(0);
    }

    const result = { created: [], updated: [], errors: [] };

    for (const u of users) {
      const raw = String(u.email || '').trim();
      const email = raw.toLowerCase();
      const password = String(u.password || 'ABCF123');
      if (!email) continue;

      try {
        const existing = await auth.getUserByEmail(email).catch(() => null);
        if (existing) {
          await auth.updateUser(existing.uid, { password });
          result.updated.push(email);
        } else {
          await auth.createUser({ email, password });
          result.created.push(email);
        }
      } catch (e) {
        result.errors.push({ email, error: String(e) });
      }
    }

    console.log('CREATE_AUTH_RESULTS:', JSON.stringify(result, null, 2));
    process.exit(result.errors.length ? 2 : 0);
  } catch (err) {
    console.error('ERROR:', err && (err.stack || err.message || err));
    process.exit(2);
  }
})();
