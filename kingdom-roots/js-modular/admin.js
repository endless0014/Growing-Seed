// Growing Seed — Admin Dashboard & Management Actions
// isAdminUser() is defined in utils.js

function getCurrentViewMode() {
  if (!currentUser) return 'user';
  if (!hasManagementAccess()) return 'user';
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
  if (userMainContainer) userMainContainer.style.display = isAdminView ? 'none' : 'block';
  if (adminDashboard) adminDashboard.style.display = isAdminView ? 'block' : 'none';

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

  if (isAdminView) renderAdminDashboard();
}

function switchToUserHome() {
  if (!currentUser) return;
  currentUser.viewMode = 'user';
  applyViewModeUI();
  saveUserData();
}

function scrollAdminSection(sectionId) {
  const target = document.getElementById(sectionId);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function removeLegacyAdminFaithPointsCard() {
  const cards = document.querySelectorAll('.admin-stats-grid .admin-stat-card');
  cards.forEach(card => {
    const labelEl = card.querySelector('.admin-stat-label');
    const labelText = String(labelEl?.textContent || '').trim().toLowerCase();
    if (labelText === 'total faith points') card.remove();
  });
}

function toggleAdminView() {
  const roleFromEmail = getRoleByEmail(currentUser?.email, currentUser?.role);
  if (roleFromEmail !== currentUser?.role) currentUser.role = roleFromEmail;

  if (!hasManagementAccess()) {
    showNotification('Only admin or moderator users can switch to management view.', { type: 'error' });
    return;
  }

  currentUser.viewMode = getCurrentViewMode() === 'admin' ? 'user' : 'admin';
  applyViewModeUI();
  saveUserData();
}

async function renderAdminDashboard(syncFromCloud = true) {
  if (!hasManagementAccess() || getCurrentViewMode() !== 'admin') return;

  if (syncFromCloud) await syncUsersFromCloudToLocal();
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
      return rule && userTaskCompletions[taskKey] === getCurrentPeriodKey(rule.unit);
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
    trendCounts.push({ label: dayStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: count });
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
    dailyTrendEl.innerHTML = trendCounts.map(entry => {
      const widthPct = Math.max(6, Math.round((entry.value / maxTrendValue) * 100));
      return `<div class="admin-bar-row"><span class="admin-bar-label">${escapeHtml(entry.label)}</span><div class="admin-bar-track"><div class="admin-bar-fill" style="width: ${widthPct}%;"></div></div><strong class="admin-bar-value">${entry.value}</strong></div>`;
    }).join('');
  }

  if (taskSummaryEl) {
    const taskRows = taskKeys.map(taskKey => {
      const doneCount = safeUsers.filter(user => {
        const completions = user.taskCompletions && typeof user.taskCompletions === 'object' ? user.taskCompletions : {};
        const rule = taskRecurrenceRules[taskKey];
        return completions[taskKey] === getCurrentPeriodKey(rule.unit);
      }).length;
      return { taskName: taskDisplayNames[taskKey] || taskKey, doneCount, rate: totalUsers > 0 ? Math.round((doneCount / totalUsers) * 100) : 0 };
    });
    taskSummaryEl.innerHTML = taskRows.map(row => {
      const widthPct = Math.max(6, row.rate);
      return `<div class="admin-bar-row"><span class="admin-bar-label">${escapeHtml(row.taskName)}</span><div class="admin-bar-track"><div class="admin-bar-fill task" style="width: ${widthPct}%;"></div></div><strong class="admin-bar-value">${row.doneCount}/${totalUsers} (${row.rate}%)</strong></div>`;
    }).join('');
  }

  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  if (usersVisibleToCurrentUser.length === 0) {
    tbody.innerHTML = '<tr><td colspan="14">No users found.</td></tr>';
    return;
  }

  const sortSelect = document.getElementById('adminSortSelect');
  const sortValue = sortSelect ? sortSelect.value : 'lastActiveDesc';
  const sortedUsers = [...usersVisibleToCurrentUser].sort((leftUser, rightUser) => {
    const leftName = String(leftUser.name || '').toLowerCase();
    const rightName = String(rightUser.name || '').toLowerCase();
    const leftFp = Math.floor(Number(leftUser.faithPoints ?? 0) || 0);
    const rightFp = Math.floor(Number(rightUser.faithPoints ?? 0) || 0);
    const leftStreak = Math.max(0, Number((leftUser.dailyLoginState && leftUser.dailyLoginState.claimedDays && leftUser.dailyLoginState.claimedDays.length) || 0));
    const rightStreak = Math.max(0, Number((rightUser.dailyLoginState && rightUser.dailyLoginState.claimedDays && rightUser.dailyLoginState.claimedDays.length) || 0));
    const leftLastActive = getLastActiveTimestamp(leftUser);
    const rightLastActive = getLastActiveTimestamp(rightUser);
    const leftRole = getRoleByEmail(leftUser.email, leftUser.role);
    const rightRole = getRoleByEmail(rightUser.email, rightUser.role);

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

  tbody.innerHTML = sortedUsers.map(user => {
    const role = getRoleByEmail(user.email, user.role);
    const normalizedEmail = normalizeEmail(user.email || '');
    const name = escapeHtml(user.name || 'N/A');
    const lastLogin = escapeHtml(user.lastLogin || 'Never');
    const lastActive = escapeHtml(formatDateTimeForDisplay(user.lastActiveAt ?? user.updatedAt));
    const email = escapeHtml(user.email || 'N/A');
    const fp = Math.floor(Number(user.faithPoints ?? 0) || 0);
    const tp = Math.floor(Number(user.treeProgress ?? 0) || 0);
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
      if (!canEditTaskAndStreak) return `<input type="checkbox" disabled ${checked ? 'checked' : ''} aria-label="${taskDisplayNames[taskKey]} completion">`;
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
        <td>${fp}</td>
        <td>${tp}</td>
        <td>${taskCheckbox('pray')}</td>
        <td>${taskCheckbox('bible')}</td>
        <td>${taskCheckbox('devotion')}</td>
        <td>${taskCheckbox('smallgroup')}</td>
        <td>${taskCheckbox('attendService')}</td>
        <td>
          <div class="admin-actions">
            <button class="admin-action-btn points" onclick="window.adminAddPoints(${userId}, '${normalizedEmail}')">+Points</button>
            <button class="admin-action-btn password" onclick="window.adminResetPassword(${userId})">Send Reset Email</button>
            <button class="admin-action-btn progress" onclick="window.adminResetProgress(${userId})" ${disableResetProgress}>Reset Progress</button>
            ${canViewProgress ? `<button class="admin-action-btn view" onclick="window.adminViewProgress(${userId})">View</button>` : ''}
            <button class="admin-action-btn open" onclick="window.adminOpenUserUi(${userId})" ${disableOpenUi}>Open UI</button>
          </div>
        </td>
      </tr>`;
  }).join('');
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

// hydrateCurrentUserFromStoredUsers() and syncCurrentSessionIfNeeded() are defined in auth.js

// --- Admin actions ---

function adminAddPoints(userId, userEmail) {
  if (!assertAdminDashboardAccess()) return;
  if (!ensureActionPermission('addPoints', 'You do not have permission to add points.')) return;
  const pointsInput = prompt('Enter points to add:', '10');
  if (pointsInput === null) return;
  const points = Number(pointsInput);
  if (!Number.isFinite(points) || points <= 0) { showNotification('Please enter a valid positive number.', { type: 'error' }); return; }
  const users = getStoredUsersSafe();
  let userIndex = findUserIndexById(users, userId);
  if (userIndex === -1 && userEmail) {
    const normalizedTargetEmail = normalizeEmail(userEmail);
    userIndex = users.findIndex(user => normalizeEmail(user.email) === normalizedTargetEmail);
  }
  if (userIndex === -1) { showNotification('User not found.', { type: 'error' }); return; }
  users[userIndex].faithPoints = Math.floor(Number(users[userIndex].faithPoints ?? 0) + points);
  users[userIndex].updatedAt = Date.now();
  users[userIndex].lastActiveAt = Date.now();
  setStoredUsers(users);
  upsertUserInCloud(users[userIndex]);
  syncCurrentSessionIfNeeded(users[userIndex]);
  renderAdminDashboard(false);
  showNotification(`Added ${points} FP to ${users[userIndex].email}.`, { type: 'success' });
}

async function adminResetPassword(userId) {
  if (!assertAdminDashboardAccess()) return;
  if (!ensureActionPermission('resetPassword', 'You do not have permission to reset passwords.')) return;
  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) { showNotification('User not found.', { type: 'error' }); return; }
  const userEmail = users[userIndex].email;
  const confirmed = confirm(`Send password reset email to ${userEmail}?`);
  if (!confirmed) return;

  if (isFirebaseAuthAvailable()) {
    try {
      await firebase.auth().sendPasswordResetEmail(userEmail);
      showNotification(`Password reset email sent to ${userEmail}.`, { type: 'success' });
    } catch (error) {
      showNotification(`Failed to send reset email: ${error.message || 'Unknown error'}`, { type: 'error' });
    }
  } else {
    // Legacy fallback: direct password set when Firebase Auth is unavailable
    const newPassword = prompt('Firebase Auth unavailable. Enter new password (min 6 characters):', '');
    if (newPassword === null) return;
    if (newPassword.length < 6) { showNotification('Password must be at least 6 characters.', { type: 'error' }); return; }
    users[userIndex].password = newPassword;
    setStoredUsers(users);
    showNotification(`Password reset for ${userEmail}.`, { type: 'success' });
  }
}

function adminResetProgress(userId) {
  if (!assertAdminDashboardAccess()) return;
  if (!ensureActionPermission('resetProgress', 'Moderator cannot reset progress.')) return;
  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) { showNotification('User not found.', { type: 'error' }); return; }
  const targetEmail = users[userIndex].email;
  if (!confirm(`Reset progress for ${targetEmail}?`)) return;
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
  if (userIndex === -1) { showNotification('User not found.', { type: 'error' }); return; }
  const user = users[userIndex];
  const progressMessage = [
    `Name: ${user.name || 'N/A'}`, `Email: ${user.email || 'N/A'}`,
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
  if (userIndex === -1) { showNotification('User not found.', { type: 'error' }); return; }
  const selectedUser = { ...users[userIndex] };
  if (!confirm(`Open actual UI as ${selectedUser.email}?\nYou can return by logging back in as admin.`)) return;
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
  if (userIndex === -1) { showNotification('User not found.', { type: 'error' }); renderAdminDashboard(false); return; }
  const targetUser = users[userIndex];
  const lockedToAdmin = isAdminEmail(targetUser.email);
  const finalRole = lockedToAdmin ? 'admin' : normalizedNextRole;
  const currentRole = getRoleByEmail(targetUser.email, targetUser.role);
  if (currentRole === finalRole) { renderAdminDashboard(false); return; }
  if (!confirm(`Change role for ${targetUser.email} from ${currentRole} to ${finalRole}?`)) { renderAdminDashboard(false); return; }
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
  if (getCurrentUserRole() !== 'admin') { showNotification('Only admin can edit task completion.', { type: 'error' }); renderAdminDashboard(false); return; }
  const rule = taskRecurrenceRules[taskKey];
  if (!rule) { showNotification('Unknown task key.', { type: 'error' }); renderAdminDashboard(false); return; }
  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) { showNotification('User not found.', { type: 'error' }); renderAdminDashboard(false); return; }
  const currentCompletions = users[userIndex].taskCompletions && typeof users[userIndex].taskCompletions === 'object'
    ? { ...users[userIndex].taskCompletions } : {};
  if (isCompleted) { currentCompletions[taskKey] = getCurrentPeriodKey(rule.unit); }
  else { delete currentCompletions[taskKey]; }
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
  if (getCurrentUserRole() !== 'admin') { showNotification('Only admin can edit streak days.', { type: 'error' }); renderAdminDashboard(false); return; }
  const parsedStreak = Math.floor(Number(streakInput));
  if (!Number.isFinite(parsedStreak) || parsedStreak < 0 || parsedStreak > DAILY_LOGIN_REWARDS.length) {
    showNotification(`Streak days must be between 0 and ${DAILY_LOGIN_REWARDS.length}.`, { type: 'error' }); renderAdminDashboard(false); return;
  }
  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) { showNotification('User not found.', { type: 'error' }); renderAdminDashboard(false); return; }
  if (parsedStreak === 0) {
    users[userIndex].dailyLoginState = normalizeDailyLoginState({});
  } else {
    const claimedDays = Array.from({ length: parsedStreak }, (_, dayIndex) => dayIndex + 1);
    users[userIndex].dailyLoginState = normalizeDailyLoginState({
      streakDay: parsedStreak >= DAILY_LOGIN_REWARDS.length ? 1 : parsedStreak + 1,
      lastClaimDate: '', cycleStartDate: getTodayDateKey(), claimedDays
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
