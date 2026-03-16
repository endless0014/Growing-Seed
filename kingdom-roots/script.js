// Authentication System
let currentUser = null;
function isCloudSyncDisabled() {
  try {
    return localStorage.getItem('TEST_DISABLE_CLOUD_SYNC') === '1' || sessionStorage.getItem('TEST_DISABLE_CLOUD_SYNC') === '1';
  } catch (e) {
    return false;
  }
}
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
let currentUserCloudUnsubscribe = null;

const DAILY_LOGIN_REWARDS = [2, 2, 3, 4, 5, 6, 8];
const DAILY_LOGIN_COMPLETION_BONUS = 20;
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

function goToFaithActivities() {
  const faithActivitiesSection = document.getElementById('faithActivitiesSection');
  if (!faithActivitiesSection) {
    return;
  }

  faithActivitiesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Extra safeguard for some mobile browsers that ignore smooth scroll in fixed-layout pages.
  window.setTimeout(() => {
    faithActivitiesSection.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, 180);
}

function showRankingComingSoon() {
  showNotification('Ranking Coming Soon', { type: 'info' });
}

function goHomeTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function focusSeedGrowthView() {
  const seedGrowthCard = document.querySelector('.seed-growth-card');
  if (seedGrowthCard) {
    seedGrowthCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function handleUpgradeRootsClick() {
  focusSeedGrowthView();
  // Small delay lets users see the full seed/progress section before modal opens.
  window.setTimeout(() => {
    openUpgradeModal();
  }, 220);
}

function syncProfilePillVisibilityForViewport() {
  const profilePill = document.getElementById('profileAccessPill');
  if (!profilePill) {
    return;
  }

  if (window.matchMedia('(max-width: 768px)').matches) {
    profilePill.style.display = 'none';
  } else {
    profilePill.style.display = '';
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

  // Normalize date-like strings into the internal date-key format (YYYY-M-D)
  const normalizeDateValue = raw => {
    if (raw === null || raw === undefined) return '';
    const s = String(raw).trim();
    if (!s) return '';
    // If already in date-key form, try to parse via getDateKeyFromDate fallback
    const tryParse = new Date(s);
    if (!Number.isNaN(tryParse.getTime())) {
      return getDateKeyFromDate(tryParse);
    }
    return '';
  };

  return {
    streakDay: safeStreakDay,
    lastClaimDate: typeof input.lastClaimDate === 'string' ? normalizeDateValue(input.lastClaimDate) : '',
    cycleStartDate: typeof input.cycleStartDate === 'string' ? normalizeDateValue(input.cycleStartDate) : '',
    claimedDays: Array.from(new Set(claimedDays)).sort((a, b) => a - b)
  };
}

function refreshDailyLoginState() {
  dailyLoginState = normalizeDailyLoginState(dailyLoginState);

  if (!dailyLoginState.lastClaimDate) {
    return;
  }

  const today = new Date();
  // Use parseDateKeyToDate for robust parsing of internal date-key strings
  const lastClaimDate = parseDateKeyToDate(dailyLoginState.lastClaimDate) || new Date(dailyLoginState.lastClaimDate);
  if (!lastClaimDate || Number.isNaN(lastClaimDate.getTime())) {
    dailyLoginState = normalizeDailyLoginState({});
    // Persist reset to storage
    try {
      const normalized = normalizeDailyLoginState(dailyLoginState);
        if (currentUser) {
        currentUser.dailyLoginState = normalized;
        currentUser.updatedAt = Date.now();
          try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
            try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
          }
        const users = getStoredUsersSafe();
        const idx = findUserIndexForSession(users, currentUser);
        if (idx !== -1) {
          users[idx].dailyLoginState = normalized;
          users[idx].updatedAt = currentUser.updatedAt;
          setStoredUsers(users);
        }
      }
    } catch (e) {
      // ignore persistence errors
    }
    return;
  }

  const daysDiff = getDaysBetween(lastClaimDate, today);

  if (daysDiff <= 1) {
    return;
  }

  // Reset in-memory state
  dailyLoginState = {
    streakDay: 1,
    lastClaimDate: '',
    cycleStartDate: '',
    claimedDays: []
  };

  // Persist reset to currentUser and stored users so storage reflects the reset
  try {
    const normalized = normalizeDailyLoginState(dailyLoginState);
    if (currentUser) {
      currentUser.dailyLoginState = normalized;
      currentUser.updatedAt = Date.now();
      try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
        try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
      }
      try {
        localStorage.setItem('lastPersistAt', String(Date.now()));
      } catch (e) {
        // ignore
      }
      try {
        localStorage.setItem('lastPersistAt', String(Date.now()));
      } catch (e) {
        // ignore
      }
    }
    const users = getStoredUsersSafe();
    const idx = findUserIndexForSession(users, currentUser);
    if (idx !== -1) {
      users[idx].dailyLoginState = normalized;
      users[idx].updatedAt = currentUser?.updatedAt ?? Date.now();
      setStoredUsers(users);
    }
  } catch (e) {
    // ignore persistence errors
  }
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

  const nodeMarkup = DAILY_LOGIN_REWARDS.map((points, index) => {
    const dayNumber = index + 1;
    const dayClass = getDailyLoginDayClass(dayNumber);
    const disabled = canClaimDailyLoginDay(dayNumber) ? '' : 'disabled';
    const iconMarkup = getDailyLoginStageSvgMarkup(dayNumber);
    const checkMarkup = dayClass === 'claimed' ? `<span class="daily-login-check">✓</span>` : '';
    return `
      <div class="daily-login-node ${dayClass}">
        <button class="daily-login-tile" data-day="${dayNumber}" ${disabled}>
          <span class="daily-login-tile-icon">${iconMarkup}</span>
          ${checkMarkup}
        </button>
        <span class="daily-login-day-label">Day${dayNumber}</span>
        <span class="daily-login-day-points">+${points}</span>
      </div>
    `;
  }).join('');

  calendarEl.innerHTML = `<div class="daily-login-track">${nodeMarkup}</div>`;

  Array.from(calendarEl.querySelectorAll('.daily-login-tile')).forEach(dayBtn => {
    dayBtn.addEventListener('click', () => {
      const dayValue = Number(dayBtn.getAttribute('data-day'));
      claimDailyLogin(dayValue);
    });
  });
}

function updateDailyLoginReminderToggle() {
  const toggleBtn = document.getElementById('dailyLoginReminderToggle');
  if (!toggleBtn) {
    return;
  }

  const enabled = isAppNotificationEnabled();
  toggleBtn.classList.toggle('on', enabled);
  toggleBtn.classList.toggle('off', !enabled);
  toggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
}

async function toggleDailyLoginReminder() {
  await enableBrowserNotificationsFromProfile();
  updateDailyLoginReminderToggle();
}

function claimDailyLogin(dayNumber) {
  refreshDailyLoginState();

  if (!canClaimDailyLoginDay(dayNumber)) {
    return;
  }

  const reward = DAILY_LOGIN_REWARDS[dayNumber - 1] || 0;
  faithPoints += reward;
  const isFinalDay = dayNumber >= DAILY_LOGIN_REWARDS.length;

  if (isFinalDay) {
    faithPoints += DAILY_LOGIN_COMPLETION_BONUS;
  }

  const todayKey = getTodayDateKey();
  if (!dailyLoginState.cycleStartDate) {
    dailyLoginState.cycleStartDate = todayKey;
  }

  dailyLoginState.lastClaimDate = todayKey;

  if (!dailyLoginState.claimedDays.includes(dayNumber)) {
    dailyLoginState.claimedDays.push(dayNumber);
    dailyLoginState.claimedDays.sort((a, b) => a - b);
  }

  if (isFinalDay) {
    dailyLoginState.streakDay = 1;
    dailyLoginState.claimedDays = [];
    dailyLoginState.cycleStartDate = '';
  } else {
    dailyLoginState.streakDay = dayNumber + 1;
  }

  updateDisplay();
  renderDailyLoginCalendar();
  const rewardMessage = isFinalDay
    ? `Daily login claimed: Day ${dayNumber} (+${reward} FP) + completion bonus (+${DAILY_LOGIN_COMPLETION_BONUS} FP).`
    : `Daily login claimed: Day ${dayNumber} (+${reward} FP).`;

  showNotification(rewardMessage, {
    type: 'success',
    browser: true
  });
}

function ensureDailyLoginUi() {
  const userMainContainer = document.getElementById('userMainContainer');
  if (userMainContainer && !document.getElementById('dailyLoginBtn')) {
    const dailyLoginBtn = document.createElement('button');
    dailyLoginBtn.id = 'dailyLoginBtn';
    dailyLoginBtn.className = 'daily-login-btn';
    dailyLoginBtn.type = 'button';
    dailyLoginBtn.textContent = 'Claim Reward';
    dailyLoginBtn.addEventListener('click', openDailyLoginModal);

    const upgradeBtn = userMainContainer.querySelector('.upgrade-btn');
    if (upgradeBtn) {
      upgradeBtn.insertAdjacentElement('beforebegin', dailyLoginBtn);
    } else {
      userMainContainer.appendChild(dailyLoginBtn);
    }
  }

  if (!document.getElementById('dailyLoginModal')) {
    const modalMarkup = `
      <div id="dailyLoginModal" class="modal" style="display: none;">
        <div class="modal-content daily-login-panel">
          <div class="daily-login-header">
            <h2>Daily check in</h2>
            <button id="dailyLoginReminderToggle" type="button" class="daily-login-reminder-toggle" onclick="toggleDailyLoginReminder()" aria-pressed="true">
              <span class="daily-login-reminder-knob"></span>
            </button>
          </div>
          <p class="daily-login-subtitle">Continuous check-in for 7 days will earn surprise!</p>
          <div id="dailyLoginCalendar" class="daily-login-grid"></div>
          <div class="modal-buttons">
            <button type="button" onclick="closeDailyLoginModal()" class="auth-btn">Close</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalMarkup);
  }
}

function openDailyLoginModal() {
  ensureDailyLoginUi();
  const modal = document.getElementById('dailyLoginModal');
  if (!modal) {
    return;
  }

  updateDailyLoginReminderToggle();
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

function stopCurrentUserCloudSync() {
  if (typeof currentUserCloudUnsubscribe === 'function') {
    currentUserCloudUnsubscribe();
  }
  currentUserCloudUnsubscribe = null;
}

function haveCloudUserStateDifferences(baseUser, incomingUser) {
  if (!baseUser || !incomingUser) {
    return false;
  }

  const trackedNumberFields = [
    'faithPoints',
    'treeProgress',
    'passiveRate',
    'fruitCount',
    'pointsForFruit'
  ];

  const hasNumericDiff = trackedNumberFields.some(field => {
    return Number(baseUser[field] ?? 0) !== Number(incomingUser[field] ?? 0);
  });

  if (hasNumericDiff) {
    return true;
  }

  if (Boolean(baseUser.maxBloomReached) !== Boolean(incomingUser.maxBloomReached)) {
    return true;
  }

  const baseTaskCompletions = JSON.stringify(baseUser.taskCompletions || {});
  const incomingTaskCompletions = JSON.stringify(incomingUser.taskCompletions || {});
  if (baseTaskCompletions !== incomingTaskCompletions) {
    return true;
  }

  const baseDailyLoginState = JSON.stringify(normalizeDailyLoginState(baseUser.dailyLoginState));
  const incomingDailyLoginState = JSON.stringify(normalizeDailyLoginState(incomingUser.dailyLoginState));
  return baseDailyLoginState !== incomingDailyLoginState;
}

function startCurrentUserCloudSync() {
  stopCurrentUserCloudSync();

  if (!currentUser?.email) {
    return;
  }

  const usersCollection = getCloudUsersCollection();
  if (!usersCollection) {
    return;
  }

  const normalizedEmail = normalizeEmail(currentUser.email);
  currentUserCloudUnsubscribe = usersCollection.doc(normalizedEmail).onSnapshot(snapshot => {
    if (!snapshot.exists || !currentUser) {
      return;
    }

    const cloudUser = normalizeStoredUser(snapshot.data(), currentUser.id);
    if (!cloudUser?.email || normalizeEmail(cloudUser.email) !== normalizeEmail(currentUser.email)) {
      return;
    }

    if (!haveCloudUserStateDifferences(currentUser, cloudUser)) {
      return;
    }

    const users = getStoredUsersSafe();
    const userIndex = users.findIndex(user => normalizeEmail(user.email) === normalizedEmail);
    if (userIndex !== -1) {
      users[userIndex] = {
        ...users[userIndex],
        ...cloudUser,
        role: getRoleByEmail(cloudUser.email)
      };
      localStorage.setItem('users', JSON.stringify(users));
    }

    currentUser = {
      ...currentUser,
      ...cloudUser,
      role: getRoleByEmail(cloudUser.email),
      viewMode: currentUser.viewMode ?? cloudUser.viewMode ?? 'user'
    };
    delete currentUser.password;
    try { persistAllUserState(users, currentUser); } catch (e) {
      try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
    }
    loadUserData();
    updateDisplay({ persist: false });
  }, error => {
    console.warn('Current user cloud sync failed:', error);
  });
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
  if (isCloudSyncDisabled()) {
    try { console.debug('[cloud] upsertUserInCloud: skipped (TEST_DISABLE_CLOUD_SYNC) for', user && user.email); } catch (e) {}
    return Promise.resolve();
  }

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
  if (isCloudSyncDisabled()) {
    try { console.debug('[cloud] syncUsersToCloud: skipped (TEST_DISABLE_CLOUD_SYNC) usersCount=', Array.isArray(users) ? users.length : 0); } catch (e) {}
    return;
  }

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
  if (isCloudSyncDisabled()) {
    try { console.debug('[cloud] syncUsersFromCloudToLocal: skipped (TEST_DISABLE_CLOUD_SYNC)'); } catch (e) {}
    return false;
  }

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
        try { persistAllUserState(getStoredUsersSafe(), parsedCurrentUser); } catch (e) {
          try { safeSetCurrentUser(parsedCurrentUser); } catch(__e2) { /* ignore */ }
        }
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
    hydrateCurrentUserFromStoredUsers();
    showAppInterface();
    loadUserData();
    updateDisplay({ persist: false });
    startCurrentUserCloudSync();
    startScheduledReminders();
  } else {
    stopCurrentUserCloudSync();
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
  ensureDailyLoginUi();
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
    try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
      try { console.error('[persist] persistAllUserState threw, fallback storing currentUser, err=', e); } catch(__dbg) {}
      try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
    }
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
  syncProfilePillVisibilityForViewport();

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
    try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
      try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
    }
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
  try {
    localStorage.setItem('users', JSON.stringify(users));
  } catch (e) {
    // ignore storage errors
  }
  try {
    console.debug('[persist] setStoredUsers: wrote users count=', Array.isArray(users) ? users.length : 0);
  } catch (__dbg) {}
  // Keep existing behavior of syncing users to cloud (cloud guard will noop in tests)
  syncUsersToCloud(users);
}

// Canonical persistence helper: write `users`, then `currentUser`, then set `lastPersistAt`.
// Tests should wait for `lastPersistAt` to ensure both writes have completed.
function persistAllUserState(users, currentUserObj) {
  try {
    try {
      console.debug('[persist] persistAllUserState: start usersCount=', Array.isArray(users) ? users.length : 0, ' currentUser.faithPoints=', currentUserObj && typeof currentUserObj.faithPoints !== 'undefined' ? currentUserObj.faithPoints : null);
    } catch(__dbgStart) {}

    // Write users first (reuse setStoredUsers to keep cloud sync path consistent)
    try {
      setStoredUsers(users);
    } catch (e) {
      try { localStorage.setItem('users', JSON.stringify(users)); } catch(__le) { try { console.error('[persist] persistAllUserState: failed writing users', __le); } catch(__dbg1) {} }
    }
    // Read-back verification for users write
    try {
      const rawUsers = localStorage.getItem('users');
      if (rawUsers) {
        try {
          const parsedUsers = JSON.parse(rawUsers);
          try { console.debug('[persist] persistAllUserState: readback usersCount=', Array.isArray(parsedUsers) ? parsedUsers.length : 0); } catch(__dbgUR) {}
        } catch(__pru) {
          try { console.error('[persist] persistAllUserState: readback users parse failed', __pru); } catch(__dbgUR2) {}
        }
      } else {
        try { console.debug('[persist] persistAllUserState: readback users is empty'); } catch(__dbgUR3) {}
      }
    } catch(__urTop) {
      try { console.error('[persist] persistAllUserState: readback users failed', __urTop); } catch(__dbgUR4) {}
    }
  } catch (e) {
    try { console.error('[persist] persistAllUserState: top-level users write failed', e); } catch(__dbg2) {}
  }

  try {
    if (currentUserObj) {
      try {
        localStorage.setItem('currentUser', JSON.stringify(currentUserObj));
      } catch (e) {
        try { console.error('[persist] persistAllUserState: failed writing currentUser', e); } catch(__dbg3) {}
      }
    }
    // Read-back verification: ensure the stored currentUser matches expected payload
    try {
      const raw = localStorage.getItem('currentUser');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          try { console.debug('[persist] persistAllUserState: readback currentUser.faithPoints=', parsed && typeof parsed.faithPoints !== 'undefined' ? parsed.faithPoints : null); } catch(__dbgRB) {}
        } catch(__rbp) {
          try { console.error('[persist] persistAllUserState: readback parse failed', __rbp); } catch(__dbgRB2) {}
        }
      } else {
        try { console.debug('[persist] persistAllUserState: readback currentUser is empty'); } catch(__dbgRB3) {}
      }
    } catch(__rbTop) {
      try { console.error('[persist] persistAllUserState: readback currentUser failed', __rbTop); } catch(__dbgRB4) {}
    }
  } catch (e) {
    try { console.error('[persist] persistAllUserState: unexpected error while handling currentUser', e); } catch(__dbg4) {}
  }

  try {
    const ts = String(Date.now());
    try { localStorage.setItem('lastPersistAt', ts); } catch(__le2) { try { console.error('[persist] persistAllUserState: failed writing lastPersistAt', __le2); } catch(__dbg5) {} }
    try {
      console.debug('[persist] persistAllUserState: wrote users count=', Array.isArray(users) ? users.length : 0, ' currentUser.faithPoints=', currentUserObj && typeof currentUserObj.faithPoints !== 'undefined' ? currentUserObj.faithPoints : null, ' ts=', ts);
    } catch (__dbg) {}
  } catch (e) {
    try { console.error('[persist] persistAllUserState: final step failed', e); } catch(__dbg6) {}
  }
}

// Safe currentUser setter: prefer canonical persist, but fall back to direct writes
function safeSetCurrentUser(userObj) {
  try {
    try { console.debug('[persist] safeSetCurrentUser: attempting canonical persist currentUser.faithPoints=', userObj && typeof userObj.faithPoints !== 'undefined' ? userObj.faithPoints : null); } catch(__dbgStart) {}
    // prefer canonical helper which writes users, currentUser, and lastPersistAt
    persistAllUserState(getStoredUsersSafe(), userObj);
    try { console.debug('[persist] safeSetCurrentUser: canonical persist succeeded for currentUser.id=', userObj && userObj.id); } catch(__dbgOk) {}
    return;
  } catch (e) {
    try { console.error('[persist] persistAllUserState threw, fallback storing currentUser, err=', e); } catch(__dbg) {}
    try {
      try { console.debug('[persist] safeSetCurrentUser: performing fallback write currentUser.faithPoints=', userObj && typeof userObj.faithPoints !== 'undefined' ? userObj.faithPoints : null); } catch(__dbg2) {}
      localStorage.setItem('currentUser', JSON.stringify(userObj));
      const ts = String(Date.now());
      localStorage.setItem('lastPersistAt', ts);
      try { console.debug('[persist] fallback wrote currentUser.faithPoints=', userObj && typeof userObj.faithPoints !== 'undefined' ? userObj.faithPoints : null, ' ts=', ts); } catch(__dbg3) {}
      // Read-back verification for fallback path
      try {
        const rawFb = localStorage.getItem('currentUser');
        if (rawFb) {
          try {
            const parsedFb = JSON.parse(rawFb);
            try { console.debug('[persist] safeSetCurrentUser: fallback readback currentUser.faithPoints=', parsedFb && typeof parsedFb.faithPoints !== 'undefined' ? parsedFb.faithPoints : null); } catch(__dbgFB) {}
          } catch(__pfb) {
            try { console.error('[persist] safeSetCurrentUser: fallback readback parse failed', __pfb); } catch(__dbgFB2) {}
          }
        } else {
          try { console.debug('[persist] safeSetCurrentUser: fallback readback currentUser is empty'); } catch(__dbgFB3) {}
        }
      } catch(__fbTop) {
        try { console.error('[persist] safeSetCurrentUser: fallback readback failed', __fbTop); } catch(__dbgFB4) {}
      }
    } catch (__e2) {
      try { console.error('[persist] safeSetCurrentUser: fallback write failed', __e2); } catch(__dbg4) {}
      // ignore fallback write errors
    }
  }
}

function findUserIndexById(users, userId) {
  const numericUserId = Number(userId);
  if (!Number.isFinite(numericUserId)) {
    return -1;
  }

  return users.findIndex(user => Number(user.id) === numericUserId);
}

function findUserIndexForSession(users, sessionUser) {
  if (!Array.isArray(users) || !sessionUser) {
    return -1;
  }

  const byIdIndex = findUserIndexById(users, sessionUser.id);
  if (byIdIndex !== -1) {
    return byIdIndex;
  }

  const normalizedSessionEmail = normalizeEmail(sessionUser.email);
  if (!normalizedSessionEmail) {
    return -1;
  }

  return users.findIndex(user => normalizeEmail(user.email) === normalizedSessionEmail);
}

function hydrateCurrentUserFromStoredUsers() {
  if (!currentUser) {
    return false;
  }

  const users = getStoredUsersSafe();
  const userIndex = findUserIndexForSession(users, currentUser);
  if (userIndex === -1) {
    return false;
  }

  const mergedUser = {
    ...users[userIndex],
    role: getRoleByEmail(users[userIndex].email),
    viewMode: currentUser.viewMode ?? users[userIndex].viewMode ?? 'user'
  };

  delete mergedUser.password;
  currentUser = mergedUser;
  try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
    try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
  }
  return true;
}

function syncCurrentSessionIfNeeded(updatedUser, options = {}) {
  const { persist = true } = options;

  if (!currentUser || !updatedUser) {
    return;
  }

  const sameId = Number(currentUser.id) === Number(updatedUser.id);
  const sameEmail = normalizeEmail(currentUser.email) !== '' && normalizeEmail(currentUser.email) === normalizeEmail(updatedUser.email);

  if (sameId || sameEmail) {
    currentUser = {
      ...currentUser,
      ...updatedUser,
      role: getRoleByEmail(updatedUser.email),
      viewMode: currentUser.viewMode ?? updatedUser.viewMode ?? 'user'
    };
    delete currentUser.password;
    try {
      persistAllUserState(getStoredUsersSafe(), currentUser);
      try { const ts = String(Date.now()); console.debug('[persist] syncCurrentSessionIfNeeded: wrote currentUser.id=', currentUser.id, ' faithPoints=', currentUser.faithPoints, ' ts=', ts); } catch (__dbg) {}
    } catch (e) {
      try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
    }
    loadUserData();
    updateDisplay({ persist });
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

  stopCurrentUserCloudSync();
  delete nextSessionUser.password;
  currentUser = nextSessionUser;
  try { persistAllUserState(getStoredUsersSafe(), nextSessionUser); } catch (e) {
    try { console.error('[persist] persistAllUserState threw, fallback storing nextSessionUser, err=', e); } catch(__dbg) {}
    try {
      localStorage.setItem('currentUser', JSON.stringify(nextSessionUser));
      const ts = String(Date.now());
      localStorage.setItem('lastPersistAt', ts);
      try { console.debug('[persist] fallback wrote nextSessionUser.faithPoints=', nextSessionUser && typeof nextSessionUser.faithPoints !== 'undefined' ? nextSessionUser.faithPoints : null, ' ts=', ts); } catch(__dbg2) {}
    } catch(__e2) { /* ignore */ }
  }
  closeProfileModal();
  showAppInterface();
  loadUserData();
  updateDisplay();
  startCurrentUserCloudSync();
  showNotification(`Now viewing user UI as ${selectedUser.email}.`, { type: 'info' });
}

window.adminAddPoints = adminAddPoints;
window.adminResetPassword = adminResetPassword;
window.adminResetProgress = adminResetProgress;
window.adminViewProgress = adminViewProgress;
window.adminOpenUserUi = adminOpenUserUi;

// Expose saveUserData so non-module inline callers and tests can persist reliably
window.saveUserData = saveUserData;

// Expose progress API to tests and inline callers
try { window.applyTreeProgress = applyTreeProgress; } catch(__e) {}
try { window.markTaskCompleted = markTaskCompleted; } catch(__e) {}

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
    stopCurrentUserCloudSync();

    const userIndex = users.findIndex(u => Number(u.id) === Number(user.id));
    const normalizedUser = normalizeStoredUser(user, user.id);
    normalizedUser.lastLogin = new Date().toLocaleString();
    normalizedUser.lastActiveAt = Date.now();
    normalizedUser.viewMode = isAdminEmail(normalizedUser.email) ? 'admin' : (normalizedUser.viewMode ?? 'user');
    // Update consecutive login streak based on lastLoginDateKey (use helper if available)
    try {
      if (typeof updateConsecutiveLoginStats === 'function') {
        updateConsecutiveLoginStats(normalizedUser);
      } else {
        throw new Error('missing helper');
      }
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
    try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
      try { console.error('[persist] persistAllUserState threw, fallback storing currentUser, err=', e); } catch(__dbg) {}
      try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
    }
    try {
      console.debug('[persist] handleLogin: currentUser set during login id=', currentUser.id, ' faithPoints=', currentUser.faithPoints);
    } catch (e) {
      // ignore
    }
    clearAuthErrors();
    showAppInterface();
    loadUserData();
    updateDisplay();
    startCurrentUserCloudSync();
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
  stopCurrentUserCloudSync();
  
  currentUser = { ...newUser };
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
    stopCurrentUserCloudSync();
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
  if (!currentUser) {
    switchToLogin();
    return;
  }

  if (isAdminEmail(currentUser?.email)) {
    if (currentUser.role !== 'admin') {
      currentUser.role = 'admin';
    }
    try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
      try { console.error('[persist] persistAllUserState threw, fallback storing currentUser, err=', e); } catch(__dbg) {}
      try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
    }
  }

  applyViewModeUI();

  const toggleBtn = document.getElementById('switchAdminViewBtn');
  if (toggleBtn) {
    const hasMgmt = hasManagementAccess();
    toggleBtn.style.display = hasMgmt ? 'block' : 'none';
    if (hasMgmt) {
      toggleBtn.textContent = getCurrentViewMode() === 'admin' ? 'Switch to User View' : 'Switch to Management View';
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
      stopCurrentUserCloudSync();
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

  try { console.debug('[progress] applyTreeProgress: start pointsToAdd=', pointsToAdd, ' addFaithPoints=', addFaithPoints, ' faithPoints(before)=', typeof faithPoints !== 'undefined' ? faithPoints : null, ' treeProgress(before)=', typeof treeProgress !== 'undefined' ? treeProgress : null); } catch(__dbg) {}

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
  try { console.debug('[progress] applyTreeProgress: end faithPoints(after)=', typeof faithPoints !== 'undefined' ? faithPoints : null, ' treeProgress(after)=', treeProgress, ' maxBloomReached=', !!maxBloomReached); } catch(__dbg2) {}
  // Probe: read-after-write snapshot to detect any external overwrite
  try {
    const _raw_probe = localStorage.getItem('currentUser');
    if (_raw_probe) {
      try {
        const _parsed_probe = JSON.parse(_raw_probe);
        try { console.debug('[probe] applyTreeProgress: stored currentUser.faithPoints=', _parsed_probe && typeof _parsed_probe.faithPoints !== 'undefined' ? _parsed_probe.faithPoints : null); } catch(__dbgP) {}
      } catch(__pp) {
        try { console.error('[probe] applyTreeProgress: stored currentUser parse failed', __pp); } catch(__dbgP2) {}
      }
    } else {
      try { console.debug('[probe] applyTreeProgress: stored currentUser is empty'); } catch(__dbgP3) {}
    }
  } catch(__probeTop) {
    try { console.error('[probe] applyTreeProgress: probe readback failed', __probeTop); } catch(__dbgP4) {}
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

function updateDisplay(options = {}) {
  const { persist = true } = options;

  const faithPointsEl = document.getElementById("faithPoints");
  const upgradeCostEl = document.getElementById("upgradeCost");
  const fpPillValueEl = document.getElementById('fpPillValue');
  const streakPillValueEl = document.getElementById('streakPillValue');
  const dailyRewardStreakEl = document.getElementById('dailyRewardStreakText');
  
  if (faithPointsEl) faithPointsEl.textContent = Math.floor(faithPoints);
  if (upgradeCostEl) upgradeCostEl.textContent = upgradeCost;
  if (fpPillValueEl) fpPillValueEl.textContent = String(Math.floor(faithPoints));

  if (streakPillValueEl) {
    const completedCount = Array.isArray(dailyLoginState.claimedDays)
      ? dailyLoginState.claimedDays.length
      : 0;
    const streakDay = completedCount > 0 ? completedCount : 1;
    streakPillValueEl.textContent = `Day ${streakDay}`;
  }

  if (dailyRewardStreakEl) {
    const completedCount = Array.isArray(dailyLoginState.claimedDays)
      ? dailyLoginState.claimedDays.length
      : 0;
    const todayClaimed = hasClaimedDailyLoginToday();
    // When the user has checked in today, show the completed day count (Day X/7).
    if (todayClaimed) {
      const shownDay = Math.max(1, completedCount);
      dailyRewardStreakEl.textContent = `Day ${shownDay}/${DAILY_LOGIN_REWARDS.length} — Checked in today.`;
    } else {
      const nextDay = Math.min(dailyLoginState.streakDay, DAILY_LOGIN_REWARDS.length);
      dailyRewardStreakEl.textContent = `Day ${nextDay} reward ready`;
    }
  }
  
  updateTaskBadges();
  updateProgressDisplay();
  updateTreeGrowth();
  updateFruitVisuals();
  if (persist) {
    saveUserData();
  }
}

function saveUserData() {
  // If the module-scoped `currentUser` isn't populated (e.g. actions run
  // early or session was seeded directly in localStorage), try to hydrate
  // it from stored `currentUser` so persistence works reliably.
  if (!currentUser) {
    try {
      const raw = localStorage.getItem('currentUser');
      if (raw) {
        currentUser = JSON.parse(raw);
      }
    } catch (e) {
      // ignore parse errors and continue — save will be a no-op if still missing
    }
  }

  if (currentUser) {
    try { console.debug('[persist] saveUserData: start currentUser.id=', currentUser && currentUser.id, ' faithPoints(in-memory)=', typeof faithPoints !== 'undefined' ? faithPoints : null); } catch(__dbgStart) {}
    refreshDailyLoginState();
    // Update user data in localStorage
    const users = getStoredUsersSafe();
    const currentUserId = Number(currentUser.id);
    const normalizedCurrentEmail = normalizeEmail(currentUser.email);
    let userIndex = users.findIndex(u => Number(u.id) === currentUserId);

    // Cross-device sessions can carry stale ids; fall back to email to keep sync reliable.
    if (userIndex === -1 && normalizedCurrentEmail) {
      userIndex = users.findIndex(u => normalizeEmail(u.email) === normalizedCurrentEmail);
    }

    if (userIndex === -1) {
      users.push(normalizeStoredUser(currentUser, Date.now()));
      userIndex = users.length - 1;
    }
    
    // Prefer the in-memory `faithPoints` value (avoid stale DOM when updateDisplay
    // hasn't been called yet). Fall back to DOM textContent if in-memory is not set.
    const domFpRaw = Number(document.getElementById('faithPoints')?.textContent);
    const computedFaithPoints = Number.isFinite(faithPoints) ? Math.floor(faithPoints) : (Number.isFinite(domFpRaw) ? Math.floor(domFpRaw) : 0);

    if (userIndex !== -1) {
      console.log('saveUserData: updating userIndex', userIndex, 'email', normalizedCurrentEmail, 'computedFaithPoints', computedFaithPoints);
      // Update the matched user object with computed game state
      users[userIndex] = {
        ...users[userIndex],
        faithPoints: Math.floor(computedFaithPoints),
        treeProgress: Math.floor(treeProgress),
        passiveRate,
        fruitCount,
        pointsForFruit,
        maxBloomReached,
        taskCompletions,
        dailyLoginState: normalizeDailyLoginState(dailyLoginState),
        viewMode: getCurrentViewMode(),
        lastActiveAt: Date.now(),
        updatedAt: Date.now()
      };

      // Persist users and current session together so `lastPersistAt` only
      // advances after both writes are durable for tests to observe.
      const newCurrent = {
        ...currentUser,
        ...users[userIndex],
        role: getRoleByEmail(currentUser?.email),
        viewMode: getCurrentViewMode()
      };
      delete newCurrent.password;
      try { console.debug('[persist] saveUserData: about to persistAllUserState for userIndex=', userIndex, ' computedFaithPoints=', computedFaithPoints); persistAllUserState(users, newCurrent); } catch (e) {
        try { console.error('[persist] persistAllUserState threw, fallback storing newCurrent, err=', e); } catch(__dbg) {}
        try { setStoredUsers(users); try { safeSetCurrentUser(newCurrent); } catch(__e2) { /* ignore */ } } catch(__e2) { /* ignore */ }
      }
      // Probe: immediate read-after-write to detect persisted value and mismatches
      try {
        const _raw_post = localStorage.getItem('currentUser');
        if (_raw_post) {
          try {
            const _parsed_post = JSON.parse(_raw_post);
            try { console.debug('[probe] saveUserData: post-persist readback currentUser.faithPoints=', _parsed_post && typeof _parsed_post.faithPoints !== 'undefined' ? _parsed_post.faithPoints : null); } catch(__dbgPP) {}
          } catch(__ppp) {
            try { console.error('[probe] saveUserData: post-persist readback parse failed', __ppp); } catch(__dbgPP2) {}
          }
        } else {
          try { console.debug('[probe] saveUserData: post-persist readback currentUser is empty'); } catch(__dbgPP3) {}
        }
      } catch(__postTop) {
        try { console.error('[probe] saveUserData: post-persist readback failed', __postTop); } catch(__dbgPP4) {}
      }
      currentUser = newCurrent;
      upsertUserInCloud(users[userIndex]);
    } else {
      // Try to find by normalized email if id-based lookup failed
      const normalizedEmail = normalizedCurrentEmail;
      let foundIndex = -1;
      if (normalizedEmail) {
        foundIndex = users.findIndex(u => normalizeEmail(u.email) === normalizedEmail);
      }

      if (foundIndex !== -1) {
        users[foundIndex] = {
          ...users[foundIndex],
          faithPoints: Math.floor(computedFaithPoints),
          treeProgress: Math.floor(treeProgress),
          passiveRate,
          fruitCount,
          pointsForFruit,
          maxBloomReached,
          taskCompletions,
          dailyLoginState: normalizeDailyLoginState(dailyLoginState),
          viewMode: getCurrentViewMode(),
          lastActiveAt: Date.now(),
          updatedAt: Date.now()
        };
          const newCurrent = {
            ...currentUser,
            ...users[foundIndex],
            role: getRoleByEmail(currentUser?.email),
            viewMode: getCurrentViewMode()
          };
          delete newCurrent.password;
          try { persistAllUserState(users, newCurrent); } catch (e) {
            try { console.error('[persist] persistAllUserState threw, fallback storing newCurrent, err=', e); } catch(__dbg) {}
            try { console.debug('[persist] saveUserData: persistAllUserState failed in fallback branch, setting users and safeSetCurrentUser'); } catch(__dbg2) {}
            try { setStoredUsers(users); try { safeSetCurrentUser(newCurrent); } catch(__e2) { /* ignore */ } } catch(__e2) { /* ignore */ }
          }
          currentUser = newCurrent;
          upsertUserInCloud(users[foundIndex]);
          console.log('saveUserData: users saved (found by email)');
      } else {
        // No existing stored user; create one from currentUser data
        const newUser = normalizeStoredUser({
          ...currentUser,
          faithPoints: Math.floor(computedFaithPoints),
          treeProgress: Math.floor(treeProgress),
          passiveRate,
          fruitCount,
          pointsForFruit,
          maxBloomReached,
          taskCompletions,
          dailyLoginState: normalizeDailyLoginState(dailyLoginState),
          viewMode: getCurrentViewMode()
        }, Date.now());
        users.push(newUser);
        const newCurrent = {
          ...currentUser,
          ...newUser,
          role: getRoleByEmail(newUser.email),
          viewMode: getCurrentViewMode()
        };
        delete newCurrent.password;
        try { persistAllUserState(users, newCurrent); } catch (e) {
          try { console.error('[persist] persistAllUserState threw, fallback storing newCurrent, err=', e); } catch(__dbg) {}
          try { console.debug('[persist] saveUserData: persistAllUserState threw in new-user branch, doing fallback persist'); } catch(__dbg2) {}
          try { setStoredUsers(users); try { safeSetCurrentUser(newCurrent); } catch(__e2) { /* ignore */ } } catch(__e2) { /* ignore */ }
        }
        currentUser = newCurrent;
        upsertUserInCloud(newUser);
        console.log('saveUserData: users saved (created new user)', newUser.email, newUser.faithPoints);
      }
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
  // Atomic persistence fallback: synchronously write current session and users
  try {
    // Ensure we have a session in module scope; hydrate from localStorage if needed
    if (!currentUser) {
      try {
        const raw = localStorage.getItem('currentUser');
        if (raw) currentUser = JSON.parse(raw);
      } catch (e) {
        // ignore
      }
    }

    const computedFaithPoints = Number(document.getElementById('faithPoints')?.textContent) || Math.floor(faithPoints);
    const users = getStoredUsersSafe();
    const normalizedEmail = normalizeEmail(currentUser?.email);
    let userIndex = findUserIndexForSession(users, currentUser);
    if (userIndex === -1 && normalizedEmail) {
      userIndex = users.findIndex(u => normalizeEmail(u.email) === normalizedEmail);
    }

    if (userIndex !== -1) {
      users[userIndex] = {
        ...users[userIndex],
        faithPoints: Math.floor(computedFaithPoints),
        treeProgress: Math.floor(treeProgress),
        passiveRate,
        fruitCount,
        pointsForFruit,
        maxBloomReached,
        taskCompletions,
        dailyLoginState: normalizeDailyLoginState(dailyLoginState),
        viewMode: getCurrentViewMode(),
        lastActiveAt: Date.now(),
        updatedAt: Date.now()
      };
      setStoredUsers(users);
      upsertUserInCloud(users[userIndex]);

      currentUser = {
        ...currentUser,
        ...users[userIndex],
        role: getRoleByEmail(currentUser?.email),
        viewMode: getCurrentViewMode()
      };
      delete currentUser.password;
      try { persistAllUserState(users, currentUser); } catch (e) {
        try { console.error('[persist] persistAllUserState threw, fallback storing currentUser, err=', e); } catch(__dbg) {}
        try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
      }
    } else if (currentUser) {
      const newUser = normalizeStoredUser({
        ...currentUser,
        faithPoints: Math.floor(computedFaithPoints),
        treeProgress: Math.floor(treeProgress),
        passiveRate,
        fruitCount,
        pointsForFruit,
        maxBloomReached,
        taskCompletions,
        dailyLoginState: normalizeDailyLoginState(dailyLoginState),
        viewMode: getCurrentViewMode()
      }, Date.now());
      users.push(newUser);
      setStoredUsers(users);
      upsertUserInCloud(newUser);
      currentUser = {
        ...currentUser,
        ...newUser,
        role: getRoleByEmail(newUser.email),
        viewMode: getCurrentViewMode()
      };
      delete currentUser.password;
      try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
        try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
      }
    }
  } catch (e) {
    console.warn('Atomic persistence failed after submitPhoto', e);
  }

  // Ensure updated FP and user session are persisted via the canonical saver as well
  try { saveUserData(); } catch (e) { console.warn('saveUserData failed after submitPhoto', e); }
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
    focusSeedGrowthView();
  } else {
    document.getElementById("insufficientFpMessage").style.display = "block";
  }
}

window.addEventListener('resize', syncProfilePillVisibilityForViewport);

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

    const updatedUserIndex = findUserIndexForSession(updatedUsers, currentUser);
    const updatedUser = updatedUserIndex !== -1 ? updatedUsers[updatedUserIndex] : null;
    if (updatedUser && haveCloudUserStateDifferences(currentUser, updatedUser)) {
      syncCurrentSessionIfNeeded(updatedUser, { persist: false });
    }
  } catch (e) {
    // ignore JSON parse errors
  }
});

// Initialize app on page load
window.addEventListener('DOMContentLoaded', function() {
  ensureLogosInjected();
  resolveLogoSources();
  ensureDailyLoginUi();
  removeLegacyAdminFaithPointsCard();
  // Expose legacy inline handlers to the global window so the module can keep `type="module"`
  try {
    if (typeof exposeGlobalHandlers === 'function') exposeGlobalHandlers();
  } catch (e) {
    console.warn('Failed to expose global handlers:', e);
  }
  // Attach programmatic auth listeners (prefer over inline handlers)
  try {
    if (typeof attachAuthEventListeners === 'function') attachAuthEventListeners();
  } catch (e) {
    console.warn('Failed to attach auth listeners:', e);
  }
  initializeApp();
});

// Expose commonly-used UI handlers to `window` so inline `onclick`/`onsubmit` attrs work
function exposeGlobalHandlers() {
  const handlerNames = [
    'handleLogin','handleRegister','handleChangePassword',
    'switchToRegister','switchToLogin','switchToForgotPassword',
    'sendResetCode','resetPasswordWithCode','goBackToForgot',
    'openLeaderboardModal','openProfileModal','openDailyLoginModal',
    'toggleDailyLoginReminder','handleUpgradeRootsClick','openUploadModal',
    'goHomeTop','goToFaithActivities','switchToUserHome','scrollAdminSection',
    'adminForceLogoutAll','adminResetAllProgress','restoreUserLoginStreaksFromBackup',
    'renderAdminDashboard','closeProfileModal','toggleAdminView','enableBrowserNotificationsFromProfile',
    'openChangePasswordModal','downloadUserData','handleLogout','deleteAccountConfirm',
    'closeChangePasswordModal','closeUploadModal','submitPhoto','closeUpgradeModal',
    'confirmUpgrade','useAllPoints','closeDailyLoginModal','closeLeaderboardModal',
    'switchPublicBoardType','openDailyLoginModal'
  ];

  handlerNames.forEach(name => {
    try {
      if (typeof window[name] === 'undefined') {
        const fn = eval(name);
        if (typeof fn === 'function') window[name] = fn;
      }
    } catch (e) {
      // ignore missing handlers
    }
  });

  // Expose admin helpers that are referenced via window.admin* in templates
  try { if (typeof adminAddPoints === 'function') window.adminAddPoints = adminAddPoints; } catch(e){}
  try { if (typeof adminResetPassword === 'function') window.adminResetPassword = adminResetPassword; } catch(e){}
  try { if (typeof adminResetProgress === 'function') window.adminResetProgress = adminResetProgress; } catch(e){}
  try { if (typeof adminViewProgress === 'function') window.adminViewProgress = adminViewProgress; } catch(e){}
  try { if (typeof adminOpenUserUi === 'function') window.adminOpenUserUi = adminOpenUserUi; } catch(e){}
}

// Attach programmatic listeners for core auth UI elements
function attachAuthEventListeners() {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const registerForm = document.getElementById('registerForm');
  if (registerForm) registerForm.addEventListener('submit', handleRegister);

  const sendResetBtn = document.getElementById('sendResetCodeBtn');
  if (sendResetBtn) sendResetBtn.addEventListener('click', sendResetCode);

  const resetPwdBtn = document.getElementById('resetPasswordBtn');
  if (resetPwdBtn) resetPwdBtn.addEventListener('click', resetPasswordWithCode);

  const forgotBackBtn = document.getElementById('forgotBackBtn');
  if (forgotBackBtn) forgotBackBtn.addEventListener('click', goBackToForgot);

  const registerLink = document.getElementById('registerLink');
  if (registerLink) registerLink.addEventListener('click', e => { e.preventDefault(); switchToRegister(); });

  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  if (forgotPasswordLink) forgotPasswordLink.addEventListener('click', e => { e.preventDefault(); switchToForgotPassword(); });

  const loginLink = document.getElementById('loginLink');
  if (loginLink) loginLink.addEventListener('click', e => { e.preventDefault(); switchToLogin(); });

  const forgotToLoginLink = document.getElementById('forgotToLoginLink');
  if (forgotToLoginLink) forgotToLoginLink.addEventListener('click', e => { e.preventDefault(); switchToLogin(); });

  // Ensure leaderboard / ranking buttons reliably open the public board modal
  try {
    const leaderboardCandidates = Array.from(document.querySelectorAll('.gs-pill.leaderboard, .bottom-nav-item'));
    leaderboardCandidates.forEach(el => {
      try {
        const onclickAttr = el.getAttribute && el.getAttribute('onclick');
        const match = onclickAttr && onclickAttr.match(/openLeaderboardModal\(['"]?(leaderboard|ranking)['"]?\)/);
        if (!match) return; // only attach to elements that explicitly call openLeaderboardModal
        const boardType = match[1];
        el.addEventListener('click', (ev) => {
          ev.preventDefault();
          if (typeof window.openLeaderboardModal === 'function') {
            window.openLeaderboardModal(boardType);
          } else if (typeof openLeaderboardModal === 'function') {
            try { openLeaderboardModal(boardType); } catch(e){}
          } else {
            // Fallback: try to show modal element directly
            const modal = document.getElementById('leaderboardModal');
            if (modal) modal.style.display = 'flex';
          }
        });
      } catch (e) { /* ignore per-element listener errors */ }
    });
  } catch (e) { /* ignore overall leaderboard wiring errors */ }
  
  // Ensure profile buttons reliably open the profile modal
  try {
    const profileCandidates = Array.from(document.querySelectorAll('.gs-pill.profile-access, .bottom-nav-item'));
    profileCandidates.forEach(el => {
      try {
        const onclickAttr = el.getAttribute && el.getAttribute('onclick');
        const isProfile = onclickAttr && onclickAttr.indexOf('openProfileModal') !== -1;
        if (!isProfile) return;
        el.addEventListener('click', (ev) => {
          ev.preventDefault();
          if (typeof window.openProfileModal === 'function') {
            try { window.openProfileModal(); } catch(e) { /* ignore */ }
          } else if (typeof openProfileModal === 'function') {
            try { openProfileModal(); } catch(e) { /* ignore */ }
          } else {
            const modal = document.getElementById('profileModal');
            if (modal) modal.style.display = 'flex';
          }
        });
      } catch (e) { /* ignore per-element errors */ }
    });
  } catch (e) { /* ignore profile wiring errors */ }
}

// Expose daily-login helpers for debugging and console-driven tests
try {
  if (typeof claimDailyLogin === 'function') window.claimDailyLogin = claimDailyLogin;
  if (typeof renderDailyLoginCalendar === 'function') window.renderDailyLoginCalendar = renderDailyLoginCalendar;
  if (typeof canClaimDailyLoginDay === 'function') window.canClaimDailyLoginDay = canClaimDailyLoginDay;
  if (typeof hasClaimedDailyLoginToday === 'function') window.hasClaimedDailyLoginToday = hasClaimedDailyLoginToday;
} catch (e) {
  // ignore
}

// Ensure public board / modal handlers are available globally for inline onclick attrs
try {
  if (typeof openLeaderboardModal === 'function') window.openLeaderboardModal = openLeaderboardModal;
  if (typeof closeLeaderboardModal === 'function') window.closeLeaderboardModal = closeLeaderboardModal;
  if (typeof switchPublicBoardType === 'function') window.switchPublicBoardType = switchPublicBoardType;
  if (typeof openDailyLoginModal === 'function') window.openDailyLoginModal = openDailyLoginModal;
} catch (e) {
  // ignore
}
