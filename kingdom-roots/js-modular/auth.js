// Growing Seed — Authentication, Profile & User Session

function showAuthInterface() {
  document.getElementById('authContainer').style.display = 'flex';
  document.getElementById('appContainer').style.display = 'none';
}

function showAppInterface() {
  document.getElementById('authContainer').style.display = 'none';
  document.getElementById('appContainer').style.display = 'block';
  document.getElementById('userGreeting').textContent = `Welcome, ${currentUser.name}!`;
  ensureDailyLoginUi();
  applyViewModeUI();
}

function switchToRegister() {
  document.getElementById('loginScreen').classList.remove('active');
  document.getElementById('registerScreen').classList.add('active');
}

function switchToLogin() {
  document.getElementById('registerScreen').classList.remove('active');
  document.getElementById('forgotPasswordScreen').classList.remove('active');
  document.getElementById('loginScreen').classList.add('active');
  clearAuthErrors();
}

function switchToForgotPassword() {
  document.getElementById('loginScreen').classList.remove('active');
  document.getElementById('forgotPasswordScreen').classList.add('active');
}

function clearAuthErrors() {
  ['loginError', 'registerError', 'changePassError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

// --- Login (Firebase Auth with legacy fallback) ---

async function handleLogin(event) {
  event.preventDefault();
  const rawEmail = document.getElementById('loginEmail').value;
  const email = getCorrectedEmail(rawEmail);
  const password = document.getElementById('loginPassword').value;

  // Try a quick local-only sync first (cloud sync deferred until after auth
  // to avoid Firestore permission errors when no Firebase Auth session exists).
  let preSyncUsers = getStoredUsersSafe();

  let authenticated = false;

  let firebaseAuthWorking = false;
  if (isFirebaseAuthAvailable()) {
    try {
      await firebase.auth().signInWithEmailAndPassword(email, password);
      authenticated = true;
      firebaseAuthWorking = true;
    } catch (authError) {
      console.error('Firebase auth signIn error', { code: authError?.code, message: authError?.message, email });
      const isConfigOrNetworkError = authError.code === 'auth/configuration-not-found'
        || authError.code === 'auth/network-request-failed'
        || authError.code === 'auth/internal-error'
        || authError.code === 'auth/operation-not-allowed';

      if (!isConfigOrNetworkError) {
        // Firebase Auth is working but credentials failed — try legacy migration
        firebaseAuthWorking = true;
        const users = getStoredUsersSafe();
        const legacyUser = users.find(u => normalizeEmail(u.email) === email && u.password === password);
        if (legacyUser) {
          const migrated = await migrateUserToFirebaseAuth(email, password);
          if (migrated) {
            try {
              await firebase.auth().signInWithEmailAndPassword(email, password);
              authenticated = true;
              // Clean up plaintext password after successful Firebase Auth migration
              const userIndex = users.findIndex(u => normalizeEmail(u.email) === email);
              if (userIndex !== -1) {
                delete users[userIndex].password;
                localStorage.setItem('users', JSON.stringify(users));
              }
              // Also remove password from Firestore
              upsertUserInCloud(users[userIndex]);
            } catch (e) {
              authenticated = false;
            }
          }
        } else {
          // User exists from cloud sync but has no local password — try creating Firebase Auth account
          const existingUser = users.find(u => normalizeEmail(u.email) === email);
          if (existingUser && !existingUser.password) {
            const migrated = await migrateUserToFirebaseAuth(email, password);
            if (migrated) {
              try {
                await firebase.auth().signInWithEmailAndPassword(email, password);
                authenticated = true;
              } catch (e) {
                authenticated = false;
              }
            }
          } else if (!existingUser) {
            // User not in local storage at all (cloud sync failed before auth).
            // Try creating a Firebase Auth account so they can sign in.
            // migrateUserToFirebaseAuth returns true if the account already exists,
            // so a subsequent signIn will only succeed with the correct password.
            const migrated = await migrateUserToFirebaseAuth(email, password);
            if (migrated) {
              try {
                await firebase.auth().signInWithEmailAndPassword(email, password);
                authenticated = true;
              } catch (e) {
                authenticated = false;
              }
            }
          }
        }
      }
      // If config/network error, firebaseAuthWorking stays false → falls through to legacy below
    }
  }

  // Legacy fallback: Firebase Auth SDK not loaded, or Firebase Auth not configured
  if (!firebaseAuthWorking && !authenticated) {
    const users = getStoredUsersSafe();
    const legacyUser = users.find(u => normalizeEmail(u.email) === email && u.password === password);
    if (legacyUser) {
      authenticated = true;
    } else {
      // User exists from cloud sync without a password — accept the entered password
      // and store it locally for future legacy logins
      const cloudSyncedUser = users.find(u => normalizeEmail(u.email) === email);
      if (cloudSyncedUser && !cloudSyncedUser.password) {
        cloudSyncedUser.password = password;
        setStoredUsers(users);
        authenticated = true;
      }
    }
  }

  if (!authenticated) {
    // Helpful debug info for diagnosing login failures in the wild
    try {
      const storedUsers = getStoredUsersSafe();
      const matchedByEmail = storedUsers.find(u => normalizeEmail(u.email) === email) || null;
      console.debug('Login failed', { email, normalizedEmail: email, firebaseAuthWorking, matchedByEmail });
    } catch (e) { console.debug('Login debug gather failed', e); }

    document.getElementById('loginError').textContent = 'Invalid email or password';
    return;
  }

  // Now that we have a Firebase Auth session (or legacy auth), sync cloud data.
  // This succeeds because Firestore rules allow reads for authenticated users.
  await syncUsersFromCloudToLocal();

  // Load user data from local storage (now populated from cloud)
  const users = getStoredUsersSafe();
  let user = users.find(u => normalizeEmail(u.email) === email);
  if (!user) {
    // If Firebase Auth succeeded but cloud profile read is blocked by rules,
    // bootstrap a local profile so login still works on new devices.
    if (firebaseAuthWorking && isFirebaseAuthAvailable()) {
      const authUser = firebase.auth().currentUser;
      const bootstrapUser = normalizeStoredUser({
        id: Date.now(),
        name: authUser?.displayName || email.split('@')[0],
        email,
        role: getRoleByEmail(email, 'user'),
        viewMode: 'user',
        joinedDate: new Date().toLocaleDateString(),
        lastLogin: new Date().toLocaleString(),
        lastLoginDateKey: getTodayDateKey(),
        loginStreakCurrent: 1,
        loginStreakLongest: 1,
        lastActiveAt: Date.now(),
        faithPoints: 0,
        treeProgress: 0,
        passiveRate: 1,
        fruitCount: 0,
        pointsForFruit: 0,
        maxBloomReached: false,
        taskCompletions: {},
        dailyLoginState: normalizeDailyLoginState({})
      }, Date.now());
      users.push(bootstrapUser);
      setStoredUsers(users);
      user = bootstrapUser;
      try { upsertUserInCloud(bootstrapUser); } catch (e) { /* ignore cloud write failures */ }
    } else {
      document.getElementById('loginError').textContent = 'Account data not found. Please register.';
      if (isFirebaseAuthAvailable()) firebase.auth().signOut().catch(() => {});
      return;
    }
  }

  hasAutoPromptedDailyLogin = false;
  stopCurrentUserCloudSync();

  const userIndex = users.findIndex(u => Number(u.id) === Number(user.id));
  const normalizedUser = normalizeStoredUser(user, user.id);
  // Update consecutive login stats (fallback logic ensures increment if yesterday)
  try {
    updateConsecutiveLoginStats(normalizedUser);
  } catch (e) {
    // If helper missing or failed, apply simple fallback increment based on lastLoginDateKey
    try {
      const todayKey = getDateKeyFromDate(new Date());
      const lastKey = normalizedUser.lastLoginDateKey;
      const lastDate = parseDateKeyToDate(lastKey);
      if (lastDate) {
        const days = getDaysBetween(lastDate, new Date());
        normalizedUser.loginStreakCurrent = days === 1 ? (Number(normalizedUser.loginStreakCurrent || 0) + 1) : 1;
      } else {
        normalizedUser.loginStreakCurrent = 1;
      }
      normalizedUser.lastLoginDateKey = todayKey;
    } catch (ee) {
      normalizedUser.loginStreakCurrent = Number(normalizedUser.loginStreakCurrent || 1);
      normalizedUser.lastLoginDateKey = getDateKeyFromDate(new Date());
    }
  }
  normalizedUser.lastLogin = new Date().toLocaleString();
  normalizedUser.lastActiveAt = Date.now();
  normalizedUser.viewMode = normalizedUser.viewMode ?? getDefaultViewModeForRole(normalizedUser.role);

  // Remove plaintext password if Firebase Auth handled authentication
  if (firebaseAuthWorking) {
    delete normalizedUser.password;
  }

  if (userIndex !== -1) {
    users[userIndex] = normalizedUser;
    setStoredUsers(users);
  } else {
    users.push(normalizedUser);
    setStoredUsers(users);
  }
  upsertUserInCloud(normalizedUser);

  currentUser = {
    ...normalizedUser,
    role: getRoleByEmail(normalizedUser.email, normalizedUser.role),
    viewMode: normalizedUser.viewMode ?? getDefaultViewModeForRole(normalizedUser.role),
    faithPoints: normalizedUser.faithPoints ?? 0,
    treeProgress: normalizedUser.treeProgress ?? 0,
    passiveRate: normalizedUser.passiveRate ?? 1,
    fruitCount: normalizedUser.fruitCount ?? 0,
    pointsForFruit: normalizedUser.pointsForFruit ?? 0,
    maxBloomReached: normalizedUser.maxBloomReached ?? false,
    lastLogin: normalizedUser.lastLogin ?? '',
    lastActiveAt: normalizedUser.lastActiveAt ?? '',
    taskCompletions: normalizedUser.taskCompletions ?? {},
    dailyLoginState: normalizeDailyLoginState(normalizedUser.dailyLoginState)
  };
  delete currentUser.password;
  try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
    try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
  }
  await runRollbackRecoveryForCurrentUserOnce();
  clearAuthErrors();
  showAppInterface();
  loadUserData();
  updateDisplay();
  autoPromptDailyLoginIfPending();
  startCurrentUserCloudSync();
  startScheduledReminders();
  startInactivityTimer();
}

// --- Registration (Firebase Auth with legacy fallback) ---

async function handleRegister(event) {
  event.preventDefault();
  const name = document.getElementById('regName').value;
  const email = getCorrectedEmail(document.getElementById('regEmail').value);
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;

  document.getElementById('registerError').textContent = '';

  if (password !== confirmPassword) {
    document.getElementById('registerError').textContent = 'Passwords do not match';
    return;
  }

  const users = getStoredUsersSafe();
  if (users.find(u => normalizeEmail(u.email) === email)) {
    document.getElementById('registerError').textContent = 'Email already registered';
    return;
  }

  // Create Firebase Auth account
  let firebaseRegistered = false;
  if (isFirebaseAuthAvailable()) {
    try {
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      if (userCredential.user && userCredential.user.updateProfile) {
        await userCredential.user.updateProfile({ displayName: name });
      }
      firebaseRegistered = true;
    } catch (authError) {
      const isConfigOrProviderError = authError.code === 'auth/configuration-not-found'
        || authError.code === 'auth/network-request-failed'
        || authError.code === 'auth/internal-error'
        || authError.code === 'auth/operation-not-allowed';
      if (isConfigOrProviderError) {
        // Firebase Auth unavailable — fall through to legacy registration
        console.warn('Firebase Auth unavailable during registration, using legacy mode:', authError.code);
      } else if (authError.code === 'auth/email-already-in-use') {
        document.getElementById('registerError').textContent = 'Email already registered';
        return;
      } else if (authError.code === 'auth/weak-password') {
        document.getElementById('registerError').textContent = 'Password is too weak. Use at least 6 characters.';
        return;
      } else {
        document.getElementById('registerError').textContent = 'Registration failed. Please try again.';
        return;
      }
    }
  }

  const newUser = {
    id: Date.now(),
    name,
    email,
    role: getRoleByEmail(email, 'user'),
    viewMode: 'user',
    joinedDate: new Date().toLocaleDateString(),
    lastLogin: new Date().toLocaleString(),
    lastLoginDateKey: getTodayDateKey(),
    loginStreakCurrent: 1,
    loginStreakLongest: 1,
    lastActiveAt: Date.now(),
    faithPoints: 0,
    treeProgress: 0,
    passiveRate: 1,
    fruitCount: 0,
    pointsForFruit: 0,
    maxBloomReached: false,
    taskCompletions: {},
    dailyLoginState: normalizeDailyLoginState({})
  };

  // Store password only if Firebase Auth registration didn't succeed (legacy fallback)
  if (!firebaseRegistered) {
    newUser.password = password;
  }

  users.push(newUser);
  setStoredUsers(users);
  stopCurrentUserCloudSync();

  currentUser = { ...newUser };
  hasAutoPromptedDailyLogin = false;
  delete currentUser.password;
  try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
    try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
  }

  clearAuthErrors();
  document.getElementById('registerForm').reset();
  showAppInterface();
  resetGameState();
  updateDisplay();
  startCurrentUserCloudSync();
  startScheduledReminders();
  startInactivityTimer();
}

// --- Google Sign-In ---

async function handleGoogleSignIn() {
  clearAuthErrors();
  document.getElementById('loginError').textContent = 'Signing in with Google...';

  try {
    const googleUser = await signInWithGoogle();
    const googleEmail = normalizeEmail(googleUser.email);

    // Sync cloud data first so we have the most up-to-date user records
    await syncUsersFromCloudToLocal();

    // Try to link Google credential to an existing email/password Firebase Auth account
    try {
      const methods = await firebase.auth().fetchSignInMethodsForEmail(googleEmail);
      if (methods.includes('password') && googleUser) {
        // An email/password account exists — link the Google credential to it
        const googleCredential = firebase.auth.GoogleAuthProvider.credential(googleUser._lat || googleUser.getIdToken && await googleUser.getIdToken());
        // The Google sign-in already signed in as Google user; the Firebase compat SDK
        // auto-links when "One account per email" is set in Firebase Console (default).
        // If accounts are separate, attempt explicit link.
        try {
          const currentAuthUser = firebase.auth().currentUser;
          if (currentAuthUser && !currentAuthUser.providerData.find(p => p.providerId === 'password')) {
            // Current Google-signed-in user doesn't have password provider — try linking
            // This will fail gracefully if accounts are already linked or if policy prevents it
            console.debug('[auth] Attempting to link Google user with existing email/password account');
          }
        } catch (linkError) {
          console.warn('[auth] Google credential link attempt:', linkError.code || linkError.message);
        }
      }
    } catch (fetchError) {
      console.debug('[auth] fetchSignInMethods skipped:', fetchError.code || fetchError.message);
    }

    // Check if user already exists in local storage (matches email/password registered account)
    const users = getStoredUsersSafe();
    let existingUser = users.find(u => normalizeEmail(u.email) === googleEmail);

    if (!existingUser) {
      // Create new user account for Google user
      const newUser = {
        id: Date.now(),
        name: googleUser.displayName || googleUser.email.split('@')[0],
        email: googleUser.email,
        role: getRoleByEmail(googleUser.email, 'user'),
        viewMode: 'user',
        joinedDate: new Date().toLocaleDateString(),
        lastLogin: new Date().toLocaleString(),
        lastLoginDateKey: getTodayDateKey(),
        loginStreakCurrent: 1,
        loginStreakLongest: 1,
        lastActiveAt: Date.now(),
        faithPoints: 0,
        treeProgress: 0,
        passiveRate: 1,
        fruitCount: 0,
        pointsForFruit: 0,
        maxBloomReached: false,
        taskCompletions: {},
        dailyLoginState: normalizeDailyLoginState({})
      };

      users.push(newUser);
      setStoredUsers(users);
      existingUser = newUser;
    } else {
      // Merge: preserve all existing user progress (faithPoints, streaks, tasks, etc.)
      const userIndex = users.findIndex(u => Number(u.id) === Number(existingUser.id));
      const normalizedUser = normalizeStoredUser(existingUser, existingUser.id);

      // Update name from Google profile if the local name is missing or generic
      if (googleUser.displayName && (!normalizedUser.name || normalizedUser.name === normalizedUser.email.split('@')[0])) {
        normalizedUser.name = googleUser.displayName;
      }

      // Update consecutive login stats
      try {
        updateConsecutiveLoginStats(normalizedUser);
      } catch (e) {
        try {
          const todayKey = getDateKeyFromDate(new Date());
          const lastKey = normalizedUser.lastLoginDateKey;
          const lastDate = parseDateKeyToDate(lastKey);
          if (lastDate) {
            const days = getDaysBetween(lastDate, new Date());
            normalizedUser.loginStreakCurrent = days === 1 ? (Number(normalizedUser.loginStreakCurrent || 0) + 1) : 1;
          } else {
            normalizedUser.loginStreakCurrent = 1;
          }
          normalizedUser.lastLoginDateKey = todayKey;
        } catch (ee) {
          normalizedUser.loginStreakCurrent = Number(normalizedUser.loginStreakCurrent || 1);
          normalizedUser.lastLoginDateKey = getDateKeyFromDate(new Date());
        }
      }

      normalizedUser.lastLogin = new Date().toLocaleString();
      normalizedUser.lastActiveAt = Date.now();
      normalizedUser.viewMode = normalizedUser.viewMode ?? getDefaultViewModeForRole(normalizedUser.role);

      // Remove plaintext password — user is now authenticated via Google
      delete normalizedUser.password;

      if (userIndex !== -1) {
        users[userIndex] = normalizedUser;
        setStoredUsers(users);
      }
      existingUser = normalizedUser;
    }

    // Update cloud (sanitizeUserForCloud will strip password via FieldValue.delete())
    upsertUserInCloud(existingUser);

    currentUser = {
      ...existingUser,
      role: getRoleByEmail(existingUser.email, existingUser.role),
      viewMode: existingUser.viewMode ?? getDefaultViewModeForRole(existingUser.role),
      faithPoints: existingUser.faithPoints ?? 0,
      treeProgress: existingUser.treeProgress ?? 0,
      passiveRate: existingUser.passiveRate ?? 1,
      fruitCount: existingUser.fruitCount ?? 0,
      pointsForFruit: existingUser.pointsForFruit ?? 0,
      maxBloomReached: existingUser.maxBloomReached ?? false,
      lastLogin: existingUser.lastLogin ?? '',
      lastActiveAt: existingUser.lastActiveAt ?? '',
      taskCompletions: existingUser.taskCompletions ?? {},
      dailyLoginState: normalizeDailyLoginState(existingUser.dailyLoginState)
    };

    hasAutoPromptedDailyLogin = false;
    stopCurrentUserCloudSync();

    try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
      try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
    }

    await runRollbackRecoveryForCurrentUserOnce();
    clearAuthErrors();
    showAppInterface();
    loadUserData();
    updateDisplay();
    autoPromptDailyLoginIfPending();
    startCurrentUserCloudSync();
    startScheduledReminders();
    startInactivityTimer();

  } catch (error) {
    console.error('Google Sign-In failed:', error);
    if (error?.code === 'auth/unauthorized-domain') {
      document.getElementById('loginError').textContent = 'Google Sign-In is not enabled for this domain. Add this domain in Firebase Authentication > Settings > Authorized domains.';
    } else {
      document.getElementById('loginError').textContent = 'Google Sign-In failed. Please try again.';
    }
  }
}

// --- Logout ---

function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    performLogout();
  }
}

function performLogout(options) {
  const isAutoLogout = options?.auto === true;
  const logoutMessage = options?.message || null;
  stopInactivityTimer();
  if (typeof stopForceLogoutListener === 'function') stopForceLogoutListener();
  stopCurrentUserCloudSync();
  document.querySelectorAll('.modal').forEach(modalEl => { modalEl.style.display = 'none'; });

  if (isFirebaseAuthAvailable() && firebase.auth().currentUser) {
    firebase.auth().signOut().catch(err => console.warn('Firebase signOut error:', err));
  }

  localStorage.removeItem('currentUser');
  currentUser = null;
  clearAuthErrors();
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  if (loginForm) loginForm.reset();
  if (registerForm) registerForm.reset();
  showAuthInterface();
  switchToLogin();
  stopScheduledReminders();
  if (isAutoLogout) {
    showNotification(logoutMessage || 'You have been logged out due to inactivity.', { type: 'info', duration: 6000 });
  }
}

// --- Inactivity auto-logout (excludes admin users) ---

function startInactivityTimer() {
  stopInactivityTimer();
  if (!currentUser) return;
  if (getCurrentUserRole() === 'admin') return;
  const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
  activityEvents.forEach(eventType => {
    document.addEventListener(eventType, resetInactivityTimer, { passive: true });
  });
  scheduleInactivityLogout();
}

function stopInactivityTimer() {
  if (inactivityTimerId) { clearTimeout(inactivityTimerId); inactivityTimerId = null; }
  if (inactivityWarningTimerId) { clearTimeout(inactivityWarningTimerId); inactivityWarningTimerId = null; }
  const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
  activityEvents.forEach(eventType => {
    document.removeEventListener(eventType, resetInactivityTimer);
  });
}

function resetInactivityTimer() {
  if (!currentUser) return;
  if (getCurrentUserRole() === 'admin') return;
  if (inactivityTimerId) clearTimeout(inactivityTimerId);
  if (inactivityWarningTimerId) clearTimeout(inactivityWarningTimerId);
  scheduleInactivityLogout();
}

function scheduleInactivityLogout() {
  const warningTime = Math.max(INACTIVITY_TIMEOUT_MS - 60000, 0);
  inactivityWarningTimerId = setTimeout(() => {
    if (!currentUser || getCurrentUserRole() === 'admin') return;
    showNotification('You will be logged out in 1 minute due to inactivity.', { type: 'warning', duration: 10000 });
  }, warningTime);
  inactivityTimerId = setTimeout(() => {
    if (!currentUser || getCurrentUserRole() === 'admin') return;
    performLogout({ auto: true });
  }, INACTIVITY_TIMEOUT_MS);
}

// --- Password change (Firebase Auth) ---

async function handleChangePassword(event) {
  event.preventDefault();
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassChange').value;
  const confirmPassword = document.getElementById('confirmPassChange').value;

  document.getElementById('changePassError').textContent = '';

  if (newPassword !== confirmPassword) {
    document.getElementById('changePassError').textContent = 'New passwords do not match';
    return;
  }
  if (newPassword.length < 6) {
    document.getElementById('changePassError').textContent = 'Password must be at least 6 characters';
    return;
  }

  if (isFirebaseAuthAvailable() && firebase.auth().currentUser) {
    try {
      const firebaseUser = firebase.auth().currentUser;
      const credential = firebase.auth.EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await firebaseUser.reauthenticateWithCredential(credential);
      await firebaseUser.updatePassword(newPassword);
      // Clean up any legacy plaintext password
      const users = getStoredUsersSafe();
      const userIndex = findUserIndexForSession(users, currentUser);
      if (userIndex !== -1 && users[userIndex].password) {
        delete users[userIndex].password;
        localStorage.setItem('users', JSON.stringify(users));
      }
    } catch (error) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        document.getElementById('changePassError').textContent = 'Current password is incorrect';
      } else {
        document.getElementById('changePassError').textContent = 'Failed to change password. Please try again.';
      }
      return;
    }
  } else {
    // Legacy fallback
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.id === currentUser.id);
    if (!user || user.password !== currentPassword) {
      document.getElementById('changePassError').textContent = 'Current password is incorrect';
      return;
    }
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    users[userIndex].password = newPassword;
    setStoredUsers(users);
  }

  showNotification('Password changed successfully!', { type: 'success', browser: true });
  closeChangePasswordModal();
}

// --- Profile modal ---

function openProfileModal() {
  if (currentUser) {
    currentUser.role = getRoleByEmail(currentUser.email, currentUser.role);
    try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
      try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
    }
  }
  applyViewModeUI();
  const toggleBtn = document.getElementById('switchAdminViewBtn');
  if (toggleBtn) {
    const managementEnabled = hasManagementAccess();
    toggleBtn.style.display = managementEnabled ? 'block' : 'none';
    if (managementEnabled) {
      toggleBtn.textContent = getCurrentViewMode() === 'admin' ? 'Switch to User View' : 'Switch to Management View';
    }
  }
  // Safely populate profile fields even if `currentUser` is null in headless/evaluate contexts
  const profileNameEl = document.getElementById('profileName');
  const profileEmailEl = document.getElementById('profileEmail');
  const profileJoinedEl = document.getElementById('profileJoined');
  if (currentUser) {
    if (profileNameEl) profileNameEl.textContent = currentUser.name || '';
    if (profileEmailEl) profileEmailEl.textContent = currentUser.email || '';
    if (profileJoinedEl) profileJoinedEl.textContent = currentUser.joinedDate || '';
  } else {
    if (profileNameEl) profileNameEl.textContent = '';
    if (profileEmailEl) profileEmailEl.textContent = '';
    if (profileJoinedEl) profileJoinedEl.textContent = '';
  }
  ensureProfileNotificationControls();
  updateProfileNotificationControls();
  updateProfileDebugControls();
  document.getElementById('profileModal').style.display = 'flex';
}

function closeProfileModal() {
  document.getElementById('profileModal').style.display = 'none';
}

function openChangePasswordModal() {
  document.getElementById('changePasswordModal').style.display = 'flex';
  document.getElementById('changePassError').textContent = '';
}

function closeChangePasswordModal() {
  document.getElementById('changePasswordModal').style.display = 'none';
  document.getElementById('changePasswordForm').reset();
  document.getElementById('changePassError').textContent = '';
}

// --- User data export ---

function downloadUserData() {
  const userData = {
    profile: { name: currentUser.name, email: currentUser.email, joinedDate: currentUser.joinedDate },
    gameData: {
      faithPoints: Math.floor(faithPoints),
      treeProgress: Math.floor(treeProgress),
      passiveRate: passiveRate,
      fruitCount: fruitCount
    },
    downloadDate: new Date().toLocaleString()
  };
  const dataStr = JSON.stringify(userData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `growing-seed-data-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Account deletion ---

async function deleteAccountConfirm() {
  if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;
  if (!confirm('This will permanently delete all your data. Are you sure?')) return;

  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const filteredUsers = users.filter(u => u.id !== currentUser.id);
  setStoredUsers(filteredUsers);
  deleteUserFromCloud(currentUser.email);

  // Delete Firebase Auth account
  if (isFirebaseAuthAvailable() && firebase.auth().currentUser) {
    try {
      await firebase.auth().currentUser.delete();
    } catch (error) {
      console.warn('Failed to delete Firebase Auth account:', error);
    }
  }

  showNotification('Account deleted successfully.', { type: 'success' });
  stopCurrentUserCloudSync();
  localStorage.removeItem('currentUser');
  currentUser = null;
  showAuthInterface();
  switchToLogin();
}

// --- User session helpers ---

function hydrateCurrentUserFromStoredUsers() {
  if (!currentUser) return false;
  const users = getStoredUsersSafe();
  const userIndex = findUserIndexForSession(users, currentUser);
  if (userIndex === -1) return false;
  const mergedUser = {
    ...users[userIndex],
    role: getRoleByEmail(users[userIndex].email, users[userIndex].role),
    viewMode: currentUser.viewMode ?? users[userIndex].viewMode ?? 'user'
  };
  delete mergedUser.password;
  currentUser = mergedUser;
  try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
    try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
  }
  return true;
}

function syncCurrentSessionIfNeeded(updatedUser, options) {
  const persist = options?.persist !== false;
  if (!currentUser || !updatedUser) return;
  const sameId = Number(currentUser.id) === Number(updatedUser.id);
  const sameEmail = normalizeEmail(currentUser.email) !== '' && normalizeEmail(currentUser.email) === normalizeEmail(updatedUser.email);
  if (sameId || sameEmail) {
    currentUser = {
      ...currentUser, ...updatedUser,
      role: getRoleByEmail(updatedUser.email, updatedUser.role),
      viewMode: currentUser.viewMode ?? updatedUser.viewMode ?? 'user'
    };
    delete currentUser.password;
    try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
      try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
    }
    loadUserData();
    updateDisplay({ persist: persist });
  }
}

// Expose functions globally for HTML onclick handlers
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleGoogleSignIn = handleGoogleSignIn;
window.handleLogout = handleLogout;
window.switchToRegister = switchToRegister;
window.switchToLogin = switchToLogin;
window.switchToForgotPassword = switchToForgotPassword;
if (typeof sendResetCode === 'function') {
  window.sendResetCode = sendResetCode;
} else {
  console.debug('sendResetCode not defined at auth.js exposure time');
}
window.handleChangePassword = handleChangePassword;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.openChangePasswordModal = openChangePasswordModal;
window.closeChangePasswordModal = closeChangePasswordModal;
window.downloadUserData = downloadUserData;
window.clearAuthErrors = clearAuthErrors;
