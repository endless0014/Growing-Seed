// Growing Seed — Firebase, Notifications, Cloud Sync & Reminders

let cloudDb = null;
let reminderIntervalId = null;
let currentUserCloudUnsubscribe = null;

// --- Firebase Auth ---

function isFirebaseAuthAvailable() {
  return typeof firebase !== 'undefined' && typeof firebase.auth === 'function';
}

function initializeFirebaseAuth() {
  if (!isFirebaseAuthAvailable()) {
    console.warn('Firebase Auth SDK not loaded. Authentication will use legacy mode.');
    return false;
  }
  try {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    return true;
  } catch (error) {
    console.warn('Firebase Auth init failed:', error);
    return false;
  }
}

async function migrateUserToFirebaseAuth(email, password) {
  if (!isFirebaseAuthAvailable()) return false;
  try {
    await firebase.auth().createUserWithEmailAndPassword(email, password);
    return true;
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') return true;
    console.warn('Firebase Auth migration failed:', error);
    return false;
  }
}

// --- Notification System ---

function ensureNotificationContainer() {
  let container = document.getElementById('appNotifications');
  if (!container) {
    container = document.createElement('div');
    container.id = 'appNotifications';
    container.className = 'app-notifications';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
  }
  return container;
}

function getCapacitorLocalNotificationsPlugin() {
  const capacitor = window.Capacitor;
  if (!capacitor || typeof capacitor.isNativePlatform !== 'function' || !capacitor.isNativePlatform()) return null;
  return capacitor.Plugins?.LocalNotifications || null;
}

async function triggerNativeLocalNotification(message, title) {
  const localNotifications = getCapacitorLocalNotificationsPlugin();
  if (!localNotifications || !isAppNotificationEnabled()) return;
  try {
    const permissionStatus = await localNotifications.checkPermissions();
    if (permissionStatus?.display !== 'granted') return;
    const notificationId = Math.floor(Date.now() % 2147483000);
    await localNotifications.schedule({
      notifications: [{
        id: notificationId,
        title: title || 'Growing Seed',
        body: String(message || ''),
        schedule: { at: new Date(Date.now() + 250) }
      }]
    });
  } catch (error) {
    console.warn('Native notification failed:', error);
  }
}

function triggerBrowserNotification(message, title) {
  if (!isAppNotificationEnabled()) return;
  const localNotifications = getCapacitorLocalNotificationsPlugin();
  if (localNotifications) {
    void triggerNativeLocalNotification(message, title || 'Growing Seed');
    return;
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title || 'Growing Seed', { body: String(message || '') });
  } catch (error) {
    console.warn('Browser notification failed:', error);
  }
}

function requestBrowserNotificationPermission() {
  const localNotifications = getCapacitorLocalNotificationsPlugin();
  if (localNotifications) {
    return localNotifications
      .checkPermissions()
      .then(status => {
        if (status?.display === 'granted') return 'granted';
        return localNotifications.requestPermissions().then(rs => rs?.display || 'default');
      })
      .catch(error => { console.warn('Native notification permission request failed:', error); return 'default'; });
  }
  if (!('Notification' in window)) return Promise.resolve('unsupported');
  if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
  return Notification.requestPermission().catch(error => {
    console.warn('Notification permission request failed:', error);
    return Notification.permission || 'default';
  });
}

function isAppNotificationEnabled() {
  const storedPreference = localStorage.getItem(NOTIFICATION_PREFERENCE_KEY);
  if (storedPreference === 'enabled') return true;
  if (storedPreference === 'disabled') return false;
  return true;
}

function setAppNotificationEnabled(enabled) {
  localStorage.setItem(NOTIFICATION_PREFERENCE_KEY, enabled ? 'enabled' : 'disabled');
}

function getNotificationToggleText() {
  return isAppNotificationEnabled() ? 'Notification Enabled' : 'Notification Disabled';
}

function showNotification(message, options) {
  const opts = options || {};
  const type = opts.type || 'info';
  const title = opts.title || '';
  const duration = opts.duration !== undefined ? opts.duration : NOTIFICATION_DEFAULT_DURATION;
  const browser = opts.browser || false;
  const container = ensureNotificationContainer();
  const toast = document.createElement('div');
  toast.className = `app-notification ${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'app-notification-close';
  closeBtn.type = 'button';
  closeBtn.textContent = 'x';
  closeBtn.setAttribute('aria-label', 'Dismiss notification');

  const contentWrap = document.createElement('div');
  contentWrap.className = 'app-notification-content';
  if (title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'app-notification-title';
    titleEl.textContent = title;
    contentWrap.appendChild(titleEl);
  }
  const bodyEl = document.createElement('div');
  bodyEl.className = 'app-notification-message';
  bodyEl.textContent = String(message || '');
  contentWrap.appendChild(bodyEl);

  toast.appendChild(contentWrap);
  toast.appendChild(closeBtn);
  container.appendChild(toast);
  requestAnimationFrame(() => { toast.classList.add('visible'); });

  const dismiss = () => {
    toast.classList.remove('visible');
    window.setTimeout(() => { toast.remove(); }, 220);
  };
  closeBtn.addEventListener('click', dismiss);
  if (duration > 0) window.setTimeout(dismiss, duration);
  if (browser) triggerBrowserNotification(message, title || 'Growing Seed');
}

// --- Firebase / Firestore ---

function isFirebaseConfigured() {
  return Object.values(FIREBASE_CONFIG).every(value => String(value || '').trim() !== '');
}

function initializeCloudDatabase() {
  if (!window.firebase) return false;
  if (!isFirebaseConfigured()) {
    console.warn('Firebase config is missing. Shared registration sync is disabled until FIREBASE_CONFIG is filled.');
    return false;
  }
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    cloudDb = firebase.firestore();
    return true;
  } catch (error) {
    console.warn('Cloud database init failed:', error);
    cloudDb = null;
    return false;
  }
}

function getCloudUsersCollection() {
  return cloudDb ? cloudDb.collection(CLOUD_USERS_COLLECTION) : null;
}

// --- Cloud CRUD ---

async function upsertUserInCloud(user) {
  const usersCollection = getCloudUsersCollection();
  if (!usersCollection || !user?.email) return;
  try {
    const normalizedEmail = normalizeEmail(user.email);
    const cloudUser = sanitizeUserForCloud(user);
    const {
      taskCompletions = {},
      dailyLoginState = normalizeDailyLoginState({}),
      ...cloudUserFields
    } = cloudUser;
    const userDoc = usersCollection.doc(normalizedEmail);

    await userDoc.set(cloudUserFields, { merge: true });
    await userDoc.update({ taskCompletions, dailyLoginState });
  } catch (error) {
    console.warn('Cloud upsert failed:', error);
  }
}

async function deleteUserFromCloud(email) {
  const usersCollection = getCloudUsersCollection();
  if (!usersCollection || !email) return;
  try {
    await usersCollection.doc(normalizeEmail(email)).delete();
  } catch (error) {
    console.warn('Cloud delete failed:', error);
  }
}

function syncUsersToCloud(users) {
  const usersCollection = getCloudUsersCollection();
  if (!usersCollection || !Array.isArray(users)) return;
  Promise.all(users.map(user => upsertUserInCloud(user))).catch(error => {
    console.warn('Cloud sync failed:', error);
  });
}

// --- Cloud sync ---

function stopCurrentUserCloudSync() {
  if (typeof currentUserCloudUnsubscribe === 'function') currentUserCloudUnsubscribe();
  currentUserCloudUnsubscribe = null;
}

function haveCloudUserStateDifferences(baseUser, incomingUser) {
  if (!baseUser || !incomingUser) return false;
  const trackedNumberFields = [
    'faithPoints', 'treeProgress', 'passiveRate', 'fruitCount',
    'pointsForFruit', 'loginStreakCurrent', 'loginStreakLongest'
  ];
  const hasNumericDiff = trackedNumberFields.some(field =>
    Number(baseUser[field] ?? 0) !== Number(incomingUser[field] ?? 0)
  );
  if (hasNumericDiff) return true;
  if (Boolean(baseUser.maxBloomReached) !== Boolean(incomingUser.maxBloomReached)) return true;
  if (JSON.stringify(baseUser.taskCompletions || {}) !== JSON.stringify(incomingUser.taskCompletions || {})) return true;
  if (JSON.stringify(normalizeDailyLoginState(baseUser.dailyLoginState)) !== JSON.stringify(normalizeDailyLoginState(incomingUser.dailyLoginState))) return true;
  const baseRole = getRoleByEmail(baseUser.email, baseUser.role);
  const incomingRole = getRoleByEmail(incomingUser.email, incomingUser.role);
  if (baseRole !== incomingRole) return true;
  if (Number(baseUser.roleUpdatedAt ?? 0) !== Number(incomingUser.roleUpdatedAt ?? 0)) return true;
  if (String(baseUser.viewMode || 'user') !== String(incomingUser.viewMode || 'user')) return true;
  return String(baseUser.lastLoginDateKey || '') !== String(incomingUser.lastLoginDateKey || '');
}

function startCurrentUserCloudSync() {
  stopCurrentUserCloudSync();
  if (!currentUser?.email) return;
  const usersCollection = getCloudUsersCollection();
  if (!usersCollection) return;
  const normalizedEmail = normalizeEmail(currentUser.email);
  currentUserCloudUnsubscribe = usersCollection.doc(normalizedEmail).onSnapshot(snapshot => {
    if (!snapshot.exists || !currentUser) return;
    const cloudUser = normalizeStoredUser(snapshot.data(), currentUser.id);
    if (!cloudUser?.email || normalizeEmail(cloudUser.email) !== normalizeEmail(currentUser.email)) return;

    const localUpdatedAt = Number(currentUser.updatedAt ?? currentUser.lastActiveAt ?? 0);
    const cloudUpdatedAt = Number(cloudUser.updatedAt ?? cloudUser.lastActiveAt ?? 0);
    const localRoleUpdatedAt = Number(currentUser.roleUpdatedAt ?? 0);
    const cloudRoleUpdatedAt = Number(cloudUser.roleUpdatedAt ?? 0);
    const rollbackMetrics = getRollbackMetrics(
      { ...currentUser, faithPoints: Math.floor(Number(faithPoints ?? currentUser.faithPoints ?? 0) || 0), dailyLoginState },
      cloudUser,
      { localDailyLoginState: dailyLoginState, incomingDailyLoginState: cloudUser.dailyLoginState }
    );
    const shouldApplyRoleUpdate = Number.isFinite(cloudRoleUpdatedAt) && cloudRoleUpdatedAt > 0
      && (!Number.isFinite(localRoleUpdatedAt) || cloudRoleUpdatedAt > localRoleUpdatedAt);
    const hasCloudTimestamp = Number.isFinite(cloudUpdatedAt) && cloudUpdatedAt > 0;
    const hasLocalTimestamp = Number.isFinite(localUpdatedAt) && localUpdatedAt > 0;
    const isCloudClearlyNewer = hasCloudTimestamp && (!hasLocalTimestamp || cloudUpdatedAt > localUpdatedAt);
    const isCloudStaleByTimestamp = hasLocalTimestamp && hasCloudTimestamp && cloudUpdatedAt < localUpdatedAt;
    const shouldIgnoreRollback = rollbackMetrics.hasRollback && !isCloudClearlyNewer && !shouldApplyRoleUpdate;
    let cloudUserToApply = cloudUser;

    if (shouldApplyRoleUpdate && rollbackMetrics.hasRollback) {
      cloudUserToApply = {
        ...cloudUser,
        faithPoints: Math.floor(Number(faithPoints ?? currentUser.faithPoints ?? 0) || 0),
        loginStreakCurrent: Math.max(getUserCurrentLoginStreak(currentUser), getUserCurrentLoginStreak(cloudUser)),
        loginStreakLongest: Math.max(getUserLongestLoginStreak(currentUser), getUserLongestLoginStreak(cloudUser)),
        dailyLoginState: normalizeDailyLoginState(dailyLoginState),
        updatedAt: Math.max(localUpdatedAt || 0, cloudUpdatedAt || 0)
      };
      debugFpLog('cloud-snapshot-role-update-without-rollback', {
        localUpdatedAt, cloudUpdatedAt, localRoleUpdatedAt, cloudRoleUpdatedAt,
        fpRollbackAmount: rollbackMetrics.fpRollbackAmount, streakRollbackDays: rollbackMetrics.streakRollbackDays
      });
    }

    if (!shouldApplyRoleUpdate && (isCloudStaleByTimestamp || shouldIgnoreRollback)) {
      const ignoredEventName = isCloudStaleByTimestamp ? 'cloud-snapshot-ignored-stale' : 'cloud-snapshot-ignored-rollback';
      debugFpLog(ignoredEventName, {
        localUpdatedAt, cloudUpdatedAt, localRoleUpdatedAt, cloudRoleUpdatedAt,
        fpRollbackAmount: rollbackMetrics.fpRollbackAmount, streakRollbackDays: rollbackMetrics.streakRollbackDays,
        localFaithPoints: Math.floor(Number(currentUser.faithPoints ?? faithPoints ?? 0) || 0),
        cloudFaithPoints: Math.floor(Number(cloudUser.faithPoints ?? 0) || 0)
      });
      if (rollbackMetrics.hasRollback) {
        showNotification(`Rollback prevented: -${rollbackMetrics.fpRollbackAmount} FP, -${rollbackMetrics.streakRollbackDays} day(s).`, { type: 'warning', duration: 6500 });
      }
      return;
    }

    if (!haveCloudUserStateDifferences(currentUser, cloudUserToApply)) return;
    debugFpLog('cloud-snapshot-applied', {
      localUpdatedAt, cloudUpdatedAt,
      previousFaithPoints: Math.floor(Number(currentUser.faithPoints ?? faithPoints ?? 0) || 0),
      incomingFaithPoints: Math.floor(Number(cloudUserToApply.faithPoints ?? 0) || 0)
    });

    const users = getStoredUsersSafe();
    const userIndex = users.findIndex(user => normalizeEmail(user.email) === normalizedEmail);
    if (userIndex !== -1) {
      users[userIndex] = { ...users[userIndex], ...cloudUserToApply, role: getRoleByEmail(cloudUserToApply.email, cloudUserToApply.role) };
      localStorage.setItem('users', JSON.stringify(users));
    }
    currentUser = {
      ...currentUser, ...cloudUserToApply,
      role: getRoleByEmail(cloudUserToApply.email, cloudUserToApply.role),
      viewMode: currentUser.viewMode ?? cloudUserToApply.viewMode ?? 'user'
    };
    delete currentUser.password;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    loadUserData();
    updateDisplay({ persist: false });
  }, error => {
    console.warn('Current user cloud sync failed:', error);
  });
}

function mergeUsersByLatestTimestamp(localUsers, cloudUsers) {
  const mergedByEmail = new Map();
  localUsers.map((user, index) => normalizeStoredUser(user, Date.now() + index)).forEach(user => {
    if (user.email) mergedByEmail.set(user.email, user);
  });
  cloudUsers.map((user, index) => normalizeStoredUser(user, Date.now() + index + 5000)).forEach(cloudUser => {
    if (!cloudUser.email) return;
    const localUser = mergedByEmail.get(cloudUser.email);
    if (!localUser) { mergedByEmail.set(cloudUser.email, cloudUser); return; }
    const localUpdatedAt = Number(localUser.updatedAt ?? 0);
    const cloudUpdatedAt = Number(cloudUser.updatedAt ?? 0);
    const latestUser = Number.isFinite(cloudUpdatedAt) && cloudUpdatedAt > localUpdatedAt ? cloudUser : localUser;
    const localRoleUpdatedAt = Number(localUser.roleUpdatedAt ?? 0);
    const cloudRoleUpdatedAt = Number(cloudUser.roleUpdatedAt ?? 0);
    const localResolvedRole = getRoleByEmail(localUser.email, localUser.role);
    const cloudResolvedRole = getRoleByEmail(cloudUser.email, cloudUser.role);
    const shouldPreferCloudRole = cloudRoleUpdatedAt > localRoleUpdatedAt
      || (cloudRoleUpdatedAt === localRoleUpdatedAt && localResolvedRole === 'user' && cloudResolvedRole !== 'user');
    const roleSource = shouldPreferCloudRole ? cloudUser : localUser;
    const merged = {
      ...latestUser,
      role: getRoleByEmail(latestUser.email, roleSource.role),
      roleUpdatedAt: Math.max(
        Number.isFinite(localRoleUpdatedAt) ? localRoleUpdatedAt : 0,
        Number.isFinite(cloudRoleUpdatedAt) ? cloudRoleUpdatedAt : 0
      )
    };
    // Preserve local password for legacy login if cloud doesn't have one
    if (!merged.password && localUser.password) {
      merged.password = localUser.password;
    }
    mergedByEmail.set(cloudUser.email, merged);
  });
  return Array.from(mergedByEmail.values());
}

async function syncUsersFromCloudToLocal() {
  const usersCollection = getCloudUsersCollection();
  if (!usersCollection) return false;
  try {
    const localUsers = getStoredUsersSafe();
    const snapshot = await usersCollection.get();
    const cloudUsers = snapshot.docs
      .map((doc, index) => normalizeStoredUser(doc.data(), Date.now() + index))
      .filter(user => Boolean(user.email));
    const mergedUsers = mergeUsersByLatestTimestamp(localUsers, cloudUsers);
    localStorage.setItem('users', JSON.stringify(mergedUsers));
    return true;
  } catch (error) {
    console.warn('Cloud read failed:', error);
    return false;
  }
}

async function migrateLocalUsersToCloudOnce() {
  if (!getCloudUsersCollection()) return;
  if (localStorage.getItem(CLOUD_MIGRATION_KEY) === 'done') return;
  const localUsers = getStoredUsersSafe();
  if (localUsers.length > 0) {
    await Promise.all(localUsers.map(user => upsertUserInCloud(user)));
  }
  localStorage.setItem(CLOUD_MIGRATION_KEY, 'done');
}

async function applyEmailCorrections() {
  const corrections = Object.entries(EMAIL_CORRECTIONS);
  if (corrections.length === 0) return;
  const users = getStoredUsersSafe();
  let usersChanged = false;
  corrections.forEach(([fromEmailRaw, toEmailRaw]) => {
    const fromEmail = normalizeEmail(fromEmailRaw);
    const toEmail = normalizeEmail(toEmailRaw);
    if (!fromEmail || !toEmail || fromEmail === toEmail) return;
    const fromIndex = users.findIndex(user => normalizeEmail(user.email) === fromEmail);
    if (fromIndex === -1) return;
    const existingTargetIndex = users.findIndex(user => normalizeEmail(user.email) === toEmail);
    const sourceUser = { ...users[fromIndex], email: toEmail, updatedAt: Date.now() };
    if (existingTargetIndex !== -1 && existingTargetIndex !== fromIndex) {
      const targetUser = users[existingTargetIndex];
      const sourceUpdatedAt = Number(sourceUser.updatedAt ?? sourceUser.lastActiveAt ?? 0);
      const targetUpdatedAt = Number(targetUser.updatedAt ?? targetUser.lastActiveAt ?? 0);
      users[existingTargetIndex] = sourceUpdatedAt >= targetUpdatedAt ? sourceUser : targetUser;
      users.splice(fromIndex, 1);
    } else {
      users[fromIndex] = sourceUser;
    }
    usersChanged = true;
  });
  if (usersChanged) setStoredUsers(users);
  if (currentUser?.email) {
    const correctedCurrentEmail = getCorrectedEmail(currentUser.email);
    if (correctedCurrentEmail !== normalizeEmail(currentUser.email)) {
      currentUser.email = correctedCurrentEmail;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
  }
  const usersCollection = getCloudUsersCollection();
  if (!usersCollection) return;
  for (const [fromEmailRaw, toEmailRaw] of corrections) {
    const fromEmail = normalizeEmail(fromEmailRaw);
    const toEmail = normalizeEmail(toEmailRaw);
    if (!fromEmail || !toEmail || fromEmail === toEmail) continue;
    try {
      const fromDocRef = usersCollection.doc(fromEmail);
      const fromSnapshot = await fromDocRef.get();
      if (!fromSnapshot.exists) continue;
      const correctedCloudUser = { ...normalizeStoredUser(fromSnapshot.data(), Date.now()), email: toEmail, updatedAt: Date.now() };
      await usersCollection.doc(toEmail).set(correctedCloudUser, { merge: true });
      await fromDocRef.delete();
    } catch (error) {
      console.warn('Email correction sync failed:', error);
    }
  }
}

function enforceAdminRoleInStorage() {
  const safeUsers = getStoredUsersSafe();
  let usersChanged = false;
  const normalizedUsers = safeUsers.map(user => {
    const expectedRole = getRoleByEmail(user.email, user.role);
    if (user.role !== expectedRole) { usersChanged = true; return { ...user, role: expectedRole }; }
    return user;
  });
  if (usersChanged) setStoredUsers(normalizedUsers);
  const currentUserRaw = localStorage.getItem('currentUser');
  if (currentUserRaw) {
    try {
      const parsedCurrentUser = JSON.parse(currentUserRaw);
      const expectedRole = getRoleByEmail(parsedCurrentUser.email, parsedCurrentUser.role);
      if (parsedCurrentUser.role !== expectedRole) {
        parsedCurrentUser.role = expectedRole;
        localStorage.setItem('currentUser', JSON.stringify(parsedCurrentUser));
      }
    } catch { localStorage.removeItem('currentUser'); }
  }
}

// --- Rollback recovery ---

function getRollbackRecoveryMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ROLLBACK_RECOVERY_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function hasRollbackRecoveryRunForEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;
  return getRollbackRecoveryMap()[normalizedEmail] === true;
}

function markRollbackRecoveryRunForEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;
  const recoveryMap = getRollbackRecoveryMap();
  recoveryMap[normalizedEmail] = true;
  localStorage.setItem(ROLLBACK_RECOVERY_KEY, JSON.stringify(recoveryMap));
}

async function runRollbackRecoveryForCurrentUserOnce() {
  if (!currentUser?.email) return null;
  const normalizedEmail = normalizeEmail(currentUser.email);
  if (!normalizedEmail || hasRollbackRecoveryRunForEmail(normalizedEmail)) return null;
  const users = getStoredUsersSafe();
  const storedUser = users.find(user => normalizeEmail(user.email) === normalizedEmail) || null;
  let cloudUser = null;
  const usersCollection = getCloudUsersCollection();
  if (usersCollection) {
    try {
      const snapshot = await usersCollection.doc(normalizedEmail).get();
      if (snapshot.exists) cloudUser = normalizeStoredUser(snapshot.data(), currentUser.id);
    } catch (error) {
      debugFpLog('rollback-recovery-cloud-read-error', { error: String(error?.message || error) });
    }
  }
  const currentUserState = {
    ...currentUser,
    faithPoints: Math.floor(Number(currentUser.faithPoints ?? 0) || 0),
    dailyLoginState: normalizeDailyLoginState(currentUser.dailyLoginState ?? dailyLoginState)
  };
  const candidateUsers = [currentUserState, storedUser, cloudUser].filter(Boolean);
  if (candidateUsers.length === 0) { markRollbackRecoveryRunForEmail(normalizedEmail); return null; }

  const bestFaithPoints = Math.max(...candidateUsers.map(user => Math.floor(Number(user.faithPoints ?? 0) || 0)));
  const bestCurrentStreak = Math.max(...candidateUsers.map(user => getUserCurrentLoginStreak(user)));
  const bestLongestStreak = Math.max(...candidateUsers.map(user => getUserLongestLoginStreak(user)));
  const bestDailySource = candidateUsers.reduce((bestUser, candidateUser) => {
    if (!bestUser) return candidateUser;
    return getLegacyDailyLoginStreak(candidateUser.dailyLoginState) > getLegacyDailyLoginStreak(bestUser.dailyLoginState)
      ? candidateUser : bestUser;
  }, null);

  const recoveredFp = Math.max(0, bestFaithPoints - Math.floor(Number(currentUserState.faithPoints ?? 0) || 0));
  const recoveredStreakDays = Math.max(0, bestCurrentStreak - getUserCurrentLoginStreak(currentUserState));
  if (recoveredFp === 0 && recoveredStreakDays === 0) {
    markRollbackRecoveryRunForEmail(normalizedEmail);
    return { recoveredFp: 0, recoveredStreakDays: 0 };
  }

  const now = Date.now();
  const recoveredDailyLoginState = normalizeDailyLoginState(bestDailySource?.dailyLoginState ?? dailyLoginState);
  currentUser.faithPoints = bestFaithPoints;
  currentUser.loginStreakCurrent = Math.max(bestCurrentStreak, 1);
  currentUser.loginStreakLongest = Math.max(bestLongestStreak, currentUser.loginStreakCurrent);
  currentUser.dailyLoginState = recoveredDailyLoginState;
  currentUser.lastActiveAt = now;
  currentUser.updatedAt = now;

  const userIndex = users.findIndex(user => normalizeEmail(user.email) === normalizedEmail);
  if (userIndex !== -1) {
    users[userIndex] = {
      ...users[userIndex], faithPoints: bestFaithPoints,
      loginStreakCurrent: currentUser.loginStreakCurrent, loginStreakLongest: currentUser.loginStreakLongest,
      dailyLoginState: recoveredDailyLoginState, lastActiveAt: now, updatedAt: now
    };
  } else {
    users.push(normalizeStoredUser(currentUser, currentUser.id));
  }
  setStoredUsers(users);
  faithPoints = bestFaithPoints;
  dailyLoginState = recoveredDailyLoginState;
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  await upsertUserInCloud(currentUser);

  debugFpLog('rollback-recovery-applied', {
    recoveredFp, recoveredStreakDays,
    restoredFaithPoints: bestFaithPoints,
    restoredCurrentStreak: currentUser.loginStreakCurrent,
    restoredLongestStreak: currentUser.loginStreakLongest
  });
  showNotification(`Recovery applied: +${recoveredFp} FP, +${recoveredStreakDays} day(s) streak restored.`, { type: 'success', duration: 7000 });
  markRollbackRecoveryRunForEmail(normalizedEmail);
  return { recoveredFp, recoveredStreakDays };
}

// --- Reminders ---

function getReminderLogSafe() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REMINDER_LOG_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function getReminderUserPrefix() {
  const userId = Number(currentUser?.id);
  if (Number.isFinite(userId)) return `u${userId}`;
  return `e${normalizeEmail(currentUser?.email || 'guest')}`;
}

function markReminderSent(reminderId, periodKey) {
  const log = getReminderLogSafe();
  log[`${getReminderUserPrefix()}::${reminderId}::${periodKey}`] = Date.now();
  localStorage.setItem(REMINDER_LOG_KEY, JSON.stringify(log));
}

function hasReminderBeenSent(reminderId, periodKey) {
  const log = getReminderLogSafe();
  return Boolean(log[`${getReminderUserPrefix()}::${reminderId}::${periodKey}`]);
}

function checkAndSendScheduledReminders() {
  if (!currentUser) return;
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  if (minute !== 0) return;
  const dayOfWeek = now.getDay();
  const dayKey = getDateKeyFromDate(now);
  const weekKey = getSundayWeekKey(now);
  const pendingDailyTasks = ['pray', 'bible', 'devotion'].filter(taskKey => !isTaskDoneForCurrentPeriod(taskKey));
  const pendingWeeklySundayTasks = ['smallgroup', 'attendService'].filter(taskKey => !isTaskDoneForCurrentPeriod(taskKey));
  const dailyMessage = pendingDailyTasks.length > 0
    ? `${pendingDailyTasks.map(taskKey => taskDisplayNames[taskKey]).join(', ')} still pending today.` : '';
  const sundayMessage = pendingWeeklySundayTasks.length > 0
    ? `${pendingWeeklySundayTasks.map(taskKey => taskDisplayNames[taskKey]).join(' and ')} still pending this week.` : '';

  const reminders = [
    { id: 'daily-0500', hour: 5, minute: 0, periodKey: dayKey, shouldNotify: () => pendingDailyTasks.length > 0, message: `5:00 AM reminder: ${dailyMessage}` },
    { id: 'daily-1300', hour: 13, minute: 0, periodKey: dayKey, shouldNotify: () => pendingDailyTasks.length > 0, message: `1:00 PM reminder: ${dailyMessage}` },
    { id: 'daily-1900', hour: 19, minute: 0, periodKey: dayKey, shouldNotify: () => pendingDailyTasks.length > 0, message: `7:00 PM reminder: ${dailyMessage}` },
    { id: 'weekly-sun-1100', hour: 11, minute: 0, weekday: 0, periodKey: weekKey, shouldNotify: () => pendingWeeklySundayTasks.length > 0, message: `Sunday 11:00 AM reminder: ${sundayMessage}` }
  ];

  reminders.forEach(reminder => {
    if (hour !== reminder.hour || minute !== reminder.minute) return;
    if (typeof reminder.weekday === 'number' && reminder.weekday !== dayOfWeek) return;
    if (typeof reminder.shouldNotify === 'function' && !reminder.shouldNotify()) return;
    if (hasReminderBeenSent(reminder.id, reminder.periodKey)) return;
    showNotification(reminder.message, { type: 'info', title: 'Task Reminder', duration: 8000, browser: true });
    markReminderSent(reminder.id, reminder.periodKey);
  });
}

function startScheduledReminders() {
  if (reminderIntervalId) clearInterval(reminderIntervalId);
  checkAndSendScheduledReminders();
  reminderIntervalId = window.setInterval(checkAndSendScheduledReminders, 30000);
}

function stopScheduledReminders() {
  if (reminderIntervalId) { clearInterval(reminderIntervalId); reminderIntervalId = null; }
}
