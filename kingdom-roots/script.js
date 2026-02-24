// Authentication System
let currentUser = null;

// Initialize app
function initializeApp() {
  currentUser = localStorage.getItem('currentUser');
  
  if (currentUser) {
    currentUser = JSON.parse(currentUser);
    showAppInterface();
    updateDisplay();
  } else {
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
  
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const user = users.find(u => u.email === email && u.password === password);
  
  if (user) {
    currentUser = { ...user };
    delete currentUser.password;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    clearAuthErrors();
    showAppInterface();
  } else {
    document.getElementById('loginError').textContent = 'Invalid email or password';
  }
}

function handleRegister(event) {
  event.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  
  document.getElementById('registerError').textContent = '';
  
  if (password !== confirmPassword) {
    document.getElementById('registerError').textContent = 'Passwords do not match';
    return;
  }
  
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  
  if (users.find(u => u.email === email)) {
    document.getElementById('registerError').textContent = 'Email already registered';
    return;
  }
  
  const newUser = {
    id: Date.now(),
    name,
    email,
    password,
    joinedDate: new Date().toLocaleDateString(),
    faithPoints: 0,
    treeProgress: 0
  };
  
  users.push(newUser);
  localStorage.setItem('users', JSON.stringify(users));
  
  currentUser = { ...newUser };
  delete currentUser.password;
  currentUser.faithPoints = 0;
  currentUser.treeProgress = 0;
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  
  clearAuthErrors();
  document.getElementById('registerForm').reset();
  showAppInterface();
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
  link.download = `kingdom-roots-data-${Date.now()}.json`;
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
let faithPoints = 3650;
let treeProgress = 0;
let passiveRate = 1;
let upgradeCost = 10;
let currentAction = '';
let html5QrcodeScanner = null;
let maxBloomReached = false;
let pointsForFruit = 0;
let fruitCount = 0;

const scriptures = [
  "The kingdom of God is like a mustard seed... – Matthew 13:31",
  "I am the vine; you are the branches. – John 15:5",
  "Let your roots grow down into Him. – Colossians 2:7",
  "Those who trust in the Lord will renew their strength. – Isaiah 40:31"
];

const actionRewards = {
  'pray': { fp: 1, fpMultiplier: 10, bonus: 0, name: 'Prayer' },
  'bible': { fp: 1, fpMultiplier: 10, bonus: 0, name: 'Bible Reading' },
  'devotion': { fp: 3, fpMultiplier: 10, bonus: 0, name: 'Devotional Time' }
};

function updateDisplay() {
  const faithPointsEl = document.getElementById("faithPoints");
  const upgradeCostEl = document.getElementById("upgradeCost");
  
  if (faithPointsEl) faithPointsEl.textContent = Math.floor(faithPoints);
  if (upgradeCostEl) upgradeCostEl.textContent = upgradeCost;
  
  updateProgressDisplay();
  updateTreeGrowth();
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
      
      localStorage.setItem('users', JSON.stringify(users));
      
      // Also update current user session with all game data
      currentUser.faithPoints = Math.floor(faithPoints);
      currentUser.treeProgress = Math.floor(treeProgress);
      currentUser.passiveRate = passiveRate;
      currentUser.fruitCount = fruitCount;
      currentUser.pointsForFruit = pointsForFruit;
      currentUser.maxBloomReached = maxBloomReached;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
  }
}

function loadUserData() {
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
        progressPercent = ((treeProgress - currentStart) / (stage.threshold - currentStart)) * 100;
        progressTextContent = `📈 ${Math.floor(treeProgress)}/${stage.threshold} progress to ${stage.name}`;
        foundStage = true;
        break;
      }
      currentStart = stage.threshold;
    }
    
    // If we've reached 3650 progress exactly, show completion message
    if (!foundStage && treeProgress >= 3650) {
      progressPercent = 100;
      progressTextContent = `📈 ${Math.floor(treeProgress)}/3650 - Mature Tree Complete! (Add progress for Old Tree & Fruits)`;
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
      if (['youngTree', 'matureTree', 'oldTree'].includes(currentStage)) {
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
  const reward = actionRewards[currentAction];
  const pointsToAdd = reward.fp * reward.fpMultiplier;
  const previousFP = faithPoints;
  faithPoints += pointsToAdd;
  treeProgress += pointsToAdd;
  
  // Check if we've just crossed into bloom (3650+)
  if (previousFP < 3650 && faithPoints >= 3650) {
    maxBloomReached = true;
  }
  
  if (maxBloomReached) {
    addFruitIfNeeded(pointsToAdd);
  }
  showScripture();
  updateDisplay();
  closeUploadModal();
}

function openQrScanner() {
  console.log('Opening QR Scanner');
  document.getElementById("qrModal").style.display = 'flex';
  document.getElementById("qr-status").textContent = "Initializing camera...";
  document.getElementById("qr-status").style.color = "#333";
  
  // Clear previous scanner if exists
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear();
  }
  
  // Start new scanner
  html5QrcodeScanner = new Html5Qrcode("qr-reader");
  
  html5QrcodeScanner.start(
    { facingMode: "environment" },
    {
      fps: 10,
      qrbox: { width: 250, height: 250 }
    },
    onQrCodeSuccess,
    onQrCodeError
  ).catch(err => {
    console.error('Failed to start scanner:', err);
    document.getElementById("qr-status").textContent = "Camera access denied or not available";
    document.getElementById("qr-status").style.color = "red";
  });
}

function onQrCodeSuccess(decodedText, decodedResult) {
  console.log('QR Code detected:', decodedText);
  
  // Check if QR contains church-related keywords
  const isChurchQr = decodedText.toLowerCase().includes('church') || 
                     decodedText.toLowerCase().includes('service') ||
                     decodedText.toLowerCase().includes('attendance');
  
  if (isChurchQr) {
    document.getElementById("qr-status").textContent = "✓ Valid Church QR Code! Service points awarded!";
    document.getElementById("qr-status").style.color = "green";
    
    // Award points (5 * 10 = 50)
    const pointsToAdd = 5 * 10;
    const previousFP = faithPoints;
    faithPoints += pointsToAdd;
    treeProgress += pointsToAdd;
    
    // Check if we've just crossed into bloom (3650+)
    if (previousFP < 3650 && faithPoints >= 3650) {
      maxBloomReached = true;
    }
    
    if (maxBloomReached) {
      addFruitIfNeeded(pointsToAdd);
    }
    showScripture();
    updateDisplay();
    
    // Stop scanner
    html5QrcodeScanner.stop().then(() => {
      html5QrcodeScanner.clear();
      
      // Close modal after success
      setTimeout(() => {
        closeQrScanner();
      }, 2000);
    }).catch(err => console.error('Error stopping scanner:', err));
  } else {
    document.getElementById("qr-status").textContent = "⚠ Invalid QR code. Please scan a church QR code.";
    document.getElementById("qr-status").style.color = "orange";
  }
}

function onQrCodeError(error) {
  // Silently ignore scanning errors
  console.log('Scanning error:', error);
}

function closeQrScanner() {
  console.log('Closing QR Scanner');
  
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().then(() => {
      html5QrcodeScanner.clear();
    }).catch(err => console.error('Error stopping scanner:', err));
  }
  
  document.getElementById("qrModal").style.display = 'none';
  document.getElementById("qr-status").textContent = "";
}

function shareGospel() {
  const pointsToAdd = 10 * 10;
  const previousFP = faithPoints;
  faithPoints += pointsToAdd;
  treeProgress += pointsToAdd;
  
  // Check if we've just crossed into bloom (3650+)
  if (previousFP < 3650 && faithPoints >= 3650) {
    maxBloomReached = true;
  }
  
  if (maxBloomReached) {
    addFruitIfNeeded(pointsToAdd);
  }
  showScripture();
  updateDisplay();
}

function addFruitIfNeeded(pointsAdded) {
  pointsForFruit += pointsAdded;
  
  if (pointsForFruit >= 100) {
    fruitCount++;
    pointsForFruit -= 100;
    addFruit();
  }
}

function addFruit() {
  // Add a bounce animation to fruits
  const fruitsGroup = document.getElementById("fruits");
  if (fruitsGroup) {
    fruitsGroup.style.animation = "none";
    // Trigger reflow
    void fruitsGroup.offsetWidth;
    fruitsGroup.style.animation = "fruitBounce 0.6s ease-out";
    
    // Animate individual fruit circles with pop effect
    const circles = fruitsGroup.querySelectorAll('circle');
    if (circles.length > 0) {
      const lastCircle = circles[circles.length - 1];
      lastCircle.style.animation = 'none';
      void lastCircle.offsetWidth;
      lastCircle.style.animation = 'fruitPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
    }
  }
}

function useAllPoints() {
  if (faithPoints >= 10 && faithPoints % 10 === 0) {
    const pointsUsed = faithPoints;
    
    // If tree is not in full bloom, add to progress
    if (!maxBloomReached) {
      treeProgress += pointsUsed;
    }
    
    // If tree is in full bloom, add points to fruit counter
    if (maxBloomReached) {
      addFruitIfNeeded(pointsUsed);
    }
    
    faithPoints = 0;
    
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
    treeProgress += pointsToAdd;
    
    // Check if we've just crossed into bloom (3650+)
    const previousTreeProgress = treeProgress - pointsToAdd;
    if (previousTreeProgress < 3650 && treeProgress >= 3650) {
      maxBloomReached = true;
    }
    
    // If tree is in full bloom, add points to fruit
    if (maxBloomReached) {
      addFruitIfNeeded(pointsToAdd);
    }
    
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
  if (currentUser) {
    loadUserData();
    updateDisplay();
  }
});
