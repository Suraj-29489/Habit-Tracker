/**
 * app.js - Main Application Coordinator
 * Handles calendar interactions, modals, dynamic checklist management, and UI state.
 */

// App State
const AppState = {
  currentDate: new Date(),
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(),
  selectedDateStr: null,
  editingEventId: null
};

// Available color presets
const COLOR_PRESETS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#3b82f6'  // Blue
];

// PWA Install Prompt State
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) installBtn.style.display = 'inline-flex';
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) installBtn.style.display = 'none';
  showToast('🎉 App installed successfully to your home screen!');
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // 1. Initialize Storage Service (loads and caches all persisted data)
  StorageService.init();

  // 2. Register Service Worker for PWA / offline support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('ServiceWorker registration skipped/failed:', err);
    });
  }

  // 3. Set initial date state
  AppState.selectedDateStr = CalendarService.formatDate(AppState.currentDate);

  // 4. Initialize default sample event only if first time launch ever
  initSampleDataIfEmpty();

  // 5. Bind UI Event Listeners
  bindEvents();

  // 6. Initial Render
  renderAll();

  // 7. Start Notification Engine
  NotificationService.startScheduler();
}

/**
 * Creates an initial welcoming tracker ONLY on the very first visit
 */
function initSampleDataIfEmpty() {
  if (!StorageService.hasInitialized()) {
    const events = StorageService.getEvents();
    if (events.length === 0) {
      const todayStr = CalendarService.formatDate(new Date());
      StorageService.saveEvent({
        title: 'Daily Goal & Habit Tracker',
        startDate: todayStr,
        durationDays: 30,
        isOngoing: false,
        color: '#6366f1',
        checklist: [
          { id: 'chk_1', text: 'Daily Check-in & Stayed on Track' },
          { id: 'chk_2', text: 'Mindfulness / Cold Shower / Exercise' },
          { id: 'chk_3', text: 'Reflection / Journaling' }
        ]
      });
    }
    StorageService.setInitialized();
  }
}

/**
 * Bind DOM Event Listeners
 */
function bindEvents() {
  // Month Navigation
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    navigateMonth(-1);
  });

  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    navigateMonth(1);
  });

  document.getElementById('todayBtn').addEventListener('click', () => {
    const now = new Date();
    AppState.viewYear = now.getFullYear();
    AppState.viewMonth = now.getMonth();
    renderAll();
  });

  // FAB & Header Create Tracker Buttons
  document.getElementById('newTrackerFab').addEventListener('click', () => {
    openCreateEventModal();
  });

  document.getElementById('newTrackerHeaderBtn').addEventListener('click', () => {
    openCreateEventModal();
  });

  // Settings Modal Buttons
  document.getElementById('settingsBtn').addEventListener('click', () => {
    openSettingsModal();
  });

  // Modal Closers
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      if (modal) closeModal(modal.id);
    });
  });

  // Close modal when clicking backdrop
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });

  // Create Event Form Submission
  const eventForm = document.getElementById('eventForm');
  if (eventForm) {
    eventForm.addEventListener('submit', handleSaveEvent);
  }

  // Duration Chip Buttons
  document.querySelectorAll('.chip-btn[data-days]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip-btn[data-days]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const daysVal = chip.getAttribute('data-days');
      const customDaysGroup = document.getElementById('customDaysGroup');
      const customDaysInput = document.getElementById('eventCustomDays');

      if (daysVal === 'custom') {
        customDaysGroup.style.display = 'block';
        customDaysInput.focus();
      } else if (daysVal === 'ongoing') {
        customDaysGroup.style.display = 'none';
        customDaysInput.value = '';
      } else {
        customDaysGroup.style.display = 'none';
        customDaysInput.value = daysVal;
      }
    });
  });

  // Add checklist item in create modal
  document.getElementById('addChecklistItemBtn').addEventListener('click', () => {
    addChecklistBuilderItem('');
  });

  // Clear all checkboxes for manual entry only
  const clearChecklistBtn = document.getElementById('clearChecklistBtn');
  if (clearChecklistBtn) {
    clearChecklistBtn.addEventListener('click', () => {
      document.getElementById('checklistBuilderContainer').innerHTML = '';
      showToast('All checkboxes removed. Tracker will use Daily Manual Notes!');
    });
  }

  // Day Modal: Add event shortcut
  document.getElementById('dayModalAddEventBtn').addEventListener('click', () => {
    closeModal('dayDetailModal');
    openCreateEventModal(AppState.selectedDateStr);
  });

  // PWA Install Handlers
  const installAppBtn = document.getElementById('installAppBtn');
  if (installAppBtn) installAppBtn.addEventListener('click', triggerInstallPrompt);

  const settingsInstallBtn = document.getElementById('settingsInstallBtn');
  if (settingsInstallBtn) settingsInstallBtn.addEventListener('click', triggerInstallPrompt);

  // Settings Actions
  document.getElementById('notificationToggleBtn').addEventListener('click', handleToggleNotification);
  document.getElementById('reminderTimeInput').addEventListener('change', handleSaveReminderTime);
  document.getElementById('exportDataBtn').addEventListener('click', handleExportData);
  document.getElementById('importDataBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', handleImportFile);
  document.getElementById('clearDataBtn').addEventListener('click', handleClearAllData);
}

/**
 * Navigate month forward/backward
 */
function navigateMonth(direction) {
  AppState.viewMonth += direction;
  if (AppState.viewMonth > 11) {
    AppState.viewMonth = 0;
    AppState.viewYear += 1;
  } else if (AppState.viewMonth < 0) {
    AppState.viewMonth = 11;
    AppState.viewYear -= 1;
  }
  renderAll();
}

/**
 * Master render function
 */
function renderAll() {
  renderHeaderControls();
  renderStatsBar();
  renderCalendar();
  renderTrackersList();
}

/**
 * Render Month/Year header
 */
function renderHeaderControls() {
  const monthName = CalendarService.MONTH_NAMES[AppState.viewMonth];
  document.getElementById('currentMonthHeading').textContent = `${monthName} ${AppState.viewYear}`;
}

/**
 * Render Quick Stats Bar
 */
function renderStatsBar() {
  const events = StorageService.getEvents();
  const todayStr = CalendarService.formatDate(new Date());

  let totalActive = 0;
  let highestStreak = 0;
  let completedToday = 0;
  let totalTodayEvents = 0;

  events.forEach(evt => {
    if (CalendarService.isDateInEvent(todayStr, evt)) {
      totalTodayEvents++;
      if (StorageService.isEventFullyCompletedOnDate(evt, todayStr)) {
        completedToday++;
      }
    }
    const stats = CalendarService.calculateEventStats(evt);
    if (stats.currentStreak > highestStreak) {
      highestStreak = stats.currentStreak;
    }
    totalActive++;
  });

  document.getElementById('statActiveHabits').textContent = totalActive;
  document.getElementById('statHighestStreak').innerHTML = `${highestStreak} <span style="font-size:0.9rem">🔥</span>`;
  document.getElementById('statTodayProgress').textContent = totalTodayEvents > 0 
    ? `${completedToday}/${totalTodayEvents}` 
    : '0/0';
}

/**
 * Render the Calendar Grid
 */
function renderCalendar() {
  const daysContainer = document.getElementById('calendarDaysGrid');
  daysContainer.innerHTML = '';

  const cellsData = CalendarService.generateMonthData(AppState.viewYear, AppState.viewMonth);

  cellsData.forEach(cell => {
    const dayEl = document.createElement('div');
    dayEl.className = `day-cell ${cell.isCurrentMonth ? 'current-month' : 'other-month'} ${cell.isToday ? 'today' : ''}`;
    dayEl.setAttribute('data-date', cell.dateStr);

    // Top row: Day Number + Status Dot
    let statusDotHtml = '';
    if (cell.hasEvents) {
      if (cell.allCompleted) {
        statusDotHtml = `<span class="day-status-indicator all-done" title="All Completed"></span>`;
      } else if (cell.anyCompleted) {
        statusDotHtml = `<span class="day-status-indicator partial" title="In Progress"></span>`;
      }
    }

    let topHtml = `
      <div class="day-cell-top">
        <span class="day-number">${cell.dayNumber}</span>
        ${statusDotHtml}
      </div>
    `;

    // Events / Badges container
    let badgesHtml = '<div class="day-events-container">';
    cell.activeEvents.forEach(evt => {
      const checkIcon = evt.isCompleted ? '<span class="check-icon">✓</span>' : '';
      badgesHtml += `
        <div class="day-event-badge ${evt.isCompleted ? 'done' : ''}" 
             style="background: ${evt.color}22; color: ${evt.color}; border-left-color: ${evt.isCompleted ? '#10b981' : evt.color}">
          <span class="counter-tag">${evt.label}</span>
          <span class="event-title-text">${escapeHtml(evt.title)}</span>
          ${checkIcon}
        </div>
      `;
    });
    badgesHtml += '</div>';

    dayEl.innerHTML = topHtml + badgesHtml;

    // Click handler -> Open Day Detail & Check-in Modal
    dayEl.addEventListener('click', () => {
      openDayDetailModal(cell.dateStr);
    });

    daysContainer.appendChild(dayEl);
  });
}

/**
 * Render the list of active trackers below calendar
 */
function renderTrackersList() {
  const container = document.getElementById('trackersListContainer');
  const events = StorageService.getEvents();

  if (events.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎯</div>
        <div class="empty-state-text">No active trackers yet. Start your first challenge or habit!</div>
        <button class="btn btn-primary" onclick="openCreateEventModal()">+ Create Tracker</button>
      </div>
    `;
    return;
  }

  let html = '<div class="trackers-grid">';
  events.forEach(evt => {
    const stats = CalendarService.calculateEventStats(evt);
    const todayStr = CalendarService.formatDate(new Date());
    const dayInfo = CalendarService.getEventDayInfo(todayStr, evt);

    // Calculate overall duration progress
    let progressPercent = 0;
    let durationLabel = 'Ongoing Streak';
    if (evt.durationDays) {
      const currentDay = Math.max(1, Math.min(dayInfo.dayNumber, evt.durationDays));
      progressPercent = Math.min(100, Math.round((currentDay / evt.durationDays) * 100));
      durationLabel = `${evt.durationDays} Days Challenge (${currentDay}/${evt.durationDays})`;
    } else {
      progressPercent = 100;
    }

    const checkCount = evt.checklist ? evt.checklist.length : 0;

    html += `
      <div class="tracker-card" style="border-top: 3px solid ${evt.color || '#6366f1'}">
        <div class="tracker-card-header">
          <div class="tracker-title-group">
            <span class="tracker-color-dot" style="background: ${evt.color || '#6366f1'}"></span>
            <div>
              <div class="tracker-title">${escapeHtml(evt.title)}</div>
              <div class="tracker-meta">Started: ${evt.startDate} • ${durationLabel}</div>
            </div>
          </div>
          <div class="tracker-streak-badge">
            🔥 ${stats.currentStreak}d streak
          </div>
        </div>

        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width: ${progressPercent}%; background: ${evt.color || '#6366f1'}"></div>
        </div>

        <div class="tracker-card-footer">
          <span>${checkCount} Daily Check${checkCount === 1 ? '' : 's'}</span>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-icon" style="padding:4px 8px; font-size:0.75rem;" onclick="openEditEventModal('${evt.id}')" title="Edit">✏️</button>
            <button class="btn btn-icon btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="handleDeleteEvent('${evt.id}')" title="Delete">🗑️</button>
          </div>
        </div>
      </div>
    `;
  });
  html += '</div>';

  container.innerHTML = html;
}

/**
 * Open Day Detail & Check-in Modal
 */
function openDayDetailModal(dateStr) {
  AppState.selectedDateStr = dateStr;
  const events = StorageService.getEvents();
  const activeEvents = events.filter(e => CalendarService.isDateInEvent(dateStr, e));

  document.getElementById('dayModalDateText').textContent = CalendarService.formatDisplayDate(dateStr);

  const container = document.getElementById('dayModalEventsContainer');
  container.innerHTML = '';

  if (activeEvents.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px 10px;">
        <div class="empty-state-icon">📅</div>
        <div class="empty-state-text">No active trackers for this day.</div>
      </div>
    `;
  } else {
    activeEvents.forEach(evt => {
      const dayInfo = CalendarService.getEventDayInfo(dateStr, evt);
      const isCompleted = StorageService.isEventFullyCompletedOnDate(evt, dateStr);
      const checksMap = StorageService.getEventDayChecklist(dateStr, evt.id);
      const savedNote = StorageService.getEventDayNotes(dateStr, evt.id);

      const card = document.createElement('div');
      card.className = 'day-event-card';
      card.style.borderLeft = `4px solid ${evt.color || '#6366f1'}`;

      // Custom Quote Banner
      let quoteHtml = '';
      if (evt.customQuote && evt.customQuote.trim().length > 0) {
        quoteHtml = `
          <div class="day-quote-banner">
            <span class="day-quote-icon">“</span>
            <span>${escapeHtml(evt.customQuote)}</span>
          </div>
        `;
      }

      // Checkboxes section
      let checklistHtml = '';
      if (evt.checklist && evt.checklist.length > 0) {
        checklistHtml = '<div style="display:flex; flex-direction:column; gap:8px;">';
        evt.checklist.forEach(item => {
          const isChecked = Boolean(checksMap[item.id]);
          checklistHtml += `
            <div class="day-check-item ${isChecked ? 'checked' : ''}" data-evt-id="${evt.id}" data-chk-id="${item.id}">
              <div class="custom-checkbox"></div>
              <span class="day-check-text">${escapeHtml(item.text)}</span>
            </div>
          `;
        });
        checklistHtml += '</div>';
      } else {
        // Manual entry / No checkboxes mode
        const isDone = Boolean(checksMap['default_check'] || (savedNote && savedNote.trim().length > 0));
        checklistHtml = `
          <div class="day-check-item ${isDone ? 'checked' : ''}" data-evt-id="${evt.id}" data-chk-id="default_check">
            <div class="custom-checkbox"></div>
            <span class="day-check-text">${isDone ? '✓ Day Goal Completed & Logged' : 'Mark Day as Completed'}</span>
          </div>
        `;
      }

      // Daily Manual Notes / Reflection Textarea (shown if enableNotes !== false)
      let notesHtml = '';
      if (evt.enableNotes !== false) {
        notesHtml = `
          <div class="day-notes-section">
            <div class="day-notes-header">
              <span>✍️ Daily Manual Note / Reflection</span>
              <span class="save-note-status" id="noteStatus_${evt.id}">${savedNote ? 'Saved ✓' : ''}</span>
            </div>
            <textarea class="day-notes-textarea" id="noteInput_${evt.id}" placeholder="Write your thoughts, daily accomplishments, or notes for today...">${escapeHtml(savedNote)}</textarea>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="day-event-card-header">
          <div style="font-weight:700; font-size:1rem;">${escapeHtml(evt.title)}</div>
          <span class="day-event-counter-banner ${isCompleted ? 'completed' : ''}">
            ${isCompleted ? '✓ ' : '🔥 '}${dayInfo.label}
          </span>
        </div>
        ${quoteHtml}
        ${checklistHtml}
        ${notesHtml}
      `;

      // Attach checkbox click handlers
      card.querySelectorAll('.day-check-item').forEach(itemEl => {
        itemEl.addEventListener('click', () => {
          const evtId = itemEl.getAttribute('data-evt-id');
          const chkId = itemEl.getAttribute('data-chk-id');
          const isCurrentlyChecked = itemEl.classList.contains('checked');
          const newChecked = !isCurrentlyChecked;

          // Toggle state in DOM
          itemEl.classList.toggle('checked', newChecked);

          // Save in storage immediately
          StorageService.toggleChecklistItem(dateStr, evtId, chkId, newChecked);

          if (navigator.vibrate) {
            navigator.vibrate(20);
          }

          // Update card banner & text if manual mode
          if (!evt.checklist || evt.checklist.length === 0) {
            const checkText = itemEl.querySelector('.day-check-text');
            if (checkText) {
              checkText.textContent = newChecked ? '✓ Day Goal Completed & Logged' : 'Mark Day as Completed';
            }
          }

          // Check if now fully completed and update card banner
          const updatedCompleted = StorageService.isEventFullyCompletedOnDate(evt, dateStr);
          const banner = card.querySelector('.day-event-counter-banner');
          if (banner) {
            banner.className = `day-event-counter-banner ${updatedCompleted ? 'completed' : ''}`;
            banner.innerHTML = `${updatedCompleted ? '✓ ' : '🔥 '}${dayInfo.label}`;
          }

          // Re-render background calendar & stats
          renderCalendar();
          renderStatsBar();
          renderTrackersList();

          if (updatedCompleted && newChecked) {
            showToast(`🔥 ${dayInfo.label} Completed! Keep up the momentum!`);
          }
        });
      });

      // Attach auto-save notes listener
      const noteInput = card.querySelector(`#noteInput_${evt.id}`);
      if (noteInput) {
        const noteStatus = card.querySelector(`#noteStatus_${evt.id}`);
        let debounceTimer = null;

        noteInput.addEventListener('input', (e) => {
          if (noteStatus) noteStatus.textContent = 'Saving...';
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            const noteVal = e.target.value;
            StorageService.saveDayNotes(dateStr, evt.id, noteVal);
            if (noteStatus) noteStatus.textContent = 'Saved ✓';

            // Check if now completed in manual notes mode
            const updatedCompleted = StorageService.isEventFullyCompletedOnDate(evt, dateStr);
            const banner = card.querySelector('.day-event-counter-banner');
            if (banner) {
              banner.className = `day-event-counter-banner ${updatedCompleted ? 'completed' : ''}`;
              banner.innerHTML = `${updatedCompleted ? '✓ ' : '🔥 '}${dayInfo.label}`;
            }

            renderCalendar();
            renderStatsBar();
            renderTrackersList();
          }, 300);
        });
      }

      container.appendChild(card);
    });
  }

  openModal('dayDetailModal');
}

/**
 * Open Create / Edit Event Modal
 */
function openCreateEventModal(startDateStr = null) {
  AppState.editingEventId = null;
  document.getElementById('eventModalTitle').textContent = 'Create New Tracker';
  document.getElementById('eventForm').reset();

  const startInput = document.getElementById('eventStartDate');
  startInput.value = startDateStr || AppState.selectedDateStr || CalendarService.formatDate(new Date());

  // Reset duration chips to 30 days default
  document.querySelectorAll('.chip-btn[data-days]').forEach(c => c.classList.remove('active'));
  const defaultChip = document.querySelector('.chip-btn[data-days="30"]');
  if (defaultChip) defaultChip.classList.add('active');
  document.getElementById('eventCustomDays').value = '30';
  document.getElementById('customDaysGroup').style.display = 'none';

  // Render Color Picker
  renderColorPicker('#6366f1');

  // Reset & Populate Checklist Builder with stable default IDs
  const checklistContainer = document.getElementById('checklistBuilderContainer');
  checklistContainer.innerHTML = '';
  addChecklistBuilderItem('Stayed Clean & Focused', 'chk_1');
  addChecklistBuilderItem('Completed Daily Goal', 'chk_2');

  // Reset Custom Quote & Enable Notes
  const quoteInput = document.getElementById('eventCustomQuote');
  if (quoteInput) quoteInput.value = '';
  const notesCheckbox = document.getElementById('eventEnableNotes');
  if (notesCheckbox) notesCheckbox.checked = true;

  openModal('createEventModal');
}

/**
 * Open Edit Modal for existing event
 */
function openEditEventModal(eventId) {
  const events = StorageService.getEvents();
  const event = events.find(e => e.id === eventId);
  if (!event) return;

  AppState.editingEventId = eventId;
  document.getElementById('eventModalTitle').textContent = 'Edit Tracker';

  document.getElementById('eventTitle').value = event.title;
  document.getElementById('eventStartDate').value = event.startDate;

  // Duration settings
  document.querySelectorAll('.chip-btn[data-days]').forEach(c => c.classList.remove('active'));
  const customDaysGroup = document.getElementById('customDaysGroup');
  const customDaysInput = document.getElementById('eventCustomDays');

  if (event.isOngoing) {
    const ongoingChip = document.querySelector('.chip-btn[data-days="ongoing"]');
    if (ongoingChip) ongoingChip.classList.add('active');
    customDaysGroup.style.display = 'none';
    customDaysInput.value = '';
  } else if ([7, 10, 20, 21, 30, 90].includes(event.durationDays)) {
    const matchingChip = document.querySelector(`.chip-btn[data-days="${event.durationDays}"]`);
    if (matchingChip) matchingChip.classList.add('active');
    customDaysGroup.style.display = 'none';
    customDaysInput.value = event.durationDays;
  } else {
    const customChip = document.querySelector('.chip-btn[data-days="custom"]');
    if (customChip) customChip.classList.add('active');
    customDaysGroup.style.display = 'block';
    customDaysInput.value = event.durationDays || '';
  }

  // Color
  renderColorPicker(event.color || '#6366f1');

  // Checklist items - preserving exact IDs
  const checklistContainer = document.getElementById('checklistBuilderContainer');
  checklistContainer.innerHTML = '';
  if (event.checklist && event.checklist.length > 0) {
    event.checklist.forEach(item => addChecklistBuilderItem(item.text, item.id));
  }

  // Custom Quote & Enable Notes
  const quoteInput = document.getElementById('eventCustomQuote');
  if (quoteInput) quoteInput.value = event.customQuote || '';
  const notesCheckbox = document.getElementById('eventEnableNotes');
  if (notesCheckbox) notesCheckbox.checked = (event.enableNotes !== false);

  openModal('createEventModal');
}

/**
 * Render Color Picker options
 */
function renderColorPicker(selectedColor) {
  const container = document.getElementById('colorPickerContainer');
  container.innerHTML = '';

  COLOR_PRESETS.forEach(color => {
    const opt = document.createElement('div');
    opt.className = `color-option ${color === selectedColor ? 'selected' : ''}`;
    opt.style.backgroundColor = color;
    opt.setAttribute('data-color', color);

    opt.addEventListener('click', () => {
      container.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });

    container.appendChild(opt);
  });
}

/**
 * Add a checklist item row to the builder
 */
function addChecklistBuilderItem(initialText = '', existingId = null) {
  const container = document.getElementById('checklistBuilderContainer');
  const row = document.createElement('div');
  row.className = 'checklist-builder-item';
  const itemId = existingId || ('chk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));
  row.setAttribute('data-item-id', itemId);

  row.innerHTML = `
    <span style="color:var(--text-muted)">☑</span>
    <input type="text" class="form-input" placeholder="e.g. Cold shower, Workout, Read 10 pages" value="${escapeHtml(initialText)}" required />
    <button type="button" class="btn-remove-item" title="Remove">✕</button>
  `;

  row.querySelector('.btn-remove-item').addEventListener('click', () => {
    row.remove();
  });

  container.appendChild(row);
}

/**
 * Save Event handler
 */
function handleSaveEvent(e) {
  e.preventDefault();

  const title = document.getElementById('eventTitle').value.trim();
  const startDate = document.getElementById('eventStartDate').value;

  if (!title || !startDate) {
    showToast('Please provide a title and start date');
    return;
  }

  // Active duration chip
  const activeChip = document.querySelector('.chip-btn[data-days].active');
  const durationType = activeChip ? activeChip.getAttribute('data-days') : '30';

  let durationDays = null;
  let isOngoing = false;

  if (durationType === 'ongoing') {
    isOngoing = true;
  } else if (durationType === 'custom') {
    const customVal = parseInt(document.getElementById('eventCustomDays').value, 10);
    durationDays = isNaN(customVal) || customVal < 1 ? 30 : customVal;
  } else {
    durationDays = parseInt(durationType, 10) || 30;
  }

  // Color
  const selectedColorEl = document.querySelector('.color-option.selected');
  const color = selectedColorEl ? selectedColorEl.getAttribute('data-color') : '#6366f1';

  // Checklist items - read from data-item-id to preserve IDs
  const checklistRows = document.querySelectorAll('#checklistBuilderContainer .checklist-builder-item');
  const checklist = [];
  checklistRows.forEach((row, idx) => {
    const inp = row.querySelector('input');
    const text = inp ? inp.value.trim() : '';
    const id = row.getAttribute('data-item-id') || `chk_${idx + 1}_${Date.now()}`;
    if (text) {
      checklist.push({ id, text });
    }
  });

  // Custom Quote & Daily Notes config
  const customQuoteEl = document.getElementById('eventCustomQuote');
  const customQuote = customQuoteEl ? customQuoteEl.value.trim() : '';

  const enableNotesEl = document.getElementById('eventEnableNotes');
  const enableNotes = enableNotesEl ? enableNotesEl.checked : true;

  const eventPayload = {
    title,
    startDate,
    durationDays,
    isOngoing,
    color,
    checklist,
    customQuote,
    enableNotes
  };

  if (AppState.editingEventId) {
    eventPayload.id = AppState.editingEventId;
  }

  StorageService.saveEvent(eventPayload);
  closeModal('createEventModal');
  renderAll();

  showToast(AppState.editingEventId ? 'Tracker updated successfully!' : '🔥 New Tracker created!');
}

/**
 * Delete Event handler
 */
function handleDeleteEvent(eventId) {
  if (confirm('Are you sure you want to delete this tracker and all its check-in records?')) {
    StorageService.deleteEvent(eventId);
    renderAll();
    showToast('Tracker deleted.');
  }
}

/**
 * Open Settings Modal
 */
function openSettingsModal() {
  const settings = StorageService.getSettings();
  const notifStatus = NotificationService.getPermissionStatus();

  const toggleBtn = document.getElementById('notificationToggleBtn');
  if (notifStatus === 'granted') {
    toggleBtn.textContent = 'Notifications Enabled (Active)';
    toggleBtn.className = 'btn btn-success';
  } else if (notifStatus === 'denied') {
    toggleBtn.textContent = 'Notifications Blocked in Browser';
    toggleBtn.className = 'btn btn-danger';
  } else {
    toggleBtn.textContent = 'Enable Daily Check-in Notifications';
    toggleBtn.className = 'btn btn-primary';
  }

  document.getElementById('reminderTimeInput').value = settings.reminderTime || '20:00';

  openModal('settingsModal');
}

/**
 * Toggle Notification Permission
 */
async function handleToggleNotification() {
  const result = await NotificationService.requestPermission();
  if (result.success) {
    showToast('🔔 Notifications enabled! Daily reminders are active.');
    openSettingsModal();
    NotificationService.sendNotification('🔥 Streak Notifications Enabled', {
      body: 'You will receive daily reminders to complete your check-in!'
    });
  } else {
    showToast('Please enable notifications in your browser/phone settings.');
    openSettingsModal();
  }
}

/**
 * Save Reminder Time
 */
function handleSaveReminderTime(e) {
  const settings = StorageService.getSettings();
  settings.reminderTime = e.target.value;
  StorageService.saveSettings(settings);
  showToast(`Reminder time set to ${e.target.value}`);
}

/**
 * Export data JSON
 */
function handleExportData() {
  const jsonStr = StorageService.exportData();
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `streak_calendar_backup_${CalendarService.formatDate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Backup downloaded successfully!');
}

/**
 * Import data from file
 */
function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const success = StorageService.importData(event.target.result);
    if (success) {
      showToast('Data imported successfully!');
      renderAll();
      closeModal('settingsModal');
    } else {
      showToast('Invalid backup file. Please try again.');
    }
  };
  reader.readAsText(file);
}

/**
 * Clear all data
 */
function handleClearAllData() {
  if (confirm('WARNING: This will erase all your trackers, check-ins, and streak history. Continue?')) {
    StorageService.clearAll();
    initSampleDataIfEmpty();
    renderAll();
    closeModal('settingsModal');
    showToast('All data has been reset.');
  }
}

/**
 * Modal helpers
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/**
 * Toast Notification Helper
 */
function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>✨</span><span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Trigger PWA Install Prompt for Android/Chrome/Desktop or guide iOS users
 */
async function triggerInstallPrompt() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const choiceResult = await deferredInstallPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      showToast('Installing app to your device...');
    }
    deferredInstallPrompt = null;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.style.display = 'none';
  } else {
    // Check device type
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (isStandalone) {
      showToast('App is already installed and running as standalone!');
    } else if (isIOS) {
      showToast('To install on iPhone/iPad: Tap the Share button (📤) in Safari and choose "Add to Home Screen" 📲');
    } else {
      showToast('To install: Open browser menu (⋮) and tap "Install app" or "Add to Home screen" 📲');
    }
  }
}

/**
 * Simple HTML escape helper
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
