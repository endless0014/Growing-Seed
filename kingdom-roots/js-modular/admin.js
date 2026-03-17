// Growing Seed — Admin Dashboard & Management Actions
// isAdminUser() is defined in utils.js

function getCurrentViewMode() {
  if (!currentUser) return 'user';
  if (!hasManagementAccess()) return 'user';
  return currentUser.viewMode === 'admin' ? 'admin' : 'user';
}

window.adminSetTaskCompletion = adminSetTaskCompletion;
window.adminSetStreakDays = adminSetStreakDays;
window.adminSetJoinedDate = adminSetJoinedDate;
function adminSetEmail(userId, emailValue) {
  if (!assertAdminDashboardAccess()) return;
  if (getCurrentUserRole() !== 'admin') { showNotification('Only admin can edit email.', { type: 'error' }); renderAdminDashboard(false); return; }
  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) { showNotification('User not found.', { type: 'error' }); renderAdminDashboard(false); return; }
  if (!emailValue || typeof emailValue !== 'string') { showNotification('Invalid email.', { type: 'error' }); return; }
  const normalized = normalizeEmail(emailValue);
  // Prevent duplicate emails
  if (users.some((u, idx) => idx !== userIndex && normalizeEmail(u.email) === normalized)) {
    showNotification('Another user already has that email.', { type: 'error' }); return;
  }
  users[userIndex].email = normalized;
  users[userIndex].updatedAt = Date.now();
  users[userIndex].lastActiveAt = Date.now();
  setStoredUsers(users);
  upsertUserInCloud(users[userIndex]);
  syncCurrentSessionIfNeeded(users[userIndex]);
  renderAdminDashboard(false);
  showNotification(`Email updated for ${users[userIndex].name}.`, { type: 'success' });
}

function adminSetFaithPoints(userId, pointsValue) {
  if (!assertAdminDashboardAccess()) return;
  // Allow moderators to add points via `addPoints` permission; admins may fully edit.
  if (!ensureActionPermission('addPoints', 'Only admin or moderator can edit faith points.')) { renderAdminDashboard(false); return; }
  const parsed = Math.floor(Number(pointsValue));
  if (!Number.isFinite(parsed) || parsed < 0) { showNotification('Invalid points value.', { type: 'error' }); return; }
  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) { showNotification('User not found.', { type: 'error' }); renderAdminDashboard(false); return; }
  users[userIndex].faithPoints = parsed;
  users[userIndex].updatedAt = Date.now();
  users[userIndex].lastActiveAt = Date.now();
  setStoredUsers(users);
  upsertUserInCloud(users[userIndex]);
  syncCurrentSessionIfNeeded(users[userIndex]);
  renderAdminDashboard(false);
  showNotification(`Faith Points updated for ${users[userIndex].email}.`, { type: 'success' });
}

function adminSetTreeProgress(userId, progressValue) {
  if (!assertAdminDashboardAccess()) return;
  // Tree progress is admin-only
  if (getCurrentUserRole() !== 'admin') { showNotification('Only admin can edit tree progress.', { type: 'error' }); renderAdminDashboard(false); return; }
  const parsed = Math.floor(Number(progressValue));
  if (!Number.isFinite(parsed) || parsed < 0) { showNotification('Invalid tree progress value.', { type: 'error' }); return; }
  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) { showNotification('User not found.', { type: 'error' }); renderAdminDashboard(false); return; }
  users[userIndex].treeProgress = parsed;
  users[userIndex].updatedAt = Date.now();
  users[userIndex].lastActiveAt = Date.now();
  setStoredUsers(users);
  upsertUserInCloud(users[userIndex]);
  syncCurrentSessionIfNeeded(users[userIndex]);
  renderAdminDashboard(false);
  showNotification(`Tree Progress updated for ${users[userIndex].email}.`, { type: 'success' });
}

window.adminSetEmail = adminSetEmail;
window.adminSetFaithPoints = adminSetFaithPoints;
window.adminSetTreeProgress = adminSetTreeProgress;
function applyViewModeUI() {
  const hasManagement = hasManagementAccess();
  const mode = getCurrentViewMode();
  const isAdminView = hasManagement && mode === 'admin';
  const currentRole = getCurrentUserRole();

  if (hasManagement && currentUser && currentUser.role !== currentRole) {
    currentUser.role = currentRole;
    try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
      try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
    }
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
    // For each day, pick the single user with the max `loginStreakCurrent` among users active that day.
    const dailyRows = [];
    for (let i = 0; i < trendCounts.length; i++) {
      const label = trendCounts[i].label;
      // compute day window again to find users for that label/day
      const dayOffset = trendCounts.length - 1 - i;
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - dayOffset);
      const dayEnd = new Date(dayStart.getTime() + oneDayMs);

      const usersThisDay = safeUsers.filter(user => {
        const candidate = Number(new Date(user.lastLogin || '').getTime()) || Number(user.lastActiveAt || 0);
        return candidate >= dayStart.getTime() && candidate < dayEnd.getTime();
      });

      if (usersThisDay.length === 0) {
        dailyRows.push({ label, value: 0, userName: '' });
        continue;
      }

      // choose the user with the highest loginStreakCurrent (fallback to 0)
      const topUser = usersThisDay.reduce((best, cur) => {
        const bestVal = Number(best?.loginStreakCurrent || 0);
        const curVal = Number(cur?.loginStreakCurrent || 0);
        return curVal > bestVal ? cur : best;
      }, usersThisDay[0]);

      const topValue = Number(topUser.loginStreakCurrent || 0) || 1;
      const topName = topUser.name || topUser.email || '';
      dailyRows.push({ label, value: topValue, userName: topName });
    }

    // Render as vertical bars: each day shows the max login-streak value for that day
    const maxTrendValue = Math.max(...dailyRows.map(r => r.value), 1);
    dailyTrendEl.innerHTML = dailyRows.map(row => {
      const heightPct = Math.max(6, Math.round((row.value / maxTrendValue) * 100));
      const countLabel = row.value > 0 ? String(row.value) : '—';
      const title = row.value > 0 ? `${row.value} day${row.value === 1 ? '' : 's'} — ${escapeHtml(row.userName)}` : 'No sign-ins';
      return `
        <div class="admin-trend-column" title="${escapeHtml(title)}">
          <div class="admin-trend-bar" style="height: ${heightPct}%">
            <span class="admin-trend-count">${escapeHtml(countLabel)}</span>
          </div>
          <div class="admin-trend-label">${escapeHtml(row.label)}</div>
        </div>
      `;
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
    tbody.innerHTML = '<tr><td colspan="11">No users found.</td></tr>';
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
    // Real Login Streak
    const realLoginStreak = Math.max(0, Number(user.loginStreakCurrent ?? 0));
    // Daily Reward Progress (day count, not timestamp)
    let dailyRewardProgress = 0;
    if (user.dailyLoginState && Array.isArray(user.dailyLoginState.claimedDays)) {
      dailyRewardProgress = user.dailyLoginState.claimedDays.length;
    }
    const completions = user.taskCompletions && typeof user.taskCompletions === 'object' ? user.taskCompletions : {};
    const userId = Number.isFinite(Number(user.id)) ? Number(user.id) : Date.now();
    const canEditTaskAndStreak = roleOfCurrentUser === 'admin';

    // Render controls for login streak and daily reward progress
    let realLoginStreakControl, dailyRewardProgressControl;
    if (canEditTaskAndStreak) {
      realLoginStreakControl = `<input type="number" min="0" value="${realLoginStreak}" onchange="window.adminSetRealLoginStreak(${userId}, this.value)" aria-label="Login streak days for ${name}">`;
      dailyRewardProgressControl = `<input type="number" min="0" max="${DAILY_LOGIN_REWARDS.length}" value="${dailyRewardProgress}" onchange="window.adminSetStreakDays(${userId}, this.value)" aria-label="Daily reward days for ${name}">`;
    } else {
      realLoginStreakControl = `${realLoginStreak} day${realLoginStreak === 1 ? '' : 's'}`;
      dailyRewardProgressControl = `${dailyRewardProgress} day${dailyRewardProgress === 1 ? '' : 's'}`;
    }


    // Activity badges: compact visual indicators for task completion.
    const taskBadge = taskKey => {
      const rule = taskRecurrenceRules[taskKey];
      const checked = rule && completions[taskKey] === getCurrentPeriodKey(rule.unit);
      const label = escapeHtml(taskDisplayNames[taskKey] || taskKey);
      const badgeClass = checked ? 'admin-activity-badge done' : 'admin-activity-badge pending';
      if (canEditTaskAndStreak) {
        // Admin may toggle completion
        const toggleAction = `window.adminSetTaskCompletion(${userId}, '${taskKey}', ${!checked})`;
        return `<span class="${badgeClass}" title="${label} - ${checked ? 'Completed' : 'Not completed'}" onclick="${toggleAction}">${label[0] || ''}</span>`;
      }
      // Read-only badge for non-admins (moderator / viewer)
      return `<span class="${badgeClass} disabled" title="${label} - ${checked ? 'Completed' : 'Not completed'}">${label[0] || ''}</span>`;
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

    // Email control (editable for admin)
    const emailControl = roleOfCurrentUser === 'admin'
      ? `<input type="email" value="${escapeHtml(user.email || '')}" onchange="window.adminSetEmail(${userId}, this.value)" aria-label="Email for ${name}">`
      : `${escapeHtml(user.email || 'N/A')}`;

    // Faith points control (editable for admin)
    const faithControl = roleOfCurrentUser === 'admin'
      ? `<input type="number" min="0" value="${fp}" onchange="window.adminSetFaithPoints(${userId}, this.value)" aria-label="Faith points for ${name}">`
      : `${fp}`;

    // Tree progress control (editable for admin)
    const treeControl = roleOfCurrentUser === 'admin'
      ? `<input type="number" min="0" value="${tp}" onchange="window.adminSetTreeProgress(${userId}, this.value)" aria-label="Tree progress for ${name}">`
      : `${tp}`;

    // Activity cell: show compact badges for tasks
    const activityCell = `<div class="admin-activity-cell">${taskKeys.map(k => taskBadge(k)).join(' ')}</div>`;

    return `
      <tr>
        <td>${name}</td>
        <td>${realLoginStreakControl}</td>
        <td>${dailyRewardProgressControl}</td>
        <td title="${escapeHtml(formatDateTimeForDisplay(user.lastLogin || ''))}">${lastLogin}</td>
        <td title="${escapeHtml(formatDateTimeForDisplay(user.lastActiveAt ?? user.updatedAt))}">${lastActive}</td>
        <td>${email}</td>
        <td>${roleControl}</td>
        <td>${faithControl}</td>
        <td>${treeControl}</td>
        <td>${activityCell}</td>
        <td>
          <div class="admin-actions">
            <button class="admin-action-btn points" onclick="window.adminAddPoints(${userId}, '${normalizedEmail}')">+Points</button>
            <button class="admin-action-btn password" onclick="window.adminResetPassword(${userId})">Reset Password</button>
            <button class="admin-action-btn progress" onclick="window.adminResetProgress(${userId})" ${disableResetProgress}>Reset Progress</button>
            <button class="admin-action-btn restore" onclick="window.adminRestoreUser(${userId})">Restore</button>
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
    try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
      try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
    }
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

  // Admin will set a default password for the user (stored locally).
  const newPassword = prompt(`Enter new default password for ${userEmail} (min 6 chars):`, 'changeme123');
  if (newPassword === null) return;
  if (newPassword.length < 6) { showNotification('Password must be at least 6 characters.', { type: 'error' }); return; }

  users[userIndex].password = newPassword;
  users[userIndex].updatedAt = Date.now();
  users[userIndex].lastActiveAt = Date.now();
  setStoredUsers(users);
  try { await upsertUserInCloud(users[userIndex]); } catch (e) { /* ignore cloud failures */ }
  syncCurrentSessionIfNeeded(users[userIndex]);
  renderAdminDashboard(false);
  showNotification(`Password set for ${userEmail}.`, { type: 'success' });
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
  try { persistAllUserState(getStoredUsersSafe(), nextSessionUser); } catch (e) {
    try { safeSetCurrentUser(nextSessionUser); } catch(__e2) { /* ignore */ }
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

// --- Restore actions (per-user and batch) ---
async function adminRestoreUser(userId) {
  if (!assertAdminDashboardAccess()) return;
  if (!ensureActionPermission('restore', 'Only admin can restore user data.')) return;

  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) { showNotification('User not found.', { type: 'error' }); return; }

  const target = users[userIndex];
  const email = normalizeEmail(target.email || '');
  if (!email) { showNotification('User has no email to restore from.', { type: 'error' }); return; }

  if (!confirm(`Restore data for ${target.email}? This will attempt to recover Faith Points, Tree Progress, and Daily login state from backups.`)) return;

  // Gather candidates: local stored user and cloud snapshot
  let cloudUser = null;
  const usersCollection = getCloudUsersCollection();
  if (usersCollection) {
    try {
      const snapshot = await usersCollection.doc(email).get();
      if (snapshot.exists) cloudUser = normalizeStoredUser(snapshot.data(), target.id);
    } catch (err) {
      console.warn('Cloud read failed for restore:', err);
    }
  }

  const localUser = users[userIndex];
  const candidateUsers = [localUser, cloudUser].filter(Boolean);
  if (candidateUsers.length === 0) { showNotification('No candidate records found to restore from.', { type: 'error' }); return; }

  const bestFaithPoints = Math.max(...candidateUsers.map(u => Math.floor(Number(u.faithPoints ?? 0) || 0)));
  const bestTreeProgress = Math.max(...candidateUsers.map(u => Math.floor(Number(u.treeProgress ?? 0) || 0)));
  const bestCurrentStreak = Math.max(...candidateUsers.map(u => getUserCurrentLoginStreak(u)));
  const bestLongestStreak = Math.max(...candidateUsers.map(u => getUserLongestLoginStreak(u)));
  const bestDailySource = candidateUsers.reduce((best, cu) => {
    if (!best) return cu;
    return getLegacyDailyLoginStreak(cu.dailyLoginState) > getLegacyDailyLoginStreak(best.dailyLoginState) ? cu : best;
  }, null);

  const recoveredFp = Math.max(0, bestFaithPoints - Math.floor(Number(localUser.faithPoints ?? 0) || 0));
  const recoveredTree = Math.max(0, bestTreeProgress - Math.floor(Number(localUser.treeProgress ?? 0) || 0));
  const recoveredStreakDays = Math.max(0, bestCurrentStreak - getUserCurrentLoginStreak(localUser));

  // Apply
  const now = Date.now();
  users[userIndex] = {
    ...users[userIndex],
    faithPoints: bestFaithPoints,
    treeProgress: bestTreeProgress,
    loginStreakCurrent: Math.max(bestCurrentStreak, 1),
    loginStreakLongest: Math.max(bestLongestStreak, Math.max(bestCurrentStreak, 1)),
    dailyLoginState: normalizeDailyLoginState(bestDailySource?.dailyLoginState ?? {}),
    taskCompletions: bestDailySource?.taskCompletions ?? users[userIndex].taskCompletions ?? {},
    lastActiveAt: now,
    updatedAt: now
  };

  setStoredUsers(users);
  try { await upsertUserInCloud(users[userIndex]); } catch (e) { console.warn('Cloud upsert failed after restore:', e); }
  syncCurrentSessionIfNeeded(users[userIndex]);
  renderAdminDashboard(false);
  showNotification(`Restored ${target.email}: +${recoveredFp} FP, +${recoveredTree} TP, +${recoveredStreakDays} streak day(s).`, { type: 'success', duration: 7000 });
}

async function restoreUserLoginStreaksFromBackup() {
  if (!assertAdminDashboardAccess()) return;
  if (!ensureActionPermission('restore', 'Only admin can restore user data.')) return;
  if (!confirm('Restore FP, Tree Progress and Daily login state for ALL users from backups? This may overwrite local data.')) return;

  const users = getStoredUsersSafe();
  const usersCollection = getCloudUsersCollection();
  let totalRecoveredFp = 0;
  let totalRecoveredTree = 0;
  let totalRecoveredStreaks = 0;

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const email = normalizeEmail(u.email || '');
    if (!email) continue;
    let cloudUser = null;
    if (usersCollection) {
      try {
        const snap = await usersCollection.doc(email).get();
        if (snap.exists) cloudUser = normalizeStoredUser(snap.data(), u.id);
      } catch (err) { console.warn('Cloud read failed for', email, err); }
    }
    const candidateUsers = [u, cloudUser].filter(Boolean);
    if (candidateUsers.length === 0) continue;
    const bestFaithPoints = Math.max(...candidateUsers.map(x => Math.floor(Number(x.faithPoints ?? 0) || 0)));
    const bestTreeProgress = Math.max(...candidateUsers.map(x => Math.floor(Number(x.treeProgress ?? 0) || 0)));
    const bestCurrentStreak = Math.max(...candidateUsers.map(x => getUserCurrentLoginStreak(x)));
    const bestLongestStreak = Math.max(...candidateUsers.map(x => getUserLongestLoginStreak(x)));
    const bestDailySource = candidateUsers.reduce((best, cu) => {
      if (!best) return cu;
      return getLegacyDailyLoginStreak(cu.dailyLoginState) > getLegacyDailyLoginStreak(best.dailyLoginState) ? cu : best;
    }, null);

    const recoveredFp = Math.max(0, bestFaithPoints - Math.floor(Number(u.faithPoints ?? 0) || 0));
    const recoveredTree = Math.max(0, bestTreeProgress - Math.floor(Number(u.treeProgress ?? 0) || 0));
    const recoveredStreakDays = Math.max(0, bestCurrentStreak - getUserCurrentLoginStreak(u));

    users[i] = {
      ...users[i],
      faithPoints: bestFaithPoints,
      treeProgress: bestTreeProgress,
      loginStreakCurrent: Math.max(bestCurrentStreak, 1),
      loginStreakLongest: Math.max(bestLongestStreak, Math.max(bestCurrentStreak, 1)),
      dailyLoginState: normalizeDailyLoginState(bestDailySource?.dailyLoginState ?? {}),
      taskCompletions: bestDailySource?.taskCompletions ?? users[i].taskCompletions ?? {},
      lastActiveAt: Date.now(),
      updatedAt: Date.now()
    };

    totalRecoveredFp += recoveredFp;
    totalRecoveredTree += recoveredTree;
    totalRecoveredStreaks += recoveredStreakDays;
  }

  setStoredUsers(users);
  try { await syncUsersToCloud(users); } catch (e) { console.warn('Cloud sync failed after bulk restore:', e); }
  renderAdminDashboard(false);
  showNotification(`Bulk restore complete. Restored +${totalRecoveredFp} FP, +${totalRecoveredTree} TP, +${totalRecoveredStreaks} streak day(s) across users.`, { type: 'success', duration: 8000 });
}

window.adminRestoreUser = adminRestoreUser;
window.restoreUserLoginStreaksFromBackup = restoreUserLoginStreaksFromBackup;

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

function adminGrantAdmin(email) {
  if (!assertAdminDashboardAccess()) return;
  const normalized = normalizeEmail(email || '');
  if (!normalized) { showNotification('Invalid email.', { type: 'error' }); return; }

  // Ensure in-memory ADMIN_EMAILS contains this address (won't persist source code).
  if (!ADMIN_EMAILS.some(e => normalizeEmail(e) === normalized)) {
    try { ADMIN_EMAILS.push(normalized); } catch (e) { /* ignore */ }
  }

  const users = getStoredUsersSafe();
  const idx = users.findIndex(u => normalizeEmail(u.email) === normalized);
  if (idx === -1) { showNotification('User not found in local storage.', { type: 'error' }); return; }

  users[idx].role = 'admin';
  users[idx].roleUpdatedAt = Date.now();
  users[idx].updatedAt = Date.now();
  users[idx].lastActiveAt = Date.now();
  setStoredUsers(users);
  try { upsertUserInCloud(users[idx]); } catch (e) { /* ignore cloud failures */ }
  syncCurrentSessionIfNeeded(users[idx]);
  renderAdminDashboard(false);
  showNotification(`${email} granted admin rights.`, { type: 'success' });
}

window.adminGrantAdmin = adminGrantAdmin;

function adminValidateActions() {
  const role = getCurrentUserRole();
  const isAdmin = isAdminUser();
  const viewMode = getCurrentViewMode();
  const canManage = hasManagementAccess();
  const sampleChecks = {
    addPoints: canManageAction('addPoints'),
    resetPassword: canManageAction('resetPassword'),
    resetProgress: canManageAction('resetProgress'),
    viewProgress: canManageAction('viewProgress'),
    openUi: canManageAction('openUi')
  };
  const result = { role, isAdmin, viewMode, canManage, sampleChecks, currentUser: currentUser ? { email: currentUser.email, id: currentUser.id } : null };
  console.info('adminValidateActions:', result);
  showNotification(`Role: ${role}, View: ${viewMode}`, { type: 'info', duration: 4000 });
  return result;
}

window.adminValidateActions = adminValidateActions;

/**
 * Non-invasive tracer for admin-related permissions.
 * Returns an object mapping action keys to permission checks without executing actions.
 */
function adminTraceActions() {
  const actions = ['addPoints','resetPassword','resetProgress','viewProgress','openUi','restore','changeRole','setTaskCompletion','setStreakDays','grantAdmin'];
  const role = getCurrentUserRole();
  const isAdmin = isAdminUser();
  const viewMode = getCurrentViewMode();
  const canManage = hasManagementAccess();
  const checks = {};
  actions.forEach(actionKey => {
    checks[actionKey] = {
      canManageAction: canManageAction(actionKey),
      hasManagementAccess: canManage,
      isAdmin: isAdmin,
      viewMode: viewMode
    };
  });
  console.info('adminTraceActions', { role, isAdmin, viewMode, canManage, checks });
  return { role, isAdmin, viewMode, canManage, checks };
}

window.adminTraceActions = adminTraceActions;

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

function adminSetJoinedDate(userId, dateValue) {
  if (!assertAdminDashboardAccess()) return;
  if (getCurrentUserRole() !== 'admin') { showNotification('Only admin can edit registration date.', { type: 'error' }); renderAdminDashboard(false); return; }
  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) { showNotification('User not found.', { type: 'error' }); renderAdminDashboard(false); return; }
  // dateValue expected in YYYY-MM-DD from input[type=date]
  if (typeof dateValue === 'string' && dateValue.length > 0) {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) {
      showNotification('Invalid date provided.', { type: 'error' }); return;
    }
    users[userIndex].joinedDate = parsed.toLocaleDateString();
  } else {
    users[userIndex].joinedDate = '';
  }
  users[userIndex].updatedAt = Date.now();
  users[userIndex].lastActiveAt = Date.now();
  setStoredUsers(users);
  upsertUserInCloud(users[userIndex]);
  syncCurrentSessionIfNeeded(users[userIndex]);
  renderAdminDashboard(false);
  showNotification(`Registered date updated for ${users[userIndex].email}.`, { type: 'success' });
}

window.adminSetJoinedDate = adminSetJoinedDate;
// Note: registered/joined date editing removed from table per UI requirements.
