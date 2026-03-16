const puppeteer = require('puppeteer');
const HOST = 'http://127.0.0.1:8001/';

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

async function run() {
  const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.text()));

  const todayKey = getTodayKey();

  const users = [
    {
      id: Date.now() + 1,
      name: 'Ivan',
      email: 'ivan@example.test',
      role: 'user',
      viewMode: 'user',
      joinedDate: new Date().toLocaleDateString(),
      lastLogin: new Date().toLocaleString(),
      lastLoginDateKey: todayKey,
      loginStreakCurrent: 1,
      dailyLoginState: { streakDay: 2, lastClaimDate: todayKey, cycleStartDate: todayKey, claimedDays: [1] },
      faithPoints: 5,
      treeProgress: 10
    },
    {
      id: Date.now() + 2,
      name: 'Ivan Galarpe',
      email: 'ivan.g@example.test',
      role: 'user',
      viewMode: 'user',
      joinedDate: new Date().toLocaleDateString(),
      lastLogin: new Date().toLocaleString(),
      lastLoginDateKey: todayKey,
      loginStreakCurrent: 1,
      dailyLoginState: { streakDay: 2, lastClaimDate: todayKey, cycleStartDate: todayKey, claimedDays: [1] },
      faithPoints: 8,
      treeProgress: 25
    }
  ];

  for (const u of users) {
    console.log('--- Testing user:', u.name, u.email);
    await page.goto(HOST, { waitUntil: 'networkidle2' });
    // Inject users and clear currentUser
    await page.evaluate((user) => {
      localStorage.setItem('users', JSON.stringify([user]));
      localStorage.removeItem('currentUser');
    }, u);

    // Reload
    await page.goto(HOST, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 600));

    // Rehydrate session from localStorage and open app UI
    const result = await page.evaluate(() => {
      try {
        const cur = JSON.parse(localStorage.getItem('users') || '[]')[0] || null;
        if (cur) {
          // set currentUser and call app rehydration helpers if available
          localStorage.setItem('currentUser', JSON.stringify(cur));
          try { currentUser = JSON.parse(localStorage.getItem('currentUser')); } catch(e){}
          if (typeof loadUserData === 'function') loadUserData();
          if (typeof updateDisplay === 'function') updateDisplay({ persist: false });
          if (typeof showAppInterface === 'function') showAppInterface();
        }

        // Open daily check modal and read display text
        if (typeof openDailyLoginModal === 'function') openDailyLoginModal();
        const dailyTextEl = document.getElementById('dailyRewardStreakText');
        const dailyText = dailyTextEl ? dailyTextEl.textContent.trim() : null;

        // Open leaderboard modal (login streak board)
        if (typeof openLeaderboardModal === 'function') openLeaderboardModal('leaderboard');
        const leaderboardModal = document.getElementById('leaderboardModal');
        const leaderboardVisible = leaderboardModal && leaderboardModal.style.display && leaderboardModal.style.display !== 'none';
        const leaderboardItems = Array.from(document.querySelectorAll('#publicBoardBody .public-board-item')).map(li => li.textContent.trim());

        // Switch to ranking (tree progress) and capture items
        if (typeof switchPublicBoardType === 'function') switchPublicBoardType('ranking');
        const rankingItems = Array.from(document.querySelectorAll('#publicBoardBody .public-board-item')).map(li => li.textContent.trim());

        // Open profile modal
        if (typeof openProfileModal === 'function') openProfileModal();
        const profileModal = document.getElementById('profileModal');
        const profileVisible = profileModal && profileModal.style.display && profileModal.style.display !== 'none';
        const profileName = document.getElementById('profileName') ? document.getElementById('profileName').textContent.trim() : null;
        const profileEmail = document.getElementById('profileEmail') ? document.getElementById('profileEmail').textContent.trim() : null;
        const profileJoined = document.getElementById('profileJoined') ? document.getElementById('profileJoined').textContent.trim() : null;

        return {
          dailyText,
          leaderboardVisible,
          leaderboardCount: leaderboardItems.length,
          leaderboardItems,
          rankingCount: rankingItems.length,
          rankingItems,
          profileVisible,
          profileName,
          profileEmail,
          profileJoined
        };
      } catch (err) {
        return { error: String(err) };
      }
    });

    console.log('Result for', u.name, ':', result);
    // close modals to reset state
    await page.evaluate(() => { try { closeDailyLoginModal(); } catch(e){} try { closeLeaderboardModal(); } catch(e){} });
    await new Promise(r => setTimeout(r, 300));
  }

  await browser.close();
}

run().catch(err => { console.error(err); process.exit(2); });
