// Growing Seed — Game Logic, Display, Daily Login, Leaderboard & Tasks

// --- Game state ---
let faithPoints = 0;
let treeProgress = 0;
let passiveRate = 1;
let upgradeCost = 10;
let currentAction = '';
let maxBloomReached = false;
let pointsForFruit = 0;
let fruitCount = 0;
let taskCompletions = {};
let dailyLoginState = { streakDay: 1, lastClaimDate: '', cycleStartDate: '', claimedDays: [] };
let hasAutoPromptedDailyLogin = false;
let currentPublicBoardType = 'leaderboard';
let inactivityTimerId = null;
let inactivityWarningTimerId = null;
let forceLogoutUnsubscribe = null;

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

// --- FP Debug ---

function isFpDebugEnabled() {
  const fromQuery = new URLSearchParams(window.location.search).get('fpDebug');
  if (fromQuery === '1' || fromQuery === 'true') return true;
  return localStorage.getItem(FP_DEBUG_MODE_KEY) === 'enabled';
}

function setFpDebugEnabled(enabled) {
  localStorage.setItem(FP_DEBUG_MODE_KEY, enabled ? 'enabled' : 'disabled');
}

function getFpDebugToggleText() {
  return isFpDebugEnabled() ? 'FP Debug: ON' : 'FP Debug: OFF';
}

function debugFpLog(eventName, details) {
  if (!isFpDebugEnabled()) return;
  const safeEmail = currentUser?.email || 'unknown';
  const payload = {
    event: eventName, email: safeEmail,
    faithPoints: Math.floor(Number(faithPoints ?? 0) || 0),
    treeProgress: Math.floor(Number(treeProgress ?? 0) || 0),
    localUpdatedAt: Number(currentUser?.updatedAt ?? 0) || 0,
    timestamp: new Date().toISOString(),
    ...(details || {})
  };
  console.log('[FP DEBUG]', payload);
}

function updateProfileDebugControls() {
  const debugBtn = document.getElementById('toggleFpDebugBtn');
  if (debugBtn) debugBtn.textContent = getFpDebugToggleText();
}

function toggleFpDebugMode() {
  const nextEnabled = !isFpDebugEnabled();
  setFpDebugEnabled(nextEnabled);
  updateProfileDebugControls();
  showNotification(nextEnabled ? 'FP debug mode enabled.' : 'FP debug mode disabled.', { type: 'info' });
}

async function runFpDiagnostics() {
  if (!currentUser?.email) { showNotification('No active user session to inspect.', { type: 'warning' }); return null; }
  const normalizedEmail = normalizeEmail(currentUser.email);
  const users = getStoredUsersSafe();
  const storedUser = users.find(user => normalizeEmail(user.email) === normalizedEmail) || null;
  let cloudUser = null;
  const usersCollection = getCloudUsersCollection();
  if (usersCollection) {
    try {
      const snapshot = await usersCollection.doc(normalizedEmail).get();
      if (snapshot.exists) cloudUser = normalizeStoredUser(snapshot.data(), currentUser.id);
    } catch (error) {
      debugFpLog('diagnostics-cloud-read-error', { error: String(error?.message || error) });
    }
  }
  const localSessionFp = Math.floor(Number(faithPoints ?? 0) || 0);
  const currentUserFp = Math.floor(Number(currentUser.faithPoints ?? 0) || 0);
  const storedFp = Math.floor(Number(storedUser?.faithPoints ?? 0) || 0);
  const cloudFp = Math.floor(Number(cloudUser?.faithPoints ?? 0) || 0);
  const sessionStreakDays = getUserCurrentLoginStreak(currentUser);
  const currentUserStreakDays = getUserCurrentLoginStreak(currentUser);
  const storedStreakDays = getUserCurrentLoginStreak(storedUser);
  const cloudStreakDays = getUserCurrentLoginStreak(cloudUser);
  const fallbackComparisonUser = cloudUser || storedUser || currentUser;
  const rollback = getRollbackMetrics(
    { faithPoints: localSessionFp, loginStreakCurrent: sessionStreakDays, dailyLoginState },
    fallbackComparisonUser,
    { localDailyLoginState: dailyLoginState, incomingDailyLoginState: fallbackComparisonUser?.dailyLoginState }
  );
  const summary = {
    email: normalizedEmail, sessionFaithPoints: localSessionFp, currentUserFaithPoints: currentUserFp,
    localStorageFaithPoints: storedFp, cloudFaithPoints: cloudUser ? cloudFp : 'n/a',
    sessionStreakDays, currentUserStreakDays, localStorageStreakDays: storedStreakDays,
    cloudStreakDays: cloudUser ? cloudStreakDays : 'n/a',
    fpRollbackAmount: rollback.fpRollbackAmount, streakRollbackDays: rollback.streakRollbackDays,
    rollbackComparedWith: cloudUser ? 'cloud' : 'localStorage/currentUser',
    currentUserUpdatedAt: Number(currentUser.updatedAt ?? currentUser.lastActiveAt ?? 0) || 0,
    localStorageUpdatedAt: Number(storedUser?.updatedAt ?? storedUser?.lastActiveAt ?? 0) || 0,
    cloudUpdatedAt: cloudUser ? (Number(cloudUser.updatedAt ?? cloudUser.lastActiveAt ?? 0) || 0) : 'n/a'
  };
  console.table(summary);
  debugFpLog('diagnostics-run', summary);
  const values = [localSessionFp, currentUserFp, storedFp, cloudUser ? cloudFp : localSessionFp];
  const maxFp = Math.max(...values);
  const minFp = Math.min(...values);
  if (maxFp !== minFp) {
    const rollbackMessage = rollback.hasRollback ? ` Potential rollback: -${rollback.fpRollbackAmount} FP, -${rollback.streakRollbackDays} day(s).` : '';
    showNotification(`FP mismatch detected. Session:${localSessionFp}, Local:${storedFp}, Cloud:${cloudUser ? cloudFp : 'n/a'}.${rollbackMessage}`, { type: 'warning', duration: 7000 });
  } else {
    showNotification(`FP diagnostics OK. All sources report ${localSessionFp} FP.`, { type: 'success' });
  }
  return { summary, rollback };
}

// --- Notification profile controls ---

function updateProfileNotificationControls() {
  const enableBtn = document.getElementById('enableNotificationsBtn');
  if (!enableBtn) { updateProfileDebugControls(); return; }
  enableBtn.textContent = getNotificationToggleText();
  enableBtn.disabled = false;
  updateProfileDebugControls();
}

function ensureProfileNotificationControls() {
  if (document.getElementById('enableNotificationsBtn')) return;
  const profileModal = document.getElementById('profileModal');
  if (!profileModal) return;
  const settingsHeading = Array.from(profileModal.querySelectorAll('h3')).find(heading =>
    String(heading.textContent || '').toLowerCase().includes('settings')
  );
  const settingsSection = settingsHeading ? settingsHeading.closest('.profile-section') : null;
  if (!settingsSection) return;
  const enableBtn = document.createElement('button');
  enableBtn.id = 'enableNotificationsBtn';
  enableBtn.className = 'settings-btn';
  enableBtn.type = 'button';
  enableBtn.textContent = getNotificationToggleText();
  enableBtn.addEventListener('click', enableBrowserNotificationsFromProfile);
  const switchAdminBtn = settingsSection.querySelector('#switchAdminViewBtn');
  if (switchAdminBtn && switchAdminBtn.parentNode === settingsSection) {
    switchAdminBtn.insertAdjacentElement('afterend', enableBtn);
  } else {
    settingsSection.appendChild(enableBtn);
  }
  const statusEl = document.getElementById('notificationPermissionStatus');
  if (statusEl) statusEl.remove();
}

async function enableBrowserNotificationsFromProfile() {
  const willEnable = !isAppNotificationEnabled();
  const localNotifications = getCapacitorLocalNotificationsPlugin();
  if (willEnable) {
    if (!localNotifications && !('Notification' in window)) {
      setAppNotificationEnabled(true); updateProfileNotificationControls();
      showNotification('Notifications enabled.', { type: 'success' }); return;
    }
    if (!localNotifications && Notification.permission === 'denied') {
      setAppNotificationEnabled(false); updateProfileNotificationControls();
      showNotification('Notifications are blocked. Enable permission in browser or phone settings first.', { type: 'warning' }); return;
    }
    const permission = await requestBrowserNotificationPermission();
    if (permission !== 'granted') {
      setAppNotificationEnabled(false); updateProfileNotificationControls();
      showNotification('Notifications disabled.', { type: 'info' }); return;
    }
    setAppNotificationEnabled(true); updateProfileNotificationControls();
    showNotification('Notifications enabled.', { type: 'success', browser: true }); return;
  }
  setAppNotificationEnabled(false); updateProfileNotificationControls();
  showNotification('Notifications disabled.', { type: 'info' });
}

// --- Navigation helpers ---

function goToFaithActivities() {
  const faithActivitiesSection = document.getElementById('faithActivitiesSection');
  if (!faithActivitiesSection) return;
  faithActivitiesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => { faithActivitiesSection.scrollIntoView({ behavior: 'auto', block: 'start' }); }, 180);
}

function showRankingComingSoon() { openLeaderboardModal('ranking'); }

function goHomeTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

function focusSeedGrowthView() {
  const seedGrowthCard = document.querySelector('.seed-growth-card');
  if (seedGrowthCard) seedGrowthCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function handleUpgradeRootsClick() {
  focusSeedGrowthView();
  window.setTimeout(() => { openUpgradeModal(); }, 220);
}

function syncProfilePillVisibilityForViewport() {
  const profilePill = document.getElementById('profileAccessPill');
  if (!profilePill) return;
  profilePill.style.display = window.matchMedia('(max-width: 768px)').matches ? 'none' : '';
}

// --- Daily login ---

function refreshDailyLoginState() {
  dailyLoginState = normalizeDailyLoginState(dailyLoginState);
  if (!dailyLoginState.lastClaimDate) return;
  const today = new Date();
  const lastClaimDate = parseDateKeyToDate(dailyLoginState.lastClaimDate);
  if (!lastClaimDate) { dailyLoginState = normalizeDailyLoginState({}); return; }
  const daysDiff = getDaysBetween(lastClaimDate, today);
  if (daysDiff <= 1) return;
  dailyLoginState = { streakDay: 1, lastClaimDate: '', cycleStartDate: '', claimedDays: [] };
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
  if (isClaimedInCycle && !(isActiveDay && !todayClaimed)) return 'claimed';
  if (isActiveDay && !todayClaimed) return 'available';
  return 'locked';
}

function canClaimDailyLoginDay(dayNumber) {
  return dayNumber === dailyLoginState.streakDay && !hasClaimedDailyLoginToday();
}

function renderDailyLoginCalendar() {
  const calendarEl = document.getElementById('dailyLoginCalendar');
  if (!calendarEl) return;
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
      </div>`;
  }).join('');
  calendarEl.innerHTML = `<div class="daily-login-track">${nodeMarkup}</div>`;
  Array.from(calendarEl.querySelectorAll('.daily-login-tile')).forEach(dayBtn => {
    dayBtn.addEventListener('click', () => { claimDailyLogin(Number(dayBtn.getAttribute('data-day'))); });
  });
}

function updateDailyLoginReminderToggle() {
  const toggleBtn = document.getElementById('dailyLoginReminderToggle');
  if (!toggleBtn) return;
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
  if (!canClaimDailyLoginDay(dayNumber)) return;
  const reward = DAILY_LOGIN_REWARDS[dayNumber - 1] || 0;
  const previousFp = Math.floor(Number(faithPoints ?? 0) || 0);
  faithPoints += reward;
  const isFinalDay = dayNumber >= DAILY_LOGIN_REWARDS.length;
  if (isFinalDay) faithPoints += DAILY_LOGIN_COMPLETION_BONUS;
  const todayKey = getTodayDateKey();
  if (!dailyLoginState.cycleStartDate) dailyLoginState.cycleStartDate = todayKey;
  dailyLoginState.lastClaimDate = todayKey;
  if (!dailyLoginState.claimedDays.includes(dayNumber)) {
    dailyLoginState.claimedDays.push(dayNumber);
    dailyLoginState.claimedDays.sort((a, b) => a - b);
  }
  if (isFinalDay) {
    dailyLoginState.streakDay = 1; dailyLoginState.claimedDays = []; dailyLoginState.cycleStartDate = '';
  } else {
    dailyLoginState.streakDay = dayNumber + 1;
  }
  updateDisplay();
  renderDailyLoginCalendar();
  const rewardMessage = isFinalDay
    ? `Daily login claimed: Day ${dayNumber} (+${reward} FP) + completion bonus (+${DAILY_LOGIN_COMPLETION_BONUS} FP).`
    : `Daily login claimed: Day ${dayNumber} (+${reward} FP).`;
  showNotification(rewardMessage, { type: 'success', browser: true });
  debugFpLog('daily-login-claimed', { dayNumber, reward, finalDay: isFinalDay, fpBefore: previousFp, fpAfter: Math.floor(Number(faithPoints ?? 0) || 0) });
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
    if (upgradeBtn) upgradeBtn.insertAdjacentElement('beforebegin', dailyLoginBtn);
    else userMainContainer.appendChild(dailyLoginBtn);
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
      </div>`;
    document.body.insertAdjacentHTML('beforeend', modalMarkup);
  }
}

function openDailyLoginModal() {
  ensureDailyLoginUi();
  const modal = document.getElementById('dailyLoginModal');
  if (!modal) return;
  updateDailyLoginReminderToggle();
  renderDailyLoginCalendar();
  modal.style.display = 'flex';
}

function closeDailyLoginModal() {
  const modal = document.getElementById('dailyLoginModal');
  if (modal) modal.style.display = 'none';
}

function autoPromptDailyLoginIfPending() {
  if (!currentUser || hasAutoPromptedDailyLogin) return;
  refreshDailyLoginState();
  if (hasClaimedDailyLoginToday()) { hasAutoPromptedDailyLogin = true; return; }
  hasAutoPromptedDailyLogin = true;
  window.setTimeout(() => { if (!currentUser) return; openDailyLoginModal(); }, 180);
}

// --- Leaderboard / Ranking ---

function updatePublicBoardTabs(boardType) {
  const leaderboardTab = document.getElementById('publicBoardLeaderboardTab');
  const rankingTab = document.getElementById('publicBoardRankingTab');
  if (!leaderboardTab || !rankingTab) return;
  const isLeaderboard = boardType !== 'ranking';
  leaderboardTab.classList.toggle('active', isLeaderboard);
  rankingTab.classList.toggle('active', !isLeaderboard);
  leaderboardTab.setAttribute('aria-selected', isLeaderboard ? 'true' : 'false');
  rankingTab.setAttribute('aria-selected', !isLeaderboard ? 'true' : 'false');
}

function switchPublicBoardType(boardType) {
  currentPublicBoardType = boardType === 'ranking' ? 'ranking' : 'leaderboard';
  renderPublicBoardList(currentPublicBoardType);
}

function renderPublicBoardList(boardType) {
  const boardBody = document.getElementById('publicBoardBody');
  const boardTitle = document.getElementById('publicBoardTitle');
  const boardSubtitle = document.getElementById('publicBoardSubtitle');
  if (!boardBody || !boardTitle || !boardSubtitle) return;
  const users = getPublicBoardUsers().filter(isPublicBoardUser);
  const isRanking = boardType === 'ranking';
  updatePublicBoardTabs(boardType);
  boardTitle.textContent = isRanking ? 'Ranking' : 'Leaderboard';
  boardSubtitle.textContent = isRanking ? 'Sorted by total tree progress points' : 'Sorted by longest consecutive login streak';
  const sortedUsers = [...users].sort((leftUser, rightUser) => {
    if (isRanking) {
      const diff = Math.floor(Number(rightUser?.treeProgress ?? 0) || 0) - Math.floor(Number(leftUser?.treeProgress ?? 0) || 0);
      return diff !== 0 ? diff : String(leftUser?.name || '').localeCompare(String(rightUser?.name || ''));
    }
    const diff = getUserLongestLoginStreak(rightUser) - getUserLongestLoginStreak(leftUser);
    return diff !== 0 ? diff : String(leftUser?.name || '').localeCompare(String(rightUser?.name || ''));
  });
  if (sortedUsers.length === 0) {
    boardBody.innerHTML = '<li class="public-board-empty">No users available for this board yet.</li>'; return;
  }
  boardBody.innerHTML = sortedUsers.slice(0, 20).map((user, index) => {
    const score = isRanking ? Math.floor(Number(user?.treeProgress ?? 0) || 0) : getUserLongestLoginStreak(user);
    const scoreLabel = isRanking ? `${score} FP` : `${score} day${score === 1 ? '' : 's'}`;
    const name = escapeHtml(String(user?.name || user?.email || 'Unknown'));
    const rankClass = index < 3 ? `top-${index + 1}` : '';
    const rankBadge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
    return `<li class="public-board-item ${rankClass}"><span class="public-board-rank">${rankBadge}</span><span class="public-board-name">${name}</span><span class="public-board-score">${scoreLabel}</span></li>`;
  }).join('');
}

function openLeaderboardModal(boardType) {
  const modal = document.getElementById('leaderboardModal');
  if (!modal) return;
  currentPublicBoardType = boardType === 'ranking' ? 'ranking' : 'leaderboard';
  renderPublicBoardList(currentPublicBoardType);
  modal.style.display = 'flex';
}

function closeLeaderboardModal() {
  const modal = document.getElementById('leaderboardModal');
  if (modal) modal.style.display = 'none';
}

// --- Task logic ---

function canCompleteTask(taskKey) {
  if (taskKey === 'attendService' && !isSundayTaskWindowNow()) {
    return { allowed: false, message: 'Worship Attendance can only be completed on Sundays.' };
  }
  const rule = taskRecurrenceRules[taskKey];
  if (!rule) return { allowed: true };
  const periodKey = getCurrentPeriodKey(rule.unit);
  if (taskCompletions[taskKey] === periodKey) {
    return { allowed: false, message: `${taskDisplayNames[taskKey] || 'This task'} can only be completed ${rule.label}.` };
  }
  return { allowed: true, periodKey };
}

function markTaskCompleted(taskKey, periodKey) {
  const rule = taskRecurrenceRules[taskKey];
  if (!rule) return;
  taskCompletions[taskKey] = periodKey || getCurrentPeriodKey(rule.unit);
}

function isTaskDoneForCurrentPeriod(taskKey) {
  const rule = taskRecurrenceRules[taskKey];
  if (!rule) return false;
  return taskCompletions[taskKey] === getCurrentPeriodKey(rule.unit);
}

function updateTaskBadges() {
  Object.entries(taskButtonBindings).forEach(([taskKey, binding]) => {
    const buttonEl = document.getElementById(binding.buttonId);
    if (!buttonEl) return;
    const isDone = isTaskDoneForCurrentPeriod(taskKey);
    buttonEl.classList.toggle('task-done', isDone);
    buttonEl.classList.toggle('task-not-done', !isDone);
  });
}

// --- Tree growth & progress ---

function applyTreeProgress(pointsToAdd, options) {
  const addFp = options?.addFaithPoints !== false;
  if (addFp) faithPoints += pointsToAdd;
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
  if (maxBloomReached && fruitEligiblePoints > 0) addFruitIfNeeded(fruitEligiblePoints);
  showScripture();
}

function normalizeFruitProgressState() {
  if (treeProgress < FULL_BLOOM_THRESHOLD) return;
  if (!maxBloomReached) {
    maxBloomReached = true;
    if (fruitCount === 0 && pointsForFruit === 0) {
      const overflowPoints = Math.max(0, treeProgress - FULL_BLOOM_THRESHOLD);
      fruitCount = Math.floor(overflowPoints / 100);
      pointsForFruit = overflowPoints % 100;
    }
  }
}

function addFruitIfNeeded(pointsAdded) {
  pointsForFruit += pointsAdded;
  while (pointsForFruit >= 100) { fruitCount++; pointsForFruit -= 100; addFruit(); }
}

function updateFruitVisuals() {
  const fruitsGroup = document.getElementById("oldTreeFruits");
  if (!fruitsGroup) return;
  const fruitCircles = fruitsGroup.querySelectorAll('circle');
  const visibleFruitCount = Math.min(Math.max(fruitCount, 0), fruitCircles.length);
  fruitCircles.forEach((circle, index) => { circle.style.opacity = index < visibleFruitCount ? '1' : '0'; });
}

function addFruit() {
  const fruitsGroup = document.getElementById("oldTreeFruits");
  if (!fruitsGroup) return;
  fruitsGroup.style.animation = "none";
  void fruitsGroup.offsetWidth;
  fruitsGroup.style.animation = "fruitBounce 0.6s ease-out";
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

function animateFlowerBurst(flowerElement) {
  const circles = flowerElement.querySelectorAll('circle');
  circles.forEach((circle, index) => {
    circle.style.animation = 'none';
    void circle.offsetWidth;
    circle.style.animation = `bloom 0.6s ease-out forwards`;
    circle.style.animationDelay = `${index * 0.08}s`;
  });
}

function animateFruitBurst(fruitElement) {
  const circles = fruitElement.querySelectorAll('circle');
  circles.forEach((circle, index) => {
    circle.style.animation = 'none';
    void circle.offsetWidth;
    circle.style.animation = `fruitPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`;
    circle.style.animationDelay = `${index * 0.1}s`;
  });
}

// --- Display ---

function updateDisplay(options) {
  const persist = options?.persist !== false;
  const faithPointsEl = document.getElementById("faithPoints");
  const upgradeCostEl = document.getElementById("upgradeCost");
  const fpPillValueEl = document.getElementById('fpPillValue');
  const streakPillValueEl = document.getElementById('streakPillValue');
  const dailyRewardStreakEl = document.getElementById('dailyRewardStreakText');
  if (faithPointsEl) faithPointsEl.textContent = Math.floor(faithPoints);
  if (upgradeCostEl) upgradeCostEl.textContent = upgradeCost;
  if (fpPillValueEl) fpPillValueEl.textContent = String(Math.floor(faithPoints));
  if (streakPillValueEl) {
    const displayStreak = Math.max(getUserCurrentLoginStreak(currentUser), 1);
    streakPillValueEl.textContent = `${displayStreak} day${displayStreak === 1 ? '' : 's'}`;
  }
  if (dailyRewardStreakEl) {
    refreshDailyLoginState();
    const currentDay = dailyLoginState.streakDay;
    const totalDays = DAILY_LOGIN_REWARDS.length;
    const todayClaimed = hasClaimedDailyLoginToday();
    dailyRewardStreakEl.textContent = todayClaimed
      ? `Day ${currentDay > totalDays ? totalDays : currentDay}/${totalDays} — Checked in today!`
      : `Day ${currentDay}/${totalDays} — Check in now!`;
  }
  updateTaskBadges();
  updateProgressDisplay();
  updateTreeGrowth();
  updateFruitVisuals();
  if (persist) saveUserData();
}

function updateProgressDisplay() {
  const progressText = document.getElementById("progressText");
  const progressBarFill = document.getElementById("progressBarFill");
  if (!progressText || !progressBarFill) return;
  const stages = [
    { name: 'Germination', threshold: 50 }, { name: 'Seedling', threshold: 150 },
    { name: 'Sapling', threshold: 350 }, { name: 'Young Tree', threshold: 600 },
    { name: 'Mature Tree', threshold: 1000 }, { name: 'Old Tree', threshold: 1500 }
  ];
  let progressTextContent = '';
  let progressPercent = 0;
  if (maxBloomReached) {
    progressPercent = (pointsForFruit / 100) * 100;
    progressTextContent = `🍎 Fruits: ${fruitCount} (${pointsForFruit}/100 points toward next fruit)`;
  } else {
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
    if (!foundStage && treeProgress >= 1500) {
      progressPercent = 100;
      progressTextContent = `📈 ${Math.floor(treeProgress)}/1500 - Old Tree Complete!`;
    }
  }
  progressText.textContent = progressTextContent;
  progressBarFill.style.width = Math.min(progressPercent, 100) + '%';
}

function updateTreeGrowth() {
  const stages = [
    { id: 'seedStageImg', key: 'seed' }, { id: 'germinationStageImg', key: 'germination' },
    { id: 'seedlingStageImg', key: 'seedling' }, { id: 'saplingStageImg', key: 'sapling' },
    { id: 'youngTreeStageImg', key: 'youngTree' }, { id: 'matureTreeStageImg', key: 'matureTree' },
    { id: 'oldTreeStageImg', key: 'oldTree' }
  ];
  let currentStage = 'seed';
  if (treeProgress >= 1500) currentStage = 'oldTree';
  else if (treeProgress >= 1000) currentStage = 'matureTree';
  else if (treeProgress >= 600) currentStage = 'youngTree';
  else if (treeProgress >= 350) currentStage = 'sapling';
  else if (treeProgress >= 150) currentStage = 'seedling';
  else if (treeProgress >= 50) currentStage = 'germination';

  const currentStageNameEl = document.getElementById('currentStageName');
  if (currentStageNameEl) {
    const stageName = currentStage.replace(/([A-Z])/g, ' $1').trim()
      .split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    currentStageNameEl.textContent = stageName;
  }

  const treeStageContainer = document.getElementById('treeStageImages');
  if (treeStageContainer) {
    treeStageContainer.classList.remove(...stages.map(s => `stage-${s.key}`));
    treeStageContainer.classList.add(`stage-${currentStage}`);
  }
  stages.forEach(stage => { const el = document.getElementById(stage.id); if (el) el.classList.remove('active'); });
  setTimeout(() => {
    const showStage = stages.find(s => s.key === currentStage);
    if (showStage) { const el = document.getElementById(showStage.id); if (el) el.classList.add('active'); }
    const shareGospelBtn = document.getElementById('shareGospelBtn');
    if (shareGospelBtn) shareGospelBtn.style.display = treeProgress >= 350 ? 'inline-block' : 'none';
  }, 50);
}

function showScripture() {
  const verse = scriptures[Math.floor(Math.random() * scriptures.length)];
  const box = document.getElementById("scriptureBox");
  if (box) box.textContent = verse;
}

// --- Save / Load ---

function saveUserData() {
  if (!currentUser) return;
  refreshDailyLoginState();
  const users = getStoredUsersSafe();
  const currentUserId = Number(currentUser.id);
  const normalizedCurrentEmail = normalizeEmail(currentUser.email);
  let userIndex = users.findIndex(u => Number(u.id) === currentUserId);
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

function loadUserData() {
  if (!currentUser) { resetGameState(); return; }
  faithPoints = Number(currentUser.faithPoints ?? 0);
  treeProgress = Number(currentUser.treeProgress ?? 0);
  passiveRate = Number(currentUser.passiveRate ?? 1);
  fruitCount = Number(currentUser.fruitCount ?? 0);
  pointsForFruit = Number(currentUser.pointsForFruit ?? 0);
  maxBloomReached = Boolean(currentUser.maxBloomReached ?? false);
  taskCompletions = currentUser.taskCompletions && typeof currentUser.taskCompletions === 'object' ? currentUser.taskCompletions : {};
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

// --- Upload / Submit ---

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
  if (submitPhotoBtn) submitPhotoBtn.disabled = true;
  document.getElementById("uploadModal").style.display = 'flex';
}

function closeUploadModal() {
  document.getElementById("uploadModal").style.display = 'none';
  const submitPhotoBtn = document.getElementById('submitPhotoBtn');
  if (submitPhotoBtn) submitPhotoBtn.disabled = true;
  currentAction = '';
}

function submitPhoto() {
  const photoInputElement = document.getElementById('photoInput');
  const selectedFile = photoInputElement?.files?.[0];
  if (!selectedFile) { showNotification('Please attach an image before submitting.', { type: 'warning' }); return; }
  const recurrenceCheck = canCompleteTask(currentAction);
  if (!recurrenceCheck.allowed) { showNotification(recurrenceCheck.message, { type: 'warning' }); closeUploadModal(); return; }
  const reward = actionRewards[currentAction];
  if (!reward) { closeUploadModal(); return; }
  const pointsToAdd = reward.fp;
  const previousFp = Math.floor(Number(faithPoints ?? 0) || 0);
  faithPoints += pointsToAdd;
  markTaskCompleted(currentAction, recurrenceCheck.periodKey);
  showScripture();
  updateDisplay();
  closeUploadModal();
  showNotification(`Great job! ${pointsToAdd} FP added for ${reward.name}.`, { type: 'success', browser: true });
  debugFpLog('task-photo-submitted', { action: currentAction, pointsToAdd, fpBefore: previousFp, fpAfter: Math.floor(Number(faithPoints ?? 0) || 0) });
}

function shareGospel() {
  const pointsToAdd = actionRewards.sharegospel.fp;
  const previousFp = Math.floor(Number(faithPoints ?? 0) || 0);
  applyTreeProgress(pointsToAdd);
  updateDisplay();
  debugFpLog('share-gospel', { pointsToAdd, fpBefore: previousFp, fpAfter: Math.floor(Number(faithPoints ?? 0) || 0) });
}

// --- Upgrade ---

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
    debugFpLog('use-all-points', { pointsUsed, fpAfter: Math.floor(Number(faithPoints ?? 0) || 0), treeProgressAfter: Math.floor(Number(treeProgress ?? 0) || 0) });
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
    updateDisplay();
    debugFpLog('upgrade', { pointsToAdd, upgradeCost, fpBefore: previousFp, fpAfter: Math.floor(Number(faithPoints ?? 0) || 0), passiveRate });
    const flowers = document.getElementById("flowers");
    if (flowers) {
      flowers.classList.remove("blooming");
      setTimeout(() => { flowers.classList.add("blooming"); }, 10);
    }
  }
}

function openUpgradeModal() {
  const modal = document.getElementById("upgradeModal");
  const insufficientMsg = document.getElementById("insufficientFpMessage");
  const useAllBtn = document.getElementById("useAllPointsModalBtn");
  insufficientMsg.style.display = "none";
  document.getElementById("upgradeCostAmount").textContent = upgradeCost;
  useAllBtn.style.display = (faithPoints >= 10 && faithPoints % 10 === 0 && faithPoints >= upgradeCost) ? "inline-block" : "none";
  modal.style.display = "flex";
}

function closeUpgradeModal() {
  document.getElementById("upgradeModal").style.display = "none";
}

function confirmUpgrade() {
  if (faithPoints >= upgradeCost) { upgrade(); closeUpgradeModal(); focusSeedGrowthView(); }
  else document.getElementById("insufficientFpMessage").style.display = "block";
}
