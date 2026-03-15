function getTodayDateKey() { return getTaskPeriodReferenceNow(); }

function refreshDailyLoginState() { today = getTaskPeriodReferenceNow(); }

function getUserCurrentLoginStreak() { return loginStreakCurrent > 0 ? parsedLoginStreakCurrent : 1; }

function getUserLongestLoginStreak() { return { longest: loginStreakLongest, current: loginStreakCurrent }; }

function renderAdminDashboard() { let streak = getUserCurrentLoginStreak(user); }