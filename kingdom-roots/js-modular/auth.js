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
  const email = normalizeEmail(document.getElementById('loginEmail').value);
  const password = document.getElementById('loginPassword').value;

  await syncUsersFromCloudToLocal();

  let authenticated = false;

  let firebaseAuthWorking = false;
  if (isFirebaseAuthAvailable()) {
    try {
      await firebase.auth().signInWithEmailAndPassword(email, password);
      authenticated = true;
      firebaseAuthWorking = true;
    } catch (authError) {
      const isConfigOrNetworkError = authError.code === 'auth/configuration-not-found'
        || authError.code === 'auth/network-request-failed'
        || authError.code === 'auth/internal-error';

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
              // Clean up plaintext password after successful migration
              const userIndex = users.findIndex(u => normalizeEmail(u.email) === email);
              if (userIndex !== -1) {
                delete users[userIndex].password;
                localStorage.setItem('users', JSON.stringify(users));
              }
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
    document.getElementById('loginError').textContent = 'Invalid email or password';
    return;
  }

  // Load user data from local storage
  const users = getStoredUsersSafe();
  const user = users.find(u => normalizeEmail(u.email) === email);
  if (!user) {
    document.getElementById('loginError').textContent = 'Account data not found. Please register.';
    if (isFirebaseAuthAvailable()) firebase.auth().signOut().catch(() => {});
    return;
  }

  hasAutoPromptedDailyLogin = false;
  stopCurrentUserCloudSync();

  const userIndex = users.findIndex(u => Number(u.id) === Number(user.id));
  const normalizedUser = normalizeStoredUser(user, user.id);
  updateConsecutiveLoginStats(normalizedUser);
  normalizedUser.lastLogin = new Date().toLocaleString();
  normalizedUser.lastActiveAt = Date.now();
  normalizedUser.viewMode = normalizedUser.viewMode ?? getDefaultViewModeForRole(normalizedUser.role);

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
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
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
  const email = normalizeEmail(document.getElementById('regEmail').value);
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
  if (isFirebaseAuthAvailable()) {
    try {
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      if (userCredential.user && userCredential.user.updateProfile) {
        await userCredential.user.updateProfile({ displayName: name });
      }
    } catch (authError) {
      if (authError.code === 'auth/email-already-in-use') {
        document.getElementById('registerError').textContent = 'Email already registered';
      } else if (authError.code === 'auth/weak-password') {
        document.getElementById('registerError').textContent = 'Password is too weak. Use at least 6 characters.';
      } else {
        document.getElementById('registerError').textContent = 'Registration failed. Please try again.';
      }
      return;
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

  // Store password only if Firebase Auth is not available (legacy fallback)
  if (!isFirebaseAuthAvailable()) {
    newUser.password = password;
  }

  users.push(newUser);
  setStoredUsers(users);
  stopCurrentUserCloudSync();

  currentUser = { ...newUser };
  hasAutoPromptedDailyLogin = false;
  delete currentUser.password;
  localStorage.setItem('currentUser', JSON.stringify(currentUser));

  clearAuthErrors();
  document.getElementById('registerForm').reset();
  showAppInterface();
  resetGameState();
  updateDisplay();
  startCurrentUserCloudSync();
  startScheduledReminders();
  startInactivityTimer();
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
  stopForceLogoutListener();
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
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
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
  document.getElementById('profileName').textContent = currentUser.name;
  document.getElementById('profileEmail').textContent = currentUser.email;
  document.getElementById('profileJoined').textContent = currentUser.joinedDate;
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
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
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
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    loadUserData();
    updateDisplay({ persist: persist });
  }
}
