/**
 * Simple JSON-based Database for Group Settings
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

const DB_PATH = path.join(__dirname, 'database');
const GROUPS_DB = path.join(DB_PATH, 'groups.json');
const USERS_DB = path.join(DB_PATH, 'users.json');
const WARNINGS_DB = path.join(DB_PATH, 'warnings.json');
const MODS_DB = path.join(DB_PATH, 'mods.json');
const BANNED_DB = path.join(DB_PATH, 'banned.json');
const DISABLED_CMD_DB = path.join(DB_PATH, 'disabledCommands.json');
const SECURITY_LOG_DB = path.join(DB_PATH, 'securitylog.json');
const ROLES_DB = path.join(DB_PATH, 'roles.json');

// In-memory cache for database files
const cache = {};

// Initialize database directory
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
}

// Initialize database files and load into cache
const initDB = (filePath, defaultData = {}) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
  // Load initial data into cache
  try {
    cache[filePath] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    cache[filePath] = defaultData;
  }
};

initDB(GROUPS_DB, {});
initDB(USERS_DB, {});
initDB(WARNINGS_DB, {});
initDB(MODS_DB, { moderators: [] });
initDB(BANNED_DB, { banned: [] });
initDB(DISABLED_CMD_DB, {});
initDB(SECURITY_LOG_DB, { logs: [] });
initDB(ROLES_DB, {});

// Read database (from cache if available, otherwise from file)
const readDB = (filePath) => {
  if (!cache[filePath]) {
    try {
      cache[filePath] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
      console.error(`Error reading database file ${filePath}: ${error.message}`);
      cache[filePath] = {}; // Fallback to empty object on error
    }
  }
  return cache[filePath];
};

// Write database (to file and update cache)
const writeDB = (filePath, data) => {
  try {
    cache[filePath] = data; // Update cache first
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing database file ${filePath}: ${error.message}`);
    return false;
  }
};

// Group Settings
const getGroupSettings = (groupId) => {
  const groups = readDB(GROUPS_DB);
  if (!groups[groupId]) {
    groups[groupId] = { ...config.defaultGroupSettings };
    writeDB(GROUPS_DB, groups);
  }
  return groups[groupId];
};

const updateGroupSettings = (groupId, settings) => {
  const groups = readDB(GROUPS_DB);
  groups[groupId] = { ...groups[groupId], ...settings };
  return writeDB(GROUPS_DB, groups);
};

// User Data
const getUser = (userId) => {
  const users = readDB(USERS_DB);
  if (!users[userId]) {
    users[userId] = {
      registered: Date.now(),
      premium: false,
      banned: false
    };
    writeDB(USERS_DB, users);
  }
  return users[userId];
};

const updateUser = (userId, data) => {
  const users = readDB(USERS_DB);
  users[userId] = { ...users[userId], ...data };
  return writeDB(USERS_DB, users);
};

// Banned Users
const isBanned = (userId) => {
  const data = readDB(BANNED_DB);
  return data.banned.includes(userId);
};

const banUser = (userId) => {
  const data = readDB(BANNED_DB);
  if (!data.banned.includes(userId)) {
    data.banned.push(userId);
    return writeDB(BANNED_DB, data);
  }
  return false;
};

const unbanUser = (userId) => {
  const data = readDB(BANNED_DB);
  if (data.banned.includes(userId)) {
    data.banned = data.banned.filter(id => id !== userId);
    return writeDB(BANNED_DB, data);
  }
  return false;
};

// Disabled Commands
const isDisabled = (groupId, commandName) => {
  const data = readDB(DISABLED_CMD_DB);
  if (!data[groupId]) return false;
  return data[groupId].includes(commandName);
};

const disableCmd = (groupId, commandName) => {
  const data = readDB(DISABLED_CMD_DB);
  if (!data[groupId]) data[groupId] = [];
  if (!data[groupId].includes(commandName)) {
    data[groupId].push(commandName);
    return writeDB(DISABLED_CMD_DB, data);
  }
  return false;
};

const enableCmd = (groupId, commandName) => {
  const data = readDB(DISABLED_CMD_DB);
  if (data[groupId]) {
    data[groupId] = data[groupId].filter(cmd => cmd !== commandName);
    return writeDB(DISABLED_CMD_DB, data);
  }
  return false;
};

// Security Logs
const addSecurityLog = (log) => {
  const data = readDB(SECURITY_LOG_DB);
  data.logs.push({
    ...log,
    timestamp: Date.now()
  });
  // Keep last 100 logs
  if (data.logs.length > 100) data.logs.shift();
  return writeDB(SECURITY_LOG_DB, data);
};

const getSecurityLogs = () => {
  return readDB(SECURITY_LOG_DB).logs || [];
};

// Roles
const setRole = (userId, role) => {
  const roles = readDB(ROLES_DB);
  roles[userId] = role;
  return writeDB(ROLES_DB, roles);
};

const getRole = (userId) => {
  const roles = readDB(ROLES_DB);
  return roles[userId] || 'user';
};

const removeRole = (userId) => {
  const roles = readDB(ROLES_DB);
  delete roles[userId];
  return writeDB(ROLES_DB, roles);
};

// ... existing helper functions (warnings, mods) ...
const getWarnings = (groupId, userId) => {
  const warnings = readDB(WARNINGS_DB);
  const key = `${groupId}_${userId}`;
  return warnings[key] || { count: 0, warnings: [] };
};

const addWarning = (groupId, userId, reason) => {
  const warnings = readDB(WARNINGS_DB);
  const key = `${groupId}_${userId}`;
  if (!warnings[key]) warnings[key] = { count: 0, warnings: [] };
  warnings[key].count++;
  warnings[key].warnings.push({ reason, date: Date.now() });
  writeDB(WARNINGS_DB, warnings);
  return warnings[key];
};

const removeWarning = (groupId, userId) => {
  const warnings = readDB(WARNINGS_DB);
  const key = `${groupId}_${userId}`;
  if (warnings[key] && warnings[key].count > 0) {
    warnings[key].count--;
    warnings[key].warnings.pop();
    writeDB(WARNINGS_DB, warnings);
    return true;
  }
  return false;
};

const clearWarnings = (groupId, userId) => {
  const warnings = readDB(WARNINGS_DB);
  const key = `${groupId}_${userId}`;
  delete warnings[key];
  return writeDB(WARNINGS_DB, warnings);
};

const getModerators = () => {
  const mods = readDB(MODS_DB);
  return mods.moderators || [];
};

const addModerator = (userId) => {
  const mods = readDB(MODS_DB);
  if (!mods.moderators) mods.moderators = [];
  if (!mods.moderators.includes(userId)) {
    mods.moderators.push(userId);
    return writeDB(MODS_DB, mods);
  }
  return false;
};

const removeModerator = (userId) => {
  const mods = readDB(MODS_DB);
  if (mods.moderators) {
    mods.moderators = mods.moderators.filter(id => id !== userId);
    return writeDB(MODS_DB, mods);
  }
  return false;
};

const isModerator = (userId) => {
  const mods = getModerators();
  return mods.includes(userId);
};

module.exports = {
  getGroupSettings,
  updateGroupSettings,
  getUser,
  updateUser,
  getWarnings,
  addWarning,
  removeWarning,
  clearWarnings,
  getModerators,
  addModerator,
  removeModerator,
  isModerator,
  isBanned,
  banUser,
  unbanUser,
  isDisabled,
  disableCmd,
  enableCmd,
  addSecurityLog,
  getSecurityLogs,
  setRole,
  getRole,
  removeRole
};
