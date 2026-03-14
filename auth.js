// ============================================================
// auth.js — TaskFlow Auth State Guard & Login/Logout Handlers
// Works for: login.html (data-page="login")
//            index.html  (data-page="dashboard")
//            habits.html (data-page="habits")
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;

  // ══════════════════════════════════════════════
  // A. LOGIN PAGE
  // ══════════════════════════════════════════════
  if (page === 'login') {

    // Already logged in → skip
    onAuthChange(user => { if (user) window.location.href = 'index.html'; });

    // Tab switching
    const tabLogin = document.getElementById('tabLogin');
    const tabReg   = document.getElementById('tabRegister');
    const fLogin   = document.getElementById('formLogin');
    const fReg     = document.getElementById('formRegister');

    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active'); tabReg.classList.remove('active');
      fLogin.style.display = 'block';  fReg.style.display   = 'none';
      clearAuthErrors();
    });
    tabReg.addEventListener('click', () => {
      tabReg.classList.add('active'); tabLogin.classList.remove('active');
      fLogin.style.display = 'none'; fReg.style.display   = 'block';
      clearAuthErrors();
    });

    // Login form
    fLogin.addEventListener('submit', async e => {
      e.preventDefault(); clearAuthErrors();
      const email = document.getElementById('loginEmail').value.trim();
      const pw    = document.getElementById('loginPw').value;
      const btn   = document.getElementById('btnLogin');
      btn.disabled = true; btn.textContent = 'Signing in…';
      try {
        await loginUser(email, pw);
        window.location.href = 'index.html';
      } catch (err) {
        document.getElementById('errLogin').textContent = friendlyAuthError(err.code);
      } finally { btn.disabled = false; btn.textContent = 'Login'; }
    });

    // Register form
    fReg.addEventListener('submit', async e => {
      e.preventDefault(); clearAuthErrors();
      const email = document.getElementById('regEmail').value.trim();
      const pw    = document.getElementById('regPw').value;
      const pw2   = document.getElementById('regPw2').value;
      if (pw !== pw2) { document.getElementById('errRegister').textContent = 'Passwords do not match.'; return; }
      if (pw.length < 6) { document.getElementById('errRegister').textContent = 'Password must be at least 6 characters.'; return; }
      const btn = document.getElementById('btnRegister');
      btn.disabled = true; btn.textContent = 'Creating account…';
      try {
        await registerUser(email, pw);
        window.location.href = 'index.html';
      } catch (err) {
        document.getElementById('errRegister').textContent = friendlyAuthError(err.code);
      } finally { btn.disabled = false; btn.textContent = 'Create Account'; }
    });

    // Google Login
    const btnGoogle = document.getElementById('btnGoogleLogin');
    if (btnGoogle) {
      btnGoogle.addEventListener('click', async () => {
        try {
          await loginWithGoogle();
          window.location.href = 'index.html';
        } catch (err) {
          document.getElementById('errLogin').textContent = friendlyAuthError(err.code);
        }
      });
    }

    // Forgot Password
    const btnForgot = document.getElementById('btnForgotPw');
    if (btnForgot) {
      btnForgot.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        if (!email) {
          document.getElementById('errLogin').textContent = 'Please enter your email first.';
          return;
        }
        try {
          await resetPassword(email);
          alert('Password reset email sent! Check your inbox.');
        } catch (err) {
          document.getElementById('errLogin').textContent = friendlyAuthError(err.code);
        }
      });
    }
  }

  // ══════════════════════════════════════════════
  // B. DASHBOARD & HABITS PAGES (auth guard)
  // ══════════════════════════════════════════════
  if (page === 'dashboard' || page === 'habits') {

    onAuthChange(user => {
      if (!user) { window.location.href = 'login.html'; return; }
      // Show user email in sidebar
      const el = document.getElementById('sidebarUser');
      if (el) el.textContent = user.email;
    });

    // Logout button
    const btnOut = document.getElementById('btnLogout');
    if (btnOut) {
      btnOut.addEventListener('click', async () => {
        await logoutUser();
        window.location.href = 'login.html';
      });
    }
  }
});

// ── Helpers ──────────────────────────────────────────────────
function clearAuthErrors() {
  ['errLogin','errRegister'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function friendlyAuthError(code) {
  return ({
    'auth/user-not-found':      'No account found with this email.',
    'auth/wrong-password':      'Incorrect password.',
    'auth/invalid-email':       'Please enter a valid email.',
    'auth/email-already-in-use':'Email already registered. Try logging in.',
    'auth/weak-password':       'Password must be at least 6 characters.',
    'auth/too-many-requests':   'Too many attempts. Try again later.',
    'auth/invalid-credential':  'Invalid email or password.',
    'auth/operation-not-allowed': 'This sign-in method is disabled in Firebase console.',
    'auth/popup-closed-by-user':  'Login window was closed.',
  })[code] || 'Authentication failed. Make sure methods are enabled in Firebase console.';
}
