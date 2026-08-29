/**
 * storage.js - LocalStorage management for Streak & Habit Calendar
 * Provides clean CRUD helpers and handles data persistence in browser/phone internal storage.
 */

const STORAGE_KEYS = {
  EVENTS: 'streak_cal_events',
  LOGS: 'streak_cal_logs',
  SETTINGS: 'streak_cal_settings'
};

const DEFAULT_SETTINGS = {
  notificationsEnabled: false,
  reminderTime: '20:00', // 8:00 PM default
  vibrationEnabled: true
};

const StorageService = {
  /**
   * Get all events
   * @returns {Array} Array of event objects
   */
  getEvents() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading events from localStorage:', e);
      return [];
    }
  },

  /**
   * Save a new event or update existing
   * @param {Object} event 
   * @returns {Object} Saved event
   */
  saveEvent(event) {
    const events = this.getEvents();
    if (!event.id) {
      event.id = 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
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
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    return event;
  },

  /**
   * Delete an event by ID and its associated logs
   * @param {string} eventId 
   */
  deleteEvent(eventId) {
    let events = this.getEvents();
    events = events.filter(e => e.id !== eventId);
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));

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
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  },

  /**
   * Get all day logs
   * @returns {Object} Day logs keyed by YYYY-MM-DD
   */
  getAllLogs() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOGS);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('Error reading logs from localStorage:', e);
      return {};
    }
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
    return (dayLog && dayLog[eventId]) ? dayLog[eventId].checks || {} : {};
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
    logs[dateStr][eventId].checks = checksMap;
    if (notes !== undefined && notes !== null) {
      logs[dateStr][eventId].notes = notes;
    }
    logs[dateStr][eventId].updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
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
      return false;
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
    if (!event.checklist || event.checklist.length === 0) {
      return { completed: 0, total: 0, percentage: 0 };
    }
    const currentChecks = this.getEventDayChecklist(dateStr, event.id);
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
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  },

  /**
   * Save app settings
   */
  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  /**
   * Export all data as JSON string for backup
   */
  exportData() {
    const data = {
      version: 1,
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
        localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(data.events));
      }
      if (data.logs && typeof data.logs === 'object') {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(data.logs));
      }
      if (data.settings) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
      }
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
    localStorage.removeItem(STORAGE_KEYS.EVENTS);
    localStorage.removeItem(STORAGE_KEYS.LOGS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  }
};

