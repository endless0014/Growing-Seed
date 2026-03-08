// Authentication System
let currentUser = null;
const ADMIN_EMAILS = ['endlesssh0014@gmail.com', 'endlessssh0014@gmail.com', 'endless0014@gmail.com'];
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDXPQnVHn9ux9Je5vGASWKig3AdBvnlOIk',
  authDomain: 'growing-seed-fc973.firebaseapp.com',
  projectId: 'growing-seed-fc973',
  storageBucket: 'growing-seed-fc973.firebasestorage.app',
  messagingSenderId: '154122860320',
  appId: '1:154122860320:web:90f610016b49ad25ef0945'
};
const CLOUD_USERS_COLLECTION = 'users';
const CLOUD_MIGRATION_KEY = 'growingSeedCloudMigrationDoneV1';
const NOTIFICATION_PREFERENCE_KEY = 'growingSeedNotificationsEnabled';
const REMINDER_LOG_KEY = 'growingSeedReminderLogV1';
let cloudDb = null;
const NOTIFICATION_DEFAULT_DURATION = 4200;
let reminderIntervalId = null;

const DAILY_LOGIN_REWARDS = [2, 2, 3, 4, 5, 6, 8];
const DAILY_LOGIN_STAGE_KEYS = [
  'seedStageImg',
  'germinationStageImg',
  'seedlingStageImg',
  'saplingStageImg',
  'youngTreeStageImg',
  'matureTreeStageImg',
  'oldTreeStageImg'
];
let dailyLoginState = {
  streakDay: 1,
  lastClaimDate: '',
  cycleStartDate: '',
  claimedDays: []
};

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

function triggerBrowserNotification(message, title = 'Growing Seed') {
  if (!isAppNotificationEnabled()) {
    return;
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    new Notification(title, { body: String(message || '') });
  } catch (error) {
    console.warn('Browser notification failed:', error);
  }
}

function requestBrowserNotificationPermission() {
  if (!('Notification' in window)) {
    return Promise.resolve('unsupported');
  }

  if (Notification.permission !== 'default') {
    return Promise.resolve(Notification.permission);
  }

  return Notification.requestPermission().catch(error => {
    console.warn('Notification permission request failed:', error);
    return Notification.permission || 'default';
  });
}

function isAppNotificationEnabled() {
  const storedPreference = localStorage.getItem(NOTIFICATION_PREFERENCE_KEY);
  if (storedPreference === 'enabled') {
    return true;
  }

  if (storedPreference === 'disabled') {
    return false;
  }

  return true;
}

function setAppNotificationEnabled(enabled) {
  localStorage.setItem(NOTIFICATION_PREFERENCE_KEY, enabled ? 'enabled' : 'disabled');
}

function getNotificationToggleText() {
  return isAppNotificationEnabled() ? 'Notification Enabled' : 'Notification Disabled';
}

function updateProfileNotificationControls() {
  const enableBtn = document.getElementById('enableNotificationsBtn');
  if (!enableBtn) {
    return;
  }

  enableBtn.textContent = getNotificationToggleText();
  enableBtn.disabled = false;
}

function ensureProfileNotificationControls() {
  const hasButton = Boolean(document.getElementById('enableNotificationsBtn'));
  if (hasButton) {
    return;
  }

  const profileModal = document.getElementById('profileModal');
  if (!profileModal) {
    return;
  }

  const settingsHeading = Array.from(profileModal.querySelectorAll('h3')).find(heading => {
    return String(heading.textContent || '').toLowerCase().includes('settings');
  });

  const settingsSection = settingsHeading ? settingsHeading.closest('.profile-section') : null;
  if (!settingsSection) {
    return;
  }

  if (!hasButton) {
    const enableBtn = document.createElement('button');
    enableBtn.id = 'enableNotificationsBtn';
    enableBtn.className = 'settings-btn';
    enableBtn.type = 'button';
    enableBtn.textContent = getNotificationToggleText();
    enableBtn.addEventListener('click', enableBrowserNotificationsFromProfile);

    // Insert after admin toggle when available for consistent order.
    const switchAdminBtn = settingsSection.querySelector('#switchAdminViewBtn');
    if (switchAdminBtn && switchAdminBtn.parentNode === settingsSection) {
      switchAdminBtn.insertAdjacentElement('afterend', enableBtn);
    } else {
      settingsSection.appendChild(enableBtn);
    }
  }

  const statusEl = document.getElementById('notificationPermissionStatus');
  if (statusEl) {
    statusEl.remove();
  }
}

async function enableBrowserNotificationsFromProfile() {
  const willEnable = !isAppNotificationEnabled();

  if (willEnable) {
    if (!('Notification' in window)) {
      setAppNotificationEnabled(true);
      updateProfileNotificationControls();
      showNotification('Notification Enabled.', { type: 'success' });
      return;
    }

    if (Notification.permission === 'denied') {
      setAppNotificationEnabled(false);
      updateProfileNotificationControls();
      showNotification('Browser blocked notifications. Enable permission in browser settings first.', { type: 'warning' });
      return;
    }

    const permission = await requestBrowserNotificationPermission();
    if (permission !== 'granted') {
      setAppNotificationEnabled(false);
      updateProfileNotificationControls();
      showNotification('Notification Disabled.', { type: 'info' });
      return;
    }

    setAppNotificationEnabled(true);
    updateProfileNotificationControls();
    showNotification('Notification Enabled.', { type: 'success', browser: true });
    return;
  }

  setAppNotificationEnabled(false);
  updateProfileNotificationControls();
  showNotification('Notification Disabled.', { type: 'info' });
}

function showNotification(message, options = {}) {
  const {
    type = 'info',
    title = '',
    duration = NOTIFICATION_DEFAULT_DURATION,
    browser = false
  } = options;

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

  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  const dismiss = () => {
    toast.classList.remove('visible');
    window.setTimeout(() => {
      toast.remove();
    }, 220);
  };

  closeBtn.addEventListener('click', dismiss);

  if (duration > 0) {
    window.setTimeout(dismiss, duration);
  }

  if (browser) {
    triggerBrowserNotification(message, title || 'Growing Seed');
  }
}

function getReminderLogSafe() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REMINDER_LOG_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getReminderUserPrefix() {
  const userId = Number(currentUser?.id);
  if (Number.isFinite(userId)) {
    return `u${userId}`;
  }
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

function getDateKeyFromDate(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function getSundayWeekKey(date) {
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return getDateKeyFromDate(copy);
}

function checkAndSendScheduledReminders() {
  if (!currentUser) {
    return;
  }

  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  if (minute !== 0) {
    return;
  }

  const dayOfWeek = now.getDay();
  const dayKey = getDateKeyFromDate(now);
  const weekKey = getSundayWeekKey(now);
  const pendingDailyTasks = ['pray', 'bible', 'devotion'].filter(taskKey => !isTaskDoneForCurrentPeriod(taskKey));
  const pendingWeeklySundayTasks = ['smallgroup', 'attendService'].filter(taskKey => !isTaskDoneForCurrentPeriod(taskKey));

  const dailyMessage = pendingDailyTasks.length > 0
    ? `${pendingDailyTasks.map(taskKey => taskDisplayNames[taskKey]).join(', ')} still pending today.`
    : '';
  const sundayMessage = pendingWeeklySundayTasks.length > 0
    ? `${pendingWeeklySundayTasks.map(taskKey => taskDisplayNames[taskKey]).join(' and ')} still pending this week.`
    : '';

  const reminders = [
    {
      id: 'daily-0500',
      hour: 5,
      minute: 0,
      periodKey: dayKey,
      shouldNotify: () => pendingDailyTasks.length > 0,
      message: `5:00 AM reminder: ${dailyMessage}`
    },
    {
      id: 'daily-1300',
      hour: 13,
      minute: 0,
      periodKey: dayKey,
      shouldNotify: () => pendingDailyTasks.length > 0,
      message: `1:00 PM reminder: ${dailyMessage}`
    },
    {
      id: 'daily-1900',
      hour: 19,
      minute: 0,
      periodKey: dayKey,
      shouldNotify: () => pendingDailyTasks.length > 0,
      message: `7:00 PM reminder: ${dailyMessage}`
    },
    {
      id: 'weekly-sun-1100',
      hour: 11,
      minute: 0,
      weekday: 0,
      periodKey: weekKey,
      shouldNotify: () => pendingWeeklySundayTasks.length > 0,
      message: `Sunday 11:00 AM reminder: ${sundayMessage}`
    }
  ];

  reminders.forEach(reminder => {
    if (hour !== reminder.hour || minute !== reminder.minute) {
      return;
    }

    if (typeof reminder.weekday === 'number' && reminder.weekday !== dayOfWeek) {
      return;
    }

    if (typeof reminder.shouldNotify === 'function' && !reminder.shouldNotify()) {
      return;
    }

    if (hasReminderBeenSent(reminder.id, reminder.periodKey)) {
      return;
    }

    showNotification(reminder.message, {
      type: 'info',
      title: 'Task Reminder',
      duration: 8000,
      browser: true
    });
    markReminderSent(reminder.id, reminder.periodKey);
  });
}

function isSundayTaskWindowNow() {
  const adjustedNow = getTaskPeriodReferenceNow();
  return adjustedNow.getDay() === 0;
}

function startScheduledReminders() {
  if (reminderIntervalId) {
    clearInterval(reminderIntervalId);
  }

  checkAndSendScheduledReminders();
  reminderIntervalId = window.setInterval(checkAndSendScheduledReminders, 30000);
}

function stopScheduledReminders() {
  if (reminderIntervalId) {
    clearInterval(reminderIntervalId);
    reminderIntervalId = null;
  }
}

function getDaysBetween(startDate, endDate) {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function getTodayDateKey() {
  return getDateKeyFromDate(new Date());
}

function normalizeDailyLoginState(sourceState) {
  const input = sourceState && typeof sourceState === 'object' ? sourceState : {};
  const streakDay = Number(input.streakDay);
  const safeStreakDay = Number.isFinite(streakDay) && streakDay >= 1 && streakDay <= DAILY_LOGIN_REWARDS.length
    ? Math.floor(streakDay)
    : 1;

  const claimedDays = Array.isArray(input.claimedDays)
    ? input.claimedDays
        .map(day => Number(day))
        .filter(day => Number.isFinite(day) && day >= 1 && day <= DAILY_LOGIN_REWARDS.length)
    : [];

  return {
    streakDay: safeStreakDay,
    lastClaimDate: typeof input.lastClaimDate === 'string' ? input.lastClaimDate : '',
    cycleStartDate: typeof input.cycleStartDate === 'string' ? input.cycleStartDate : '',
    claimedDays: Array.from(new Set(claimedDays)).sort((a, b) => a - b)
  };
}

function refreshDailyLoginState() {
  dailyLoginState = normalizeDailyLoginState(dailyLoginState);

  if (!dailyLoginState.lastClaimDate) {
    return;
  }

  const today = new Date();
  const lastClaimDate = new Date(dailyLoginState.lastClaimDate);
  if (Number.isNaN(lastClaimDate.getTime())) {
    dailyLoginState = normalizeDailyLoginState({});
    return;
  }

  const daysDiff = getDaysBetween(lastClaimDate, today);

  if (daysDiff <= 1) {
    return;
  }

  dailyLoginState = {
    streakDay: 1,
    lastClaimDate: '',
    cycleStartDate: '',
    claimedDays: []
  };
}

function hasClaimedDailyLoginToday() {
  return dailyLoginState.lastClaimDate === getTodayDateKey();
}

function getDailyLoginStageSvgMarkup(dayNumber) {
  const stageKey = DAILY_LOGIN_STAGE_KEYS[Math.max(0, Math.min(dayNumber - 1, DAILY_LOGIN_STAGE_KEYS.length - 1))];
  const stageElement = document.getElementById(stageKey);
  const svg = stageElement?.querySelector('svg');
  return svg ? svg.outerHTML : '';
}

function getDailyLoginDayClass(dayNumber) {
  const todayClaimed = hasClaimedDailyLoginToday();
  const isClaimedInCycle = dailyLoginState.claimedDays.includes(dayNumber);
  const isActiveDay = dayNumber === dailyLoginState.streakDay;

  if (isClaimedInCycle && !(isActiveDay && !todayClaimed)) {
    return 'claimed';
  }

  if (isActiveDay && !todayClaimed) {
    return 'available';
  }

  return 'locked';
}

function canClaimDailyLoginDay(dayNumber) {
  const todayClaimed = hasClaimedDailyLoginToday();
  return dayNumber === dailyLoginState.streakDay && !todayClaimed;
}

function renderDailyLoginCalendar() {
  const calendarEl = document.getElementById('dailyLoginCalendar');
  if (!calendarEl) {
    return;
  }

  refreshDailyLoginState();

  const markup = DAILY_LOGIN_REWARDS.map((points, index) => {
    const dayNumber = index + 1;
    const dayClass = getDailyLoginDayClass(dayNumber);
    const disabled = canClaimDailyLoginDay(dayNumber) ? '' : 'disabled';
    const iconMarkup = getDailyLoginStageSvgMarkup(dayNumber);
    return `
      <button class="daily-login-day ${dayClass}" data-day="${dayNumber}" ${disabled}>
        <span class="daily-login-day-label">Day ${dayNumber}</span>
        <span class="daily-login-day-icon">${iconMarkup}</span>
        <span class="daily-login-day-points">+${points} FP</span>
      </button>
    `;
  }).join('');

  calendarEl.innerHTML = markup;

  Array.from(calendarEl.querySelectorAll('.daily-login-day')).forEach(dayBtn => {
    dayBtn.addEventListener('click', () => {
      const dayValue = Number(dayBtn.getAttribute('data-day'));
      claimDailyLogin(dayValue);
    });
  });
}

function claimDailyLogin(dayNumber) {
  refreshDailyLoginState();

  if (!canClaimDailyLoginDay(dayNumber)) {
    return;
  }

  const reward = DAILY_LOGIN_REWARDS[dayNumber - 1] || 0;
  faithPoints += reward;

  const todayKey = getTodayDateKey();
  if (!dailyLoginState.cycleStartDate) {
    dailyLoginState.cycleStartDate = todayKey;
  }

  dailyLoginState.lastClaimDate = todayKey;

  if (!dailyLoginState.claimedDays.includes(dayNumber)) {
    dailyLoginState.claimedDays.push(dayNumber);
    dailyLoginState.claimedDays.sort((a, b) => a - b);
  }

  if (dayNumber >= DAILY_LOGIN_REWARDS.length) {
    dailyLoginState.streakDay = 1;
    dailyLoginState.claimedDays = [];
    dailyLoginState.cycleStartDate = '';
  } else {
    dailyLoginState.streakDay = dayNumber + 1;
  }

  updateDisplay();
  renderDailyLoginCalendar();
  showNotification(`Daily login claimed: Day ${dayNumber} (+${reward} FP).`, {
    type: 'success',
    browser: true
  });
}

function openDailyLoginModal() {
  const modal = document.getElementById('dailyLoginModal');
  if (!modal) {
    return;
  }

  renderDailyLoginCalendar();
  modal.style.display = 'flex';
}

function closeDailyLoginModal() {
  const modal = document.getElementById('dailyLoginModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isAdminEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  return ADMIN_EMAILS.some(adminEmail => normalizeEmail(adminEmail) === normalizedEmail);
}

function getRoleByEmail(email) {
  return isAdminEmail(email) ? 'admin' : 'user';
}

function isFirebaseConfigured() {
  return Object.values(FIREBASE_CONFIG).every(value => String(value || '').trim() !== '');
}

function initializeCloudDatabase() {
  if (!window.firebase) {
    return false;
  }

  if (!isFirebaseConfigured()) {
    console.warn('Firebase config is missing. Shared registration sync is disabled until FIREBASE_CONFIG is filled.');
    return false;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
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

function normalizeStoredUser(user, fallbackId) {
  const fallbackNumericId = Number(fallbackId ?? Date.now());
  const parsedUserId = Number(user?.id);
  const safeUserId = Number.isFinite(parsedUserId)
    ? parsedUserId
    : (Number.isFinite(fallbackNumericId) ? fallbackNumericId : Date.now());
  const parsedLastActiveAt = Number(user?.lastActiveAt ?? user?.updatedAt ?? 0);

  return {
    ...user,
    id: safeUserId,
    email: normalizeEmail(user?.email),
    role: getRoleByEmail(user?.email),
    viewMode: user?.viewMode ?? 'user',
    lastLogin: user?.lastLogin ?? '',
    lastActiveAt: Number.isFinite(parsedLastActiveAt) && parsedLastActiveAt > 0 ? parsedLastActiveAt : '',
    taskCompletions: user?.taskCompletions && typeof user.taskCompletions === 'object' ? user.taskCompletions : {},
    dailyLoginState: normalizeDailyLoginState(user?.dailyLoginState)
  };
}

function formatDateTimeForDisplay(value) {
  if (value === null || value === undefined || value === '') {
    return 'Never';
  }

  const timestamp = Number(value);
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return new Date(timestamp).toLocaleString();
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString();
  }

  return 'Never';
}

function getLastActiveTimestamp(user) {
  const candidate = Number(user?.lastActiveAt ?? user?.updatedAt ?? 0);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : 0;
}

function sanitizeUserForCloud(user) {
  const normalizedUser = normalizeStoredUser(user, Date.now());
  return {
    ...normalizedUser,
    updatedAt: Date.now()
  };
}

async function upsertUserInCloud(user) {
  const usersCollection = getCloudUsersCollection();
  if (!usersCollection || !user?.email) {
    return;
  }

  try {
    const normalizedEmail = normalizeEmail(user.email);
    await usersCollection.doc(normalizedEmail).set(sanitizeUserForCloud(user), { merge: true });
  } catch (error) {
    console.warn('Cloud upsert failed:', error);
  }
}

async function deleteUserFromCloud(email) {
  const usersCollection = getCloudUsersCollection();
  if (!usersCollection || !email) {
    return;
  }

  try {
    await usersCollection.doc(normalizeEmail(email)).delete();
  } catch (error) {
    console.warn('Cloud delete failed:', error);
  }
}

function syncUsersToCloud(users) {
  const usersCollection = getCloudUsersCollection();
  if (!usersCollection || !Array.isArray(users)) {
    return;
  }

  Promise.all(users.map(user => upsertUserInCloud(user))).catch(error => {
    console.warn('Cloud sync failed:', error);
  });
}

function mergeUsersByLatestTimestamp(localUsers, cloudUsers) {
  const mergedByEmail = new Map();

  localUsers
    .map((user, index) => normalizeStoredUser(user, Date.now() + index))
    .forEach(user => {
      if (user.email) {
        mergedByEmail.set(user.email, user);
      }
    });

  cloudUsers
    .map((user, index) => normalizeStoredUser(user, Date.now() + index + 5000))
    .forEach(cloudUser => {
      if (!cloudUser.email) {
        return;
      }

      const localUser = mergedByEmail.get(cloudUser.email);
      if (!localUser) {
        mergedByEmail.set(cloudUser.email, cloudUser);
        return;
      }

      const localUpdatedAt = Number(localUser.updatedAt ?? 0);
      const cloudUpdatedAt = Number(cloudUser.updatedAt ?? 0);
      if (Number.isFinite(cloudUpdatedAt) && cloudUpdatedAt > localUpdatedAt) {
        mergedByEmail.set(cloudUser.email, cloudUser);
      }
    });

  return Array.from(mergedByEmail.values());
}

async function syncUsersFromCloudToLocal() {
  const usersCollection = getCloudUsersCollection();
  if (!usersCollection) {
    return false;
  }

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
  if (!getCloudUsersCollection()) {
    return;
  }

  if (localStorage.getItem(CLOUD_MIGRATION_KEY) === 'done') {
    return;
  }

  const localUsers = getStoredUsersSafe();
  if (localUsers.length > 0) {
    await Promise.all(localUsers.map(user => upsertUserInCloud(user)));
  }

  localStorage.setItem(CLOUD_MIGRATION_KEY, 'done');
}

function enforceAdminRoleInStorage() {
  const safeUsers = getStoredUsersSafe();
  let usersChanged = false;

  const normalizedUsers = safeUsers.map(user => {
    const expectedRole = getRoleByEmail(user.email);
    if (user.role !== expectedRole) {
      usersChanged = true;
      return { ...user, role: expectedRole };
    }
    return user;
  });

  if (usersChanged) {
    setStoredUsers(normalizedUsers);
  }

  const currentUserRaw = localStorage.getItem('currentUser');
  if (currentUserRaw) {
    try {
      const parsedCurrentUser = JSON.parse(currentUserRaw);
      const expectedRole = getRoleByEmail(parsedCurrentUser.email);
      if (parsedCurrentUser.role !== expectedRole) {
        parsedCurrentUser.role = expectedRole;
        localStorage.setItem('currentUser', JSON.stringify(parsedCurrentUser));
      }
    } catch {
      localStorage.removeItem('currentUser');
    }
  }
}

// Initialize app
async function initializeApp() {
  initializeCloudDatabase();
  await migrateLocalUsersToCloudOnce();
  await syncUsersFromCloudToLocal();
  enforceAdminRoleInStorage();
  if (!localStorage.getItem(NOTIFICATION_PREFERENCE_KEY)) {
    setAppNotificationEnabled(true);
  }
  currentUser = localStorage.getItem('currentUser');
  
  if (currentUser) {
    currentUser = JSON.parse(currentUser);
    showAppInterface();
    loadUserData();
    updateDisplay();
    startScheduledReminders();
  } else {
    resetGameState();
    showAuthInterface();
    stopScheduledReminders();
  }
}

function showAuthInterface() {
  document.getElementById('authContainer').style.display = 'flex';
  document.getElementById('appContainer').style.display = 'none';
}

function showAppInterface() {
  document.getElementById('authContainer').style.display = 'none';
  document.getElementById('appContainer').style.display = 'block';
  document.getElementById('userGreeting').textContent = `Welcome, ${currentUser.name}!`;
  applyViewModeUI();
}

function isAdminUser() {
  return currentUser?.role === 'admin' || getRoleByEmail(currentUser?.email) === 'admin';
}

function getCurrentViewMode() {
  if (!currentUser) {
    return 'user';
  }

  if (!isAdminUser()) {
    return 'user';
  }

  return currentUser.viewMode === 'admin' ? 'admin' : 'user';
}

function applyViewModeUI() {
  const isAdmin = isAdminUser();
  const mode = getCurrentViewMode();
  const isAdminView = isAdmin && mode === 'admin';

  if (isAdmin && currentUser && currentUser.role !== 'admin') {
    currentUser.role = 'admin';
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  }

  document.body.classList.toggle('admin-view', isAdminView);

  const userMainContainer = document.getElementById('userMainContainer');
  const adminDashboard = document.getElementById('adminDashboard');
  if (userMainContainer) {
    userMainContainer.style.display = isAdminView ? 'none' : 'block';
  }
  if (adminDashboard) {
    adminDashboard.style.display = isAdminView ? 'block' : 'none';
  }

  const toggleBtn = document.getElementById('switchAdminViewBtn');
  if (toggleBtn) {
    if (isAdmin) {
      toggleBtn.style.display = 'block';
      toggleBtn.textContent = isAdminView ? 'Switch to User View' : 'Switch to Admin View';
    } else {
      toggleBtn.style.display = 'none';
    }
  }

  const modeIndicator = document.getElementById('viewModeIndicator');
  if (modeIndicator) {
    modeIndicator.style.display = isAdmin ? 'inline-block' : 'none';
    modeIndicator.textContent = isAdminView ? 'ADMIN VIEW' : 'USER VIEW';
  }

  removeLegacyAdminFaithPointsCard();

  if (isAdminView) {
    renderAdminDashboard();
  }
}

function removeLegacyAdminFaithPointsCard() {
  const cards = document.querySelectorAll('.admin-stats-grid .admin-stat-card');
  cards.forEach(card => {
    const labelEl = card.querySelector('.admin-stat-label');
    const labelText = String(labelEl?.textContent || '').trim().toLowerCase();
    if (labelText === 'total faith points') {
      card.remove();
    }
  });
}

function toggleAdminView() {
  if (getRoleByEmail(currentUser?.email) === 'admin' && currentUser?.role !== 'admin') {
    currentUser.role = 'admin';
  }

  if (!isAdminUser()) {
    showNotification('Only admin users can switch to admin view.', { type: 'error' });
    return;
  }

  currentUser.viewMode = getCurrentViewMode() === 'admin' ? 'user' : 'admin';
  applyViewModeUI();
  saveUserData();
}

async function renderAdminDashboard(syncFromCloud = true) {
  if (!isAdminUser() || getCurrentViewMode() !== 'admin') {
    return;
  }

  if (syncFromCloud) {
    await syncUsersFromCloudToLocal();
  }

  removeLegacyAdminFaithPointsCard();

  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const safeUsers = Array.isArray(users) ? users : [];

  const totalUsers = safeUsers.length;
  const totalAdmins = safeUsers.filter(user => getRoleByEmail(user.email) === 'admin').length;

  const totalUsersEl = document.getElementById('adminTotalUsers');
  const totalAdminsEl = document.getElementById('adminTotalAdmins');
  const taskRefreshEl = document.getElementById('adminTaskRefreshTime');

  if (totalUsersEl) totalUsersEl.textContent = String(totalUsers);
  if (totalAdminsEl) totalAdminsEl.textContent = String(totalAdmins);
  if (taskRefreshEl) taskRefreshEl.textContent = `Task refresh: ${getTaskRefreshTimeLabel()}`;

  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) {
    return;
  }

  if (safeUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8">No users found.</td></tr>';
    return;
  }

  const sortedUsers = [...safeUsers].sort((leftUser, rightUser) => {
    return getLastActiveTimestamp(rightUser) - getLastActiveTimestamp(leftUser);
  });

  tbody.innerHTML = sortedUsers
    .map(user => {
      const role = getRoleByEmail(user.email);
      const normalizedEmail = normalizeEmail(user.email || '');
      const name = escapeHtml(user.name || 'N/A');
      const lastLogin = escapeHtml(user.lastLogin || 'Never');
      const lastActive = escapeHtml(formatDateTimeForDisplay(user.lastActiveAt ?? user.updatedAt));
      const email = escapeHtml(user.email || 'N/A');
      const faithPoints = Math.floor(Number(user.faithPoints ?? 0) || 0);
      const treeProgress = Math.floor(Number(user.treeProgress ?? 0) || 0);
      const userId = Number.isFinite(Number(user.id)) ? Number(user.id) : Date.now();
      return `
        <tr>
          <td>${name}</td>
          <td>${lastLogin}</td>
          <td>${lastActive}</td>
          <td>${email}</td>
          <td><span class="admin-role-badge ${role}">${role}</span></td>
          <td>${faithPoints}</td>
          <td>${treeProgress}</td>
          <td>
            <div class="admin-actions">
              <button class="admin-action-btn points" onclick="window.adminAddPoints(${userId}, '${normalizedEmail}')">+Points</button>
              <button class="admin-action-btn password" onclick="window.adminResetPassword(${userId})">Reset PW</button>
              <button class="admin-action-btn progress" onclick="window.adminResetProgress(${userId})">Reset Progress</button>
              <button class="admin-action-btn view" onclick="window.adminViewProgress(${userId})">View</button>
              <button class="admin-action-btn open" onclick="window.adminOpenUserUi(${userId})">Open UI</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function assertAdminDashboardAccess() {
  if (!isAdminUser()) {
    showNotification('Admin dashboard access required.', { type: 'error' });
    return false;
  }

  if (getCurrentViewMode() !== 'admin' && currentUser) {
    currentUser.viewMode = 'admin';
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  }

  return true;
}

function getStoredUsersSafe() {
  const users = JSON.parse(localStorage.getItem('users') || '[]');

  if (!Array.isArray(users)) {
    return [];
  }

  const normalizedUsers = users.map((user, index) => normalizeStoredUser(user, Date.now() + index));
  const didChange = normalizedUsers.some((user, index) => {
    const previousUser = users[index];
    const previousId = Number(previousUser?.id);
    return !Number.isFinite(previousId) || previousId !== user.id || normalizeEmail(previousUser?.email) !== user.email;
  });

  if (didChange) {
    localStorage.setItem('users', JSON.stringify(normalizedUsers));
  }

  return normalizedUsers;
}

function setStoredUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
  syncUsersToCloud(users);
}

function findUserIndexById(users, userId) {
  const numericUserId = Number(userId);
  if (!Number.isFinite(numericUserId)) {
    return -1;
  }

  return users.findIndex(user => Number(user.id) === numericUserId);
}

function syncCurrentSessionIfNeeded(updatedUser) {
  if (currentUser && Number(currentUser.id) === Number(updatedUser.id)) {
    currentUser = {
      ...currentUser,
      ...updatedUser,
      role: getRoleByEmail(updatedUser.email),
      viewMode: currentUser.viewMode ?? updatedUser.viewMode ?? 'user'
    };
    delete currentUser.password;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    loadUserData();
    updateDisplay();
  }
}

function adminAddPoints(userId, userEmail = '') {
  if (!assertAdminDashboardAccess()) return;

  const pointsInput = prompt('Enter points to add:', '10');
  if (pointsInput === null) return;

  const points = Number(pointsInput);
  if (!Number.isFinite(points) || points <= 0) {
    showNotification('Please enter a valid positive number.', { type: 'error' });
    return;
  }

  const users = getStoredUsersSafe();
  let userIndex = findUserIndexById(users, userId);
  if (userIndex === -1 && userEmail) {
    const normalizedTargetEmail = normalizeEmail(userEmail);
    userIndex = users.findIndex(user => normalizeEmail(user.email) === normalizedTargetEmail);
  }

  if (userIndex === -1) {
    showNotification('User not found.', { type: 'error' });
    return;
  }

  users[userIndex].faithPoints = Math.floor(Number(users[userIndex].faithPoints ?? 0) + points);
  users[userIndex].updatedAt = Date.now();
  users[userIndex].lastActiveAt = Date.now();
  setStoredUsers(users);
  upsertUserInCloud(users[userIndex]);
  syncCurrentSessionIfNeeded(users[userIndex]);
  renderAdminDashboard(false);
  showNotification(`Added ${points} FP to ${users[userIndex].email}.`, { type: 'success' });
}

function adminResetPassword(userId) {
  if (!assertAdminDashboardAccess()) return;

  const newPassword = prompt('Enter new password (min 6 characters):', 'password123');
  if (newPassword === null) return;

  if (newPassword.length < 6) {
    showNotification('Password must be at least 6 characters.', { type: 'error' });
    return;
  }

  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) {
    showNotification('User not found.', { type: 'error' });
    return;
  }

  users[userIndex].password = newPassword;
  setStoredUsers(users);
  showNotification(`Password reset for ${users[userIndex].email}.`, { type: 'success' });
}

function adminResetProgress(userId) {
  if (!assertAdminDashboardAccess()) return;

  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) {
    showNotification('User not found.', { type: 'error' });
    return;
  }

  const targetEmail = users[userIndex].email;
  const confirmReset = confirm(`Reset progress for ${targetEmail}?`);
  if (!confirmReset) return;

  users[userIndex].faithPoints = 0;
  users[userIndex].treeProgress = 0;
  users[userIndex].passiveRate = 1;
  users[userIndex].fruitCount = 0;
  users[userIndex].pointsForFruit = 0;
  users[userIndex].maxBloomReached = false;
  users[userIndex].taskCompletions = {};
  users[userIndex].dailyLoginState = normalizeDailyLoginState({});

  setStoredUsers(users);
  syncCurrentSessionIfNeeded(users[userIndex]);
  renderAdminDashboard();
  showNotification(`Progress reset for ${targetEmail}.`, { type: 'success' });
}

function adminViewProgress(userId) {
  if (!assertAdminDashboardAccess()) return;

  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) {
    showNotification('User not found.', { type: 'error' });
    return;
  }

  const user = users[userIndex];
  const progressMessage = [
    `Name: ${user.name || 'N/A'}`,
    `Email: ${user.email || 'N/A'}`,
    `Role: ${getRoleByEmail(user.email)}`,
    `Faith Points: ${Math.floor(Number(user.faithPoints ?? 0) || 0)}`,
    `Tree Progress: ${Math.floor(Number(user.treeProgress ?? 0) || 0)}`,
    `Fruits: ${Math.floor(Number(user.fruitCount ?? 0) || 0)}`
  ].join('\n');

  showNotification(progressMessage, { type: 'info', title: 'User Progress', duration: 7000 });
}

function adminOpenUserUi(userId) {
  if (!assertAdminDashboardAccess()) return;

  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) {
    showNotification('User not found.', { type: 'error' });
    return;
  }

  const selectedUser = { ...users[userIndex] };
  const proceed = confirm(`Open actual UI as ${selectedUser.email}?\nYou can return by logging back in as admin.`);
  if (!proceed) return;

  const nextSessionUser = {
    ...selectedUser,
    role: getRoleByEmail(selectedUser.email),
    viewMode: 'user'
  };

  delete nextSessionUser.password;
  currentUser = nextSessionUser;
  localStorage.setItem('currentUser', JSON.stringify(nextSessionUser));
  closeProfileModal();
  showAppInterface();
  loadUserData();
  updateDisplay();
  showNotification(`Now viewing user UI as ${selectedUser.email}.`, { type: 'info' });
}

window.adminAddPoints = adminAddPoints;
window.adminResetPassword = adminResetPassword;
window.adminResetProgress = adminResetProgress;
window.adminViewProgress = adminViewProgress;
window.adminOpenUserUi = adminOpenUserUi;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  document.getElementById('forgotStep1').style.display = 'block';
  document.getElementById('forgotStep2').style.display = 'none';
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const normalizedEmail = normalizeEmail(email);

  await syncUsersFromCloudToLocal();
  
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const user = users.find(
    u => normalizeEmail(u.email) === normalizedEmail && u.password === password
  );
  
  if (user) {
    const userIndex = users.findIndex(u => Number(u.id) === Number(user.id));
    const normalizedUser = normalizeStoredUser(user, user.id);
    normalizedUser.lastLogin = new Date().toLocaleString();
    normalizedUser.lastActiveAt = Date.now();
    normalizedUser.viewMode = isAdminEmail(normalizedUser.email) ? 'admin' : (normalizedUser.viewMode ?? 'user');

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
      role: getRoleByEmail(normalizedUser.email),
      viewMode: isAdminEmail(normalizedUser.email) ? 'admin' : (normalizedUser.viewMode ?? 'user'),
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
    clearAuthErrors();
    showAppInterface();
    loadUserData();
    updateDisplay();
    startScheduledReminders();
  } else {
    document.getElementById('loginError').textContent = 'Invalid email or password';
  }
}

function handleRegister(event) {
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
  
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  
  if (users.find(u => normalizeEmail(u.email) === email)) {
    document.getElementById('registerError').textContent = 'Email already registered';
    return;
  }
  
  const newUser = {
    id: Date.now(),
    name,
    email,
    role: getRoleByEmail(email),
    viewMode: 'user',
    password,
    joinedDate: new Date().toLocaleDateString(),
    lastLogin: new Date().toLocaleString(),
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
  
  currentUser = { ...newUser };
  delete currentUser.password;
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  
  clearAuthErrors();
  document.getElementById('registerForm').reset();
  showAppInterface();
  resetGameState();
  updateDisplay();
  startScheduledReminders();
}

function sendResetCode() {
  const email = document.getElementById('forgotEmail').value;
  document.getElementById('forgotError').textContent = '';
  
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const user = users.find(u => u.email === email);
  
  if (!user) {
    document.getElementById('forgotError').textContent = 'Email not found';
    return;
  }
  
  // Generate a random reset code
  const resetCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  // Store reset code temporarily
  const resetRequests = JSON.parse(localStorage.getItem('resetRequests') || '{}');
  resetRequests[email] = { code: resetCode, timestamp: Date.now() };
  localStorage.setItem('resetRequests', JSON.stringify(resetRequests));
  
  // Simulate sending email
  showNotification(`Reset code sent to ${email}. Code: ${resetCode}`, {
    type: 'info',
    title: 'Password Reset',
    duration: 10000
  });
  
  document.getElementById('forgotStep1').style.display = 'none';
  document.getElementById('forgotStep2').style.display = 'block';
}

function resetPasswordWithCode() {
  const email = document.getElementById('forgotEmail').value;
  const resetCode = document.getElementById('resetCode').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmNewPassword').value;
  
  document.getElementById('resetError').textContent = '';
  
  if (newPassword !== confirmPassword) {
    document.getElementById('resetError').textContent = 'Passwords do not match';
    return;
  }
  
  const resetRequests = JSON.parse(localStorage.getItem('resetRequests') || '{}');
  const resetData = resetRequests[email];
  
  if (!resetData || resetData.code !== resetCode) {
    document.getElementById('resetError').textContent = 'Invalid reset code';
    return;
  }
  
  // Check if code expired (15 minutes)
  if (Date.now() - resetData.timestamp > 15 * 60 * 1000) {
    document.getElementById('resetError').textContent = 'Reset code expired';
    return;
  }
  
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const userIndex = users.findIndex(u => u.email === email);
  
  if (userIndex !== -1) {
    users[userIndex].password = newPassword;
    setStoredUsers(users);
    
    // Clear reset request
    delete resetRequests[email];
    localStorage.setItem('resetRequests', JSON.stringify(resetRequests));
    
    showNotification('Password reset successfully! Please login with your new password.', {
      type: 'success',
      browser: true
    });
    switchToLogin();
  }
}

function goBackToForgot() {
  document.getElementById('forgotStep1').style.display = 'block';
  document.getElementById('forgotStep2').style.display = 'none';
  document.getElementById('resetCode').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmNewPassword').value = '';
  document.getElementById('resetError').textContent = '';
}

function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('currentUser');
    currentUser = null;
    clearAuthErrors();
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
    showAuthInterface();
    switchToLogin();
    stopScheduledReminders();
  }
}

function openProfileModal() {
  if (isAdminEmail(currentUser?.email)) {
    if (currentUser.role !== 'admin') {
      currentUser.role = 'admin';
    }
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  }

  applyViewModeUI();

  const toggleBtn = document.getElementById('switchAdminViewBtn');
  if (toggleBtn) {
    const isAdmin = isAdminEmail(currentUser?.email);
    toggleBtn.style.display = isAdmin ? 'block' : 'none';
    if (isAdmin) {
      toggleBtn.textContent = getCurrentViewMode() === 'admin' ? 'Switch to User View' : 'Switch to Admin View';
    }
  }

  document.getElementById('profileName').textContent = currentUser.name;
  document.getElementById('profileEmail').textContent = currentUser.email;
  document.getElementById('profileJoined').textContent = currentUser.joinedDate;
  ensureProfileNotificationControls();
  updateProfileNotificationControls();
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

function handleChangePassword(event) {
  event.preventDefault();
  
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassChange').value;
  const confirmPassword = document.getElementById('confirmPassChange').value;
  
  document.getElementById('changePassError').textContent = '';
  
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const user = users.find(u => u.id === currentUser.id);
  
  if (!user || user.password !== currentPassword) {
    document.getElementById('changePassError').textContent = 'Current password is incorrect';
    return;
  }
  
  if (newPassword !== confirmPassword) {
    document.getElementById('changePassError').textContent = 'New passwords do not match';
    return;
  }
  
  if (newPassword.length < 6) {
    document.getElementById('changePassError').textContent = 'Password must be at least 6 characters';
    return;
  }
  
  const userIndex = users.findIndex(u => u.id === currentUser.id);
  users[userIndex].password = newPassword;
  setStoredUsers(users);
  
  showNotification('Password changed successfully!', { type: 'success', browser: true });
  closeChangePasswordModal();
}

function downloadUserData() {
  const userData = {
    profile: {
      name: currentUser.name,
      email: currentUser.email,
      joinedDate: currentUser.joinedDate
    },
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

function deleteAccountConfirm() {
  if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
    if (confirm('This will permanently delete all your data. Type your email to confirm: ' + currentUser.email)) {
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const filteredUsers = users.filter(u => u.id !== currentUser.id);
      setStoredUsers(filteredUsers);
      deleteUserFromCloud(currentUser.email);
      
      showNotification('Account deleted successfully.', { type: 'success' });
      localStorage.removeItem('currentUser');
      currentUser = null;
      showAuthInterface();
      switchToLogin();
    }
  }
}

function clearAuthErrors() {
  document.getElementById('loginError').textContent = '';
  document.getElementById('registerError').textContent = '';
  document.getElementById('forgotError').textContent = '';
  document.getElementById('resetError').textContent = '';
  document.getElementById('changePassError').textContent = '';
}

const LOGO_CACHE_BUSTER = '20260225-logo-refresh-2';

function testImagePath(path) {
  return new Promise(resolve => {
    const testImg = new Image();
    testImg.onload = () => resolve(true);
    testImg.onerror = () => resolve(false);
    testImg.src = path;
  });
}

function createLogoWrapElement(fileName, altText) {
  const wrap = document.createElement('div');
  wrap.className = 'mobile-logo-wrap';

  const img = document.createElement('img');
  img.className = 'mobile-header-logo';
  img.setAttribute('data-logo-file', fileName);
  img.alt = altText;
  img.src = `assets/${fileName}?v=${LOGO_CACHE_BUSTER}`;

  wrap.appendChild(img);
  return wrap;
}

function ensureLogoContainer(targetEl, containerClass, ariaLabel) {
  if (!targetEl) {
    return null;
  }

  let container = targetEl.classList && targetEl.classList.contains(containerClass)
    ? targetEl
    : targetEl.querySelector(`.${containerClass}`);
  if (!container) {
    container = document.createElement('div');
    container.className = containerClass;
    container.setAttribute('aria-label', ariaLabel);
    targetEl.appendChild(container);
  }

  const hasAbcf = container.querySelector('img[data-logo-file="ABCF.png"]');
  const hasPulse = container.querySelector('img[data-logo-file="Pulse.png"]');

  if (!hasAbcf) {
    container.appendChild(createLogoWrapElement('ABCF.png', 'ABCF logo'));
  }
  if (!hasPulse) {
    container.appendChild(createLogoWrapElement('Pulse.png', 'Pulse logo'));
  }

  return container;
}

function ensureLogosInjected() {
  const authTopRightLogos = document.querySelector('#authContainer .auth-mobile-logos');
  if (authTopRightLogos) {
    authTopRightLogos.remove();
  }

  const loginCard = document.querySelector('#loginScreen .auth-card');
  if (loginCard) {
    let loginLogoRow = loginCard.querySelector('.auth-card-logos');
    if (!loginLogoRow) {
      loginLogoRow = document.createElement('div');
      loginLogoRow.className = 'auth-card-logos';
      loginLogoRow.setAttribute('aria-label', 'Login logos');

      const loginTitle = loginCard.querySelector('h1');
      if (loginTitle) {
        loginCard.insertBefore(loginLogoRow, loginTitle);
      } else {
        const loginForm = loginCard.querySelector('#loginForm');
        if (loginForm) {
          loginCard.insertBefore(loginLogoRow, loginForm);
        } else {
          loginCard.appendChild(loginLogoRow);
        }
      }
    }
    ensureLogoContainer(loginLogoRow, 'auth-card-logos', 'Login logos');
  }

  const appHeader = document.querySelector('.app-header');
  if (appHeader) {
    let titleWithLogos = appHeader.querySelector('.title-with-logos');
    if (!titleWithLogos) {
      const headerTitle = appHeader.querySelector('h1');
      titleWithLogos = document.createElement('div');
      titleWithLogos.className = 'title-with-logos';

      if (headerTitle) {
        titleWithLogos.appendChild(headerTitle);
      }

      const headerRight = appHeader.querySelector('.header-right');
      if (headerRight) {
        appHeader.insertBefore(titleWithLogos, headerRight);
      } else {
        appHeader.appendChild(titleWithLogos);
      }
    }

    ensureLogoContainer(titleWithLogos, 'mobile-header-logos', 'Header logos');
  }
}

async function resolveLogoSources() {
  const logoEls = Array.from(document.querySelectorAll('.mobile-header-logo[data-logo-file]'));
  if (logoEls.length === 0) {
    return;
  }

  const basePath = window.location.pathname.replace(/[^/]*$/, '');

  await Promise.all(logoEls.map(async logoEl => {
    const logoFile = logoEl.getAttribute('data-logo-file');
    if (!logoFile) {
      return;
    }

    const candidates = [
      `assets/${logoFile}?v=${LOGO_CACHE_BUSTER}`,
      `./assets/${logoFile}?v=${LOGO_CACHE_BUSTER}`,
      `/assets/${logoFile}?v=${LOGO_CACHE_BUSTER}`,
      `/kingdom-roots/assets/${logoFile}?v=${LOGO_CACHE_BUSTER}`,
      `${basePath}assets/${logoFile}?v=${LOGO_CACHE_BUSTER}`
    ];

    for (const candidate of candidates) {
      const exists = await testImagePath(candidate);
      if (exists) {
        logoEl.src = candidate;
        const wrapper = logoEl.closest('.mobile-logo-wrap');
        if (wrapper) {
          wrapper.classList.add('logo-loaded');
        }
        return;
      }
    }
  }));
}

// Game Logic
let faithPoints = 0;
let treeProgress = 0;
let passiveRate = 1;
let upgradeCost = 10;
let currentAction = '';
let maxBloomReached = false;
let pointsForFruit = 0;
let fruitCount = 0;
let taskCompletions = {};
const FULL_BLOOM_THRESHOLD = 1500;
const TASK_REFRESH_HOUR = 24;
const TASK_REFRESH_MINUTE = 0;

function resetGameState() {
  faithPoints = 0;
  treeProgress = 0;
  passiveRate = 1;
  upgradeCost = 10;
  currentAction = '';
  maxBloomReached = false;
  pointsForFruit = 0;
  fruitCount = 0;
  taskCompletions = {};
  dailyLoginState = normalizeDailyLoginState({});
}

const scriptures = [
  "The kingdom of God is like a mustard seed... – Matthew 13:31",
  "I am the vine; you are the branches. – John 15:5",
  "Let your roots grow down into Him. – Colossians 2:7",
  "Those who trust in the Lord will renew their strength. – Isaiah 40:31"
];

const actionRewards = {
  'pray': { fp: 2, bonus: 0, name: 'Prayer Time' },
  'bible': { fp: 2, bonus: 0, name: 'Bible Reading' },
  'devotion': { fp: 4, bonus: 0, name: 'Daily Devotion' },
  'smallgroup': { fp: 10, bonus: 0, name: 'Small Group' },
  'attendService': { fp: 15, bonus: 0, name: 'Worship Attendance' },
  'sharegospel': { fp: 10, bonus: 0, name: 'Share Gospel' }
};

const taskRecurrenceRules = {
  pray: { unit: 'day', label: 'once per day' },
  bible: { unit: 'day', label: 'once per day' },
  devotion: { unit: 'day', label: 'once per day' },
  smallgroup: { unit: 'week', label: 'once per week' },
  attendService: { unit: 'week', label: 'once per week' }
};

const taskDisplayNames = {
  pray: 'Prayer Time',
  bible: 'Bible Reading',
  devotion: 'Daily Devotion',
  smallgroup: 'Small Group',
  attendService: 'Worship Attendance'
};

const taskButtonBindings = {
  pray: { buttonId: 'prayBtn' },
  bible: { buttonId: 'bibleBtn' },
  devotion: { buttonId: 'devotionBtn' },
  smallgroup: { buttonId: 'smallgroupBtn' },
  attendService: { buttonId: 'attendServiceBtn' }
};

function getYearWeekKey(date) {
  const tempDate = new Date(date.getTime());
  const day = tempDate.getDay() || 7;
  tempDate.setDate(tempDate.getDate() + 4 - day);
  const yearStart = new Date(tempDate.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
  return `${tempDate.getFullYear()}-W${weekNumber}`;
}

function getTaskRefreshOffsetMinutes() {
  const totalMinutes = (Number(TASK_REFRESH_HOUR) * 60) + Number(TASK_REFRESH_MINUTE);

  if (!Number.isFinite(totalMinutes)) {
    return 0;
  }

  const minutesInDay = 24 * 60;
  return ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
}

function getTaskRefreshTimeLabel() {
  const normalizedOffset = getTaskRefreshOffsetMinutes();
  const hours = Math.floor(normalizedOffset / 60);
  const minutes = normalizedOffset % 60;
  const paddedHours = String(hours).padStart(2, '0');
  const paddedMinutes = String(minutes).padStart(2, '0');
  return `${paddedHours}:${paddedMinutes}`;
}

function getTaskPeriodReferenceNow() {
  const offsetMinutes = getTaskRefreshOffsetMinutes();
  return new Date(Date.now() - (offsetMinutes * 60 * 1000));
}

function getCurrentTaskDayKey() {
  const adjusted = getTaskPeriodReferenceNow();
  return `${adjusted.getFullYear()}-${adjusted.getMonth() + 1}-${adjusted.getDate()}`;
}

function getCurrentPeriodKey(unit) {
  const adjustedNow = getTaskPeriodReferenceNow();
  if (unit === 'week') {
    return getYearWeekKey(adjustedNow);
  }
  return getCurrentTaskDayKey();
}

function canCompleteTask(taskKey) {
  if (taskKey === 'attendService' && !isSundayTaskWindowNow()) {
    return {
      allowed: false,
      message: 'Worship Attendance can only be completed on Sundays.'
    };
  }

  const rule = taskRecurrenceRules[taskKey];
  if (!rule) {
    return { allowed: true };
  }

  const periodKey = getCurrentPeriodKey(rule.unit);
  const lastCompletedPeriod = taskCompletions[taskKey];
  if (lastCompletedPeriod === periodKey) {
    return {
      allowed: false,
      message: `${taskDisplayNames[taskKey] || 'This task'} can only be completed ${rule.label}.`
    };
  }

  return { allowed: true, periodKey };
}

function markTaskCompleted(taskKey, periodKey) {
  const rule = taskRecurrenceRules[taskKey];
  if (!rule) {
    return;
  }
  taskCompletions[taskKey] = periodKey || getCurrentPeriodKey(rule.unit);
}

function applyTreeProgress(pointsToAdd, options = {}) {
  const { addFaithPoints = true } = options;

  if (addFaithPoints) {
    faithPoints += pointsToAdd;
  }

  const previousTreeProgress = treeProgress;
  treeProgress += pointsToAdd;

  let fruitEligiblePoints = 0;

  if (maxBloomReached) {
    fruitEligiblePoints = pointsToAdd;
  } else if (previousTreeProgress >= FULL_BLOOM_THRESHOLD) {
    maxBloomReached = true;
    fruitEligiblePoints = pointsToAdd;
  } else if (previousTreeProgress < FULL_BLOOM_THRESHOLD && treeProgress >= FULL_BLOOM_THRESHOLD) {
    maxBloomReached = true;
    fruitEligiblePoints = treeProgress - FULL_BLOOM_THRESHOLD;
  }

  if (maxBloomReached && fruitEligiblePoints > 0) {
    addFruitIfNeeded(fruitEligiblePoints);
  }
}

function normalizeFruitProgressState() {
  if (treeProgress < FULL_BLOOM_THRESHOLD) {
    return;
  }

  if (!maxBloomReached) {
    maxBloomReached = true;

    if (fruitCount === 0 && pointsForFruit === 0) {
      const overflowPoints = Math.max(0, treeProgress - FULL_BLOOM_THRESHOLD);
      fruitCount = Math.floor(overflowPoints / 100);
      pointsForFruit = overflowPoints % 100;
    }
  }
}

function isTaskDoneForCurrentPeriod(taskKey) {
  const rule = taskRecurrenceRules[taskKey];
  if (!rule) {
    return false;
  }

  const currentPeriod = getCurrentPeriodKey(rule.unit);
  return taskCompletions[taskKey] === currentPeriod;
}

function updateTaskBadges() {
  Object.entries(taskButtonBindings).forEach(([taskKey, binding]) => {
    const buttonEl = document.getElementById(binding.buttonId);
    if (!buttonEl) {
      return;
    }

    const isDone = isTaskDoneForCurrentPeriod(taskKey);
    buttonEl.classList.toggle('task-done', isDone);
    buttonEl.classList.toggle('task-not-done', !isDone);
  });
}

function updateDisplay() {
  const faithPointsEl = document.getElementById("faithPoints");
  const upgradeCostEl = document.getElementById("upgradeCost");
  
  if (faithPointsEl) faithPointsEl.textContent = Math.floor(faithPoints);
  if (upgradeCostEl) upgradeCostEl.textContent = upgradeCost;
  
  updateTaskBadges();
  updateProgressDisplay();
  updateTreeGrowth();
  updateFruitVisuals();
  saveUserData();
}

function saveUserData() {
  if (currentUser) {
    refreshDailyLoginState();
    // Update user data in localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    
    if (userIndex !== -1) {
      users[userIndex].faithPoints = Math.floor(faithPoints);
      users[userIndex].treeProgress = Math.floor(treeProgress);
      users[userIndex].passiveRate = passiveRate;
      users[userIndex].fruitCount = fruitCount;
      users[userIndex].pointsForFruit = pointsForFruit;
      users[userIndex].maxBloomReached = maxBloomReached;
      users[userIndex].taskCompletions = taskCompletions;
      users[userIndex].dailyLoginState = normalizeDailyLoginState(dailyLoginState);
      users[userIndex].viewMode = getCurrentViewMode();
      users[userIndex].lastActiveAt = Date.now();
      
      setStoredUsers(users);
      
      // Also update current user session with all game data
      currentUser.faithPoints = Math.floor(faithPoints);
      currentUser.treeProgress = Math.floor(treeProgress);
      currentUser.passiveRate = passiveRate;
      currentUser.fruitCount = fruitCount;
      currentUser.pointsForFruit = pointsForFruit;
      currentUser.maxBloomReached = maxBloomReached;
      currentUser.taskCompletions = taskCompletions;
      currentUser.dailyLoginState = normalizeDailyLoginState(dailyLoginState);
      currentUser.viewMode = getCurrentViewMode();
      currentUser.lastActiveAt = users[userIndex].lastActiveAt;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
  }
}

function loadUserData() {
  if (!currentUser) {
    resetGameState();
    return;
  }

  faithPoints = Number(currentUser.faithPoints ?? 0);
  treeProgress = Number(currentUser.treeProgress ?? 0);
  passiveRate = Number(currentUser.passiveRate ?? 1);
  fruitCount = Number(currentUser.fruitCount ?? 0);
  pointsForFruit = Number(currentUser.pointsForFruit ?? 0);
  maxBloomReached = Boolean(currentUser.maxBloomReached ?? false);
  taskCompletions = currentUser.taskCompletions && typeof currentUser.taskCompletions === 'object'
    ? currentUser.taskCompletions
    : {};
  dailyLoginState = normalizeDailyLoginState(currentUser.dailyLoginState);
  currentUser.viewMode = currentUser.viewMode ?? (isAdminUser() ? 'admin' : 'user');

  if (!Number.isFinite(faithPoints)) faithPoints = 0;
  if (!Number.isFinite(treeProgress)) treeProgress = 0;
  if (!Number.isFinite(passiveRate) || passiveRate < 1) passiveRate = 1;
  if (!Number.isFinite(fruitCount) || fruitCount < 0) fruitCount = 0;
  if (!Number.isFinite(pointsForFruit) || pointsForFruit < 0) pointsForFruit = 0;
  refreshDailyLoginState();
  normalizeFruitProgressState();
  applyViewModeUI();
}

function updateProgressDisplay() {
  const progressText = document.getElementById("progressText");
  const progressBarFill = document.getElementById("progressBarFill");
  
  if (!progressText || !progressBarFill) return; // Exit if elements don't exist
  
  const stages = [
    { name: 'Germination', threshold: 50 },
    { name: 'Seedling', threshold: 150 },
    { name: 'Sapling', threshold: 350 },
    { name: 'Young Tree', threshold: 600 },
    { name: 'Mature Tree', threshold: 1000 },
    { name: 'Old Tree', threshold: 1500 }
  ];
  
  let progressTextContent = '';
  let progressPercent = 0;
  
  if (maxBloomReached) {
    // If in full bloom, show fruit progress
    progressPercent = (pointsForFruit / 100) * 100;
    progressTextContent = `🍎 Fruits: ${fruitCount} (${pointsForFruit}/100 points toward next fruit)`;
  } else {
    // Find the current and next stage based on treeProgress
    let currentStart = 0;
    let foundStage = false;
    for (let stage of stages) {
      if (treeProgress < stage.threshold) {
        const stageProgress = treeProgress - currentStart;
        const stageTarget = stage.threshold - currentStart;
        progressPercent = (stageProgress / stageTarget) * 100;
        progressTextContent = `📈 ${Math.floor(stageProgress)}/${stageTarget} progress to ${stage.name}`;
        foundStage = true;
        break;
      }
      currentStart = stage.threshold;
    }
    
    // If we've reached the final stage, show completion message
    if (!foundStage && treeProgress >= 1500) {
      progressPercent = 100;
      progressTextContent = `📈 ${Math.floor(treeProgress)}/1500 - Old Tree Complete!`;
    }
  }
  
  progressText.textContent = progressTextContent;
  progressBarFill.style.width = Math.min(progressPercent, 100) + '%';
}

function updateTreeGrowth() {
  // Use image-based stages
  const stages = [
    { id: 'seedStageImg', key: 'seed' },
    { id: 'germinationStageImg', key: 'germination' },
    { id: 'seedlingStageImg', key: 'seedling' },
    { id: 'saplingStageImg', key: 'sapling' },
    { id: 'youngTreeStageImg', key: 'youngTree' },
    { id: 'matureTreeStageImg', key: 'matureTree' },
    { id: 'oldTreeStageImg', key: 'oldTree' }
  ];
  let currentStage = null;
  if (treeProgress >= 1500) {
    currentStage = 'oldTree';
  } else if (treeProgress >= 1000) {
    currentStage = 'matureTree';
  } else if (treeProgress >= 600) {
    currentStage = 'youngTree';
  } else if (treeProgress >= 350) {
    currentStage = 'sapling';
  } else if (treeProgress >= 150) {
    currentStage = 'seedling';
  } else if (treeProgress >= 50) {
    currentStage = 'germination';
  } else {
    currentStage = 'seed';
  }

  const currentStageNameEl = document.getElementById('currentStageName');
  if (currentStageNameEl) {
    const stageName = currentStage
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    currentStageNameEl.textContent = stageName;
  }

  const treeStageContainer = document.getElementById('treeStageImages');
  if (treeStageContainer) {
    const allStageBackgroundClasses = stages.map(stage => `stage-${stage.key}`);
    treeStageContainer.classList.remove(...allStageBackgroundClasses);
    treeStageContainer.classList.add(`stage-${currentStage}`);
  }

  // Remove 'active' class from all images
  stages.forEach(stage => {
    const el = document.getElementById(stage.id);
    if (el) {
      el.classList.remove('active');
    }
  });
  // Add 'active' class to the current stage image
  setTimeout(() => {
    const showStage = stages.find(s => s.key === currentStage);
    if (showStage) {
      const el = document.getElementById(showStage.id);
      if (el) {
        el.classList.add('active');
      }
    }
    // Share Gospel button logic
    const shareGospelBtn = document.getElementById('shareGospelBtn');
    if (shareGospelBtn) {
      if (treeProgress >= 350) {
        shareGospelBtn.style.display = 'inline-block';
      } else {
        shareGospelBtn.style.display = 'none';
      }
    }
  }, 50);
}

function animateFlowerBurst(flowerElement) {
  // Re-trigger bloom animation for flowers
  const circles = flowerElement.querySelectorAll('circle');
  circles.forEach((circle, index) => {
    circle.style.animation = 'none';
    // Trigger reflow to restart animation
    void circle.offsetWidth;
    circle.style.animation = `bloom 0.6s ease-out forwards`;
    circle.style.animationDelay = `${index * 0.08}s`;
  });
}

function animateFruitBurst(fruitElement) {
  // Trigger pop animation for fruits
  const circles = fruitElement.querySelectorAll('circle');
  circles.forEach((circle, index) => {
    circle.style.animation = 'none';
    // Trigger reflow to restart animation
    void circle.offsetWidth;
    circle.style.animation = `fruitPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`;
    circle.style.animationDelay = `${index * 0.1}s`;
  });
}

function openUploadModal(action) {
  currentAction = action;
  const reward = actionRewards[action];
  const titlePrefixElement = document.getElementById("uploadTitlePrefix");
  const actionNameElement = document.getElementById("actionName");

  if (action === 'attendService') {
    titlePrefixElement.textContent = 'Share a';
    actionNameElement.textContent = 'Selfie with the Pastor';
  } else {
    titlePrefixElement.textContent = 'Share Your';
    actionNameElement.textContent = reward.name;
  }
  document.getElementById("photoInput").value = '';
  document.getElementById("photoPreview").style.display = 'none';
  const submitPhotoBtn = document.getElementById('submitPhotoBtn');
  if (submitPhotoBtn) {
    submitPhotoBtn.disabled = true;
  }
  const modal = document.getElementById("uploadModal");
  modal.style.display = 'flex';
}

function closeUploadModal() {
  const modal = document.getElementById("uploadModal");
  modal.style.display = 'none';
  const submitPhotoBtn = document.getElementById('submitPhotoBtn');
  if (submitPhotoBtn) {
    submitPhotoBtn.disabled = true;
  }
  currentAction = '';
}

function submitPhoto() {
  const photoInputElement = document.getElementById('photoInput');
  const selectedFile = photoInputElement?.files?.[0];
  if (!selectedFile) {
    showNotification('Please attach an image before submitting.', { type: 'warning' });
    return;
  }

  const recurrenceCheck = canCompleteTask(currentAction);
  if (!recurrenceCheck.allowed) {
    showNotification(recurrenceCheck.message, { type: 'warning' });
    closeUploadModal();
    return;
  }

  const reward = actionRewards[currentAction];
  if (!reward) {
    closeUploadModal();
    return;
  }

  const pointsToAdd = reward.fp;
  faithPoints += pointsToAdd;

  markTaskCompleted(currentAction, recurrenceCheck.periodKey);
  showScripture();
  updateDisplay();
  closeUploadModal();
  showNotification(`Great job! ${pointsToAdd} FP added for ${reward.name}.`, {
    type: 'success',
    browser: true
  });
}

function shareGospel() {
  const pointsToAdd = actionRewards.sharegospel.fp;
  applyTreeProgress(pointsToAdd);
  showScripture();
  updateDisplay();
}

function addFruitIfNeeded(pointsAdded) {
  pointsForFruit += pointsAdded;

  while (pointsForFruit >= 100) {
    fruitCount++;
    pointsForFruit -= 100;
    addFruit();
  }
}

function updateFruitVisuals() {
  const fruitsGroup = document.getElementById("oldTreeFruits");
  if (!fruitsGroup) {
    return;
  }

  const fruitCircles = fruitsGroup.querySelectorAll('circle');
  const visibleFruitCount = Math.min(Math.max(fruitCount, 0), fruitCircles.length);

  fruitCircles.forEach((circle, index) => {
    circle.style.opacity = index < visibleFruitCount ? '1' : '0';
  });
}

function addFruit() {
  // Add a bounce animation to fruits
  const fruitsGroup = document.getElementById("oldTreeFruits");
  if (fruitsGroup) {
    fruitsGroup.style.animation = "none";
    // Trigger reflow
    void fruitsGroup.offsetWidth;
    fruitsGroup.style.animation = "fruitBounce 0.6s ease-out";
    
    // Animate individual fruit circles with pop effect
    const circles = fruitsGroup.querySelectorAll('circle');
    if (circles.length > 0) {
      const newlyShownIndex = Math.min(Math.max(fruitCount - 1, 0), circles.length - 1);
      const latestFruit = circles[newlyShownIndex];
      if (latestFruit) {
        latestFruit.style.opacity = '1';
        latestFruit.style.animation = 'none';
        void latestFruit.offsetWidth;
        latestFruit.style.animation = 'fruitPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
      }
    }
  }
}

function useAllPoints() {
  if (faithPoints >= 10 && faithPoints % 10 === 0) {
    const pointsUsed = faithPoints;

    faithPoints = 0;
    applyTreeProgress(pointsUsed, { addFaithPoints: false });
    
    // Show success message
    const message = maxBloomReached 
      ? `Blessed! You distributed ${pointsUsed} Faith Points for the fruit of your tree! 🍎` 
      : `Blessed! You distributed ${pointsUsed} Faith Points for your growth! 🙏`;
    document.getElementById("scriptureBox").textContent = message;
    document.getElementById("scriptureBox").style.color = "#4CAF50";
    document.getElementById("scriptureBox").style.fontWeight = "bold";
    
    updateDisplay();
    closeUpgradeModal();
    
    // Reset message color after 3 seconds
    setTimeout(() => {
      document.getElementById("scriptureBox").style.color = "#555";
      document.getElementById("scriptureBox").style.fontWeight = "normal";
    }, 3000);
  } else {
    showNotification('Points must be divisible by 10 to use!', { type: 'warning' });
  }
}

function upgrade() {
  if (faithPoints >= upgradeCost) {
    const pointsToAdd = upgradeCost;
    faithPoints -= upgradeCost;
    passiveRate += 1;
    applyTreeProgress(pointsToAdd, { addFaithPoints: false });
    
    // upgradeCost stays at 10 - do not increment
    updateDisplay();
    
    // Trigger bloom animation
    const flowers = document.getElementById("flowers");
    if (flowers) {
      flowers.classList.remove("blooming");
      setTimeout(() => {
        flowers.classList.add("blooming");
      }, 10);
    }
  }
}

function openUpgradeModal() {
  const modal = document.getElementById("upgradeModal");
  const insufficientMsg = document.getElementById("insufficientFpMessage");
  const useAllBtn = document.getElementById("useAllPointsModalBtn");
  
  // Hide insufficient message
  insufficientMsg.style.display = "none";
  
  // Update cost display
  document.getElementById("upgradeCostAmount").textContent = upgradeCost;
  
  // Show/hide Use All Points button based on divisible by 10
  if (faithPoints >= 10 && faithPoints % 10 === 0 && faithPoints >= upgradeCost) {
    useAllBtn.style.display = "inline-block";
  } else {
    useAllBtn.style.display = "none";
  }
  
  modal.style.display = "flex";
}

function closeUpgradeModal() {
  document.getElementById("upgradeModal").style.display = "none";
}

function confirmUpgrade() {
  if (faithPoints >= upgradeCost) {
    upgrade();
    closeUpgradeModal();
  } else {
    document.getElementById("insufficientFpMessage").style.display = "block";
  }
}

function showScripture() {
  const verse = scriptures[Math.floor(Math.random() * scriptures.length)];
  document.getElementById("scriptureBox").textContent = verse;
}

// Photo preview
const photoInput = document.getElementById('photoInput');
if (photoInput) {
  photoInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    const submitPhotoBtn = document.getElementById('submitPhotoBtn');
    if (submitPhotoBtn) {
      submitPhotoBtn.disabled = !file;
    }

    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        const preview = document.getElementById('photoPreview');
        if (preview) {
          preview.src = event.target.result;
          preview.style.display = 'block';
        }
      };
      reader.readAsDataURL(file);
    } else {
      const preview = document.getElementById('photoPreview');
      if (preview) {
        preview.style.display = 'none';
        preview.removeAttribute('src');
      }
    }
  });
}

// Close modal when clicking outside of it
window.addEventListener('click', function(event) {
  const uploadModal = document.getElementById('uploadModal');
  const dailyLoginModal = document.getElementById('dailyLoginModal');
  
  if (uploadModal && event.target === uploadModal) {
    closeUploadModal();
  }

  if (dailyLoginModal && event.target === dailyLoginModal) {
    closeDailyLoginModal();
  }
});

// Keep faith points display in sync when admin updates a user in another tab/window
window.addEventListener('storage', function(event) {
  if (!currentUser || event.key !== 'users' || !event.newValue) {
    return;
  }

  try {
    const updatedUsers = JSON.parse(event.newValue);
    if (!Array.isArray(updatedUsers)) {
      return;
    }

    const updatedUser = updatedUsers.find(u => Number(u.id) === Number(currentUser.id));
    if (updatedUser && Number(updatedUser.faithPoints) !== Number(currentUser.faithPoints)) {
      syncCurrentSessionIfNeeded(updatedUser);
    }
  } catch (e) {
    // ignore JSON parse errors
  }
});

// Initialize app on page load
window.addEventListener('DOMContentLoaded', function() {
  ensureLogosInjected();
  resolveLogoSources();
  removeLegacyAdminFaithPointsCard();
  initializeApp();
});
