// Growing Seed — Compatibility helpers (legacy functions extracted from monolithic bundle)
// Provides minimal implementations for reset/forgot password UI handlers

(function () {
  function sendResetCode() {
    const emailEl = document.getElementById('forgotEmail');
    const email = getCorrectedEmail(emailEl ? emailEl.value : '');
    const forgotErrorEl = document.getElementById('forgotError');
    if (forgotErrorEl) forgotErrorEl.textContent = '';

    if (isFirebaseAuthAvailable && isFirebaseAuthAvailable()) {
      firebase.auth().sendPasswordResetEmail(email)
        .then(() => {
          if (typeof showNotification === 'function') {
            showNotification(`Password reset email sent to ${email}. Check your inbox.`, {
              type: 'success',
              title: 'Password Reset',
              duration: 9000,
              browser: true
            });
          }
          if (forgotErrorEl) forgotErrorEl.textContent = 'Reset email sent. Check your inbox and spam folder.';
        })
        .catch(error => {
          const code = String(error?.code || '');
          if (code === 'auth/user-not-found') {
            if (forgotErrorEl) forgotErrorEl.textContent = 'Email not found';
            return;
          }
          if (code === 'auth/invalid-email') {
            if (forgotErrorEl) forgotErrorEl.textContent = 'Enter a valid email address';
            return;
          }
          // Fall back to the legacy local reset-code flow when Firebase reset email
          // is unavailable or the account is not managed by Firebase Auth.
          sendLegacyResetCode(email, forgotErrorEl);
        });
      return;
    }

    sendLegacyResetCode(email, forgotErrorEl);
  }

  function sendLegacyResetCode(email, forgotErrorEl) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => normalizeEmail(u.email) === email);

    if (!user) {
      if (forgotErrorEl) forgotErrorEl.textContent = 'Email not found';
      return;
    }

    const resetCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const resetRequests = JSON.parse(localStorage.getItem('resetRequests') || '{}');
    resetRequests[email] = { code: resetCode, timestamp: Date.now() };
    localStorage.setItem('resetRequests', JSON.stringify(resetRequests));

    if (typeof showNotification === 'function') {
      showNotification(`Reset code sent to ${email}. Code: ${resetCode}`, {
        type: 'info',
        title: 'Password Reset',
        duration: 10000
      });
    } else {
      try { console.debug('[compat] reset code', resetCode); } catch(e){}
    }

    const step1 = document.getElementById('forgotStep1');
    const step2 = document.getElementById('forgotStep2');
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'block';
  }

  function resetPasswordWithCode() {
    const emailEl = document.getElementById('forgotEmail');
    const resetCodeEl = document.getElementById('resetCode');
    const newPasswordEl = document.getElementById('newPassword');
    const confirmPasswordEl = document.getElementById('confirmNewPassword');
    const resetErrorEl = document.getElementById('resetError');

    const email = getCorrectedEmail(emailEl ? emailEl.value : '');
    const resetCode = resetCodeEl ? resetCodeEl.value : '';
    const newPassword = newPasswordEl ? newPasswordEl.value : '';
    const confirmPassword = confirmPasswordEl ? confirmPasswordEl.value : '';

    if (resetErrorEl) resetErrorEl.textContent = '';

    if (newPassword !== confirmPassword) {
      if (resetErrorEl) resetErrorEl.textContent = 'Passwords do not match';
      return;
    }

    const resetRequests = JSON.parse(localStorage.getItem('resetRequests') || '{}');
    const resetData = resetRequests[email];

    if (!resetData || resetData.code !== resetCode) {
      if (resetErrorEl) resetErrorEl.textContent = 'Invalid reset code';
      return;
    }

    if (Date.now() - resetData.timestamp > 15 * 60 * 1000) {
      if (resetErrorEl) resetErrorEl.textContent = 'Reset code expired';
      return;
    }

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex(u => normalizeEmail(u.email) === email);

    if (userIndex !== -1) {
      users[userIndex].password = newPassword;
      if (typeof setStoredUsers === 'function') {
        setStoredUsers(users);
      } else {
        localStorage.setItem('users', JSON.stringify(users));
      }

      delete resetRequests[email];
      localStorage.setItem('resetRequests', JSON.stringify(resetRequests));

      if (typeof showNotification === 'function') {
        showNotification('Password reset successfully! Please login with your new password.', {
          type: 'success',
          browser: true
        });
      }

      if (typeof switchToLogin === 'function') switchToLogin();
    }
  }

  function goBackToForgot() {
    const step1 = document.getElementById('forgotStep1');
    const step2 = document.getElementById('forgotStep2');
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
    const resetCodeEl = document.getElementById('resetCode');
    const newPasswordEl = document.getElementById('newPassword');
    const confirmPasswordEl = document.getElementById('confirmNewPassword');
    const resetErrorEl = document.getElementById('resetError');
    if (resetCodeEl) resetCodeEl.value = '';
    if (newPasswordEl) newPasswordEl.value = '';
    if (confirmPasswordEl) confirmPasswordEl.value = '';
    if (resetErrorEl) resetErrorEl.textContent = '';
  }

  try {
    window.sendResetCode = sendResetCode;
    window.resetPasswordWithCode = resetPasswordWithCode;
    window.goBackToForgot = goBackToForgot;
  } catch (e) { /* ignore */ }

})();
