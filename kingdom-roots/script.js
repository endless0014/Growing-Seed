// Authentication System
let currentUser = null;
const RETAINED_TEST_EMAIL = 'endlesssh0014@gmail.com';
const ADMIN_EMAILS = ['endlesssh0014@gmail.com', 'endlessssh0014@gmail.com', 'endless0014@gmail.com'];

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

function enforceAdminRoleInStorage() {
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const safeUsers = Array.isArray(users) ? users : [];
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
    localStorage.setItem('users', JSON.stringify(normalizedUsers));
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

function retainOnlyTestUserDataOnce() {
  return;
}

// Initialize app
function initializeApp() {
  enforceAdminRoleInStorage();
  currentUser = localStorage.getItem('currentUser');
  
  if (currentUser) {
    currentUser = JSON.parse(currentUser);
    showAppInterface();
    loadUserData();
    updateDisplay();
  } else {
    resetGameState();
    showAuthInterface();
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

  if (isAdminView) {
    renderAdminDashboard();
  }
}

function toggleAdminView() {
  if (getRoleByEmail(currentUser?.email) === 'admin' && currentUser?.role !== 'admin') {
    currentUser.role = 'admin';
  }

  if (!isAdminUser()) {
    alert('Only admin users can switch to admin view.');
    return;
  }

  currentUser.viewMode = getCurrentViewMode() === 'admin' ? 'user' : 'admin';
  applyViewModeUI();
  saveUserData();
}

function renderAdminDashboard() {
  if (!isAdminUser() || getCurrentViewMode() !== 'admin') {
    return;
  }

  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const safeUsers = Array.isArray(users) ? users : [];

  const totalUsers = safeUsers.length;
  const totalFaithPoints = safeUsers.reduce((sum, user) => {
    const value = Number(user.faithPoints ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const totalAdmins = safeUsers.filter(user => getRoleByEmail(user.email) === 'admin').length;

  const totalUsersEl = document.getElementById('adminTotalUsers');
  const totalFaithPointsEl = document.getElementById('adminTotalFaithPoints');
  const totalAdminsEl = document.getElementById('adminTotalAdmins');

  if (totalUsersEl) totalUsersEl.textContent = String(totalUsers);
  if (totalFaithPointsEl) totalFaithPointsEl.textContent = String(Math.floor(totalFaithPoints));
  if (totalAdminsEl) totalAdminsEl.textContent = String(totalAdmins);

  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) {
    return;
  }

  if (safeUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">No users found.</td></tr>';
    return;
  }

  tbody.innerHTML = safeUsers
    .map(user => {
      const role = getRoleByEmail(user.email);
      const name = escapeHtml(user.name || 'N/A');
      const email = escapeHtml(user.email || 'N/A');
      const faithPoints = Math.floor(Number(user.faithPoints ?? 0) || 0);
      const treeProgress = Math.floor(Number(user.treeProgress ?? 0) || 0);
      const userId = Number(user.id);
      return `
        <tr>
          <td>${name}</td>
          <td>${email}</td>
          <td><span class="admin-role-badge ${role}">${role}</span></td>
          <td>${faithPoints}</td>
          <td>${treeProgress}</td>
          <td>
            <div class="admin-actions">
              <button class="admin-action-btn points" onclick="adminAddPoints(${userId})">+Points</button>
              <button class="admin-action-btn password" onclick="adminResetPassword(${userId})">Reset PW</button>
              <button class="admin-action-btn progress" onclick="adminResetProgress(${userId})">Reset Progress</button>
              <button class="admin-action-btn view" onclick="adminViewProgress(${userId})">View</button>
              <button class="admin-action-btn open" onclick="adminOpenUserUi(${userId})">Open UI</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function assertAdminDashboardAccess() {
  if (!isAdminUser() || getCurrentViewMode() !== 'admin') {
    alert('Admin dashboard access required.');
    return false;
  }
  return true;
}

function getStoredUsersSafe() {
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  return Array.isArray(users) ? users : [];
}

function setStoredUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

function findUserIndexById(users, userId) {
  return users.findIndex(user => Number(user.id) === Number(userId));
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

function adminAddPoints(userId) {
  if (!assertAdminDashboardAccess()) return;

  const pointsInput = prompt('Enter points to add:', '10');
  if (pointsInput === null) return;

  const points = Number(pointsInput);
  if (!Number.isFinite(points) || points <= 0) {
    alert('Please enter a valid positive number.');
    return;
  }

  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) {
    alert('User not found.');
    return;
  }

  users[userIndex].faithPoints = Math.floor(Number(users[userIndex].faithPoints ?? 0) + points);
  setStoredUsers(users);
  syncCurrentSessionIfNeeded(users[userIndex]);
  renderAdminDashboard();
}

function adminResetPassword(userId) {
  if (!assertAdminDashboardAccess()) return;

  const newPassword = prompt('Enter new password (min 6 characters):', 'password123');
  if (newPassword === null) return;

  if (newPassword.length < 6) {
    alert('Password must be at least 6 characters.');
    return;
  }

  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) {
    alert('User not found.');
    return;
  }

  users[userIndex].password = newPassword;
  setStoredUsers(users);
  alert(`Password reset for ${users[userIndex].email}`);
}

function adminResetProgress(userId) {
  if (!assertAdminDashboardAccess()) return;

  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) {
    alert('User not found.');
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

  setStoredUsers(users);
  syncCurrentSessionIfNeeded(users[userIndex]);
  renderAdminDashboard();
}

function adminViewProgress(userId) {
  if (!assertAdminDashboardAccess()) return;

  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) {
    alert('User not found.');
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

  alert(progressMessage);
}

function adminOpenUserUi(userId) {
  if (!assertAdminDashboardAccess()) return;

  const users = getStoredUsersSafe();
  const userIndex = findUserIndexById(users, userId);
  if (userIndex === -1) {
    alert('User not found.');
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
}

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

function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const normalizedEmail = normalizeEmail(email);
  
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const user = users.find(
    u => normalizeEmail(u.email) === normalizedEmail && u.password === password
  );
  
  if (user) {
    currentUser = {
      ...user,
      role: getRoleByEmail(user.email),
      viewMode: isAdminEmail(user.email) ? 'admin' : (user.viewMode ?? 'user'),
      faithPoints: user.faithPoints ?? 0,
      treeProgress: user.treeProgress ?? 0,
      passiveRate: user.passiveRate ?? 1,
      fruitCount: user.fruitCount ?? 0,
      pointsForFruit: user.pointsForFruit ?? 0,
      maxBloomReached: user.maxBloomReached ?? false,
      taskCompletions: user.taskCompletions ?? {}
    };
    delete currentUser.password;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    clearAuthErrors();
    showAppInterface();
    loadUserData();
    updateDisplay();
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
    faithPoints: 0,
    treeProgress: 0,
    passiveRate: 1,
    fruitCount: 0,
    pointsForFruit: 0,
    maxBloomReached: false,
    taskCompletions: {}
  };
  
  users.push(newUser);
  localStorage.setItem('users', JSON.stringify(users));
  
  currentUser = { ...newUser };
  delete currentUser.password;
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  
  clearAuthErrors();
  document.getElementById('registerForm').reset();
  showAppInterface();
  resetGameState();
  updateDisplay();
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
  alert(`Reset code sent to ${email}:\n\nCode: ${resetCode}\n\n(In a real app, this would be sent via email)`);
  
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
    localStorage.setItem('users', JSON.stringify(users));
    
    // Clear reset request
    delete resetRequests[email];
    localStorage.setItem('resetRequests', JSON.stringify(resetRequests));
    
    alert('Password reset successfully! Please login with your new password.');
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
  localStorage.setItem('users', JSON.stringify(users));
  
  alert('Password changed successfully!');
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
      localStorage.setItem('users', JSON.stringify(filteredUsers));
      
      alert('Account deleted successfully');
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

// Game Logic
let faithPoints = 0;
let treeProgress = 0;
let passiveRate = 1;
let upgradeCost = 10;
let currentAction = '';
let html5QrcodeScanner = null;
let isQrScannerRunning = false;
let maxBloomReached = false;
let pointsForFruit = 0;
let fruitCount = 0;
let taskCompletions = {};
const FULL_BLOOM_THRESHOLD = 1500;

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
}

const scriptures = [
  "The kingdom of God is like a mustard seed... – Matthew 13:31",
  "I am the vine; you are the branches. – John 15:5",
  "Let your roots grow down into Him. – Colossians 2:7",
  "Those who trust in the Lord will renew their strength. – Isaiah 40:31"
];

const actionRewards = {
  'pray': { fp: 1, fpMultiplier: 10, bonus: 0, name: 'Prayer' },
  'bible': { fp: 1, fpMultiplier: 10, bonus: 0, name: 'Bible Reading' },
  'devotion': { fp: 3, fpMultiplier: 10, bonus: 0, name: 'Devotional Time' },
  'smallgroup': { fp: 3, fpMultiplier: 10, bonus: 0, name: 'Small Group' },
  'attendService': { fp: 5, fpMultiplier: 10, bonus: 0, name: 'Selfie with the Pastor' },
  'sharegospel': { fp: 10, fpMultiplier: 10, bonus: 0, name: 'Share Gospel' }
};

const taskRecurrenceRules = {
  pray: { unit: 'day', label: 'once per day' },
  bible: { unit: 'day', label: 'once per day' },
  devotion: { unit: 'day', label: 'once per day' },
  smallgroup: { unit: 'week', label: 'once per week' },
  attendService: { unit: 'week', label: 'once per week' }
};

const taskDisplayNames = {
  pray: 'Pray',
  bible: 'Read Bible',
  devotion: 'Devotion',
  smallgroup: 'Small Group',
  attendService: 'Selfie with the Pastor'
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

function getCurrentPeriodKey(unit) {
  const now = new Date();
  if (unit === 'week') {
    return getYearWeekKey(now);
  }
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function canCompleteTask(taskKey) {
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
      users[userIndex].viewMode = getCurrentViewMode();
      
      localStorage.setItem('users', JSON.stringify(users));
      
      // Also update current user session with all game data
      currentUser.faithPoints = Math.floor(faithPoints);
      currentUser.treeProgress = Math.floor(treeProgress);
      currentUser.passiveRate = passiveRate;
      currentUser.fruitCount = fruitCount;
      currentUser.pointsForFruit = pointsForFruit;
      currentUser.maxBloomReached = maxBloomReached;
      currentUser.taskCompletions = taskCompletions;
      currentUser.viewMode = getCurrentViewMode();
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
  currentUser.viewMode = currentUser.viewMode ?? (isAdminUser() ? 'admin' : 'user');

  if (!Number.isFinite(faithPoints)) faithPoints = 0;
  if (!Number.isFinite(treeProgress)) treeProgress = 0;
  if (!Number.isFinite(passiveRate) || passiveRate < 1) passiveRate = 1;
  if (!Number.isFinite(fruitCount) || fruitCount < 0) fruitCount = 0;
  if (!Number.isFinite(pointsForFruit) || pointsForFruit < 0) pointsForFruit = 0;
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
  const recurrenceCheck = canCompleteTask(action);
  if (!recurrenceCheck.allowed) {
    alert(recurrenceCheck.message);
    return;
  }

  currentAction = action;
  const reward = actionRewards[action];
  document.getElementById("actionName").textContent = reward.name;
  document.getElementById("photoInput").value = '';
  document.getElementById("photoPreview").style.display = 'none';
  const modal = document.getElementById("uploadModal");
  modal.style.display = 'flex';
  console.log('Modal opened for:', action);
}

function closeUploadModal() {
  console.log('Closing modal');
  const modal = document.getElementById("uploadModal");
  modal.style.display = 'none';
  currentAction = '';
}

function submitPhoto() {
  const recurrenceCheck = canCompleteTask(currentAction);
  if (!recurrenceCheck.allowed) {
    alert(recurrenceCheck.message);
    closeUploadModal();
    return;
  }

  const reward = actionRewards[currentAction];
  const pointsToAdd = reward.fp * reward.fpMultiplier;
  applyTreeProgress(pointsToAdd);

  markTaskCompleted(currentAction, recurrenceCheck.periodKey);
  showScripture();
  updateDisplay();
  closeUploadModal();
}

async function stopQrScannerInstance() {
  if (!html5QrcodeScanner) {
    return;
  }

  try {
    if (isQrScannerRunning) {
      await html5QrcodeScanner.stop();
    }
  } catch (error) {
    console.warn('QR stop warning:', error);
  }

  try {
    await html5QrcodeScanner.clear();
  } catch (error) {
    console.warn('QR clear warning:', error);
  }

  html5QrcodeScanner = null;
  isQrScannerRunning = false;
}

async function openQrScanner() {
  const recurrenceCheck = canCompleteTask('attendService');
  if (!recurrenceCheck.allowed) {
    alert(recurrenceCheck.message);
    return;
  }

  console.log('Opening QR Scanner');
  document.getElementById("qrModal").style.display = 'flex';
  document.getElementById("qr-status").textContent = "Initializing camera...";
  document.getElementById("qr-status").style.color = "#333";

  if (!window.isSecureContext) {
    document.getElementById("qr-status").textContent = "Camera requires HTTPS. Please open the secure app URL.";
    document.getElementById("qr-status").style.color = "red";
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    document.getElementById("qr-status").textContent = "Camera is not supported on this browser/device.";
    document.getElementById("qr-status").style.color = "red";
    return;
  }

  const qrReader = document.getElementById("qr-reader");
  if (qrReader) {
    qrReader.innerHTML = '';
  }
  
  await stopQrScannerInstance();
  
  // Start new scanner
  html5QrcodeScanner = new Html5Qrcode("qr-reader");
  const scannerConfig = {
    fps: 10,
    qrbox: { width: 250, height: 250 }
  };

  const setReadyStatus = () => {
    document.getElementById("qr-status").textContent = "Camera ready. Scan church QR code.";
    document.getElementById("qr-status").style.color = "#2e7d32";
  };

  try {
    await html5QrcodeScanner.start(
      { facingMode: { ideal: "environment" } },
      scannerConfig,
      onQrCodeSuccess,
      onQrCodeError
    );
    isQrScannerRunning = true;
    setReadyStatus();
    return;
  } catch (primaryError) {
    console.warn('Primary camera start failed, trying fallback cameras:', primaryError);
  }
  
  try {
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras || cameras.length === 0) {
      throw new Error('No cameras found on this device.');
    }

    await html5QrcodeScanner.start(
      cameras[0].id,
      scannerConfig,
      onQrCodeSuccess,
      onQrCodeError
    );
    isQrScannerRunning = true;
    setReadyStatus();
  } catch (fallbackError) {
    console.error('Failed to start scanner:', fallbackError);
    document.getElementById("qr-status").textContent = "Unable to start camera. Allow camera permission and retry.";
    document.getElementById("qr-status").style.color = "red";
  }
}

async function onQrCodeSuccess(decodedText, decodedResult) {
  console.log('QR Code detected:', decodedText);
  
  // Check if QR contains church-related keywords
  const isChurchQr = decodedText.toLowerCase().includes('church') || 
                     decodedText.toLowerCase().includes('service') ||
                     decodedText.toLowerCase().includes('attendance');
  
  if (isChurchQr) {
    const recurrenceCheck = canCompleteTask('attendService');
    if (!recurrenceCheck.allowed) {
      document.getElementById("qr-status").textContent = recurrenceCheck.message;
      document.getElementById("qr-status").style.color = "orange";
      return;
    }

    document.getElementById("qr-status").textContent = "✓ Valid Church QR Code! Service points awarded!";
    document.getElementById("qr-status").style.color = "green";
    
    // Award points (5 * 10 = 50)
    const pointsToAdd = 5 * 10;
    applyTreeProgress(pointsToAdd);

    markTaskCompleted('attendService', recurrenceCheck.periodKey);
    showScripture();
    updateDisplay();
    
    await stopQrScannerInstance();

    // Close modal after success
    setTimeout(() => {
      closeQrScanner();
    }, 2000);
  } else {
    document.getElementById("qr-status").textContent = "⚠ Invalid QR code. Please scan a church QR code.";
    document.getElementById("qr-status").style.color = "orange";
  }
}

function onQrCodeError(error) {
  // Silently ignore scanning errors
  console.log('Scanning error:', error);
}

async function closeQrScanner() {
  console.log('Closing QR Scanner');

  await stopQrScannerInstance();
  
  document.getElementById("qrModal").style.display = 'none';
  document.getElementById("qr-status").textContent = "";
}

function shareGospel() {
  const pointsToAdd = 10 * 10;
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
      ? `Blessed! You grew ${pointsUsed} Fruits for the Kingdom! 🍎` 
      : `Blessed! You distributed ${pointsUsed} Faith Points to the Kingdom! 🙏`;
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
    alert('Points must be divisible by 10 to use!');
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
    }
  });
}

// Close modal when clicking outside of it
window.addEventListener('click', function(event) {
  const uploadModal = document.getElementById('uploadModal');
  const qrModal = document.getElementById('qrModal');
  
  if (uploadModal && event.target === uploadModal) {
    closeUploadModal();
  }
  
  if (qrModal && event.target === qrModal) {
    closeQrScanner();
  }
});

// Initialize app on page load
window.addEventListener('DOMContentLoaded', function() {
  initializeApp();
});
