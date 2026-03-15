// Growing Seed — Configuration & Constants

let currentUser = null;

const ADMIN_EMAILS = ['endlesssh0014@gmail.com', 'endlessssh0014@gmail.com', 'endless0014@gmail.com'];
const ALLOWED_ROLES = ['admin', 'moderator', 'user'];

// Firebase web API keys are client-side identifiers (designed to be public).
// Access is controlled via Firebase Security Rules — ensure Firestore rules
// restrict reads/writes appropriately.
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDXPQnVHn9ux9Je5vGASWKig3AdBvnlOIk',
  authDomain: 'growing-seed-fc973.firebaseapp.com',
  projectId: 'growing-seed-fc973',
  storageBucket: 'growing-seed-fc973.firebasestorage.app',
  messagingSenderId: '154122860320',
  appId: '1:154122860320:web:90f610016b49ad25ef0945'
};

const CLOUD_USERS_COLLECTION = 'users';

const EMAIL_CORRECTIONS = {
  'nicolenavarrosa27@gmailc.com': 'nicolenavarrosa27@gmail.com'
};

const CLOUD_MIGRATION_KEY = 'growingSeedCloudMigrationDoneV1';
const STREAK_MIGRATION_KEY = 'growingSeedStreakMigrationFromLegacyV1';
const ROLLBACK_RECOVERY_KEY = 'growingSeedRollbackRecoveryDoneByEmailV1';
const NOTIFICATION_PREFERENCE_KEY = 'growingSeedNotificationsEnabled';
const REMINDER_LOG_KEY = 'growingSeedReminderLogV1';
const FP_DEBUG_MODE_KEY = 'growingSeedFpDebugModeV1';
const NOTIFICATION_DEFAULT_DURATION = 4200;
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const DAILY_LOGIN_REWARDS = [2, 2, 3, 4, 5, 6, 8];
const DAILY_LOGIN_COMPLETION_BONUS = 20;
const DAILY_LOGIN_STAGE_KEYS = [
  'seedStageImg',
  'germinationStageImg',
  'seedlingStageImg',
  'saplingStageImg',
  'youngTreeStageImg',
  'matureTreeStageImg',
  'oldTreeStageImg'
];

const NON_USER_ROLES_FOR_PUBLIC_BOARDS = new Set(['admin', 'moderator']);

const FULL_BLOOM_THRESHOLD = 1500;
const TASK_REFRESH_HOUR = 24;
const TASK_REFRESH_MINUTE = 0;

const LOGO_CACHE_BUSTER = '20260225-logo-refresh-2';

const scriptures = [
  "The kingdom of God is like a mustard seed... – Matthew 13:31",
  "I am the vine; you are the branches. – John 15:5",
  "Let your roots grow down into Him. – Colossians 2:7",
  "Those who trust in the Lord will renew their strength. – Isaiah 40:31"
];

const actionRewards = {
  'pray': { fp: 2, bonus: 0, name: 'Prayer Time' },
  'bible': { fp: 2, bonus: 0, name: 'Bible Reading' },
  'devotion': { fp: 4, bonus: 0, name: 'Daily Devotion' },
  'smallgroup': { fp: 10, bonus: 0, name: 'Small Group' },
  'attendService': { fp: 15, bonus: 0, name: 'Worship Attendance' },
  'sharegospel': { fp: 10, bonus: 0, name: 'Share Gospel' }
};

const taskRecurrenceRules = {
  pray: { unit: 'day', label: 'once per day' },
  bible: { unit: 'day', label: 'once per day' },
  devotion: { unit: 'day', label: 'once per day' },
  smallgroup: { unit: 'week', label: 'once per week' },
  attendService: { unit: 'week', label: 'once per week' }
};

const taskDisplayNames = {
  pray: 'Prayer Time',
  bible: 'Bible Reading',
  devotion: 'Daily Devotion',
  smallgroup: 'Small Group',
  attendService: 'Worship Attendance'
};

const taskButtonBindings = {
  pray: { buttonId: 'prayBtn' },
  bible: { buttonId: 'bibleBtn' },
  devotion: { buttonId: 'devotionBtn' },
  smallgroup: { buttonId: 'smallgroupBtn' },
  attendService: { buttonId: 'attendServiceBtn' }
};
