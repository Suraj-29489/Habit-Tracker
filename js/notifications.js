/**
 * notifications.js - Web Notifications & Reminder Engine
 * Manages notification permissions, daily check-in prompts, and reminder schedules.
 */

const NotificationService = {
  isSupported() {
    return 'Notification' in window;
  },

  getPermissionStatus() {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission; // 'granted', 'denied', or 'default'
  },

  async requestPermission() {
    if (!this.isSupported()) {
      return { success: false, reason: 'unsupported' };
    }
    try {
      const permission = await Notification.requestPermission();
      const settings = StorageService.getSettings();
      settings.notificationsEnabled = (permission === 'granted');
      StorageService.saveSettings(settings);
      return { success: permission === 'granted', status: permission };
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return { success: false, reason: error.message };
    }
  },

  sendNotification(title, options = {}) {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return false;
    }

    const defaultOptions = {
      icon: './assets/icon.svg',
      badge: './assets/icon.svg',
      body: 'Time for your daily streak check-in! Keep the momentum going.',
      tag: 'daily-streak-reminder',
      renotify: true,
      data: { url: window.location.href }
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      // Use service worker notification if available
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, finalOptions);
        });
      } else {
        const notification = new Notification(title, finalOptions);
        notification.onclick = function () {
          window.focus();
          this.close();
        };
      }
      return true;
    } catch (e) {
      console.error('Notification display error:', e);
      return false;
    }
  },

  /**
   * Check if today's check-in reminder should fire
   */
  checkDailyReminder() {
    const settings = StorageService.getSettings();
    if (!settings.notificationsEnabled || Notification.permission !== 'granted') {
      return;
    }

    const events = StorageService.getEvents();
    if (events.length === 0) return;

    const todayStr = CalendarService.formatDate(new Date());

    // Check if there are incomplete events today
    const activeEventsToday = events.filter(event => CalendarService.isDateInEvent(todayStr, event));
    if (activeEventsToday.length === 0) return;

    let hasIncomplete = false;
    for (const evt of activeEventsToday) {
      if (!StorageService.isEventFullyCompletedOnDate(evt, todayStr)) {
        hasIncomplete = true;
        break;
      }
    }

    if (!hasIncomplete) {
      // All checked in for today!
      return;
    }

    // Check time condition (only fire once per day around or after reminderTime)
    const lastNotifiedKey = 'streak_last_notification_date';
    const lastNotifiedDate = localStorage.getItem(lastNotifiedKey);

    if (lastNotifiedDate === todayStr) {
      return; // Already notified today
    }

    const [reminderHours, reminderMinutes] = (settings.reminderTime || '20:00').split(':').map(Number);
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    if (currentHours > reminderHours || (currentHours === reminderHours && currentMinutes >= reminderMinutes)) {
      this.sendNotification('🔥 Daily Streak Reminder', {
        body: `You have active challenges waiting for your check-in today! Keep your streak alive.`,
      });
      localStorage.setItem(lastNotifiedKey, todayStr);
    }
  },

  /**
   * Start interval check (runs every 5 minutes when tab is open)
   */
  startScheduler() {
    // Initial check
    this.checkDailyReminder();

    // Check periodically
    setInterval(() => {
      this.checkDailyReminder();
    }, 5 * 60 * 1000);
  }
};

