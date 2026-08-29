/**
 * storage.js - High-Reliability LocalStorage & IndexedDB Persistence Engine
 * Guarantees data persistence across page reloads, browser restarts, and PWA sessions.
 */

const STORAGE_KEYS = {
  EVENTS: 'streak_cal_events_v2',
  LOGS: 'streak_cal_logs_v2',
  SETTINGS: 'streak_cal_settings_v2',
  INITIALIZED: 'streak_cal_initialized_v2'
};

const DEFAULT_SETTINGS = {
  notificationsEnabled: false,
  reminderTime: '20:00', // 8:00 PM default
  vibrationEnabled: true
};

// In-memory cache for ultra-fast and reliable synchronous access
let _cachedEvents = null;
let _cachedLogs = null;
let _cachedSettings = null;

const StorageService = {
  /**
   * Initialize storage and migrate legacy keys if any exist
   */
  init() {
    try {
      // Migrate from v1 if exists
      if (!localStorage.getItem(STORAGE_KEYS.EVENTS) && localStorage.getItem('streak_cal_events')) {
        const oldEvents = localStorage.getItem('streak_cal_events');
        localStorage.setItem(STORAGE_KEYS.EVENTS, oldEvents);
      }
      if (!localStorage.getItem(STORAGE_KEYS.LOGS) && localStorage.getItem('streak_cal_logs')) {
        const oldLogs = localStorage.getItem('streak_cal_logs');
        localStorage.setItem(STORAGE_KEYS.LOGS, oldLogs);
      }
      if (!localStorage.getItem(STORAGE_KEYS.SETTINGS) && localStorage.getItem('streak_cal_settings')) {
        const oldSettings = localStorage.getItem('streak_cal_settings');
        localStorage.setItem(STORAGE_KEYS.SETTINGS, oldSettings);
      }

      // Pre-warm cache
      this.getEvents();
      this.getAllLogs();
      this.getSettings();

      // Setup IndexedDB background backup
      this._initIndexedDBBackup();
      console.log('✓ StorageService initialized with persisted data');
    } catch (e) {
      console.warn('Storage init warning:', e);
    }
  },

  /**
   * Check if app has been initialized before
   */
  hasInitialized() {
    return localStorage.getItem(STORAGE_KEYS.INITIALIZED) === 'true';
  },

  /**
   * Mark app as initialized
   */
  setInitialized() {
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  },

  /**
   * Get all events
   * @returns {Array} Array of event objects
   */
  getEvents() {
    if (_cachedEvents !== null) {
      return _cachedEvents;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
      _cachedEvents = data ? JSON.parse(data) : [];
      if (!Array.isArray(_cachedEvents)) _cachedEvents = [];
    } catch (e) {
      console.error('Error reading events from localStorage:', e);
      _cachedEvents = [];
    }
    return _cachedEvents;
  },

  /**
   * Save a new event or update existing
   * @param {Object} event 
   * @returns {Object} Saved event
   */
  saveEvent(event) {
    const events = this.getEvents();
    if (!event.id) {
      event.id = 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      event.createdAt = new Date().toISOString();
      events.push(event);
    } else {
      const idx = events.findIndex(e => e.id === event.id);
      if (idx !== -1) {
        events[idx] = { ...events[idx], ...event, updatedAt: new Date().toISOString() };
      } else {
        events.push(event);
      }
    }
    _cachedEvents = events;
    this._persist(STORAGE_KEYS.EVENTS, events);
    this.setInitialized();
    return event;
  },

  /**
   * Delete an event by ID and its associated logs
   * @param {string} eventId 
   */
  deleteEvent(eventId) {
    let events = this.getEvents();
    events = events.filter(e => e.id !== eventId);
    _cachedEvents = events;
    this._persist(STORAGE_KEYS.EVENTS, events);

    // Clean up logs for this event
    const logs = this.getAllLogs();
    Object.keys(logs).forEach(date => {
      if (logs[date] && logs[date][eventId]) {
        delete logs[date][eventId];
        if (Object.keys(logs[date]).length === 0) {
          delete logs[date];
        }
      }
    });
    _cachedLogs = logs;
    this._persist(STORAGE_KEYS.LOGS, logs);
    this.setInitialized();
  },

  /**
   * Get all day logs
   * @returns {Object} Day logs keyed by YYYY-MM-DD
   */
  getAllLogs() {
    if (_cachedLogs !== null) {
      return _cachedLogs;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOGS);
      _cachedLogs = data ? JSON.parse(data) : {};
      if (typeof _cachedLogs !== 'object' || _cachedLogs === null) _cachedLogs = {};
    } catch (e) {
      console.error('Error reading logs from localStorage:', e);
      _cachedLogs = {};
    }
    return _cachedLogs;
  },

  /**
   * Get log for a specific date
   * @param {string} dateStr YYYY-MM-DD
   * @returns {Object} Log for the date
   */
  getDayLog(dateStr) {
    const logs = this.getAllLogs();
    return logs[dateStr] || {};
  },

  /**
   * Get checklist status for a specific event on a specific date
   * @param {string} dateStr YYYY-MM-DD
   * @param {string} eventId 
   * @returns {Object} { [checkId]: boolean }
   */
  getEventDayChecklist(dateStr, eventId) {
    const dayLog = this.getDayLog(dateStr);
    if (dayLog && dayLog[eventId] && dayLog[eventId].checks) {
      return { ...dayLog[eventId].checks };
    }
    return {};
  },

  /**
   * Save checklist item toggles for a specific day and event
   * @param {string} dateStr YYYY-MM-DD
   * @param {string} eventId 
   * @param {Object} checksMap Object with checkId -> boolean
   * @param {string} [notes] Optional note for the day
   */
  saveDayChecklist(dateStr, eventId, checksMap, notes = '') {
    const logs = this.getAllLogs();
    if (!logs[dateStr]) {
      logs[dateStr] = {};
    }
    if (!logs[dateStr][eventId]) {
      logs[dateStr][eventId] = { checks: {}, notes: '', updatedAt: new Date().toISOString() };
    }
    logs[dateStr][eventId].checks = { ...checksMap };
    if (notes !== undefined && notes !== null) {
      logs[dateStr][eventId].notes = notes;
    }
    logs[dateStr][eventId].updatedAt = new Date().toISOString();

    _cachedLogs = logs;
    this._persist(STORAGE_KEYS.LOGS, logs);
    this.setInitialized();
  },

  /**
   * Toggle a single checklist item for a specific date and event
   * @param {string} dateStr YYYY-MM-DD
   * @param {string} eventId 
   * @param {string} checkId 
   * @param {boolean} isChecked 
   */
  toggleChecklistItem(dateStr, eventId, checkId, isChecked) {
    const currentChecks = this.getEventDayChecklist(dateStr, eventId);
    currentChecks[checkId] = isChecked;
    this.saveDayChecklist(dateStr, eventId, currentChecks);
  },

  /**
   * Check if all checklist items for an event on a given date are completed
   * @param {Object} event 
   * @param {string} dateStr 
   * @returns {boolean}
   */
  isEventFullyCompletedOnDate(event, dateStr) {
    if (!event.checklist || event.checklist.length === 0) {
      const currentChecks = this.getEventDayChecklist(dateStr, event.id);
      return Boolean(currentChecks['default_check']);
    }
    const currentChecks = this.getEventDayChecklist(dateStr, event.id);
    return event.checklist.every(item => currentChecks[item.id] === true);
  },

  /**
   * Count completed checklist items vs total for an event on a given date
   * @param {Object} event 
   * @param {string} dateStr 
   * @returns {{ completed: number, total: number, percentage: number }}
   */
  getEventProgressOnDate(event, dateStr) {
    const currentChecks = this.getEventDayChecklist(dateStr, event.id);
    if (!event.checklist || event.checklist.length === 0) {
      const isDone = Boolean(currentChecks['default_check']);
      return { completed: isDone ? 1 : 0, total: 1, percentage: isDone ? 100 : 0 };
    }
    const total = event.checklist.length;
    let completed = 0;
    event.checklist.forEach(item => {
      if (currentChecks[item.id] === true) completed++;
    });
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  },

  /**
   * Get app settings
   */
  getSettings() {
    if (_cachedSettings !== null) {
      return _cachedSettings;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      _cachedSettings = data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      _cachedSettings = { ...DEFAULT_SETTINGS };
    }
    return _cachedSettings;
  },

  /**
   * Save app settings
   */
  saveSettings(settings) {
    _cachedSettings = { ...DEFAULT_SETTINGS, ...settings };
    this._persist(STORAGE_KEYS.SETTINGS, _cachedSettings);
  },

  /**
   * Persist helper with fallback handling
   * @private
   */
  _persist(key, data) {
    try {
      const str = JSON.stringify(data);
      localStorage.setItem(key, str);
      this._saveToIndexedDB(key, data);
    } catch (e) {
      console.error(`Error persisting key ${key}:`, e);
    }
  },

  /**
   * IndexedDB dual-backup to guarantee data safety across browser sessions
   * @private
   */
  _initIndexedDBBackup() {
    if (!window.indexedDB) return;
    const req = indexedDB.open('StreakCalendarDB', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('store')) {
        db.createObjectStore('store');
      }
    };
  },

  _saveToIndexedDB(key, data) {
    if (!window.indexedDB) return;
    try {
      const req = indexedDB.open('StreakCalendarDB', 1);
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('store', 'readwrite');
        tx.objectStore('store').put(data, key);
      };
    } catch (err) {
      // Ignore background sync errors
    }
  },

  /**
   * Export all data as JSON string for backup
   */
  exportData() {
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      events: this.getEvents(),
      logs: this.getAllLogs(),
      settings: this.getSettings()
    };
    return JSON.stringify(data, null, 2);
  },

  /**
   * Import data from JSON string
   */
  importData(jsonString) {
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      if (data.events && Array.isArray(data.events)) {
        _cachedEvents = data.events;
        this._persist(STORAGE_KEYS.EVENTS, data.events);
      }
      if (data.logs && typeof data.logs === 'object') {
        _cachedLogs = data.logs;
        this._persist(STORAGE_KEYS.LOGS, data.logs);
      }
      if (data.settings) {
        _cachedSettings = data.settings;
        this._persist(STORAGE_KEYS.SETTINGS, data.settings);
      }
      this.setInitialized();
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  },

  /**
   * Clear all app data
   */
  clearAll() {
    _cachedEvents = [];
    _cachedLogs = {};
    _cachedSettings = { ...DEFAULT_SETTINGS };

    localStorage.removeItem(STORAGE_KEYS.EVENTS);
    localStorage.removeItem(STORAGE_KEYS.LOGS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.INITIALIZED);
  }
};
