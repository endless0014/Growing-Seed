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
let beginnerWalkthroughStep = 0;
const BEGINNER_WALKTHROUGH_KEY = 'growingSeedBeginnerWalkthroughSeenV1';
const BEGINNER_WALKTHROUGH_STEPS = [
  {
    icon: '🎁',
    title: 'Claim your daily reward',
    body: 'Start each day by tapping the Claim Reward button. This gives you a streak bonus and keeps your progress moving.',
    bullets: ['Come back daily for better rewards', 'Your streak helps your growth']
  },
  {
    icon: '🙏',
    title: 'Complete faith activities',
    body: 'Use the Faith Activities buttons to earn Faith Points. Prayer, Bible reading, devotion, and worship all help your tree grow.',
    bullets: ['Each activity gives you FP', 'Some tasks refresh daily or weekly']
  },
  {
    icon: '🌱',
    title: 'Watch your tree grow',
    body: 'Every point you earn brings your tree to the next stage. The progress bar shows how close you are to the next step.',
    bullets: ['New stages appear as you grow', 'The tree is your visual progress meter']
  },
  {
    icon: '🌿',
    title: 'Upgrade your roots',
    body: 'When you have enough Faith Points, open Upgrade Roots to boost your growth and make future progress faster.',
    bullets: ['Spend FP to strengthen your growth', 'Use upgrades when the tree feels slow']
  },
  {
    icon: '🔁',
    title: 'Keep the habit going',
    body: 'The best way to play is to return often, finish a few tasks, and stay consistent. Small steps still grow a strong tree.',
    bullets: ['Consistency matters more than big bursts', 'You can reopen this guide anytime']
  }
];

// --- Seed Nurturing System ---
let activeSeed = null; // { seedType, stage, daysElapsed, nurtureProgress, nurtureActionsToday, lastActionDate, activeChallenge, challengeDaysLeft }
let seedHistory = []; // Track harvested seeds for stats

const SEED_TYPES = {
  faith: { name: 'Faith', icon: '✝️', verse: 'Matthew 17:20', meaning: 'Even small faith moves mountains', color: '#FF6B6B' },
  love: { name: 'Love', icon: '❤️', verse: '1 Corinthians 13:13', meaning: 'Greatest seed of all virtues', color: '#FF69B4' },
  hope: { name: 'Hope', icon: '🌈', verse: 'Romans 5:5', meaning: 'Hope does not disappoint', color: '#4ECDC4' },
  peace: { name: 'Peace', icon: '☮️', verse: 'James 3:18', meaning: 'Peace sown yields righteousness', color: '#A8E6CF' },
  joy: { name: 'Joy', icon: '😊', verse: 'Galatians 5:22', meaning: 'Joy is fruit of the Spirit', color: '#FFE66D' }
};

const NURTURE_ACTIONS = {
  water: { name: 'Water', cost: 5, fp: 1, description: 'Encouragement & prayer' },
  protect: { name: 'Protect', cost: 10, fp: 2, description: 'Guard against doubt' },
  fertilize: { name: 'Fertilize', cost: 15, fp: 3, description: 'Risk-taking & growth' }
};

const SEED_STAGES = [
  { stage: 0, name: 'Seed', minDays: 0, maxDays: 0, emoji: '🌾', daysEstimate: '0-1' },
  { stage: 1, name: 'Sprout', minDays: 1, maxDays: 3, emoji: '🌱', daysEstimate: '2-5' },
  { stage: 2, name: 'Seedling', minDays: 4, maxDays: 7, emoji: '🌿', daysEstimate: '5-10' },
  { stage: 3, name: 'Sapling', minDays: 8, maxDays: 12, emoji: '🌳', daysEstimate: '10-20' },
  { stage: 4, name: 'Young Tree', minDays: 13, maxDays: 18, emoji: '🌲', daysEstimate: '15-30' },
  { stage: 5, name: 'Mature Tree', minDays: 19, maxDays: 25, emoji: '🎄', daysEstimate: '25-30' }
];

const CHALLENGES = [
  { name: 'Storm', icon: '⛈️', description: 'A fierce storm tests your seed!' },
  { name: 'Pests', icon: '🦗', description: 'Insects threaten your plant!' },
  { name: 'Drought', icon: '🏜️', description: 'Dry spell challenges growth!' },
  { name: 'Frost', icon: '❄️', description: 'Unexpected cold snaps your plant!' },
  { name: 'Weeds', icon: '🌾', description: 'Weeds compete for resources!' }
];

const SEED_CHALLENGES = {
  faith: [
    { name: 'Doubt', icon: '❓', description: 'Waves of doubt test your conviction.' },
    { name: 'Fear', icon: '😨', description: 'Fear whispers that you cannot overcome.' },
    { name: 'Disbelief', icon: '🚫', description: 'The world mocks your faith.' },
    { name: 'Temptation', icon: '🍎', description: 'Easier paths tempt you away.' },
    { name: 'Darkness', icon: '🌑', description: 'Shadows cloud your vision of hope.' }
  ],
  love: [
    { name: 'Heartbreak', icon: '💔', description: 'Love faces rejection and pain.' },
    { name: 'Conflict', icon: '⚔️', description: 'Harsh words wound the heart.' },
    { name: 'Betrayal', icon: '🔪', description: 'Trust is broken by those you loved.' },
    { name: 'Selfishness', icon: '😤', description: 'Greed threatens to consume compassion.' },
    { name: 'Indifference', icon: '😐', description: 'The world grows cold and uncaring.' }
  ],
  hope: [
    { name: 'Despair', icon: '😔', description: 'Despair whispers that nothing will improve.' },
    { name: 'Disappointment', icon: '😞', description: 'Plans crumble, dreams fade away.' },
    { name: 'Hopelessness', icon: '⚫', description: 'The future seems impossible.' },
    { name: 'Lost Direction', icon: '🧭', description: 'You no longer know the way forward.' },
    { name: 'Emptiness', icon: '🕳️', description: 'A void threatens to consume your spirit.' }
  ],
  peace: [
    { name: 'Turmoil', icon: '🌪️', description: 'Inner chaos disrupts your tranquility.' },
    { name: 'Conflict', icon: '💢', description: 'Disputes and tensions rise around you.' },
    { name: 'Anxiety', icon: '😰', description: 'Worry floods your mind and heart.' },
    { name: 'Discord', icon: '🎵', description: 'Harsh voices drown out harmony.' },
    { name: 'Restlessness', icon: '⚡', description: 'You cannot find stillness or calm.' }
  ],
  joy: [
    { name: 'Sorrow', icon: '😢', description: 'Grief threatens to dampen your spirit.' },
    { name: 'Melancholy', icon: '🌧️', description: 'Sadness clouds your joy.' },
    { name: 'Emptiness', icon: '😕', description: 'Nothing brings delight anymore.' },
    { name: 'Loss', icon: '📴', description: 'Something precious has been taken.' },
    { name: 'Heaviness', icon: '⚙️', description: 'Burdens weigh down your heart.' }
  ]
};

const CHALLENGE_OPTIONS = {
  fight: { action: 'Fight', cost: 10, successRate: 0.7, reward: 30 },
  endure: { action: 'Endure', cost: 5, successRate: 1.0, reward: 15 },
  giveUp: { action: 'Give up', cost: 0, successRate: null, penalty: -1 }
};

const MAX_NURTURE_ACTIONS_PER_DAY = 3;
const CHALLENGE_TRIGGER_DAYS = { min: 2, max: 3 };
const STAGE_PROGRESSION_REQUIREMENTS = { min: 35, max: 50 }; // Progress points to advance stage (active: ~30 days, passive: ~60+ days)

function addSeedProgressToTree(pointsToAdd = 1) {
  if (!Number.isFinite(pointsToAdd) || pointsToAdd <= 0) return;
  applyTreeProgress(Math.round(pointsToAdd), { addFaithPoints: false });
}

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
  activeSeed = null;
  seedHistory = [];
}

function renderBeginnerWalkthroughStep(stepIndex = 0) {
  const contentEl = document.getElementById('walkthroughStepContent');
  const progressEl = document.getElementById('walkthroughProgress');
  const prevBtn = document.getElementById('walkthroughPrevBtn');
  const nextBtn = document.getElementById('walkthroughNextBtn');
  const subtitleEl = document.getElementById('walkthroughSubtitle');
  const safeStep = Math.max(0, Math.min(stepIndex, BEGINNER_WALKTHROUGH_STEPS.length - 1));
  const step = BEGINNER_WALKTHROUGH_STEPS[safeStep];

  if (!contentEl || !progressEl || !prevBtn || !nextBtn || !subtitleEl) return;

  beginnerWalkthroughStep = safeStep;
  subtitleEl.textContent = 'Start simple and grow your faith one step at a time.';
  contentEl.innerHTML = `
    <div class="walkthrough-step-icon">${step.icon}</div>
    <h3>${step.title}</h3>
    <p>${step.body}</p>
    <ul>
      ${step.bullets.map(item => `<li>${item}</li>`).join('')}
    </ul>
  `;

  progressEl.innerHTML = BEGINNER_WALKTHROUGH_STEPS.map((_, index) => `<span class="walkthrough-dot ${index === safeStep ? 'active' : ''}"></span>`).join('');
  prevBtn.disabled = safeStep === 0;
  nextBtn.textContent = safeStep === BEGINNER_WALKTHROUGH_STEPS.length - 1 ? 'Finish' : 'Next';
}

function openBeginnerWalkthroughModal(force = false) {
  const modal = document.getElementById('beginnerWalkthroughModal');
  if (!modal) return;

  const hasSeenGuide = localStorage.getItem(BEGINNER_WALKTHROUGH_KEY) === 'seen';
  if (!force && hasSeenGuide) {
    return;
  }

  beginnerWalkthroughStep = 0;
  renderBeginnerWalkthroughStep(0);
  modal.style.display = 'flex';
}

function closeBeginnerWalkthroughModal(markSeen = true) {
  const modal = document.getElementById('beginnerWalkthroughModal');
  if (!modal) return;

  modal.style.display = 'none';
  if (markSeen) {
    localStorage.setItem(BEGINNER_WALKTHROUGH_KEY, 'seen');
  }
}

function nextBeginnerWalkthroughStep() {
  if (beginnerWalkthroughStep >= BEGINNER_WALKTHROUGH_STEPS.length - 1) {
    closeBeginnerWalkthroughModal(true);
    return;
  }

  renderBeginnerWalkthroughStep(beginnerWalkthroughStep + 1);
}

function previousBeginnerWalkthroughStep() {
  if (beginnerWalkthroughStep <= 0) {
    return;
  }

  renderBeginnerWalkthroughStep(beginnerWalkthroughStep - 1);
}

function maybeShowBeginnerWalkthroughOnFirstLoad() {
  const hasSeenGuide = localStorage.getItem(BEGINNER_WALKTHROUGH_KEY) === 'seen';
  if (hasSeenGuide) {
    return;
  }

  window.setTimeout(() => {
    openBeginnerWalkthroughModal(false);
  }, 450);
}

// --- Seed Nurturing Functions ---

function plantSeed(seedType) {
  if (!SEED_TYPES[seedType]) {
    showNotification('Invalid seed type.', { type: 'warning' });
    return false;
  }
  if (activeSeed) {
    showNotification('You already have an active seed. Harvest it first.', { type: 'info' });
    return false;
  }
  const todayKey = getTodayDateKey();
  activeSeed = {
    seedType: seedType,
    stage: 0,
    daysElapsed: 0,
    nurtureProgress: 0,
    nurtureActionsToday: 0,
    lastActionDate: todayKey,
    activeChallenge: null,
    challengeTriggeredDay: null,
    isResilience: false
  };
  showNotification(`🌱 You planted a ${SEED_TYPES[seedType].name} seed!`, { type: 'success' });
  debugFpLog('plant-seed', { seedType, stage: 0 });
  updateDisplay();
  return true;
}

function getSeedStageInfo(stage) {
  return SEED_STAGES[Math.max(0, Math.min(stage, SEED_STAGES.length - 1))];
}

function getCurrentSeedProgress() {
  if (!activeSeed) return null;
  const stageInfo = getSeedStageInfo(activeSeed.stage);
  const progThreshold = STAGE_PROGRESSION_REQUIREMENTS.min + 
    (STAGE_PROGRESSION_REQUIREMENTS.max - STAGE_PROGRESSION_REQUIREMENTS.min) * (activeSeed.stage / (SEED_STAGES.length - 1));
  return {
    seedType: activeSeed.seedType,
    stageName: stageInfo.name,
    daysElapsed: activeSeed.daysElapsed,
    nurtureProgress: activeSeed.nurtureProgress,
    nurtureProgressThreshold: Math.round(progThreshold),
    actionsRemainingToday: MAX_NURTURE_ACTIONS_PER_DAY - activeSeed.nurtureActionsToday,
    hasChallenge: activeSeed.activeChallenge !== null,
    challenge: activeSeed.activeChallenge
  };
}

function resetDailyNurtureActions() {
  if (!activeSeed) return;
  const todayKey = getTodayDateKey();
  if (activeSeed.lastActionDate !== todayKey) {
    activeSeed.lastActionDate = todayKey;
    activeSeed.nurtureActionsToday = 0;
    activeSeed.daysElapsed += 1;
  }
}

function getNurtureActionsRemainingToday() {
  if (!activeSeed) return 0;
  resetDailyNurtureActions();
  return MAX_NURTURE_ACTIONS_PER_DAY - activeSeed.nurtureActionsToday;
}

function hasActionableNurtureAction(actionType) {
  if (!activeSeed) return { allowed: false, message: 'No active seed. Plant one first!' };
  if (!NURTURE_ACTIONS[actionType]) return { allowed: false, message: 'Unknown action.' };
  
  const action = NURTURE_ACTIONS[actionType];
  if (faithPoints < action.cost) {
    return { allowed: false, message: `Insufficient FP. Need ${action.cost} FP, you have ${Math.floor(faithPoints)}.` };
  }
  
  const actionsRemaining = getNurtureActionsRemainingToday();
  if (actionsRemaining <= 0) {
    return { allowed: false, message: 'Max daily nurture actions reached. Try again tomorrow.' };
  }
  
  if (activeSeed.activeChallenge) {
    return { allowed: false, message: 'Cannot nurture while facing a challenge. Resolve it first!' };
  }
  
  return { allowed: true };
}

function performNurtureAction(actionType) {
  const check = hasActionableNurtureAction(actionType);
  if (!check.allowed) {
    showNotification(check.message, { type: 'warning' });
    return false;
  }
  
  const action = NURTURE_ACTIONS[actionType];
  const previousFp = Math.floor(faithPoints);
  
  // Deduct FP
  faithPoints -= action.cost;
  
  // Track action
  activeSeed.nurtureActionsToday += 1;
  activeSeed.nurtureProgress += (action.fp * 5); // Each FP value = 5 progress units
  addSeedProgressToTree(action.fp * 2);
  
  // Check for stage progression
  checkAndProgressSeed();
  
  updateDisplay();
  showNotification(`🌿 ${action.name}! (-${action.cost} FP) | Progress: ${activeSeed.nurtureProgress}`, { type: 'success' });
  debugFpLog('nurture-action', { actionType, cost: action.cost, fpBefore: previousFp, fpAfter: Math.floor(faithPoints), nurtureProgress: activeSeed.nurtureProgress });
  
  return true;
}

function checkAndProgressSeed() {
  if (!activeSeed) return;
  
  const progThreshold = STAGE_PROGRESSION_REQUIREMENTS.min + 
    (STAGE_PROGRESSION_REQUIREMENTS.max - STAGE_PROGRESSION_REQUIREMENTS.min) * (activeSeed.stage / (SEED_STAGES.length - 1));
  
  if (activeSeed.nurtureProgress >= progThreshold && activeSeed.stage < SEED_STAGES.length - 1) {
    activeSeed.stage += 1;
    activeSeed.nurtureProgress = 0;
    const newStageInfo = getSeedStageInfo(activeSeed.stage);
    addSeedProgressToTree(Math.max(3, activeSeed.stage + 1));
    
    // Trigger stage progression animation
    triggerSeedStageAnimation();
    
    showNotification(`✨ Your seed advanced to ${newStageInfo.emoji} ${newStageInfo.name}! ${newStageInfo.stage === SEED_STAGES.length - 1 ? '🎉 Ready to harvest! Fruits await!' : ''}`, { type: 'success', browser: true });
    debugFpLog('seed-stage-up', { newStage: activeSeed.stage, stageName: newStageInfo.name });
  }
}

function triggerSeedStageAnimation() {
  const upgradeModal = document.getElementById('upgradeModal');
  if (!upgradeModal) return;
  
  const nurtureContainer = document.getElementById('nurtureUIContainer');
  if (nurtureContainer) {
    nurtureContainer.style.animation = 'none';
    void nurtureContainer.offsetWidth;
    nurtureContainer.style.animation = 'seedGrow 0.6s ease-out';
  }
}

function shouldTriggerChallenge() {
  if (!activeSeed || activeSeed.activeChallenge) return false;
  if (!activeSeed.challengeTriggeredDay) return true;
  
  const daysSinceChallenge = activeSeed.daysElapsed - activeSeed.challengeTriggeredDay;
  const daysUntilNext = Math.floor(Math.random() * (CHALLENGE_TRIGGER_DAYS.max - CHALLENGE_TRIGGER_DAYS.min + 1)) + CHALLENGE_TRIGGER_DAYS.min;
  
  return daysSinceChallenge >= daysUntilNext;
}

function triggerRandomChallenge() {
  if (!activeSeed || !shouldTriggerChallenge()) return false;
  
  const seedType = activeSeed.seedType;
  const seedChallenges = SEED_CHALLENGES[seedType] || CHALLENGES;
  const randomChallenge = seedChallenges[Math.floor(Math.random() * seedChallenges.length)];
  activeSeed.activeChallenge = randomChallenge;
  activeSeed.challengeTriggeredDay = activeSeed.daysElapsed;
  
  showNotification(`${randomChallenge.icon} ${randomChallenge.description}`, { type: 'warning', browser: true, duration: 5000 });
  debugFpLog('challenge-triggered', { challengeName: randomChallenge.name, seedType: seedType, seedStage: activeSeed.stage });
  
  return true;
}

// --- Challenge Response Functions ---

function respondToChallenge(responseType) {
  if (!activeSeed || !activeSeed.activeChallenge) {
    showNotification('No active challenge.', { type: 'warning' });
    return false;
  }
  
  const option = CHALLENGE_OPTIONS[responseType];
  if (!option) return false;
  
  const previousFp = Math.floor(faithPoints);
  let success = false;
  let message = '';
  
  if (responseType === 'fight') {
    success = Math.random() < option.successRate;
    if (faithPoints >= option.cost) {
      faithPoints -= option.cost;
      if (success) {
        activeSeed.nurtureProgress += option.reward;
        message = `💪 Victory! You fought off the ${activeSeed.activeChallenge.name}! +${option.reward} progress`;
        checkAndProgressSeed();
      } else {
        // Failed challenge penalty
        activeSeed.nurtureProgress = Math.max(0, activeSeed.nurtureProgress - 10);
        message = `😟 The ${activeSeed.activeChallenge.name} overwhelmed you. Progress slowed.`;
      }
    } else {
      showNotification(`Not enough FP. Need ${option.cost} FP.`, { type: 'warning' });
      return false;
    }
  } else if (responseType === 'endure') {
    if (faithPoints >= option.cost) {
      faithPoints -= option.cost;
      activeSeed.nurtureProgress += option.reward;
      success = true;
      message = `🛡️ You endured the ${activeSeed.activeChallenge.name}. +${option.reward} progress (slower but steady)`;
      checkAndProgressSeed();
    } else {
      showNotification(`Not enough FP. Need ${option.cost} FP.`, { type: 'warning' });
      return false;
    }
  } else if (responseType === 'giveUp') {
    // Regress one stage
    if (activeSeed.stage > 0) {
      activeSeed.stage -= 1;
      activeSeed.nurtureProgress = 0;
      const stageInfo = getSeedStageInfo(activeSeed.stage);
      message = `😔 You gave up. Seed regressed to ${stageInfo.name}.`;
    } else {
      message = `😔 You gave up. Seed remains a ${getSeedStageInfo(0).name}.`;
    }
    success = true;
  }
  
  activeSeed.activeChallenge = null;
  
  showNotification(message, { type: success ? 'success' : 'warning', browser: true });
  debugFpLog('challenge-response', { responseType, success, fpBefore: previousFp, fpAfter: Math.floor(faithPoints) });
  updateDisplay();
  
  return true;
}

// --- Harvest Functions ---

function canHarvestSeed() {
  if (!activeSeed) return { allowed: false, message: 'No active seed to harvest.' };
  if (activeSeed.activeChallenge) return { allowed: false, message: 'Resolve challenge first.' };
  if (activeSeed.stage < SEED_STAGES.length - 1) {
    const currentStage = getSeedStageInfo(activeSeed.stage);
    return { allowed: false, message: `Seed not ready. Currently at ${currentStage.name} stage.` };
  }
  return { allowed: true };
}

function harvestSeed() {
  const check = canHarvestSeed();
  if (!check.allowed) {
    showNotification(check.message, { type: 'info' });
    return false;
  }
  
  // Calculate harvest rewards based on nurture effort
  const baseReward = 20;
  const effortBonus = Math.floor(activeSeed.nurtureProgress / 5); // Extra FP for quality nurture
  const totalReward = baseReward + effortBonus;
  
  // Apply rewards
  const previousFp = Math.floor(faithPoints);
  const previousTreeProgress = Math.floor(treeProgress);
  
  // Award FP for harvest
  faithPoints += totalReward;
  
  // Apply to tree progress (scaled bonus - seed harvest boosts tree growth!)
  const treeProgressBonus = Math.round(totalReward * 1.5); // 1.5x multiplier for tree
  applyTreeProgress(treeProgressBonus, { addFaithPoints: false });
  
  // Track harvest
  const harvestedSeed = {
    type: activeSeed.seedType,
    stage: activeSeed.stage,
    daysToGrow: activeSeed.daysElapsed,
    nurtureActionsTotal: 0,
    rewardFp: totalReward,
    treeBonus: treeProgressBonus,
    harvestedAt: Date.now()
  };
  seedHistory.push(harvestedSeed);
  
  const seedTypeName = SEED_TYPES[activeSeed.seedType].name;
  const seedTypeIcon = SEED_TYPES[activeSeed.seedType].icon;
  
  // Trigger harvest animation
  triggerHarvestAnimation();
  
  showNotification(`🎉 HARVEST! ${seedTypeIcon} ${seedTypeName} Seed Complete!\n+${totalReward} FP (Harvest) + ${treeProgressBonus} 🌳 (Tree Growth)`, { type: 'success', browser: true, duration: 4000 });
  debugFpLog('harvest-seed', { seedType: activeSeed.seedType, daysGrown: activeSeed.daysElapsed, rewardFp: totalReward, treeBonus: treeProgressBonus, fpBefore: previousFp, fpAfter: Math.floor(faithPoints), treeBefore: previousTreeProgress, treeAfter: Math.floor(treeProgress) });
  
  // Reset for next seed
  activeSeed = null;
  updateDisplay();
  
  return true;
}

function triggerHarvestAnimation() {
  const upgradeModal = document.getElementById('upgradeModal');
  if (!upgradeModal) return;
  
  const nurtureContainer = document.getElementById('nurtureUIContainer');
  if (nurtureContainer) {
    nurtureContainer.style.animation = 'none';
    void nurtureContainer.offsetWidth;
    nurtureContainer.style.animation = 'harvestCelebrate 0.8s ease-out';
  }
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
    showNotification(`FP mismatch detected. Session:${localSessionFp}, Current:${currentUserFp}, Local:${storedFp}, Cloud:${cloudUser ? cloudFp : 'n/a'}.${rollbackMessage}`, { type: 'warning', duration: 7000 });
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
  const lastClaimDate = parseDateKeyToDate(dailyLoginState.lastClaimDate) || new Date(dailyLoginState.lastClaimDate);
  if (!lastClaimDate || Number.isNaN(lastClaimDate.getTime())) {
    dailyLoginState = normalizeDailyLoginState({});
    try {
      const normalized = normalizeDailyLoginState(dailyLoginState);
      if (typeof currentUser !== 'undefined' && currentUser) {
        currentUser.dailyLoginState = normalized;
        currentUser.updatedAt = Date.now();
        try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
          try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
        }
        const users = getStoredUsersSafe();
        const idx = findUserIndexForSession(users, currentUser);
        if (idx !== -1) {
          users[idx].dailyLoginState = normalized;
          users[idx].updatedAt = currentUser.updatedAt;
          setStoredUsers(users);
        }
      }
    } catch (e) {}
    return;
  }
  const daysDiff = getDaysBetween(lastClaimDate, today);
  if (daysDiff <= 1) return;
  dailyLoginState = { streakDay: 1, lastClaimDate: '', cycleStartDate: '', claimedDays: [] };
  try {
    const normalized = normalizeDailyLoginState(dailyLoginState);
    if (typeof currentUser !== 'undefined' && currentUser) {
      currentUser.dailyLoginState = normalized;
      currentUser.updatedAt = Date.now();
      try { persistAllUserState(getStoredUsersSafe(), currentUser); } catch (e) {
        try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
      }
    }
    const users = getStoredUsersSafe();
    const idx = findUserIndexForSession(users, currentUser);
    if (idx !== -1) {
      users[idx].dailyLoginState = normalized;
      users[idx].updatedAt = currentUser?.updatedAt ?? Date.now();
      setStoredUsers(users);
    }
  } catch (e) {}
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
  try { console.debug('[instr][mod] post-claimDailyLogin', { faithPoints: Math.floor(Number(faithPoints ?? 0) || 0), currentUser: (currentUser && currentUser.email) ? { email: currentUser.email, faithPoints: currentUser.faithPoints } : null, storedCurrentUser: JSON.parse(localStorage.getItem('currentUser') || '{}'), ts: String(Date.now()) }); } catch(e) {}
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
  
  // Update seed status if active
  const seedStatusEl = document.getElementById('activeSeedStatus');
  if (activeSeed && seedStatusEl) {
    const progress = getCurrentSeedProgress();
    seedStatusEl.innerHTML = `🌱 ${SEED_TYPES[activeSeed.seedType].name} Seed (${progress.stageName}) - ${activeSeed.daysElapsed}d`;
    seedStatusEl.style.display = 'inline-block';
  } else if (seedStatusEl) {
    seedStatusEl.style.display = 'none';
  }
  
  if (dailyRewardStreakEl) {
    refreshDailyLoginState();
    const currentDay = dailyLoginState.streakDay;
    const totalDays = DAILY_LOGIN_REWARDS.length;
    const todayClaimed = hasClaimedDailyLoginToday();

    let displayedDay = currentDay;
    if (todayClaimed) {
      if (Array.isArray(dailyLoginState.claimedDays) && dailyLoginState.claimedDays.length > 0) {
        displayedDay = Math.max(...dailyLoginState.claimedDays);
      } else if (currentDay === 1 && !dailyLoginState.cycleStartDate) {
        displayedDay = totalDays;
      } else {
        displayedDay = Math.max(1, currentDay - 1);
      }
    }

    dailyRewardStreakEl.textContent = todayClaimed
      ? `Day ${displayedDay}/${totalDays} — Checked in today!`
      : `Day ${currentDay}/${totalDays} — Check in now!`;
  }
  updateTaskBadges();
  updateProgressDisplay();
  updateTreeGrowth();
  updateFruitVisuals();
  
  // Check and trigger challenges daily
  if (activeSeed) {
    resetDailyNurtureActions();
    triggerRandomChallenge();
  }
  
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
    users[userIndex].activeSeed = activeSeed ? JSON.parse(JSON.stringify(activeSeed)) : null;
    users[userIndex].seedHistory = seedHistory.length > 0 ? JSON.parse(JSON.stringify(seedHistory)) : [];
    users[userIndex].viewMode = getCurrentViewMode();
    users[userIndex].lastActiveAt = Date.now();
    users[userIndex].updatedAt = Date.now();
    try { console.debug('[probe] saveUserData (modular): pre-upsert users[userIndex]=', JSON.parse(JSON.stringify(users[userIndex] || {}))); } catch (e) {}
    try { console.debug('[probe] saveUserData (modular): before setStoredUsers users[userIndex]=', JSON.parse(JSON.stringify(users[userIndex] || {}))); } catch (e) {}
    setStoredUsers(users);
    // Freeze payload and log it to avoid races where users[userIndex] mutates before upsert
    const upsertPayload = JSON.parse(JSON.stringify(users[userIndex] || {}));
    try { console.debug('[micro] saveUserData (modular): pre-upsert-payload=', upsertPayload); } catch (e) {}
    try { console.log('[micro] saveUserData (modular): pre-upsert-payload=', JSON.parse(JSON.stringify(upsertPayload))); } catch (e) {}
    try { console.log('PRE_UPSERT_SNAPSHOT_MARKER::', JSON.stringify(upsertPayload)); } catch (e) {}
    try { window.__LAST_PRE_UPSERT_SNAPSHOT = { ts: Date.now(), src: 'kingdom-roots/js-modular/game.js', payload: JSON.parse(JSON.stringify(upsertPayload)) }; } catch (e) {}
    try {
      const safe = { ts: Date.now(), src: 'kingdom-roots/js-modular/game.js', id: (upsertPayload && (upsertPayload.id || upsertPayload.email)) || null, faithPoints: (upsertPayload && upsertPayload.faithPoints) || null };
      try { localStorage.setItem('__debug_last_pre_upsert', JSON.stringify(safe)); } catch (_) {}
      try { window.__LAST_PRE_UPSERT_SNAPSHOT_SAFE = safe; } catch (_) {}
      try { console.log('PRE_UPSERT_SNAPSHOT_MARKER_SAFE::' + (safe.id || '') + '::' + safe.ts); } catch (_) {}
    } catch (e) {}
    try {
      const dbgKey = '__debug_pre_upsert_snapshots';
      const arr = JSON.parse(localStorage.getItem(dbgKey) || '[]');
      arr.push({ ts: Date.now(), src: 'kingdom-roots/js-modular/game.js', payload: JSON.parse(JSON.stringify(upsertPayload)) });
      localStorage.setItem(dbgKey, JSON.stringify(arr.slice(-50)));
    } catch (e) {}
    upsertUserInCloud(upsertPayload).then(res => {
      try { console.debug('[probe] saveUserData (modular): cloudResult=', JSON.parse(JSON.stringify(res || {}))); } catch (e) {}
      try { console.debug('[probe] saveUserData (modular): after cloud read currentUser=', JSON.parse(localStorage.getItem('currentUser') || '{}'), 'usersCount=', JSON.parse(localStorage.getItem('users') || '[]').length); } catch (e) {}
    }).catch(e => { console.warn('saveUserData cloud upsert failed:', e); });
    currentUser.faithPoints = Math.floor(faithPoints);
    currentUser.treeProgress = Math.floor(treeProgress);
    currentUser.passiveRate = passiveRate;
    currentUser.fruitCount = fruitCount;
    currentUser.pointsForFruit = pointsForFruit;
    currentUser.maxBloomReached = maxBloomReached;
    currentUser.taskCompletions = taskCompletions;
    currentUser.dailyLoginState = normalizeDailyLoginState(dailyLoginState);
    currentUser.activeSeed = activeSeed ? JSON.parse(JSON.stringify(activeSeed)) : null;
    currentUser.seedHistory = seedHistory.length > 0 ? JSON.parse(JSON.stringify(seedHistory)) : [];
    currentUser.viewMode = getCurrentViewMode();
    currentUser.id = users[userIndex].id;
    currentUser.lastActiveAt = users[userIndex].lastActiveAt;
    currentUser.updatedAt = users[userIndex].updatedAt;
    try { persistAllUserState(users, currentUser); } catch (e) {
      try { safeSetCurrentUser(currentUser); } catch(__e2) { /* ignore */ }
    }
    try {
      localStorage.setItem('lastPersistAt', String(Date.now()));
    } catch (e) {
      // ignore
    }
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
  activeSeed = currentUser.activeSeed ? JSON.parse(JSON.stringify(currentUser.activeSeed)) : null;
  seedHistory = Array.isArray(currentUser.seedHistory) ? JSON.parse(JSON.stringify(currentUser.seedHistory)) : [];
  currentUser.viewMode = currentUser.viewMode ?? (isAdminUser() ? 'admin' : 'user');
  if (!Number.isFinite(faithPoints)) faithPoints = 0;
  if (!Number.isFinite(treeProgress)) treeProgress = 0;
  if (!Number.isFinite(passiveRate) || passiveRate < 1) passiveRate = 1;
  if (!Number.isFinite(fruitCount) || fruitCount < 0) fruitCount = 0;
  if (!Number.isFinite(pointsForFruit) || pointsForFruit < 0) pointsForFruit = 0;
  refreshDailyLoginState();
  normalizeFruitProgressState();
  resetDailyNurtureActions();
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
  try { console.debug('[instr][mod] post-submitPhoto', { faithPoints: Math.floor(Number(faithPoints ?? 0) || 0), storedCurrentUser: JSON.parse(localStorage.getItem('currentUser') || '{}'), ts: String(Date.now()) }); } catch(e) {}
}

function shareGospel() {
  const pointsToAdd = actionRewards.sharegospel.fp;
  const previousFp = Math.floor(Number(faithPoints ?? 0) || 0);
  applyTreeProgress(pointsToAdd);
  updateDisplay();
  debugFpLog('share-gospel', { pointsToAdd, fpBefore: previousFp, fpAfter: Math.floor(Number(faithPoints ?? 0) || 0) });
  try { console.debug('[instr][mod] post-shareGospel', { faithPoints: Math.floor(Number(faithPoints ?? 0) || 0), storedCurrentUser: JSON.parse(localStorage.getItem('currentUser') || '{}'), ts: String(Date.now()) }); } catch(e) {}
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
    try { console.debug('[instr][mod] post-useAllPoints', { faithPoints: Math.floor(Number(faithPoints ?? 0) || 0), storedUsersFirst: JSON.parse(localStorage.getItem('users') || '[]')[0] || null, ts: String(Date.now()) }); } catch(e) {}
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
    try { console.debug('[instr][mod] post-upgrade', { faithPoints: Math.floor(Number(faithPoints ?? 0) || 0), currentUser: (currentUser && currentUser.email) ? { email: currentUser.email, faithPoints: currentUser.faithPoints } : null, ts: String(Date.now()) }); } catch(e) {}
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
  
  // Inject seed/nurture UI if applicable
  ensureNurtureUIInUpgradeModal();
  
  modal.style.display = "flex";
}

function ensureNurtureUIInUpgradeModal() {
  const modal = document.getElementById("upgradeModal");
  if (!modal || document.getElementById("nurtureUIContainer")) return;
  
  const container = document.createElement('div');
  container.id = 'nurtureUIContainer';
  container.style.cssText = 'margin: 20px 0; padding: 15px; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc;';
  
  if (!activeSeed) {
    // Show seed selection with verses
    const seedKeys = Object.keys(SEED_TYPES);
    const seedButtonsHtml = seedKeys.map(key => {
      const seed = SEED_TYPES[key];
      return `
        <div style="margin-bottom: 10px; padding: 10px; background: ${seed.color}20; border-left: 4px solid ${seed.color}; border-radius: 4px; text-align: left;">
          <button type="button" onclick="plantSeed('${key}'); closeUpgradeModal();" class="auth-btn" style="background: ${seed.color}; width: 100%; margin: 0; padding: 10px;">
            <span style="font-size: 18px;">${seed.icon}</span> <strong>${seed.name}</strong>
          </button>
          <p style="margin: 5px 0 2px 0; font-size: 12px; color: #666;"><em>${seed.verse}</em></p>
          <p style="margin: 0; font-size: 12px; color: #333;">${seed.meaning}</p>
        </div>
      `;
    }).join('');
    
    container.innerHTML = `
      <div style="text-align: center;">
        <h3 style="margin-top: 0; margin-bottom: 15px;">🌱 Choose Your Seed</h3>
        <div style="text-align: left; max-width: 400px; margin: 0 auto;">
          ${seedButtonsHtml}
        </div>
      </div>
    `;
  } else {
    // Show nurture actions
    const progress = getCurrentSeedProgress();
    const seedType = SEED_TYPES[progress.seedType];
    
    // Build progression path visual
    const progressionStages = SEED_STAGES.map((stage, idx) => {
      const isActive = idx === activeSeed.stage;
      const isCompleted = idx < activeSeed.stage;
      const stageClass = isActive ? 'active-stage' : isCompleted ? 'completed-stage' : 'future-stage';
      return `<div class="progression-stage ${stageClass}" title="${stage.name}~${stage.daysEstimate} days">${stage.emoji}</div>`;
    }).join('');
    
    container.innerHTML = `
      <div style="text-align: center;">
        <h3 style="margin-top: 0;">${seedType.icon} ${seedType.name} Seed</h3>
        <p style="font-size: 12px; color: #666; margin: 5px 0;"><em>"${seedType.verse}"</em></p>
        <p style="font-size: 13px; margin: 5px 0 15px 0;">${seedType.meaning}</p>
        
        <!-- Progression Path -->
        <div style="display: flex; justify-content: center; gap: 5px; margin: 15px 0; background: #f5f5f5; padding: 10px; border-radius: 8px;">
          ${progressionStages}
        </div>
        
        <p style="font-size: 14px; margin: 5px 0; font-weight: bold;">${progress.stageName} ${SEED_STAGES[activeSeed.stage].emoji}</p>
        <p style="font-size: 12px; color: #666; margin: 5px 0;">
          📅 Days: ${progress.daysElapsed} | 
          📊 Progress: ${progress.nurtureProgress}/${progress.nurtureProgressThreshold} | 
          🔄 Actions: ${progress.actionsRemainingToday}/${MAX_NURTURE_ACTIONS_PER_DAY}
        </p>
        
        ${progress.hasChallenge ? `<p style="color: #FF6B6B; font-weight: bold;">⚠️ Challenge: ${progress.challenge.icon} ${progress.challenge.name}</p>` : ''}
        
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 10px;">
          <button type="button" onclick="performNurtureAction('water')" class="auth-btn" style="background: #4ECDC4; font-size: 12px;">💧 Water<br/>(5 FP)</button>
          <button type="button" onclick="performNurtureAction('protect')" class="auth-btn" style="background: #FFE66D; color: #333; font-size: 12px;">🛡️ Protect<br/>(10 FP)</button>
          <button type="button" onclick="performNurtureAction('fertilize')" class="auth-btn" style="background: #FF6B6B; font-size: 12px;">🌾 Fertilize<br/>(15 FP)</button>
        </div>
        ${progress.hasChallenge ? `
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ccc;">
            <p style="font-weight: bold;">Choose your response:</p>
            <button type="button" onclick="respondToChallenge('fight')" class="auth-btn" style="background: #FF6B6B; font-size: 12px; width: 32%;">💪 Fight (10 FP, 70% success)</button>
            <button type="button" onclick="respondToChallenge('endure')" class="auth-btn" style="background: #FFE66D; color: #333; font-size: 12px; width: 32%;">🛡️ Endure (5 FP, guaranteed)</button>
            <button type="button" onclick="respondToChallenge('giveUp')" class="auth-btn" style="background: #999; font-size: 12px; width: 32%;">😔 Give up (-1 stage)</button>
          </div>
        ` : ''}
        ${activeSeed.stage >= SEED_STAGES.length - 1 ? `
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ccc;">
            <p style="color: #27AE60; font-weight: bold;">🎉 Ready for Harvest!</p>
            <button type="button" onclick="harvestSeed(); closeUpgradeModal();" class="auth-btn" style="background: #27AE60; font-weight: bold;">🌾 Harvest Seed → 🌳 Feed Tree</button>
          </div>
        ` : ''}
      </div>
      
      <style>
        .progression-stage {
          font-size: 20px;
          padding: 5px 8px;
          border-radius: 6px;
          transition: all 0.3s ease;
        }
        .active-stage {
          background: #FFE66D;
          transform: scale(1.2);
          box-shadow: 0 0 10px rgba(255, 230, 109, 0.5);
          animation: seedPulse 1.5s infinite;
        }
        .completed-stage {
          background: #27AE60;
          opacity: 0.8;
        }
        .future-stage {
          background: #ddd;
          opacity: 0.5;
        }
      </style>
    `;
  }
  
  const upgradeSection = modal.querySelector('.modal-content');
  if (upgradeSection) {
    upgradeSection.insertBefore(container, upgradeSection.firstChild);
  }
}

function closeUpgradeModal() {
  const modal = document.getElementById("upgradeModal");
  if (modal) modal.style.display = "none";
  // Clean up injected nurture UI
  const nurtureUI = document.getElementById("nurtureUIContainer");
  if (nurtureUI) nurtureUI.remove();
}

function confirmUpgrade() {
  if (faithPoints >= upgradeCost) { upgrade(); closeUpgradeModal(); focusSeedGrowthView(); }
  else document.getElementById("insufficientFpMessage").style.display = "block";
}
