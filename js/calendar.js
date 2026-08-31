/**
 * calendar.js - High-Precision Calendar, UTC-Safe Date Math & Streak Analytics
 */

const CalendarService = {
  MONTH_NAMES: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ],

  SHORT_MONTH_NAMES: [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ],

  DAY_NAMES: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],

  /**
   * Format a Date object to YYYY-MM-DD in local time
   * @param {Date} date 
   * @returns {string}
   */
  formatDate(date) {
    if (!date) date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Parse YYYY-MM-DD string to local Date object
   * @param {string} str 
   * @returns {Date}
   */
  parseDate(str) {
    if (!str) return new Date();
    const parts = str.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  },

  /**
   * Format display date string like "Saturday, Aug 29, 2026"
   * @param {string|Date} date 
   * @returns {string}
   */
  formatDisplayDate(date) {
    const d = typeof date === 'string' ? this.parseDate(date) : date;
    const dayOfWeek = this.DAY_NAMES[d.getDay()];
    const monthName = this.SHORT_MONTH_NAMES[d.getMonth()];
    const dayNum = d.getDate();
    const year = d.getFullYear();
    return `${dayOfWeek}, ${monthName} ${dayNum}, ${year}`;
  },

  /**
   * Calculate difference in days between two date strings (date2 - date1)
   * Uses UTC timestamps to prevent any Daylight Saving Time / timezone shifting issues.
   * @param {string} dateStr1 YYYY-MM-DD
   * @param {string} dateStr2 YYYY-MM-DD
   * @returns {number}
   */
  diffDays(dateStr1, dateStr2) {
    if (!dateStr1 || !dateStr2) return 0;
    const p1 = dateStr1.split('-').map(Number);
    const p2 = dateStr2.split('-').map(Number);
    const utc1 = Date.UTC(p1[0], p1[1] - 1, p1[2]);
    const utc2 = Date.UTC(p2[0], p2[1] - 1, p2[2]);
    return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
  },

  /**
   * Check if a specific date falls within an event's active timeline
   * @param {string} dateStr YYYY-MM-DD
   * @param {Object} event 
   * @returns {boolean}
   */
  isDateInEvent(dateStr, event) {
    if (!event || !event.startDate) return false;
    const dayIndex = this.diffDays(event.startDate, dateStr) + 1;
    if (dayIndex < 1) return false;

    if (event.isOngoing) {
      return true;
    }

    if (event.durationDays) {
      return dayIndex <= event.durationDays;
    }

    if (event.endDate) {
      return this.diffDays(dateStr, event.endDate) >= 0;
    }

    return true;
  },

  /**
   * Get the custom counter day number for an event on a specific date (e.g. Day 1, Day 2)
   * @param {string} dateStr YYYY-MM-DD
   * @param {Object} event 
   * @returns {{ dayNumber: number, totalDays: number|null, isOngoing: boolean, isWithin: boolean, isFuture: boolean }}
   */
  getEventDayInfo(dateStr, event) {
    const dayNumber = this.diffDays(event.startDate, dateStr) + 1;
    const isWithin = this.isDateInEvent(dateStr, event);
    const totalDays = event.durationDays || null;
    const isOngoing = Boolean(event.isOngoing);

    const todayStr = this.formatDate(new Date());
    const isFuture = this.diffDays(todayStr, dateStr) > 0;

    return {
      dayNumber,
      totalDays,
      isOngoing,
      isWithin,
      isFuture,
      label: isWithin ? (isOngoing ? `Day ${dayNumber}` : `Day ${dayNumber}${totalDays ? '/' + totalDays : ''}`) : ''
    };
  },

  /**
   * Calculate consecutive streak of completed days for an event up to today
   * @param {Object} event 
   * @returns {{ currentStreak: number, maxStreak: number, totalCompletedDays: number }}
   */
  calculateEventStats(event) {
    const today = new Date();
    const todayStr = this.formatDate(today);
    const startDate = this.parseDate(event.startDate);
    const daysSinceStart = this.diffDays(event.startDate, todayStr);

    if (daysSinceStart < 0) {
      return { currentStreak: 0, maxStreak: 0, totalCompletedDays: 0 };
    }

    let maxStreak = 0;
    let tempStreak = 0;
    let totalCompletedDays = 0;

    const maxDaysToCheck = event.durationDays ? Math.min(daysSinceStart + 1, event.durationDays) : daysSinceStart + 1;

    for (let i = 0; i < maxDaysToCheck; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(checkDate.getDate() + i);
      const checkDateStr = this.formatDate(checkDate);

      const isCompleted = StorageService.isEventFullyCompletedOnDate(event, checkDateStr);

      if (isCompleted) {
        totalCompletedDays++;
        tempStreak++;
        if (tempStreak > maxStreak) {
          maxStreak = tempStreak;
        }
      } else {
        if (checkDateStr !== todayStr) {
          tempStreak = 0;
        }
      }
    }

    // Determine current active streak ending at today or yesterday
    let activeStreak = 0;
    let curDate = new Date(today);

    // Check today first
    let curDateStr = this.formatDate(curDate);
    if (this.isDateInEvent(curDateStr, event) && StorageService.isEventFullyCompletedOnDate(event, curDateStr)) {
      activeStreak++;
      curDate.setDate(curDate.getDate() - 1);
    } else {
      // If today not yet completed, check if streak from yesterday continues
      curDate.setDate(curDate.getDate() - 1);
    }

    while (true) {
      curDateStr = this.formatDate(curDate);
      if (this.diffDays(event.startDate, curDateStr) < 0) break;
      if (!this.isDateInEvent(curDateStr, event)) break;

      if (StorageService.isEventFullyCompletedOnDate(event, curDateStr)) {
        activeStreak++;
        curDate.setDate(curDate.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      currentStreak: activeStreak,
      maxStreak: Math.max(maxStreak, activeStreak),
      totalCompletedDays
    };
  },

  /**
   * Generate calendar grid data for given year and month (0-indexed)
   * @param {number} year 
   * @param {number} month 
   * @returns {Array<Object>} Array of day cell objects
   */
  generateMonthData(year, month) {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const totalDaysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const todayStr = this.formatDate(new Date());
    const allEvents = StorageService.getEvents();

    const cells = [];

    // 1. Previous month trailing days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateStr = this.formatDate(prevDate);
      cells.push(this._createCellData(prevDate, dateStr, todayStr, allEvents, false));
    }

    // 2. Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const curDate = new Date(year, month, d);
      const dateStr = this.formatDate(curDate);
      cells.push(this._createCellData(curDate, dateStr, todayStr, allEvents, true));
    }

    // 3. Next month leading days to complete grid (42 cells = 6 rows)
    const remainingCells = 42 - cells.length;
    for (let n = 1; n <= remainingCells; n++) {
      const nextDate = new Date(year, month + 1, n);
      const dateStr = this.formatDate(nextDate);
      cells.push(this._createCellData(nextDate, dateStr, todayStr, allEvents, false));
    }

    return cells;
  },

  /**
   * Helper to compile data for a single day cell
   * @private
   */
  _createCellData(dateObj, dateStr, todayStr, allEvents, isCurrentMonth) {
    const isToday = (dateStr === todayStr);

    // Find all events active on this date
    const activeEvents = allEvents
      .filter(event => this.isDateInEvent(dateStr, event))
      .map(event => {
        const dayInfo = this.getEventDayInfo(dateStr, event);
        const isCompleted = StorageService.isEventFullyCompletedOnDate(event, dateStr);
        const progress = StorageService.getEventProgressOnDate(event, dateStr);

        return {
          id: event.id,
          title: event.title,
          color: event.color || '#6366f1',
          dayNumber: dayInfo.dayNumber,
          totalDays: dayInfo.totalDays,
          isOngoing: dayInfo.isOngoing,
          label: dayInfo.label,
          isCompleted,
          progress
        };
      });

    const hasEvents = activeEvents.length > 0;
    const allCompleted = hasEvents && activeEvents.every(e => e.isCompleted);
    const anyCompleted = hasEvents && activeEvents.some(e => e.isCompleted || e.progress.completed > 0);

    return {
      date: dateObj,
      dateStr,
      dayNumber: dateObj.getDate(),
      isCurrentMonth,
      isToday,
      activeEvents,
      hasEvents,
      allCompleted,
      anyCompleted
    };
  }
};
