// Align daily check-in 'today' to task refresh boundary:
function getTodayDateKey() {
    return getDateKeyFromDate(getTaskPeriodReferenceNow());
}

function refreshDailyLoginState() {
    const today = getTaskPeriodReferenceNow();
    // rest of the function code... 
}

// Make login streak strictly actual login (not 7-day check-in):
function getUserCurrentLoginStreak(user) {
    const parsed = Math.floor(Number(user?.loginStreakCurrent));
    return Math.max(1, parsed);
}

function getUserLongestLoginStreak(user) {
    return Math.max(user.loginStreakLongest, user.loginStreakCurrent, 1);
}

// Leaderboard will automatically use the updated login streak

// Admin dashboard streak column should use real login streak:
function renderAdminDashboard() {
    const streak = getUserCurrentLoginStreak(user);
    // rest of the function code...
}

// For admin editing control (adminSetStreakDays)...
function adminSetStreakDays() {
    // Keep existing behavior... but change label/value to 'loginStreak' in table.
}