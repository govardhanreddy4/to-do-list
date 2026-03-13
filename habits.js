// ============================================================
// habits.js — Habit Tracker App Logic
// ============================================================
// Sections:
//   1.  State & Constants
//   2.  Utility Helpers
//   3.  Stats Renderer
//   4.  Reminder Banner
//   5.  Weekly Report
//   6.  Habit Card Builder & Render
//   7.  Sort Logic
//   8.  Modal Controller
//   9.  CRUD Event Handlers
//  10.  UI Event Listeners
//  11.  Init
// ============================================================

// ── 1. State & Constants ─────────────────────────────────────
let allHabits  = [];          // live array kept in sync via Firestore onSnapshot
let activeSort = 'recent';    // 'recent' | 'streak' | 'incomplete'

// Days of the week abbreviations for the weekly report
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── 2. Utility Helpers ───────────────────────────────────────

/**
 * todayStr – Returns today's date as "YYYY-MM-DD" (local time).
 */
function todayStr() {
  const d = new Date();
  return dateToStr(d);
}

/**
 * dateToStr – Converts a Date object to "YYYY-MM-DD".
 */
function dateToStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * isCompletedToday – Checks if a habit was completed today.
 */
function isCompletedToday(habit) {
  return (habit.completedDates || []).includes(todayStr());
}

/**
 * escapeHtml – Prevents XSS by escaping user-supplied strings.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * showToast – Displays a brief bottom-right toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function showToast(message, type = 'success') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span> ${message}`;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => toast.remove(), 3100);
}

// ── 3. Stats Renderer ────────────────────────────────────────

/**
 * updateStats – Computes and paints the 4 stats cards.
 */
function updateStats() {
  const total     = allHabits.length;
  const doneToday = allHabits.filter(isCompletedToday).length;
  const bestStreak = allHabits.reduce((max, h) => Math.max(max, h.longestStreak || 0), 0);
  const pct = total > 0 ? Math.round((doneToday / total) * 100) : 0;

  document.getElementById('statTotalHabits').textContent = total;
  document.getElementById('statDoneToday').textContent   = doneToday;
  document.getElementById('statBestStreak').textContent  = bestStreak;
  document.getElementById('statProgressPct').textContent = `${pct}%`;
  document.getElementById('progressFill').style.width    = `${pct}%`;
}

// ── 4. Reminder Banner ────────────────────────────────────────

/**
 * checkReminder – Shows a banner listing habits NOT completed today.
 */
function checkReminder() {
  const notDone = allHabits.filter(h => !isCompletedToday(h));
  const banner  = document.getElementById('reminderBanner');
  const content = document.getElementById('reminderContent');

  if (notDone.length === 0) {
    banner.style.display = 'none';
    return;
  }

  let html = `<strong>⏰ ${notDone.length} habit${notDone.length > 1 ? 's' : ''} not yet done today:</strong>`;
  notDone.forEach(h => {
    html += `<span class="notif-item">• ${escapeHtml(h.name)}</span>`;
  });
  content.innerHTML   = html;
  banner.style.display = 'flex';
}

// ── 5. Weekly Report ─────────────────────────────────────────

/**
 * renderWeeklyReport – Builds a 7-day bar chart of completions.
 * The 7 days shown are the 6 days before today + today (Mon-relative).
 */
function renderWeeklyReport() {
  const grid = document.getElementById('weeklyGrid');
  const today = new Date();
  const todayDateStr = todayStr();

  // Build last-7-days array (index 0 = 6 days ago, index 6 = today)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({ dateStr: dateToStr(d), label: DAY_ABBR[d.getDay()] });
  }

  // Count completions per day
  const counts = days.map(({ dateStr }) =>
    allHabits.filter(h => (h.completedDates || []).includes(dateStr)).length
  );

  // Max count for scaling bars (minimum 1 to avoid division by zero)
  const maxCount = Math.max(...counts, 1);

  // Build HTML
  grid.innerHTML = days.map(({ dateStr, label }, i) => {
    const count    = counts[i];
    const heightPct = Math.round((count / maxCount) * 100);
    const isToday  = dateStr === todayDateStr;
    return `
      <div class="weekly-day ${isToday ? 'today' : ''}">
        <span class="week-count">${count}</span>
        <div class="week-bar-wrap">
          <div class="week-bar-fill" style="height:${heightPct}%"></div>
        </div>
        <span class="week-day-label">${label}</span>
      </div>
    `;
  }).join('');
}

// ── 6. Habit Card Builder & Render ───────────────────────────

/**
 * buildHabitCard – Generates the HTML for a single habit card.
 */
function buildHabitCard(habit) {
  const doneToday    = isCompletedToday(habit);
  const streak       = habit.currentStreak  || 0;
  const longest      = habit.longestStreak  || 0;
  const doneBtnLabel = doneToday ? '✅ Done Today!' : '⚡ Done Today';

  return `
    <div class="habit-card ${doneToday ? 'done-today' : ''}" data-id="${habit.id}">

      <!-- Name Row + Streak Badge -->
      <div class="habit-top">
        <span class="habit-name">${escapeHtml(habit.name)}</span>
        <span class="streak-badge">
          <span class="fire">🔥</span>
          ${streak} day${streak !== 1 ? 's' : ''}
        </span>
      </div>

      <!-- Streak Details -->
      <div class="streak-details">
        <span>Current: <strong>${streak}</strong></span>
        <span>Longest: <strong>${longest}</strong></span>
      </div>

      <!-- Action Row -->
      <div class="habit-actions">
        <button
          class="btn-done-today"
          ${doneToday ? 'disabled' : ''}
          onclick="handleDoneToday('${habit.id}')"
        >${doneBtnLabel}</button>

        <button
          class="card-btn edit"
          title="Edit habit"
          onclick="openEditModal('${habit.id}')"
        >✏️</button>

        <button
          class="card-btn delete"
          title="Delete habit"
          onclick="openDeleteModal('${habit.id}')"
        >🗑️</button>
      </div>

    </div>
  `;
}

/**
 * renderHabits – Sorts allHabits and paints the habit grid.
 */
function renderHabits() {
  const sorted   = applySortToHabits();
  const grid     = document.getElementById('habitGrid');
  const empty    = document.getElementById('emptyState');

  if (sorted.length === 0) {
    grid.innerHTML   = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = sorted.map(buildHabitCard).join('');
}

// ── 7. Sort Logic ─────────────────────────────────────────────

/**
 * applySortToHabits – Returns a sorted copy of allHabits per activeSort.
 */
function applySortToHabits() {
  const copy = [...allHabits];
  const today = todayStr();

  if (activeSort === 'streak') {
    // Highest current streak first
    copy.sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0));

  } else if (activeSort === 'incomplete') {
    // Habits NOT done today come first, then done ones
    copy.sort((a, b) => {
      const aDone = (a.completedDates || []).includes(today) ? 1 : 0;
      const bDone = (b.completedDates || []).includes(today) ? 1 : 0;
      return aDone - bDone;  // 0 (not done) sorts before 1 (done)
    });

  } else {
    // 'recent' — newest createdAt first (default Firestore order)
    copy.sort((a, b) => {
      const aT = a.createdAt ? a.createdAt.seconds : 0;
      const bT = b.createdAt ? b.createdAt.seconds : 0;
      return bT - aT;
    });
  }
  return copy;
}

// ── 8. Modal Controller ───────────────────────────────────────
let editingHabitId  = null;  // null = add mode, string = edit mode
let pendingDeleteId = null;  // ID queued for delete confirm

function resetForm() {
  document.getElementById('habitForm').reset();
  document.getElementById('habitId').value     = '';
  document.getElementById('errHabitName').textContent = '';
  editingHabitId = null;
}

/** Opens modal in Add mode. */
function openAddModal() {
  resetForm();
  document.getElementById('modalTitle').textContent = 'Add New Habit';
  document.getElementById('btnSave').textContent    = 'Save Habit';
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('habitName').focus();
}

/**
 * Opens modal in Edit mode, pre-filling the habit name.
 * @param {string} id
 */
function openEditModal(id) {
  const habit = allHabits.find(h => h.id === id);
  if (!habit) return;
  resetForm();
  editingHabitId = id;
  document.getElementById('modalTitle').textContent = 'Edit Habit';
  document.getElementById('btnSave').textContent    = 'Update Habit';
  document.getElementById('habitId').value          = id;

  // Set the input value and trigger the floating label via dispatching an input event
  const inp = document.getElementById('habitName');
  inp.value = habit.name || '';
  // Dispatch so CSS :valid selector recognizes pre-filled value
  inp.dispatchEvent(new Event('input'));

  document.getElementById('modalOverlay').classList.add('open');
  inp.focus();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  resetForm();
}

function openDeleteModal(id) {
  pendingDeleteId = id;
  document.getElementById('deleteOverlay').classList.add('open');
}

function closeDeleteModal() {
  pendingDeleteId = null;
  document.getElementById('deleteOverlay').classList.remove('open');
}

// ── 9. CRUD Event Handlers ────────────────────────────────────

// Form submit — handles Add and Edit
document.getElementById('habitForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const nameInput = document.getElementById('habitName');
  const name = nameInput.value.trim();
  const errEl = document.getElementById('errHabitName');

  // Validate
  if (!name) {
    errEl.textContent = 'Habit name is required.';
    nameInput.focus();
    return;
  }
  errEl.textContent = '';

  const btnSave = document.getElementById('btnSave');
  btnSave.disabled    = true;
  btnSave.textContent = editingHabitId ? 'Updating…' : 'Saving…';

  try {
    if (editingHabitId) {
      await updateHabit(editingHabitId, name);
      showToast('Habit updated!', 'success');
    } else {
      await addHabit(name);
      showToast('Habit added! Keep it up 🔥', 'success');
    }
    closeModal();
  } catch (err) {
    console.error('Save habit error:', err);
    showToast('Failed to save habit. Try again.', 'error');
  } finally {
    btnSave.disabled    = false;
    btnSave.textContent = editingHabitId ? 'Update Habit' : 'Save Habit';
  }
});

// Confirm deletion
document.getElementById('btnDeleteConfirm').addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  try {
    await deleteHabit(pendingDeleteId);
    showToast('Habit deleted.', 'success');
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Failed to delete habit.', 'error');
  } finally {
    closeDeleteModal();
  }
});

/**
 * handleDoneToday – Called when a "Done Today" button is clicked.
 * Guards against double-marking via the streak logic in firebase.js.
 */
async function handleDoneToday(id) {
  const habit = allHabits.find(h => h.id === id);
  if (!habit) return;
  if (isCompletedToday(habit)) {
    showToast('Already marked done today!', 'info');
    return;
  }
  // Optimistic UI — disable button immediately
  const card = document.querySelector(`.habit-card[data-id="${id}"]`);
  if (card) {
    const btn = card.querySelector('.btn-done-today');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  }
  try {
    await markHabitDone(id, habit);
    showToast('Great job! Streak updated 🔥', 'success');
  } catch (err) {
    console.error('Done today error:', err);
    showToast('Failed to mark habit. Try again.', 'error');
    // Re-enable on failure
    if (card) {
      const btn = card.querySelector('.btn-done-today');
      if (btn) { btn.disabled = false; btn.textContent = '⚡ Done Today'; }
    }
  }
}

// ── 10. UI Event Listeners ────────────────────────────────────

// "Add Habit" sidebar button
document.getElementById('btnOpenModal').addEventListener('click', openAddModal);

// Modal close buttons
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

// Delete dialog
document.getElementById('btnDeleteCancel').addEventListener('click', closeDeleteModal);
document.getElementById('deleteOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('deleteOverlay')) closeDeleteModal();
});

// Reminder dismiss
document.getElementById('reminderClose').addEventListener('click', () => {
  document.getElementById('reminderBanner').style.display = 'none';
});

// Sort select
document.getElementById('sortSelect').addEventListener('change', (e) => {
  activeSort = e.target.value;
  renderHabits();
});

// Keyboard: Escape closes modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); closeDeleteModal(); }
});

// Mobile hamburger
document.getElementById('hamburger').addEventListener('click', () => {
  const sb = document.getElementById('sidebar');
  sb.classList.toggle('open');
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
      sb.classList.remove('open');
      overlay.classList.remove('open');
    });
  }
  overlay.classList.toggle('open');
});

// ── 11. Init ─────────────────────────────────────────────────

function initDateDisplay() {
  document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

/**
 * init – Bootstraps the Habit Tracker:
 *   1. Show today's date.
 *   2. Subscribe to Firestore → on every change, re-run all UI updates.
 */
function init() {
  initDateDisplay();

  fetchHabits((habits) => {
    allHabits = habits;
    updateStats();
    checkReminder();
    renderHabits();
    renderWeeklyReport();
  });
}

document.addEventListener('DOMContentLoaded', init);
