// Headless test for daily check-in logic
const DAILY_LOGIN_REWARDS = [2,2,3,4,5,6,8];
function getDateKeyFromDate(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
function getTodayDateKey(){ return getDateKeyFromDate(new Date()); }
function getDaysBetween(startDate, endDate) {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
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
  const normalizeDateValue = raw => {
    if (raw === null || raw === undefined) return '';
    const s = String(raw).trim();
    if (!s) return '';
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
    claimedDays: Array.from(new Set(claimedDays)).sort((a,b)=>a-b)
  };
}
let dailyLoginState = normalizeDailyLoginState({});
let faithPoints = 0;
function hasClaimedDailyLoginToday(){ return dailyLoginState.lastClaimDate === getTodayDateKey(); }
function canClaimDailyLoginDay(dayNumber){ const todayClaimed = hasClaimedDailyLoginToday(); return dayNumber === dailyLoginState.streakDay && !todayClaimed; }
function claimDailyLogin(dayNumber){
  if (!canClaimDailyLoginDay(dayNumber)) return {ok:false,reason:'cannot claim'};
  const reward = DAILY_LOGIN_REWARDS[dayNumber-1]||0;
  faithPoints += reward;
  const isFinalDay = dayNumber >= DAILY_LOGIN_REWARDS.length;
  if (isFinalDay) faithPoints += 20;
  const todayKey = getTodayDateKey();
  if (!dailyLoginState.cycleStartDate) dailyLoginState.cycleStartDate = todayKey;
  dailyLoginState.lastClaimDate = todayKey;
  if (!dailyLoginState.claimedDays.includes(dayNumber)){
    dailyLoginState.claimedDays.push(dayNumber);
    dailyLoginState.claimedDays.sort((a,b)=>a-b);
  }
  if (isFinalDay){ dailyLoginState.streakDay=1; dailyLoginState.claimedDays=[]; dailyLoginState.cycleStartDate=''; }
  else { dailyLoginState.streakDay = dayNumber + 1; }
  return {ok:true,reward,faithPoints,dailyLoginState};
}

console.log('Initial dailyLoginState:', dailyLoginState);
console.log('Can claim day 1?', canClaimDailyLoginDay(1));
console.log('Claiming day 1...');
console.log(claimDailyLogin(1));
console.log('After claim - faithPoints:', faithPoints);
console.log('Try to claim day 1 again (should fail):', claimDailyLogin(1));
// Simulate yesterday claimed -> dailyLoginState.lastClaimDate = yesterday
const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
dailyLoginState = normalizeDailyLoginState({ lastClaimDate: yesterday.toString(), streakDay: 2, claimedDays: [1] });
console.log('\nSimulated yesterday state:', dailyLoginState);
console.log('Can claim day 2?', canClaimDailyLoginDay(2));
console.log('Claiming day 2...');
console.log(claimDailyLogin(2));
console.log('Final faithPoints:', faithPoints);
process.exit(0);
