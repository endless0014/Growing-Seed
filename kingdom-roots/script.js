// Authentication System
let currentUser = null;
const ADMIN_EMAILS = ['endlesssh0014@gmail.com', 'endlessssh0014@gmail.com', 'endless0014@gmail.com'];
const ALLOWED_ROLES = ['admin', 'moderator', 'user'];
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDXPQnVHn9ux9Je5vGASWKig3AdBvnlOIk',
  authDomain: 'growing-seed-fc973.firebaseapp.com',
  projectId: 'growing-seed-fc973',
  storageBucket: 'growing-seed-fc973.firebasestorage.app',
  messagingSenderId: '154122860320',
  appId: '1:154122860320:web:90f610016b49ad25ef0945'
};
const CLOUD_USERS_COLLECTION = 'users';
const EMAIL_CORRECTIONS = {
  'nicolenavarrosa27@gmailc.com': 'nicolenavarrosa27@gmail.com'
};
const CLOUD_MIGRATION_KEY = 'growingSeedCloudMigrationDoneV1';
const NOTIFICATION_PREFERENCE_KEY = 'growingSeedNotificationsEnabled';
const REMINDER_LOG_KEY = 'growingSeedReminderLogV1';
const FP_DEBUG_MODE_KEY = 'growingSeedFpDebugModeV1';
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
const NON_USER_ROLES_FOR_PUBLIC_BOARDS = new Set(['admin', 'moderator']);

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
  if (!capacitor || typeof capacitor.isNativePlatform !== 'function' || !capacitor.isNativePlatform()) {
    return null;
  }

  return capacitor.Plugins?.LocalNotifications || null;
}

async function triggerNativeLocalNotification(message, title = 'Growing Seed') {
  const localNotifications = getCapacitorLocalNotificationsPlugin();
  if (!localNotifications || !isAppNotificationEnabled()) {
    return;
  }

  try {
    const permissionStatus = await localNotifications.checkPermissions();
    if (permissionStatus?.display !== 'granted') {
      return;
    }

    const notificationId = Math.floor(Date.now() % 2147483000);
    await localNotifications.schedule({
      notifications: [
        {
          id: notificationId,
          title,
          body: String(message || ''),
          schedule: { at: new Date(Date.now() + 250) }
        }
      ]
    });
  } catch (error) {
    console.warn('Native notification failed:', error);
  }
}

function triggerBrowserNotification(message, title = 'Growing Seed') {
  if (!isAppNotificationEnabled()) {
    return;
  }

  const localNotifications = getCapacitorLocalNotificationsPlugin();
  if (localNotifications) {
    void triggerNativeLocalNotification(message, title);
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
  const localNotifications = getCapacitorLocalNotificationsPlugin();
  if (localNotifications) {
    return localNotifications
      .checkPermissions()
      .then(status => {
        if (status?.display === 'granted') {
          return 'granted';
        }

        return localNotifications.requestPermissions().then(requestStatus => requestStatus?.display || 'default');
      })
      .catch(error => {
        console.warn('Native notification permission request failed:', error);
        return 'default';
      });
  }

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

function isFpDebugEnabled() {
  const fromQuery = new URLSearchParams(window.location.search).get('fpDebug');
  if (fromQuery === '1' || fromQuery === 'true') {
    return true;
  }

  return localStorage.getItem(FP_DEBUG_MODE_KEY) === 'enabled';
}

function setFpDebugEnabled(enabled) {
  localStorage.setItem(FP_DEBUG_MODE_KEY, enabled ? 'enabled' : 'disabled');
}

function getFpDebugToggleText() {
  return isFpDebugEnabled() ? 'FP Debug: ON' : 'FP Debug: OFF';
}

function debugFpLog(eventName, details = {}) {
  if (!isFpDebugEnabled()) {
    return;
  }

  const safeEmail = currentUser?.email || 'unknown';
  const payload = {
    event: eventName,
    email: safeEmail,
    faithPoints: Math.floor(Number(faithPoints ?? 0) || 0),
    treeProgress: Math.floor(Number(treeProgress ?? 0) || 0),
    localUpdatedAt: Number(currentUser?.updatedAt ?? 0) || 0,
    timestamp: new Date().toISOString(),
    ...details
  };

  console.log('[FP DEBUG]', payload);
}

function updateProfileDebugControls() {
  const debugBtn = document.getElementById('toggleFpDebugBtn');
  if (debugBtn) {
    debugBtn.textContent = getFpDebugToggleText();
  }
}

function toggleFpDebugMode() {
  const nextEnabled = !isFpDebugEnabled();
  setFpDebugEnabled(nextEnabled);
  updateProfileDebugControls();
  showNotification(nextEnabled ? 'FP debug mode enabled.' : 'FP debug mode disabled.', { type: 'info' });
}

async function runFpDiagnostics() {
  if (!currentUser?.email) {
    showNotification('No active user session to inspect.', { type: 'warning' });
    return;
  }

  const normalizedEmail = normalizeEmail(currentUser.email);
  const users = getStoredUsersSafe();
  const storedUser = users.find(user => normalizeEmail(user.email) === normalizedEmail) || null;

  let cloudUser = null;
  const usersCollection = getCloudUsersCollection();
  if (usersCollection) {
    try {
      const snapshot = await usersCollection.doc(normalizedEmail).get();
      if (snapshot.exists) {
        cloudUser = normalizeStoredUser(snapshot.data(), currentUser.id);
      }
    } catch (error) {
      debugFpLog('diagnostics-cloud-read-error', { error: String(error?.message || error) });
    }
  }

  const localSessionFp = Math.floor(Number(faithPoints ?? 0) || 0);
  const currentUserFp = Math.floor(Number(currentUser.faithPoints ?? 0) || 0);
  const storedFp = Math.floor(Number(storedUser?.faithPoints ?? 0) || 0);
  const cloudFp = Math.floor(Number(cloudUser?.faithPoints ?? 0) || 0);

  const summary = {
    email: normalizedEmail,
    sessionFaithPoints: localSessionFp,
    currentUserFaithPoints: currentUserFp,
    localStorageFaithPoints: storedFp,
    cloudFaithPoints: cloudUser ? cloudFp : 'n/a',
    currentUserUpdatedAt: Number(currentUser.updatedAt ?? currentUser.lastActiveAt ?? 0) || 0,
    localStorageUpdatedAt: Number(storedUser?.updatedAt ?? storedUser?.lastActiveAt ?? 0) || 0,
    cloudUpdatedAt: cloudUser ? (Number(cloudUser.updatedAt ?? cloudUser.lastActiveAt ?? 0) || 0) : 'n/a'
  };

  console.table(summary);
  debugFpLog('diagnostics-run', summary);

  const values = [
    localSessionFp,
    currentUserFp,
    storedFp,
    cloudUser ? cloudFp : localSessionFp
  ];
  const maxFp = Math.max(...values);
  const minFp = Math.min(...values);

  if (maxFp !== minFp) {
    showNotification(`FP mismatch detected. Session:${localSessionFp}, Local:${storedFp}, Cloud:${cloudUser ? cloudFp : 'n/a'}.`, {
      type: 'warning',
      duration: 7000
    });
  } else {
    showNotification(`FP diagnostics OK. All sources report ${localSessionFp} FP.`, {
      type: 'success'
    });
  }
}

function updateProfileNotificationControls() {
  const enableBtn = document.getElementById('enableNotificationsBtn');
  if (!enableBtn) {
    updateProfileDebugControls();
    return;
  }

  enableBtn.textContent = getNotificationToggleText();
  enableBtn.disabled = false;
  updateProfileDebugControls();
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
  const localNotifications = getCapacitorLocalNotificationsPlugin();

  if (willEnable) {
    if (!localNotifications && !('Notification' in window)) {
      setAppNotificationEnabled(true);
      updateProfileNotificationControls();
      showNotification('Notifications enabled.', { type: 'success' });
      return;
    }

    if (!localNotifications && Notification.permission === 'denied') {
      setAppNotificationEnabled(false);
      updateProfileNotificationControls();
      showNotification('Notifications are blocked. Enable permission in browser or phone settings first.', { type: 'warning' });
      return;
    }

    const permission = await requestBrowserNotificationPermission();
    if (permission !== 'granted') {
      setAppNotificationEnabled(false);
      updateProfileNotificationControls();
      showNotification('Notifications disabled.', { type: 'info' });
      return;
    }

    setAppNotificationEnabled(true);
    updateProfileNotificationControls();
    showNotification('Notifications enabled.', { type: 'success', browser: true });
    return;
  }

  setAppNotificationEnabled(false);
  updateProfileNotificationControls();
  showNotification('Notifications disabled.', { type: 'info' });
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
  openLeaderboardModal('ranking');
}

function parseDateKeyToDate(dateKey) {
  const normalized = String(dateKey || '').trim();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, monthIndex, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getUserCurrentLoginStreak(user) {
  const parsed = Math.floor(Number(user?.loginStreakCurrent ?? 0));
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  const legacyStreak = getLegacyDailyLoginStreak(user?.dailyLoginState);
  return legacyStreak;
}

function getUserLongestLoginStreak(user) {
  const parsed = Math.floor(Number(user?.loginStreakLongest ?? 0));
  const parsedCurrent = Math.floor(Number(user?.loginStreakCurrent ?? 0));
  const legacyStreak = getLegacyDailyLoginStreak(user?.dailyLoginState);
  return Math.max(
    Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
    Number.isFinite(parsedCurrent) && parsedCurrent > 0 ? parsedCurrent : 0,
    legacyStreak
  );
}

function getLegacyDailyLoginStreak(dailyState) {
  const normalized = normalizeDailyLoginState(dailyState);
  const claimedCount = Array.isArray(normalized.claimedDays) ? normalized.claimedDays.length : 0;
  const impliedFromNextDay = Math.max(0, Math.floor(Number(normalized.streakDay ?? 1) - 1));
  return Math.max(claimedCount, impliedFromNextDay);
}

function updateConsecutiveLoginStats(user, referenceDate = new Date()) {
  if (!user || typeof user !== 'object') {
    return;
  }

  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const todayKey = getDateKeyFromDate(today);
  const lastLoginDate = parseDateKeyToDate(user.lastLoginDateKey);

  let currentStreak = getUserCurrentLoginStreak(user);
  let longestStreak = getUserLongestLoginStreak(user);

  if (!lastLoginDate) {
    currentStreak = 1;
  } else {
    const dayGap = getDaysBetween(lastLoginDate, today);
    if (dayGap === 0) {
      user.loginStreakCurrent = currentStreak;
      user.loginStreakLongest = Math.max(longestStreak, currentStreak);
      user.lastLoginDateKey = todayKey;
      return;
    }

    if (dayGap === 1) {
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, currentStreak);
  user.loginStreakCurrent = currentStreak;
  user.loginStreakLongest = longestStreak;
  user.lastLoginDateKey = todayKey;
}

function isPublicBoardUser(user) {
  const role = getRoleByEmail(user?.email, user?.role);
  return !NON_USER_ROLES_FOR_PUBLIC_BOARDS.has(role);
}

function getPublicBoardUsers() {
  return getStoredUsersSafe().filter(isPublicBoardUser);
}

let currentPublicBoardType = 'leaderboard';

function updatePublicBoardTabs(boardType) {
  const leaderboardTab = document.getElementById('publicBoardLeaderboardTab');
  const rankingTab = document.getElementById('publicBoardRankingTab');
  if (!leaderboardTab || !rankingTab) {
    return;
  }

  const isLeaderboard = boardType !== 'ranking';
  leaderboardTab.classList.toggle('active', isLeaderboard);
  rankingTab.classList.toggle('active', !isLeaderboard);
  leaderboardTab.setAttribute('aria-selected', isLeaderboard ? 'true' : 'false');
  rankingTab.setAttribute('aria-selected', !isLeaderboard ? 'true' : 'false');
}

function switchPublicBoardType(boardType = 'leaderboard') {
  currentPublicBoardType = boardType === 'ranking' ? 'ranking' : 'leaderboard';
  renderPublicBoardList(currentPublicBoardType);
}

function renderPublicBoardList(boardType = 'leaderboard') {
  const boardBody = document.getElementById('publicBoardBody');
  const boardTitle = document.getElementById('publicBoardTitle');
  const boardSubtitle = document.getElementById('publicBoardSubtitle');
  if (!boardBody || !boardTitle || !boardSubtitle) {
    return;
  }

  const users = getPublicBoardUsers();
  const isRanking = boardType === 'ranking';

  updatePublicBoardTabs(boardType);

  boardTitle.textContent = isRanking ? 'Ranking' : 'Leaderboard';
  boardSubtitle.textContent = isRanking
    ? 'Sorted by total tree progress points'
    : 'Sorted by longest consecutive login streak';

  const sortedUsers = [...users].sort((leftUser, rightUser) => {
    if (isRanking) {
      const leftValue = Math.floor(Number(leftUser?.treeProgress ?? 0) || 0);
      const rightValue = Math.floor(Number(rightUser?.treeProgress ?? 0) || 0);
      if (rightValue !== leftValue) {
        return rightValue - leftValue;
      }
      return String(leftUser?.name || '').localeCompare(String(rightUser?.name || ''));
    }

    const leftValue = getUserLongestLoginStreak(leftUser);
    const rightValue = getUserLongestLoginStreak(rightUser);
    if (rightValue !== leftValue) {
      return rightValue - leftValue;
    }
    return String(leftUser?.name || '').localeCompare(String(rightUser?.name || ''));
  });

  if (sortedUsers.length === 0) {
    boardBody.innerHTML = '<li class="public-board-empty">No users available for this board yet.</li>';
    return;
  }

  boardBody.innerHTML = sortedUsers
    .slice(0, 20)
    .map((user, index) => {
      const score = isRanking
        ? Math.floor(Number(user?.treeProgress ?? 0) || 0)
        : getUserLongestLoginStreak(user);
      const scoreLabel = isRanking ? `${score} FP` : `${score} day${score === 1 ? '' : 's'}`;
      const name = escapeHtml(String(user?.name || user?.email || 'Unknown'));
      const rankClass = index < 3 ? `top-${index + 1}` : '';
      const rankBadge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
      return `
        <li class="public-board-item ${rankClass}">
          <span class="public-board-rank">${rankBadge}</span>
          <span class="public-board-name">${name}</span>
          <span class="public-board-score">${scoreLabel}</span>
        </li>
      `;
    })
    .join('');
}

function openLeaderboardModal(boardType = 'leaderboard') {
  const modal = document.getElementById('leaderboardModal');
  if (!modal) {
    return;
  }

  currentPublicBoardType = boardType === 'ranking' ? 'ranking' : 'leaderboard';
  renderPublicBoardList(currentPublicBoardType);
  modal.style.display = 'flex';
}

function closeLeaderboardModal() {
  const modal = document.getElementById('leaderboardModal');
  if (!modal) {
    return;
  }

  modal.style.display = 'none';
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

  const nodeMarkup = DAILY_LOGIN_REWARDS.map((points, index) => {
    const dayNumber = index + 1;
    const dayClass = getDailyLoginDayClass(dayNumber);
    const isClaimed = dayClass === 'claimed';
    const disabled = canClaimDailyLoginDay(dayNumber) ? '' : 'disabled';
    const iconMarkup = getDailyLoginStageSvgMarkup(dayNumber);
    const checkMarkMarkup = isClaimed ? '<span class="daily-login-check" aria-hidden="true">✓</span>' : '';
    return `
      <div class="daily-login-node ${dayClass}">
        <button class="daily-login-tile" data-day="${dayNumber}" ${disabled} aria-label="Day ${dayNumber}${isClaimed ? ' claimed' : ''}">
          <span class="daily-login-tile-icon">${iconMarkup}</span>
          ${checkMarkMarkup}
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
  const previousFp = Math.floor(Number(faithPoints ?? 0) || 0);
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
  debugFpLog('daily-login-claimed', {
    dayNumber,
    reward,
    finalDay: isFinalDay,
    fpBefore: previousFp,
    fpAfter: Math.floor(Number(faithPoints ?? 0) || 0)
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

function getCorrectedEmail(email) {
  const normalized = normalizeEmail(email);
  return EMAIL_CORRECTIONS[normalized] || normalized;
}

function isAdminEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  return ADMIN_EMAILS.some(adminEmail => normalizeEmail(adminEmail) === normalizedEmail);
}

function normalizeRole(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return ALLOWED_ROLES.includes(normalizedRole) ? normalizedRole : 'user';
}

function getRoleByEmail(email, preferredRole = 'user') {
  if (isAdminEmail(email)) {
    return 'admin';
  }

  return normalizeRole(preferredRole);
}

function getCurrentUserRole() {
  if (!currentUser) {
    return 'user';
  }

  return getRoleByEmail(currentUser.email, currentUser.role);
}

function hasManagementAccess() {
  const role = getCurrentUserRole();
  return role === 'admin' || role === 'moderator';
}

function canManageAction(actionKey) {
  const role = getCurrentUserRole();
  if (role === 'admin') {
    return true;
  }

  if (role === 'moderator') {
    return actionKey !== 'resetProgress' && actionKey !== 'openUi' && actionKey !== 'changeRole' && actionKey !== 'viewProgress';
  }

  return false;
}

function getDefaultViewModeForRole(role) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === 'admin' || normalizedRole === 'moderator' ? 'admin' : 'user';
}

function ensureActionPermission(actionKey, deniedMessage) {
  if (canManageAction(actionKey)) {
    return true;
  }

  showNotification(deniedMessage || 'You do not have permission for this action.', { type: 'error' });
  return false;
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
    'pointsForFruit',
    'loginStreakCurrent',
    'loginStreakLongest'
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
  if (baseDailyLoginState !== incomingDailyLoginState) {
    return true;
  }

  return String(baseUser.lastLoginDateKey || '') !== String(incomingUser.lastLoginDateKey || '');
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

    // Ignore stale snapshots so recent local progress (like FP gains) is not rolled back.
    const localUpdatedAt = Number(currentUser.updatedAt ?? currentUser.lastActiveAt ?? 0);
    const cloudUpdatedAt = Number(cloudUser.updatedAt ?? cloudUser.lastActiveAt ?? 0);
    if (
      Number.isFinite(localUpdatedAt) &&
      localUpdatedAt > 0 &&
      Number.isFinite(cloudUpdatedAt) &&
      cloudUpdatedAt > 0 &&
      cloudUpdatedAt < localUpdatedAt
    ) {
      debugFpLog('cloud-snapshot-ignored-stale', {
        localUpdatedAt,
        cloudUpdatedAt,
        localFaithPoints: Math.floor(Number(currentUser.faithPoints ?? faithPoints ?? 0) || 0),
        cloudFaithPoints: Math.floor(Number(cloudUser.faithPoints ?? 0) || 0)
      });
      return;
    }

    if (!haveCloudUserStateDifferences(currentUser, cloudUser)) {
      return;
    }

    debugFpLog('cloud-snapshot-applied', {
      localUpdatedAt,
      cloudUpdatedAt,
      previousFaithPoints: Math.floor(Number(currentUser.faithPoints ?? faithPoints ?? 0) || 0),
      incomingFaithPoints: Math.floor(Number(cloudUser.faithPoints ?? 0) || 0)
    });

    const users = getStoredUsersSafe();
    const userIndex = users.findIndex(user => normalizeEmail(user.email) === normalizedEmail);
    if (userIndex !== -1) {
      users[userIndex] = {
        ...users[userIndex],
        ...cloudUser,
        role: getRoleByEmail(cloudUser.email, cloudUser.role)
      };
      localStorage.setItem('users', JSON.stringify(users));
    }

    currentUser = {
      ...currentUser,
      ...cloudUser,
      role: getRoleByEmail(cloudUser.email, cloudUser.role),
      viewMode: currentUser.viewMode ?? cloudUser.viewMode ?? 'user'
    };
    delete currentUser.password;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
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
  const parsedRoleUpdatedAt = Number(user?.roleUpdatedAt ?? 0);
  const parsedLoginStreakCurrent = Number(user?.loginStreakCurrent ?? 0);
  const parsedLoginStreakLongest = Number(user?.loginStreakLongest ?? 0);

  return {
    ...user,
    id: safeUserId,
    email: getCorrectedEmail(user?.email),
    role: getRoleByEmail(user?.email, user?.role),
    roleUpdatedAt: Number.isFinite(parsedRoleUpdatedAt) && parsedRoleUpdatedAt > 0 ? parsedRoleUpdatedAt : 0,
    loginStreakCurrent: Number.isFinite(parsedLoginStreakCurrent) && parsedLoginStreakCurrent > 0
      ? Math.floor(parsedLoginStreakCurrent)
      : 0,
    loginStreakLongest: Number.isFinite(parsedLoginStreakLongest) && parsedLoginStreakLongest > 0
      ? Math.floor(parsedLoginStreakLongest)
      : 0,
    lastLoginDateKey: typeof user?.lastLoginDateKey === 'string' ? user.lastLoginDateKey : '',
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
      const latestUser = Number.isFinite(cloudUpdatedAt) && cloudUpdatedAt > localUpdatedAt
        ? cloudUser
        : localUser;

      // Resolve role independently from activity timestamps so progress saves do not overwrite role changes.
      const localRoleUpdatedAt = Number(localUser.roleUpdatedAt ?? 0);
      const cloudRoleUpdatedAt = Number(cloudUser.roleUpdatedAt ?? 0);
      const roleSource = cloudRoleUpdatedAt > localRoleUpdatedAt ? cloudUser : localUser;

      mergedByEmail.set(cloudUser.email, {
        ...latestUser,
        role: getRoleByEmail(latestUser.email, roleSource.role),
        roleUpdatedAt: Math.max(
          Number.isFinite(localRoleUpdatedAt) ? localRoleUpdatedAt : 0,
          Number.isFinite(cloudRoleUpdatedAt) ? cloudRoleUpdatedAt : 0
        )
      });
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

async function applyEmailCorrections() {
  const corrections = Object.entries(EMAIL_CORRECTIONS);
  if (corrections.length === 0) {
    return;
  }

  const users = getStoredUsersSafe();
  let usersChanged = false;

  corrections.forEach(([fromEmailRaw, toEmailRaw]) => {
    const fromEmail = normalizeEmail(fromEmailRaw);
    const toEmail = normalizeEmail(toEmailRaw);
    if (!fromEmail || !toEmail || fromEmail === toEmail) {
      return;
    }

    const fromIndex = users.findIndex(user => normalizeEmail(user.email) === fromEmail);
    if (fromIndex === -1) {
      return;
    }

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

  if (usersChanged) {
    setStoredUsers(users);
  }

  if (currentUser?.email) {
    const correctedCurrentEmail = getCorrectedEmail(currentUser.email);
    if (correctedCurrentEmail !== normalizeEmail(currentUser.email)) {
      currentUser.email = correctedCurrentEmail;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
  }

  const usersCollection = getCloudUsersCollection();
  if (!usersCollection) {
    return;
  }

  for (const [fromEmailRaw, toEmailRaw] of corrections) {
    const fromEmail = normalizeEmail(fromEmailRaw);
    const toEmail = normalizeEmail(toEmailRaw);
    if (!fromEmail || !toEmail || fromEmail === toEmail) {
      continue;
    }

    try {
      const fromDocRef = usersCollection.doc(fromEmail);
      const fromSnapshot = await fromDocRef.get();
      if (!fromSnapshot.exists) {
        continue;
      }

      const correctedCloudUser = {
        ...normalizeStoredUser(fromSnapshot.data(), Date.now()),
        email: toEmail,
        updatedAt: Date.now()
      };

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
      const expectedRole = getRoleByEmail(parsedCurrentUser.email, parsedCurrentUser.role);
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
  await applyEmailCorrections();
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
    const users = getStoredUsersSafe();
    const currentIndex = findUserIndexForSession(users, currentUser);
    if (currentIndex !== -1) {
      updateConsecutiveLoginStats(users[currentIndex]);
      users[currentIndex].lastActiveAt = Date.now();
      users[currentIndex].updatedAt = Date.now();
      setStoredUsers(users);
      currentUser = {
        ...currentUser,
        ...users[currentIndex]
      };
      delete currentUser.password;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
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
  return getCurrentUserRole() === 'admin';
}

function getCurrentViewMode() {
  if (!currentUser) {
    return 'user';
  }

  if (!hasManagementAccess()) {
    return 'user';
  }

  return currentUser.viewMode === 'admin' ? 'admin' : 'user';
}

function applyViewModeUI() {
  const hasManagement = hasManagementAccess();
  const mode = getCurrentViewMode();
  const isAdminView = hasManagement && mode === 'admin';
  const currentRole = getCurrentUserRole();

  if (hasManagement && currentUser && currentUser.role !== currentRole) {
    currentUser.role = currentRole;
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
    if (hasManagement) {
      toggleBtn.style.display = 'block';
      toggleBtn.textContent = isAdminView ? 'Switch to User View' : 'Switch to Management View';
    } else {
      toggleBtn.style.display = 'none';
    }
  }

  const modeIndicator = document.getElementById('viewModeIndicator');
  if (modeIndicator) {
    modeIndicator.style.display = hasManagement ? 'inline-block' : 'none';
    modeIndicator.textContent = isAdminView ? 'MANAGEMENT VIEW' : 'USER VIEW';
  }

  removeLegacyAdminFaithPointsCard();
  syncProfilePillVisibilityForViewport();

  if (isAdminView) {
    renderAdminDashboard();
  }
}

function switchToUserHome() {
  if (!currentUser) {
    return;
  }

  currentUser.viewMode = 'user';
  applyViewModeUI();
  saveUserData();
}

function scrollAdminSection(sectionId) {
  const target = document.getElementById(sectionId);
  if (!target) {
    return;
  }

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  const roleFromEmail = getRoleByEmail(currentUser?.email, currentUser?.role);
  if (roleFromEmail !== currentUser?.role) {
    currentUser.role = roleFromEmail;
  }

  if (!hasManagementAccess()) {
    showNotification('Only admin or moderator users can switch to management view.', { type: 'error' });
    return;
  }

  currentUser.viewMode = getCurrentViewMode() === 'admin' ? 'user' : 'admin';
  applyViewModeUI();
  saveUserData();
}

async function renderAdminDashboard(syncFromCloud = true) {
  if (!hasManagementAccess() || getCurrentViewMode() !== 'admin') {
    return;
  }

  if (syncFromCloud) {
    await syncUsersFromCloudToLocal();
  }

  removeLegacyAdminFaithPointsCard();

  const safeUsers = getStoredUsersSafe();
  const roleOfCurrentUser = getCurrentUserRole();
  const usersVisibleToCurrentUser = roleOfCurrentUser === 'moderator'
    ? safeUsers.filter(user => getRoleByEmail(user.email, user.role) !== 'admin')
    : safeUsers;

  const totalUsers = safeUsers.length;
  const totalAdmins = safeUsers.filter(user => getRoleByEmail(user.email, user.role) === 'admin').length;
  const totalModerators = safeUsers.filter(user => getRoleByEmail(user.email, user.role) === 'moderator').length;

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const activeUsers = safeUsers.filter(user => {
    const lastActive = getLastActiveTimestamp(user);
    return lastActive > 0 && (now - lastActive) <= oneDayMs;
  }).length;
  const inactiveUsers = Math.max(totalUsers - activeUsers, 0);

  const taskKeys = Object.keys(taskRecurrenceRules);
  const completedTaskCount = safeUsers.reduce((sum, user) => {
    const userTaskCompletions = user.taskCompletions && typeof user.taskCompletions === 'object' ? user.taskCompletions : {};
    return sum + taskKeys.filter(taskKey => {
      const rule = taskRecurrenceRules[taskKey];
      if (!rule) {
        return false;
      }

      return userTaskCompletions[taskKey] === getCurrentPeriodKey(rule.unit);
    }).length;
  }, 0);
  const totalTaskSlots = Math.max(totalUsers * taskKeys.length, 1);
  const taskCompletionRate = Math.round((completedTaskCount / totalTaskSlots) * 100);

  const trendDays = 7;
  const trendCounts = [];
  for (let dayOffset = trendDays - 1; dayOffset >= 0; dayOffset--) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - dayOffset);
    const dayEnd = new Date(dayStart.getTime() + oneDayMs);

    const count = safeUsers.filter(user => {
      const candidate = Number(new Date(user.lastLogin || '').getTime()) || Number(user.lastActiveAt || 0);
      return candidate >= dayStart.getTime() && candidate < dayEnd.getTime();
    }).length;

    trendCounts.push({
      label: dayStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: count
    });
  }

  const totalUsersEl = document.getElementById('adminTotalUsers');
  const totalAdminsEl = document.getElementById('adminTotalAdmins');
  const totalModeratorsEl = document.getElementById('adminTotalModerators');
  const activeUsersEl = document.getElementById('adminActiveUsers');
  const inactiveUsersEl = document.getElementById('adminInactiveUsers');
  const taskCompletionRateEl = document.getElementById('adminTaskCompletionRate');
  const taskRefreshEl = document.getElementById('adminTaskRefreshTime');
  const dailyTrendEl = document.getElementById('adminDailyLoginTrend');
  const taskSummaryEl = document.getElementById('adminTaskStatusSummary');

  if (totalUsersEl) totalUsersEl.textContent = String(totalUsers);
  if (totalAdminsEl) totalAdminsEl.textContent = String(totalAdmins);
  if (totalModeratorsEl) totalModeratorsEl.textContent = String(totalModerators);
  if (activeUsersEl) activeUsersEl.textContent = String(activeUsers);
  if (inactiveUsersEl) inactiveUsersEl.textContent = String(inactiveUsers);
  if (taskCompletionRateEl) taskCompletionRateEl.textContent = `${taskCompletionRate}%`;
  if (taskRefreshEl) taskRefreshEl.textContent = `Task refresh: ${getTaskRefreshTimeLabel()}`;

  if (dailyTrendEl) {
    const maxTrendValue = Math.max(...trendCounts.map(entry => entry.value), 1);
    dailyTrendEl.innerHTML = trendCounts
      .map(entry => {
        const widthPct = Math.max(6, Math.round((entry.value / maxTrendValue) * 100));
        return `
          <div class="admin-bar-row">
            <span class="admin-bar-label">${escapeHtml(entry.label)}</span>
            <div class="admin-bar-track">
              <div class="admin-bar-fill" style="width: ${widthPct}%;"></div>
            </div>
            <strong class="admin-bar-value">${entry.value}</strong>
          </div>
        `;
      })
      .join('');
  }

  if (taskSummaryEl) {
    const taskRows = taskKeys.map(taskKey => {
      const doneCount = safeUsers.filter(user => {
        const completions = user.taskCompletions && typeof user.taskCompletions === 'object' ? user.taskCompletions : {};
        const rule = taskRecurrenceRules[taskKey];
        return completions[taskKey] === getCurrentPeriodKey(rule.unit);
      }).length;

      return {
        taskName: taskDisplayNames[taskKey] || taskKey,
        doneCount,
        rate: totalUsers > 0 ? Math.round((doneCount / totalUsers) * 100) : 0
      };
    });

    taskSummaryEl.innerHTML = taskRows
      .map(row => {
        const widthPct = Math.max(6, row.rate);
        return `
          <div class="admin-bar-row">
            <span class="admin-bar-label">${escapeHtml(row.taskName)}</span>
            <div class="admin-bar-track">
              <div class="admin-bar-fill task" style="width: ${widthPct}%;"></div>
            </div>
            <strong class="admin-bar-value">${row.doneCount}/${totalUsers} (${row.rate}%)</strong>
          </div>
        `;
      })
      .join('');
  }

  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) {
    return;
  }

  if (usersVisibleToCurrentUser.length === 0) {
    tbody.innerHTML = '<tr><td colspan="14">No users found.</td></tr>';
    return;
  }

  const sortSelect = document.getElementById('adminSortSelect');
  const sortValue = sortSelect ? sortSelect.value : 'lastActiveDesc';
  const sortedUsers = [...usersVisibleToCurrentUser].sort((leftUser, rightUser) => {
    const leftName = String(leftUser.name || '').toLowerCase();
    const rightName = String(rightUser.name || '').toLowerCase();
    const leftRole = getRoleByEmail(leftUser.email, leftUser.role);
    const rightRole = getRoleByEmail(rightUser.email, rightUser.role);
    const leftFp = Math.floor(Number(leftUser.faithPoints ?? 0) || 0);
    const rightFp = Math.floor(Number(rightUser.faithPoints ?? 0) || 0);
    const leftStreak = Math.max(0, Number((leftUser.dailyLoginState && leftUser.dailyLoginState.claimedDays && leftUser.dailyLoginState.claimedDays.length) || 0));
    const rightStreak = Math.max(0, Number((rightUser.dailyLoginState && rightUser.dailyLoginState.claimedDays && rightUser.dailyLoginState.claimedDays.length) || 0));
    const leftLastActive = getLastActiveTimestamp(leftUser);
    const rightLastActive = getLastActiveTimestamp(rightUser);

    if (sortValue === 'nameAsc') return leftName.localeCompare(rightName);
    if (sortValue === 'nameDesc') return rightName.localeCompare(leftName);
    if (sortValue === 'faithPointsAsc') return leftFp - rightFp;
    if (sortValue === 'faithPointsDesc') return rightFp - leftFp;
    if (sortValue === 'streakAsc') return leftStreak - rightStreak;
    if (sortValue === 'streakDesc') return rightStreak - leftStreak;
    if (sortValue === 'lastActiveAsc') return leftLastActive - rightLastActive;
    if (sortValue === 'roleAsc') return leftRole.localeCompare(rightRole);

    return rightLastActive - leftLastActive;
  });

  tbody.innerHTML = sortedUsers
    .map(user => {
      const role = getRoleByEmail(user.email, user.role);
      const normalizedEmail = normalizeEmail(user.email || '');
      const name = escapeHtml(user.name || 'N/A');
      const lastLogin = escapeHtml(user.lastLogin || 'Never');
      const lastActive = escapeHtml(formatDateTimeForDisplay(user.lastActiveAt ?? user.updatedAt));
      const email = escapeHtml(user.email || 'N/A');
      const faithPoints = Math.floor(Number(user.faithPoints ?? 0) || 0);
      const treeProgress = Math.floor(Number(user.treeProgress ?? 0) || 0);
      const streak = Math.max(0, Number((user.dailyLoginState && user.dailyLoginState.claimedDays && user.dailyLoginState.claimedDays.length) || 0));
      const completions = user.taskCompletions && typeof user.taskCompletions === 'object' ? user.taskCompletions : {};
      const userId = Number.isFinite(Number(user.id)) ? Number(user.id) : Date.now();
      const canEditTaskAndStreak = roleOfCurrentUser === 'admin';
      const streakControl = canEditTaskAndStreak
        ? `<input type="number" min="0" max="${DAILY_LOGIN_REWARDS.length}" value="${streak}" onchange="window.adminSetStreakDays(${userId}, this.value)" aria-label="Streak days for ${name}">`
        : `${streak} day${streak === 1 ? '' : 's'}`;
      const taskCheckbox = taskKey => {
        const rule = taskRecurrenceRules[taskKey];
        const checked = rule && completions[taskKey] === getCurrentPeriodKey(rule.unit);
        if (!canEditTaskAndStreak) {
          return `<input type="checkbox" disabled ${checked ? 'checked' : ''} aria-label="${taskDisplayNames[taskKey]} completion">`;
        }

        return `<input type="checkbox" ${checked ? 'checked' : ''} onchange="window.adminSetTaskCompletion(${userId}, '${taskKey}', this.checked)" aria-label="${taskDisplayNames[taskKey]} completion">`;
      };
      const roleControl = roleOfCurrentUser === 'admin'
        ? `<select class="admin-role-select" onchange="window.adminChangeUserRole(${userId}, this.value)">
            <option value="user" ${role === 'user' ? 'selected' : ''}>user</option>
            <option value="moderator" ${role === 'moderator' ? 'selected' : ''}>moderator</option>
            <option value="admin" ${role === 'admin' ? 'selected' : ''}>admin</option>
          </select>`
        : `<span class="admin-role-badge ${role}">${role}</span>`;
      const disableResetProgress = !canManageAction('resetProgress') ? 'disabled' : '';
      const canViewProgress = canManageAction('viewProgress');
      const disableOpenUi = !canManageAction('openUi') ? 'disabled' : '';
      return `
        <tr>
          <td class="admin-cell-name">${name}</td>
          <td>${streakControl}</td>
          <td>${lastLogin}</td>
          <td>${lastActive}</td>
          <td>${email}</td>
          <td>${roleControl}</td>
          <td>${faithPoints}</td>
          <td>${treeProgress}</td>
          <td>${taskCheckbox('pray')}</td>
          <td>${taskCheckbox('bible')}</td>
          <td>${taskCheckbox('devotion')}</td>
          <td>${taskCheckbox('smallgroup')}</td>
          <td>${taskCheckbox('attendService')}</td>
          <td>
            <div class="admin-actions">
              <button class="admin-action-btn points" onclick="window.adminAddPoints(${userId}, '${normalizedEmail}')">+Points</button>
              <button class="admin-action-btn password" onclick="window.adminResetPassword(${userId})">Reset PW</button>
              <button class="admin-action-btn progress" onclick="window.adminResetProgress(${userId})" ${disableResetProgress}>Reset Progress</button>
              ${canViewProgress ? `<button class="admin-action-btn view" onclick="window.adminViewProgress(${userId})">View</button>` : ''}
              <button class="admin-action-btn open" onclick="window.adminOpenUserUi(${userId})" ${disableOpenUi}>Open UI</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function assertAdminDashboardAccess() {
  if (!hasManagementAccess()) {
    showNotification('Management dashboard access required.', { type: 'error' });
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
    role: getRoleByEmail(users[userIndex].email, users[userIndex].role),
    viewMode: currentUser.viewMode ?? users[userIndex].viewMode ?? 'user'
  };

  delete mergedUser.password;
  currentUser = mergedUser;
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
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
      role: getRoleByEmail(updatedUser.email, updatedUser.role),
      viewMode: currentUser.viewMode ?? updatedUser.viewMode ?? 'user'
    };
    delete currentUser.password;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    loadUserData();
    updateDisplay({ persist });
  }
}

function adminAddPoints(userId, userEmail = '') {
  if (!assertAdminDashboardAccess()) return;
  if (!ensureActionPermission('addPoints', 'You do not have permission to add points.')) return;

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
  if (!ensureActionPermission('resetPassword', 'You do not have permission to reset passwords.')) return;

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
  if (!ensureActionPermission('resetProgress', 'Moderator cannot reset progress.')) return;

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
  if (!ensureActionPermission('viewProgress', 'You do not have permission to view progress.')) return;

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
    `Role: ${getRoleByEmail(user.email, user.role)}`,
    `Faith Points: ${Math.floor(Number(user.faithPoints ?? 0) || 0)}`,
    `Tree Progress: ${Math.floor(Number(user.treeProgress ?? 0) || 0)}`,
    `Fruits: ${Math.floor(Number(user.fruitCount ?? 0) || 0)}`
  ].join('\n');

  showNotification(progressMessage, { type: 'info', title: 'User Progress', duration: 7000 });
}

function adminOpenUserUi(userId) {
  if (!assertAdminDashboardAccess()) return;
  if (!ensureActionPermission('openUi', 'Moderator cannot open user UI.')) return;

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
    role: getRoleByEmail(selectedUser.email, selectedUser.role),
    viewMode: 'user'
  };

  stopCurrentUserCloudSync();
  delete nextSessionUser.password;
  currentUser = nextSessionUser;
  localStorage.setItem('currentUser', JSON.stringify(nextSessionUser));
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

function adminChangeUserRole(userId, nextRole) {
  if (!assertAdminDashboardAccess()) return;
  if (!ensureActionPermission('changeRole', 'Only admin can change user roles.')) return;

  const normalizedNextRole = normalizeRole(nextRole);
  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) {
    showNotification('User not found.', { type: 'error' });
    renderAdminDashboard(false);
    return;
  }

  const targetUser = users[userIndex];
  const lockedToAdmin = isAdminEmail(targetUser.email);
  const finalRole = lockedToAdmin ? 'admin' : normalizedNextRole;
  const currentRole = getRoleByEmail(targetUser.email, targetUser.role);

  if (currentRole === finalRole) {
    renderAdminDashboard(false);
    return;
  }

  const confirmed = confirm(`Change role for ${targetUser.email} from ${currentRole} to ${finalRole}?`);
  if (!confirmed) {
    renderAdminDashboard(false);
    return;
  }

  users[userIndex].role = finalRole;
  users[userIndex].roleUpdatedAt = Date.now();
  users[userIndex].updatedAt = Date.now();
  users[userIndex].lastActiveAt = Date.now();
  setStoredUsers(users);
  upsertUserInCloud(users[userIndex]);
  syncCurrentSessionIfNeeded(users[userIndex]);
  renderAdminDashboard(false);
  showNotification(`Role updated to ${finalRole} for ${targetUser.email}.`, { type: 'success' });
}

window.adminChangeUserRole = adminChangeUserRole;

function adminSetTaskCompletion(userId, taskKey, isCompleted) {
  if (!assertAdminDashboardAccess()) return;
  if (getCurrentUserRole() !== 'admin') {
    showNotification('Only admin can edit task completion.', { type: 'error' });
    renderAdminDashboard(false);
    return;
  }

  const rule = taskRecurrenceRules[taskKey];
  if (!rule) {
    showNotification('Unknown task key.', { type: 'error' });
    renderAdminDashboard(false);
    return;
  }

  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) {
    showNotification('User not found.', { type: 'error' });
    renderAdminDashboard(false);
    return;
  }

  const currentCompletions = users[userIndex].taskCompletions && typeof users[userIndex].taskCompletions === 'object'
    ? { ...users[userIndex].taskCompletions }
    : {};

  if (isCompleted) {
    currentCompletions[taskKey] = getCurrentPeriodKey(rule.unit);
  } else {
    delete currentCompletions[taskKey];
  }

  users[userIndex].taskCompletions = currentCompletions;
  users[userIndex].updatedAt = Date.now();
  users[userIndex].lastActiveAt = Date.now();
  setStoredUsers(users);
  upsertUserInCloud(users[userIndex]);
  syncCurrentSessionIfNeeded(users[userIndex]);
  renderAdminDashboard(false);
}

function adminSetStreakDays(userId, streakInput) {
  if (!assertAdminDashboardAccess()) return;
  if (getCurrentUserRole() !== 'admin') {
    showNotification('Only admin can edit streak days.', { type: 'error' });
    renderAdminDashboard(false);
    return;
  }

  const parsedStreak = Math.floor(Number(streakInput));
  if (!Number.isFinite(parsedStreak) || parsedStreak < 0 || parsedStreak > DAILY_LOGIN_REWARDS.length) {
    showNotification(`Streak days must be between 0 and ${DAILY_LOGIN_REWARDS.length}.`, { type: 'error' });
    renderAdminDashboard(false);
    return;
  }

  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) {
    showNotification('User not found.', { type: 'error' });
    renderAdminDashboard(false);
    return;
  }

  if (parsedStreak === 0) {
    users[userIndex].dailyLoginState = normalizeDailyLoginState({});
  } else {
    const claimedDays = Array.from({ length: parsedStreak }, (_, dayIndex) => dayIndex + 1);
    users[userIndex].dailyLoginState = normalizeDailyLoginState({
      streakDay: parsedStreak >= DAILY_LOGIN_REWARDS.length ? 1 : parsedStreak + 1,
      lastClaimDate: '',
      cycleStartDate: getTodayDateKey(),
      claimedDays
    });
  }

  users[userIndex].updatedAt = Date.now();
  users[userIndex].lastActiveAt = Date.now();
  setStoredUsers(users);
  upsertUserInCloud(users[userIndex]);
  syncCurrentSessionIfNeeded(users[userIndex]);
  renderAdminDashboard(false);
}

window.adminSetTaskCompletion = adminSetTaskCompletion;
window.adminSetStreakDays = adminSetStreakDays;

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
    role: getRoleByEmail(email, 'user'),
    viewMode: 'user',
    password,
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
  stopCurrentUserCloudSync();
  
  currentUser = { ...newUser };
  delete currentUser.password;
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  
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
    // Ensure modal overlays do not persist when returning to auth screens.
    document.querySelectorAll('.modal').forEach(modalEl => {
      modalEl.style.display = 'none';
    });
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

  showScripture();
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
    const streakDay = getUserCurrentLoginStreak(currentUser);
    streakPillValueEl.textContent = `Day ${Math.max(streakDay, 1)}`;
  }

  if (dailyRewardStreakEl) {
    const completedCount = Array.isArray(dailyLoginState.claimedDays)
      ? dailyLoginState.claimedDays.length
      : 0;
    const todayClaimed = hasClaimedDailyLoginToday();
    const nextDay = Math.min(dailyLoginState.streakDay, DAILY_LOGIN_REWARDS.length);
    dailyRewardStreakEl.textContent = todayClaimed
      ? `Checked in today. Next reward: Day ${nextDay}`
      : `Day ${nextDay} reward ready`;
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
  if (currentUser) {
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
      users[userIndex].updatedAt = Date.now();
      
      setStoredUsers(users);
      upsertUserInCloud(users[userIndex]);
      
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
      currentUser.id = users[userIndex].id;
      currentUser.lastActiveAt = users[userIndex].lastActiveAt;
      currentUser.updatedAt = users[userIndex].updatedAt;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      debugFpLog('save-user-data', {
        savedFaithPoints: users[userIndex].faithPoints,
        savedUpdatedAt: users[userIndex].updatedAt,
        savedTreeProgress: users[userIndex].treeProgress
      });
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
  const previousFp = Math.floor(Number(faithPoints ?? 0) || 0);
  faithPoints += pointsToAdd;

  markTaskCompleted(currentAction, recurrenceCheck.periodKey);
  showScripture();
  updateDisplay();
  closeUploadModal();
  showNotification(`Great job! ${pointsToAdd} FP added for ${reward.name}.`, {
    type: 'success',
    browser: true
  });
  debugFpLog('task-photo-submitted', {
    action: currentAction,
    pointsToAdd,
    fpBefore: previousFp,
    fpAfter: Math.floor(Number(faithPoints ?? 0) || 0)
  });
}

function shareGospel() {
  const pointsToAdd = actionRewards.sharegospel.fp;
  const previousFp = Math.floor(Number(faithPoints ?? 0) || 0);
  applyTreeProgress(pointsToAdd);
  updateDisplay();
  debugFpLog('share-gospel', {
    pointsToAdd,
    fpBefore: previousFp,
    fpAfter: Math.floor(Number(faithPoints ?? 0) || 0)
  });
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
    const successMessage = maxBloomReached
      ? `Blessed! You distributed ${pointsUsed} Faith Points for the fruit of your tree! 🍎`
      : `Blessed! You distributed ${pointsUsed} Faith Points for your growth! 🙏`;
    showNotification(successMessage, { type: 'success' });
    
    updateDisplay();
    closeUpgradeModal();
    debugFpLog('use-all-points', {
      pointsUsed,
      fpAfter: Math.floor(Number(faithPoints ?? 0) || 0),
      treeProgressAfter: Math.floor(Number(treeProgress ?? 0) || 0)
    });
  } else {
    showNotification('Points must be divisible by 10 to use!', { type: 'warning' });
  }
}

function upgrade() {
  if (faithPoints >= upgradeCost) {
    const pointsToAdd = upgradeCost;
    const previousFp = Math.floor(Number(faithPoints ?? 0) || 0);
    faithPoints -= upgradeCost;
    passiveRate += 1;
    applyTreeProgress(pointsToAdd, { addFaithPoints: false });
    
    // upgradeCost stays at 10 - do not increment
    updateDisplay();
    debugFpLog('upgrade', {
      pointsToAdd,
      upgradeCost,
      fpBefore: previousFp,
      fpAfter: Math.floor(Number(faithPoints ?? 0) || 0),
      passiveRate
    });
    
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
  const leaderboardModal = document.getElementById('leaderboardModal');
  
  if (uploadModal && event.target === uploadModal) {
    closeUploadModal();
  }

  if (dailyLoginModal && event.target === dailyLoginModal) {
    closeDailyLoginModal();
  }

  if (leaderboardModal && event.target === leaderboardModal) {
    closeLeaderboardModal();
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
  initializeApp();
});
