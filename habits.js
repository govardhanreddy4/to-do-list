// ============================================================
// habits.js — Habit Tracker App Logic (Refactored for Unified Dashboard)
// ============================================================

// ── 1. State ─────────────────────────────────────────────────
let allHabits = [];

// ── 2. Utility Helpers ───────────────────────────────────────
function habitTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isHabitDoneToday(habit) {
  return (habit.completedDates || []).includes(habitTodayStr());
}

function escapeHabitHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── 3. Stats Renderer ────────────────────────────────────────
function updateHabitStats() {
  const total = allHabits.length;
  const doneToday = allHabits.filter(isHabitDoneToday).length;
  const el = document.getElementById('statHabitsDone');
  if (el) el.textContent = `${doneToday}/${total}`;
}

// ── 4. Habit Card Builder ────────────────────────────────────
function buildHabitCard(habit) {
  const doneToday = isHabitDoneToday(habit);
  const streak = habit.currentStreak || 0;
  const longest = habit.longestStreak || 0;

  return `
    <div class="habit-card ${doneToday ? 'done-today' : ''}" data-id="${habit.id}">
      <div class="habit-top">
        <span class="habit-name">${escapeHabitHtml(habit.name)}</span>
        <span class="streak-badge"><span class="fire">🔥</span> ${streak} days</span>
      </div>
      <div class="streak-details">
        <span>Current: <strong>${streak}</strong></span>
        <span>Longest: <strong>${longest}</strong></span>
      </div>
      <div class="habit-actions">
        <div class="done-today-wrap ${doneToday ? 'is-done' : ''}" onclick="handleHabitDone('${habit.id}')">
          <div class="checkbox-container-single">
            <label class="custom-checkbox-visual-only">
              <input type="checkbox" class="hidden-checkbox" ${doneToday ? 'checked disabled' : ''}>
              <div class="checkbox-box">
                <svg class="checkmark" viewBox="0 0 52 52">
                  <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"></circle>
                  <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"></path>
                </svg>
              </div>
            </label>
          </div>
          <span class="done-today-label">${doneToday ? 'Done Today!' : 'Mark Done'}</span>
        </div>
        <button class="card-btn edit" title="Edit habit" onclick="openEditHabitModal('${habit.id}')">✏️</button>
        <button class="card-btn delete" title="Delete habit" onclick="openDeleteHabitModal('${habit.id}')">🗑️</button>
      </div>
    </div>
  `;
}

function renderHabitGrid() {
  const grid = document.getElementById('habitGrid');
  if (!grid) return;
  if (allHabits.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No habits yet.</p>';
    return;
  }
  grid.innerHTML = allHabits.map(buildHabitCard).join('');
}

// ── 5. Modal Controllers ─────────────────────────────────────
let editingHabitId = null;
let pendingHabitDeleteId = null;

function openAddHabitModal() {
  editingHabitId = null;
  document.getElementById('habitForm').reset();
  document.getElementById('habitId').value = '';
  document.getElementById('habitModalTitle').textContent = 'Add New Habit';
  document.getElementById('btnHabitSave').textContent = 'Save Habit';
  document.getElementById('habitModalOverlay').classList.add('open');
  document.getElementById('habitName').focus();
}

window.openAddHabitModal = openAddHabitModal; // Export for index.html quick action

function openEditHabitModal(id) {
  const habit = allHabits.find(h => h.id === id);
  if (!habit) return;
  editingHabitId = id;
  document.getElementById('habitForm').reset();
  document.getElementById('habitId').value = id;
  document.getElementById('habitName').value = habit.name;
  document.getElementById('habitModalTitle').textContent = 'Edit Habit';
  document.getElementById('btnHabitSave').textContent = 'Update Habit';
  document.getElementById('habitModalOverlay').classList.add('open');
  document.getElementById('habitName').focus();
}
window.openEditHabitModal = openEditHabitModal;

function closeHabitModal() {
  document.getElementById('habitModalOverlay').classList.remove('open');
}

function openDeleteHabitModal(id) {
  pendingHabitDeleteId = id;
  document.getElementById('habitDeleteOverlay').classList.add('open');
}
window.openDeleteHabitModal = openDeleteHabitModal;

function closeHabitDeleteModal() {
  document.getElementById('habitDeleteOverlay').classList.remove('open');
}

// ── 6. Event Handlers ────────────────────────────────────────
async function handleHabitDone(id) {
  const habit = allHabits.find(h => h.id === id);
  if (!habit || isHabitDoneToday(habit)) return;
  try {
    await markHabitDone(id, habit);
    if (typeof showToast === 'function') showToast('Habit completed! 🔥', 'success');
  } catch (err) {
    console.error('Habit mark error:', err);
  }
}
window.handleHabitDone = handleHabitDone;

document.getElementById('habitForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('habitName').value.trim();
  if (!name) return;

  const btn = document.getElementById('btnHabitSave');
  btn.disabled = true;
  
  try {
    if (editingHabitId) {
      await updateHabit(editingHabitId, name);
      if (typeof showToast === 'function') showToast('Habit updated!', 'success');
    } else {
      await addHabit(name);
      if (typeof showToast === 'function') showToast('New habit added! 🔥', 'success');
    }
    closeHabitModal();
  } catch (err) {
    console.error('Habit save error:', err);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('btnHabitDeleteConfirm')?.addEventListener('click', async () => {
  if (!pendingHabitDeleteId) return;
  try {
    await deleteHabit(pendingHabitDeleteId);
    if (typeof showToast === 'function') showToast('Habit deleted.', 'success');
    closeHabitDeleteModal();
  } catch (err) {
    console.error('Habit delete error:', err);
  }
});

document.getElementById('habitModalClose')?.addEventListener('click', closeHabitModal);
document.getElementById('btnHabitCancel')?.addEventListener('click', closeHabitModal);
document.getElementById('btnHabitDeleteCancel')?.addEventListener('click', closeHabitDeleteModal);

// ── 7. Analytics & Extra init ──────────────────────────────────
function initHabits() {
  // We use the firestore helper from firebase.js
  // Note: Unsubscribe isn't stored here for simplicity on dashboard
  fetchHabits((habits) => {
    allHabits = habits;
    updateHabitStats();
    renderHabitGrid();
  });
}

// If on index.html (Unified Dashboard)
if (document.body.dataset.page === 'dashboard') {
  document.addEventListener('DOMContentLoaded', () => {
     // Wait for firebase.js to be ready (it runs on script tag load)
     // script.js handles task init, we handle habits
     initHabits();
  });
} 
// If on standalone habits.html
else if (document.body.dataset.page === 'habits') {
  document.addEventListener('DOMContentLoaded', () => {
    initHabits();
    // Also init the date display if the element exists
    const dateEl = document.getElementById('todayDate');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  });
}
