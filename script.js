// ============================================================
// script.js — TaskFlow Dashboard Logic
// ============================================================
// Sections:
//   1. State
//   2. DOM references
//   3. Utility helpers
//   4. Stats & notifications
//   5. Task card rendering
//   6. Filter & sort
//   7. Modal controller (add / edit)
//   8. CRUD event handlers
//   9. UI event listeners
//  10. Init
// ============================================================

// ── 1. App State ────────────────────────────────────────────
let allTasks      = [];   // live array from Firestore
let activeFilter  = 'all'; // 'all' | 'pending' | 'completed'
let activeSort    = 'createdAt'; // 'createdAt' | 'dueDate' | 'priority'
let editingTaskId = null; // null = add mode, string = edit mode
let pendingDeleteId = null; // task ID queued for deletion

// ── 2. DOM References ────────────────────────────────────────
const taskGrid        = document.getElementById('taskGrid');
const emptyState      = document.getElementById('emptyState');
const filterPills     = document.getElementById('filterPills');
const sortSelect      = document.getElementById('sortSelect');
const notifBanner     = document.getElementById('notificationBanner');
const notifContent    = document.getElementById('notifContent');
const notifClose      = document.getElementById('notifClose');
const modalOverlay    = document.getElementById('modalOverlay');
const deleteOverlay   = document.getElementById('deleteOverlay');
const taskForm        = document.getElementById('taskForm');
const modalTitle      = document.getElementById('modalTitle');
const btnSave         = document.getElementById('btnSave');
const statusGroup     = document.getElementById('statusGroup');
const toastContainer  = document.getElementById('toastContainer');
const progressFill    = document.getElementById('progressFill');
const hamburger       = document.getElementById('hamburger');
const sidebar         = document.getElementById('sidebar');

// Form fields
const fieldId       = document.getElementById('taskId');
const fieldTitle    = document.getElementById('taskTitle');
const fieldDesc     = document.getElementById('taskDesc');
const fieldPriority = document.getElementById('taskPriority');
const fieldDueDate  = document.getElementById('taskDueDate');
const fieldStatus   = document.getElementById('taskStatus');

// Error spans
const errTitle    = document.getElementById('errTitle');
const errPriority = document.getElementById('errPriority');
const errDueDate  = document.getElementById('errDueDate');

// Stat DOM nodes
const statTotalVal     = document.getElementById('statTotalVal');
const statCompletedVal = document.getElementById('statCompletedVal');
const statPendingVal   = document.getElementById('statPendingVal');
const statPercentVal   = document.getElementById('statPercentVal');

// Badge nodes in sidebar
const badgeAll       = document.getElementById('badgeAll');
const badgePending   = document.getElementById('badgePending');
const badgeCompleted = document.getElementById('badgeCompleted');

// Nav buttons
const navAll       = document.getElementById('navAll');
const navPending   = document.getElementById('navPending');
const navCompleted = document.getElementById('navCompleted');

// ── 3. Utility Helpers ───────────────────────────────────────

/**
 * Returns today's date as a YYYY-MM-DD string (local time).
 */
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * showToast – Shows a brief notification toast.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function showToast(message, type = 'success') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span> ${message}`;
  toastContainer.appendChild(toast);
  // Auto-remove after animation (3s total)
  setTimeout(() => toast.remove(), 3100);
}

/**
 * Formats a YYYY-MM-DD string to a human-readable date (e.g. "Mar 15, 2026").
 */
function formatDate(dateStr) {
  if (!dateStr) return 'No due date';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/**
 * Priority sort order map — Higher number = higher priority.
 */
const PRIORITY_ORDER = { high: 3, medium: 2, low: 1 };

// ── 4. Stats & Notifications ─────────────────────────────────

/**
 * updateStats – Re-computes dashboard stats from allTasks and updates the DOM.
 */
function updateStats() {
  const total     = allTasks.length;
  const completed = allTasks.filter(t => t.status === 'completed').length;
  const pending   = total - completed;
  const percent   = total > 0 ? Math.round((completed / total) * 100) : 0;

  statTotalVal.textContent     = total;
  statCompletedVal.textContent = completed;
  statPendingVal.textContent   = pending;
  statPercentVal.textContent   = `${percent}%`;
  progressFill.style.width     = `${percent}%`;

  // Sidebar badges
  badgeAll.textContent       = total;
  badgePending.textContent   = pending;
  badgeCompleted.textContent = completed;
}

/**
 * checkNotifications – Shows a banner for tasks that are overdue or due today.
 * Only checks pending tasks.
 */
function checkNotifications() {
  const today   = todayStr();
  const overdue = allTasks.filter(t => t.status === 'pending' && t.dueDate && t.dueDate < today);
  const dueToday = allTasks.filter(t => t.status === 'pending' && t.dueDate === today);

  if (overdue.length === 0 && dueToday.length === 0) {
    notifBanner.style.display = 'none';
    return;
  }

  let html = '';
  if (overdue.length > 0) {
    html += `<strong>🚨 ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}:</strong>`;
    overdue.forEach(t => {
      html += `<span class="notif-item">• ${t.title} — was due ${formatDate(t.dueDate)}</span>`;
    });
  }
  if (dueToday.length > 0) {
    html += `<strong style="margin-top:${overdue.length > 0 ? '8px' : '0'}; display:block;">📅 ${dueToday.length} task${dueToday.length > 1 ? 's' : ''} due today:</strong>`;
    dueToday.forEach(t => {
      html += `<span class="notif-item">• ${t.title}</span>`;
    });
  }

  notifContent.innerHTML = html;
  notifBanner.style.display = 'flex';
}

// ── 5. Task Card Rendering ────────────────────────────────────

/**
 * getDueDateClass – Returns a CSS class based on a task's due date.
 */
function getDueDateClass(dueDate, status) {
  if (!dueDate || status === 'completed') return '';
  const today = todayStr();
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';
  return '';
}

/**
 * buildTaskCard – Generates the HTML string for a task card.
 * @param {Object} task
 * @returns {string} HTML string
 */
function buildTaskCard(task) {
  const isCompleted  = task.status === 'completed';
  const dueCls       = getDueDateClass(task.dueDate, task.status);
  const dueDateLabel = task.dueDate ? formatDate(task.dueDate) : '—';
  const dueIcon      = dueCls === 'overdue' ? '⚠️' : '📅';

  return `
    <div class="task-card ${isCompleted ? 'completed' : ''}" data-id="${task.id}">
      <!-- Checkbox + Title + Action Buttons -->
      <div class="card-top">
        <input
          type="checkbox"
          class="task-checkbox"
          aria-label="Mark task complete"
          ${isCompleted ? 'checked' : ''}
          onchange="handleToggle('${task.id}', '${task.status}')"
        />
        <div class="task-title-wrap">
          <div class="task-title">${escapeHtml(task.title)}</div>
          ${task.description
            ? `<div class="task-desc">${escapeHtml(task.description)}</div>`
            : ''}
        </div>
        <div class="card-actions">
          <button
            class="card-btn edit"
            title="Edit task"
            onclick="openEditModal('${task.id}')"
          >✏️</button>
          <button
            class="card-btn delete"
            title="Delete task"
            onclick="openDeleteModal('${task.id}')"
          >🗑️</button>
        </div>
      </div>

      <!-- Meta: Priority + Due Date + Status -->
      <div class="card-meta">
        <span class="priority-badge ${task.priority}">${task.priority}</span>
        <span class="due-chip ${dueCls}">${dueIcon} ${dueDateLabel}</span>
        <span class="status-badge ${task.status}">${task.status}</span>
      </div>
    </div>
  `;
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
 * renderTasks – Applies current filter + sort and paints the task grid.
 */
function renderTasks() {
  const filtered = applyFilterAndSort();
  if (filtered.length === 0) {
    taskGrid.innerHTML    = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';
  taskGrid.innerHTML = filtered.map(buildTaskCard).join('');
}

// ── 6. Filter & Sort ─────────────────────────────────────────

/**
 * applyFilterAndSort – Returns a filtered + sorted copy of allTasks.
 */
function applyFilterAndSort() {
  // 1. Filter
  let result = allTasks.filter(t => {
    if (activeFilter === 'all') return true;
    return t.status === activeFilter;
  });

  // 2. Sort
  result = [...result].sort((a, b) => {
    if (activeSort === 'dueDate') {
      // Tasks without a due date go to the end
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (activeSort === 'priority') {
      return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
    }
    // Default: newest first (createdAt desc)
    const aTime = a.createdAt ? a.createdAt.seconds : 0;
    const bTime = b.createdAt ? b.createdAt.seconds : 0;
    return bTime - aTime;
  });

  return result;
}

/**
 * setFilter – Updates the active filter and re-renders.
 */
function setFilter(filter) {
  activeFilter = filter;

  // Update pill buttons
  document.querySelectorAll('.pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  // Update sidebar nav
  [navAll, navPending, navCompleted].forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  renderTasks();
}

// ── 7. Modal Controller ───────────────────────────────────────

/** Clears all form fields and error messages. */
function resetForm() {
  taskForm.reset();
  errTitle.textContent    = '';
  errPriority.textContent = '';
  errDueDate.textContent  = '';
  fieldId.value           = '';
  editingTaskId           = null;
}

/** Opens the modal for adding a new task. */
function openAddModal() {
  resetForm();
  modalTitle.textContent    = 'Add New Task';
  btnSave.textContent       = 'Save Task';
  statusGroup.style.display = 'none'; // status not needed when adding
  modalOverlay.classList.add('open');
  fieldTitle.focus();
}

/**
 * Opens the modal pre-filled for editing an existing task.
 * @param {string} id – Firestore document ID
 */
function openEditModal(id) {
  const task = allTasks.find(t => t.id === id);
  if (!task) return;

  resetForm();
  editingTaskId = id;
  modalTitle.textContent    = 'Edit Task';
  btnSave.textContent       = 'Update Task';
  statusGroup.style.display = 'block'; // show status field in edit mode

  fieldId.value           = id;
  fieldTitle.value        = task.title || '';
  fieldDesc.value         = task.description || '';
  fieldPriority.value     = task.priority || '';
  fieldDueDate.value      = task.dueDate || '';
  fieldStatus.value       = task.status || 'pending';

  modalOverlay.classList.add('open');
  fieldTitle.focus();
}

/** Closes the task modal. */
function closeModal() {
  modalOverlay.classList.remove('open');
  resetForm();
}

/**
 * Opens the delete confirmation dialog.
 * @param {string} id
 */
function openDeleteModal(id) {
  pendingDeleteId = id;
  deleteOverlay.classList.add('open');
}

/** Closes the delete dialog. */
function closeDeleteModal() {
  pendingDeleteId = null;
  deleteOverlay.classList.remove('open');
}

// ── 8. CRUD Event Handlers ────────────────────────────────────

/**
 * validateForm – Validates form fields and sets error messages.
 * @returns {boolean} true if valid
 */
function validateForm() {
  let valid = true;
  errTitle.textContent    = '';
  errPriority.textContent = '';
  errDueDate.textContent  = '';

  if (!fieldTitle.value.trim()) {
    errTitle.textContent = 'Title is required.';
    valid = false;
  }
  if (!fieldPriority.value) {
    errPriority.textContent = 'Please select a priority.';
    valid = false;
  }
  if (!fieldDueDate.value) {
    errDueDate.textContent = 'Please select a due date.';
    valid = false;
  }
  return valid;
}

// Form submit — handles both Add and Edit
taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const taskData = {
    title:       fieldTitle.value.trim(),
    description: fieldDesc.value.trim(),
    priority:    fieldPriority.value,
    dueDate:     fieldDueDate.value,
    status:      editingTaskId ? fieldStatus.value : 'pending',
  };

  btnSave.disabled    = true;
  btnSave.textContent = editingTaskId ? 'Updating…' : 'Saving…';

  try {
    if (editingTaskId) {
      await updateTask(editingTaskId, taskData);
      showToast('Task updated successfully!', 'success');
    } else {
      await addTask(taskData);
      showToast('Task added successfully!', 'success');
    }
    closeModal();
  } catch (err) {
    console.error('Save task error:', err);
    showToast('Failed to save task. Please try again.', 'error');
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = editingTaskId ? 'Update Task' : 'Save Task';
  }
});

/**
 * handleToggle – Called when the task checkbox is clicked.
 */
async function handleToggle(id, currentStatus) {
  try {
    await toggleTaskStatus(id, currentStatus);
    const next = currentStatus === 'completed' ? 'pending' : 'completed';
    showToast(`Task marked as ${next}!`, 'info');
  } catch (err) {
    console.error('Toggle error:', err);
    showToast('Failed to update task status.', 'error');
  }
}

// Confirm deletion
document.getElementById('btnDeleteConfirm').addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  try {
    await deleteTask(pendingDeleteId);
    showToast('Task deleted.', 'success');
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Failed to delete task.', 'error');
  } finally {
    closeDeleteModal();
  }
});

// ── 9. UI Event Listeners ─────────────────────────────────────

// "Add Task" button (sidebar)
document.getElementById('btnOpenModal').addEventListener('click', openAddModal);

// Close modal buttons
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);

// Close modal when clicking the overlay backdrop
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

// Cancel delete dialog
document.getElementById('btnDeleteCancel').addEventListener('click', closeDeleteModal);
deleteOverlay.addEventListener('click', (e) => {
  if (e.target === deleteOverlay) closeDeleteModal();
});

// Dismiss notification banner
notifClose.addEventListener('click', () => {
  notifBanner.style.display = 'none';
});

// Filter pills (below stats)
filterPills.addEventListener('click', (e) => {
  const btn = e.target.closest('.pill');
  if (!btn) return;
  setFilter(btn.dataset.filter);
});

// Sidebar nav buttons
[navAll, navPending, navCompleted].forEach(btn => {
  btn.addEventListener('click', () => {
    setFilter(btn.dataset.filter);
    closeSidebar(); // close on mobile after selecting
  });
});

// Sort select
sortSelect.addEventListener('change', () => {
  activeSort = sortSelect.value;
  renderTasks();
});

// Mobile hamburger
hamburger.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  // Create overlay dynamically if not present
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', closeSidebar);
  }
  overlay.classList.toggle('open');
});

function closeSidebar() {
  sidebar.classList.remove('open');
  const overlay = document.querySelector('.sidebar-overlay');
  if (overlay) overlay.classList.remove('open');
}

// Keyboard: Escape closes modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeDeleteModal();
  }
});

// ── 10. Init ─────────────────────────────────────────────────

/**
 * Set today's date in the top bar.
 */
function initDateDisplay() {
  const now = new Date();
  document.getElementById('todayDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

/**
 * Boot — Subscribe to Firestore and wire up the UI.
 */
function init() {
  initDateDisplay();

  // Subscribe to live Firestore updates
  fetchTasks((tasks) => {
    allTasks = tasks;
    updateStats();
    checkNotifications();
    renderTasks();
  });
}

// Start the app once the DOM is ready
document.addEventListener('DOMContentLoaded', init);
