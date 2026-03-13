// ============================================================
// firebase.js — Firebase Firestore Configuration & Operations
// ============================================================

// 🔥 IMPORTANT: Replace the config below with YOUR Firebase project credentials.
// Visit https://console.firebase.google.com → Project Settings → Your Apps → SDK Setup
const firebaseConfig = {
  apiKey: "AIzaSyB6NmWK9TxIUEJ0_B30m-6pfQkotkaOCt0",
  authDomain: "to-do-list-4d734.firebaseapp.com",
  projectId: "to-do-list-4d734",
  storageBucket: "to-do-list-4d734.firebasestorage.app",
  messagingSenderId: "551498974462",
  appId: "1:551498974462:web:030c9a4d9b7a67447d11af",
  measurementId: "G-R1BHH56SQX"
};

// ── Initialize Firebase App ──────────────────────────────────
firebase.initializeApp(firebaseConfig);

// ── Get a reference to Firestore ─────────────────────────────
const db = firebase.firestore();

// ── Collection reference (all tasks live here) ───────────────
const tasksCollection = db.collection("tasks");

// ============================================================
// FIRESTORE CRUD HELPERS
// ============================================================

/**
 * fetchTasks – Subscribe to real-time task updates from Firestore.
 * @param {Function} callback – Called whenever the tasks change.
 * @returns {Function} Unsubscribe function to stop listening.
 */
function fetchTasks(callback) {
  return tasksCollection
    .orderBy("createdAt", "desc") // newest first by default
    .onSnapshot(
      (snapshot) => {
        const tasks = [];
        snapshot.forEach((doc) => {
          tasks.push({ id: doc.id, ...doc.data() });
        });
        callback(tasks);
      },
      (error) => {
        console.error("Firestore listener error:", error);
        showToast("Failed to load tasks. Check your Firebase config.", "error");
      }
    );
}

/**
 * addTask – Create a new task document in Firestore.
 * @param {Object} taskData – Task fields (title, description, priority, dueDate, status).
 * @returns {Promise}
 */
async function addTask(taskData) {
  return tasksCollection.add({
    ...taskData,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * updateTask – Update an existing task document.
 * @param {string} id – Firestore document ID.
 * @param {Object} taskData – Fields to update.
 * @returns {Promise}
 */
async function updateTask(id, taskData) {
  return tasksCollection.doc(id).update({
    ...taskData,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * deleteTask – Remove a task document from Firestore.
 * @param {string} id – Firestore document ID.
 * @returns {Promise}
 */
async function deleteTask(id) {
  return tasksCollection.doc(id).delete();
}

/**
 * toggleTaskStatus – Flip a task between "pending" and "completed".
 * @param {string} id – Firestore document ID.
 * @param {string} currentStatus – Current status value.
 * @returns {Promise}
 */
async function toggleTaskStatus(id, currentStatus) {
  const newStatus = currentStatus === "completed" ? "pending" : "completed";
  return tasksCollection.doc(id).update({
    status: newStatus,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// ============================================================
// HABIT TRACKER — FIRESTORE HELPERS
// ============================================================

// ── Habit collection reference ───────────────────────────────
const habitsCollection = db.collection("habits");

/**
 * fetchHabits – Subscribe to real-time habit updates from Firestore.
 * @param {Function} callback – Called with habits array on every change.
 * @returns {Function} Unsubscribe function.
 */
function fetchHabits(callback) {
  return habitsCollection
    .orderBy("createdAt", "desc")
    .onSnapshot(
      (snapshot) => {
        const habits = [];
        snapshot.forEach((doc) => {
          habits.push({ id: doc.id, ...doc.data() });
        });
        callback(habits);
      },
      (error) => {
        console.error("Habits listener error:", error);
      }
    );
}

/**
 * addHabit – Create a new habit document with default streak values.
 * @param {string} name – Habit name.
 * @returns {Promise}
 */
async function addHabit(name) {
  return habitsCollection.add({
    name,
    currentStreak:  0,
    longestStreak:  0,
    completedDates: [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * updateHabit – Update a habit's name (and updatedAt).
 * @param {string} id
 * @param {string} name
 * @returns {Promise}
 */
async function updateHabit(id, name) {
  return habitsCollection.doc(id).update({
    name,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * deleteHabit – Remove a habit document.
 * @param {string} id
 * @returns {Promise}
 */
async function deleteHabit(id) {
  return habitsCollection.doc(id).delete();
}

/**
 * markHabitDone – Mark a habit as completed for today and update streaks.
 *
 * Streak rules (client-side):
 *   - If already done today → no-op (returns early).
 *   - If yesterday was completed  → currentStreak + 1.
 *   - If yesterday was NOT completed → currentStreak resets to 1.
 *   - longestStreak is updated if currentStreak exceeds it.
 *
 * @param {string} id      – Firestore document ID.
 * @param {Object} habit   – Current habit object from Firestore.
 * @returns {Promise|void}
 */
async function markHabitDone(id, habit) {
  // ── Date helpers ─────────────────────────────────────────
  const todayDate = new Date();
  const toStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const today = toStr(todayDate);
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = toStr(yesterdayDate);

  // ── Guard: already completed today ───────────────────────
  const dates = habit.completedDates || [];
  if (dates.includes(today)) return; // nothing to do

  // ── Streak calculation ────────────────────────────────────
  let currentStreak = habit.currentStreak || 0;
  const longestStreak = habit.longestStreak || 0;

  if (dates.includes(yesterday)) {
    // Consecutive day → increment streak
    currentStreak += 1;
  } else {
    // Missed at least one day → reset streak
    currentStreak = 1;
  }

  const newLongest = Math.max(longestStreak, currentStreak);

  return habitsCollection.doc(id).update({
    completedDates: [...dates, today],
    currentStreak,
    longestStreak: newLongest,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}
