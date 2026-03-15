// Growing Seed — Utility Functions

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Email helpers ---

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

// --- Role helpers ---

function normalizeRole(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return ALLOWED_ROLES.includes(normalizedRole) ? normalizedRole : 'user';
}

function getRoleByEmail(email, preferredRole) {
  if (isAdminEmail(email)) return 'admin';
  return normalizeRole(preferredRole);
}

function getCurrentUserRole() {
  if (!currentUser) return 'user';
  return getRoleByEmail(currentUser.email, currentUser.role);
}

function isAdminUser() {
  return getCurrentUserRole() === 'admin';
}

function hasManagementAccess() {
  const role = getCurrentUserRole();
  return role === 'admin' || role === 'moderator';
}

function canManageAction(actionKey) {
  const role = getCurrentUserRole();
  if (role === 'admin') return true;
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
  if (canManageAction(actionKey)) return true;
  showNotification(deniedMessage || 'You do not have permission for this action.', { type: 'error' });
  return false;
}

// --- Date helpers ---

function parseDateKeyToDate(dateKey) {
  const normalized = String(dateKey || '').trim();
  if (!normalized) return null;
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, monthIndex, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDateKey(value) {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const keyedDate = parseDateKeyToDate(raw);
  if (keyedDate) return getDateKeyFromDate(keyedDate);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return getDateKeyFromDate(parsed);
  return '';
}

function getDateKeyFromDate(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function getTodayDateKey() {
  return getDateKeyFromDate(new Date());
}

function getDaysBetween(startDate, endDate) {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function getSundayWeekKey(date) {
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return getDateKeyFromDate(copy);
}

function getYearWeekKey(date) {
  const tempDate = new Date(date.getTime());
  const day = tempDate.getDay() || 7;
  tempDate.setDate(tempDate.getDate() + 4 - day);
  const yearStart = new Date(tempDate.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
  return `${tempDate.getFullYear()}-W${weekNumber}`;
}

function formatDateTimeForDisplay(value) {
  if (value === null || value === undefined || value === '') return 'Never';
  const timestamp = Number(value);
  if (Number.isFinite(timestamp) && timestamp > 0) return new Date(timestamp).toLocaleString();
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString();
  return 'Never';
}

function getLastActiveTimestamp(user) {
  const candidate = Number(user?.lastActiveAt ?? user?.updatedAt ?? 0);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : 0;
}

// --- Task period helpers ---

function getTaskRefreshOffsetMinutes() {
  const totalMinutes = (Number(TASK_REFRESH_HOUR) * 60) + Number(TASK_REFRESH_MINUTE);
  if (!Number.isFinite(totalMinutes)) return 0;
  const minutesInDay = 24 * 60;
  return ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
}

function getTaskRefreshTimeLabel() {
  const normalizedOffset = getTaskRefreshOffsetMinutes();
  const hours = Math.floor(normalizedOffset / 60);
  const minutes = normalizedOffset % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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
  if (unit === 'week') return getYearWeekKey(adjustedNow);
  return getCurrentTaskDayKey();
}

function isSundayTaskWindowNow() {
  const adjustedNow = getTaskPeriodReferenceNow();
  return adjustedNow.getDay() === 0;
}

// --- Daily login / streak helpers ---

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
    lastClaimDate: normalizeDateKey(input.lastClaimDate),
    cycleStartDate: normalizeDateKey(input.cycleStartDate),
    claimedDays: Array.from(new Set(claimedDays)).sort((a, b) => a - b)
  };
}

function getUserCurrentLoginStreak(user) {
  const parsed = Math.floor(Number(user?.loginStreakCurrent ?? 0));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getUserLongestLoginStreak(user) {
  const parsed = Math.floor(Number(user?.loginStreakLongest ?? 0));
  const parsedCurrent = Math.floor(Number(user?.loginStreakCurrent ?? 0));
  return Math.max(
    Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
    Number.isFinite(parsedCurrent) && parsedCurrent > 0 ? parsedCurrent : 0
  );
}

function getLegacyDailyLoginStreak(dailyState) {
  const normalized = normalizeDailyLoginState(dailyState);
  const claimedCount = Array.isArray(normalized.claimedDays) ? normalized.claimedDays.length : 0;
  const impliedFromNextDay = Math.max(0, Math.floor(Number(normalized.streakDay ?? 1) - 1));
  return Math.max(claimedCount, impliedFromNextDay);
}

function getRollbackMetrics(localUserState, incomingUserState, options) {
  const opts = options || {};
  const localDailyLoginState = opts.localDailyLoginState;
  const incomingDailyLoginState = opts.incomingDailyLoginState;
  const localFaithPoints = Math.floor(Number(localUserState?.faithPoints ?? 0) || 0);
  const incomingFaithPoints = Math.floor(Number(incomingUserState?.faithPoints ?? 0) || 0);
  const localStreakDays = Math.max(
    getUserCurrentLoginStreak(localUserState),
    getLegacyDailyLoginStreak(localDailyLoginState ?? localUserState?.dailyLoginState)
  );
  const incomingStreakDays = Math.max(
    getUserCurrentLoginStreak(incomingUserState),
    getLegacyDailyLoginStreak(incomingDailyLoginState ?? incomingUserState?.dailyLoginState)
  );
  const fpRollbackAmount = Math.max(0, localFaithPoints - incomingFaithPoints);
  const streakRollbackDays = Math.max(0, localStreakDays - incomingStreakDays);
  return {
    localFaithPoints,
    incomingFaithPoints,
    localStreakDays,
    incomingStreakDays,
    fpRollbackAmount,
    streakRollbackDays,
    hasRollback: fpRollbackAmount > 0 || streakRollbackDays > 0
  };
}

function updateConsecutiveLoginStats(user, referenceDate) {
  if (!user || typeof user !== 'object') return;
  const today = referenceDate
    ? new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
    : new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
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
    currentStreak = dayGap === 1 ? currentStreak + 1 : 1;
  }
  longestStreak = Math.max(longestStreak, currentStreak);
  user.loginStreakCurrent = currentStreak;
  user.loginStreakLongest = longestStreak;
  user.lastLoginDateKey = todayKey;
}

// --- User normalization ---

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
      ? Math.floor(parsedLoginStreakCurrent) : 0,
    loginStreakLongest: Number.isFinite(parsedLoginStreakLongest) && parsedLoginStreakLongest > 0
      ? Math.floor(parsedLoginStreakLongest) : 0,
    lastLoginDateKey: typeof user?.lastLoginDateKey === 'string' ? user.lastLoginDateKey : '',
    viewMode: user?.viewMode ?? 'user',
    lastLogin: user?.lastLogin ?? '',
    lastActiveAt: Number.isFinite(parsedLastActiveAt) && parsedLastActiveAt > 0 ? parsedLastActiveAt : '',
    taskCompletions: user?.taskCompletions && typeof user.taskCompletions === 'object' ? user.taskCompletions : {},
    dailyLoginState: normalizeDailyLoginState(user?.dailyLoginState)
  };
}

function sanitizeUserForCloud(user) {
  const normalizedUser = normalizeStoredUser(user, Date.now());
  const sanitized = {
    ...normalizedUser,
    updatedAt: Date.now()
  };
  delete sanitized.password;
  // Actively remove legacy password field from Firestore documents
  if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) {
    sanitized.password = firebase.firestore.FieldValue.delete();
  }
  return sanitized;
}

// --- Public board helpers ---

function isPublicBoardUser(user) {
  if (!user) return false;
  const resolvedRole = String(getRoleByEmail(user?.email, user?.role) || '').trim().toLowerCase();
  const storedRole = String(user?.role || '').trim().toLowerCase();
  const storedViewMode = String(user?.viewMode || '').trim().toLowerCase();
  const privilegedByRole = NON_USER_ROLES_FOR_PUBLIC_BOARDS.has(resolvedRole) || NON_USER_ROLES_FOR_PUBLIC_BOARDS.has(storedRole);
  const privilegedByEmail = isAdminEmail(user?.email);
  const privilegedByViewMode = storedViewMode === 'admin';
  return !privilegedByRole && !privilegedByEmail && !privilegedByViewMode;
}

function getPublicBoardUsers() {
  return getStoredUsersSafe().filter(isPublicBoardUser);
}

// --- Local storage helpers ---

function getStoredUsersSafe() {
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  if (!Array.isArray(users)) return [];
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
  if (!Number.isFinite(numericUserId)) return -1;
  return users.findIndex(user => Number(user.id) === numericUserId);
}

function findUserIndexForSession(users, sessionUser) {
  if (!Array.isArray(users) || !sessionUser) return -1;
  const byIdIndex = findUserIndexById(users, sessionUser.id);
  if (byIdIndex !== -1) return byIdIndex;
  const normalizedSessionEmail = normalizeEmail(sessionUser.email);
  if (!normalizedSessionEmail) return -1;
  return users.findIndex(user => normalizeEmail(user.email) === normalizedSessionEmail);
}
