// Growing Seed — Initialization, Logo Injection & Event Listeners

// --- Logo helpers ---

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
  if (!targetEl) return null;
  let container = targetEl.classList && targetEl.classList.contains(containerClass)
    ? targetEl
    : targetEl.querySelector(`.${containerClass}`);
  if (!container) {
    container = document.createElement('div');
    container.className = containerClass;
    container.setAttribute('aria-label', ariaLabel);
    targetEl.appendChild(container);
  }
  if (!container.querySelector('img[data-logo-file="ABCF.png"]')) {
    container.appendChild(createLogoWrapElement('ABCF.png', 'ABCF logo'));
  }
  if (!container.querySelector('img[data-logo-file="Pulse.png"]')) {
    container.appendChild(createLogoWrapElement('Pulse.png', 'Pulse logo'));
  }
  return container;
}

function ensureLogosInjected() {
  const authTopRightLogos = document.querySelector('#authContainer .auth-mobile-logos');
  if (authTopRightLogos) authTopRightLogos.remove();

  const loginCard = document.querySelector('#loginScreen .auth-card');
  if (loginCard) {
    let loginLogoRow = loginCard.querySelector('.auth-card-logos');
    if (!loginLogoRow) {
      loginLogoRow = document.createElement('div');
      loginLogoRow.className = 'auth-card-logos';
      loginLogoRow.setAttribute('aria-label', 'Login logos');
      const loginTitle = loginCard.querySelector('h1');
      if (loginTitle) loginCard.insertBefore(loginLogoRow, loginTitle);
      else {
        const loginForm = loginCard.querySelector('#loginForm');
        if (loginForm) loginCard.insertBefore(loginLogoRow, loginForm);
        else loginCard.appendChild(loginLogoRow);
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
      if (headerTitle) titleWithLogos.appendChild(headerTitle);
      const headerRight = appHeader.querySelector('.header-right');
      if (headerRight) appHeader.insertBefore(titleWithLogos, headerRight);
      else appHeader.appendChild(titleWithLogos);
    }
    ensureLogoContainer(titleWithLogos, 'mobile-header-logos', 'Header logos');
  }
}

async function resolveLogoSources() {
  const logoEls = Array.from(document.querySelectorAll('.mobile-header-logo[data-logo-file]'));
  if (logoEls.length === 0) return;
  const basePath = window.location.pathname.replace(/[^/]*$/, '');
  await Promise.all(logoEls.map(async logoEl => {
    const logoFile = logoEl.getAttribute('data-logo-file');
    if (!logoFile) return;
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
        if (wrapper) wrapper.classList.add('logo-loaded');
        return;
      }
    }
  }));
}

// --- App initialization ---

async function initializeApp() {
  initializeCloudDatabase();
  initializeFirebaseAuth();
  await applyEmailCorrections();
  await migrateLocalUsersToCloudOnce();
  await syncUsersFromCloudToLocal();
  enforceAdminRoleInStorage();

  if (!localStorage.getItem(NOTIFICATION_PREFERENCE_KEY)) {
    setAppNotificationEnabled(true);
  }

  currentUser = localStorage.getItem('currentUser');
  hasAutoPromptedDailyLogin = false;

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
      currentUser = { ...currentUser, ...users[currentIndex] };
      delete currentUser.password;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
    await runRollbackRecoveryForCurrentUserOnce();
    showAppInterface();
    loadUserData();
    updateDisplay({ persist: false });
    autoPromptDailyLoginIfPending();
    startCurrentUserCloudSync();
    startScheduledReminders();
    startInactivityTimer();
  } else {
    stopInactivityTimer();
    stopCurrentUserCloudSync();
    resetGameState();
    showAuthInterface();
    stopScheduledReminders();
  }
}

// --- Event listeners ---

window.addEventListener('resize', syncProfilePillVisibilityForViewport);

window.addEventListener('click', function(event) {
  const uploadModal = document.getElementById('uploadModal');
  const dailyLoginModal = document.getElementById('dailyLoginModal');
  const leaderboardModal = document.getElementById('leaderboardModal');
  if (uploadModal && event.target === uploadModal) closeUploadModal();
  if (dailyLoginModal && event.target === dailyLoginModal) closeDailyLoginModal();
  if (leaderboardModal && event.target === leaderboardModal) closeLeaderboardModal();
});

window.addEventListener('storage', function(event) {
  if (!currentUser || event.key !== 'users' || !event.newValue) return;
  try {
    const updatedUsers = JSON.parse(event.newValue);
    if (!Array.isArray(updatedUsers)) return;
    const updatedUserIndex = findUserIndexForSession(updatedUsers, currentUser);
    const updatedUser = updatedUserIndex !== -1 ? updatedUsers[updatedUserIndex] : null;
    if (updatedUser && haveCloudUserStateDifferences(currentUser, updatedUser)) {
      syncCurrentSessionIfNeeded(updatedUser, { persist: false });
    }
  } catch (e) { /* ignore JSON parse errors */ }
});

window.addEventListener('DOMContentLoaded', function() {
  ensureLogosInjected();
  resolveLogoSources();
  ensureDailyLoginUi();
  removeLegacyAdminFaithPointsCard();

  // Photo preview
  const photoInput = document.getElementById('photoInput');
  if (photoInput) {
    photoInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      const submitPhotoBtn = document.getElementById('submitPhotoBtn');
      if (submitPhotoBtn) submitPhotoBtn.disabled = !file;
      if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
          const preview = document.getElementById('photoPreview');
          if (preview) { preview.src = event.target.result; preview.style.display = 'block'; }
        };
        reader.readAsDataURL(file);
      } else {
        const preview = document.getElementById('photoPreview');
        if (preview) { preview.style.display = 'none'; preview.removeAttribute('src'); }
      }
    });
  }

  initializeApp();
});
