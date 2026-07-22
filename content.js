let overlayElement = null;

async function checkLockStatus() {
  const localData = await chrome.storage.local.get(['isLocked', 'password']);
  if (localData.password && localData.isLocked !== false) {
    showOverlay();
  } else {
    removeOverlay();
  }
}

function preventDefaultAction(e) {
  e.preventDefault();
}

function preventInspectElement(e) {
  // F12
  if (e.key === 'F12') {
    e.preventDefault();
    return false;
  }
  
  // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
  if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
    e.preventDefault();
    return false;
  }
  
  // Ctrl+U (View Source)
  if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
    e.preventDefault();
    return false;
  }
}

function enableLockProtections() {
  document.addEventListener('contextmenu', preventDefaultAction);
  document.addEventListener('keydown', preventInspectElement, { capture: true });
}

function disableLockProtections() {
  document.removeEventListener('contextmenu', preventDefaultAction);
  document.removeEventListener('keydown', preventInspectElement, { capture: true });
}

function showOverlay() {
  if (document.getElementById('browser-lock-overlay-12345')) return;

  overlayElement = document.createElement('div');
  overlayElement.id = 'browser-lock-overlay-12345';
  
  const container = document.createElement('div');
  container.id = 'browser-lock-container-12345';
  
  const h2 = document.createElement('h2');
  h2.textContent = 'Browser Locked';
  
  const p1 = document.createElement('p');
  p1.textContent = 'Please enter your password to continue.';
  
  const input = document.createElement('input');
  input.type = 'password';
  input.id = 'browser-lock-password-12345';
  input.placeholder = 'Password';
  input.autofocus = true;
  
  const button = document.createElement('button');
  button.id = 'browser-lock-submit-12345';
  button.textContent = 'Unlock';
  
  const errorP = document.createElement('p');
  errorP.id = 'browser-lock-error-12345';
  errorP.style.display = 'none';
  errorP.style.color = '#ff4d4f';
  errorP.style.marginTop = '10px';
  errorP.textContent = 'Incorrect password';
  
  container.appendChild(h2);
  container.appendChild(p1);
  container.appendChild(input);
  container.appendChild(button);
  container.appendChild(errorP);
  
  overlayElement.appendChild(container);
  if (document.documentElement) {
    document.documentElement.appendChild(overlayElement);
  } else {
    // Fallback if somehow documentElement is not ready
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.appendChild(overlayElement);
    });
  }
  
  document.getElementById('browser-lock-submit-12345').addEventListener('click', verifyPassword);
  document.getElementById('browser-lock-password-12345').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      verifyPassword();
    }
  });

  enableLockProtections();

  const pwdInputId = 'browser-lock-password-12345';

  const focusInput = () => {
    const pwdInput = document.getElementById(pwdInputId);
    if (pwdInput && document.activeElement !== pwdInput) {
      pwdInput.focus({ preventScroll: true });
    }
  };

  // Polling aktif: setiap 50ms cek apakah fokus sudah di input password.
  // Jika belum, paksa fokus kembali. Berjalan selama 5 detik sejak overlay muncul.
  // Ini mengatasi Chrome yang mencuri fokus ke address bar setelah halaman load.
  const startTime = Date.now();
  const focusInterval = setInterval(() => {
    const pwdInput = document.getElementById(pwdInputId);
    if (!pwdInput) {
      clearInterval(focusInterval);
      return;
    }
    // Hanya paksa fokus jika window sedang aktif (document.hasFocus())
    // dan fokus saat ini bukan di input password
    if (document.hasFocus() && document.activeElement !== pwdInput) {
      pwdInput.focus({ preventScroll: true });
    }
    // Berhenti polling setelah 5 detik
    if (Date.now() - startTime > 5000) {
      clearInterval(focusInterval);
    }
  }, 50);

  // Setiap kali window mendapat fokus kembali (user klik tab ini),
  // kembalikan fokus ke input password jika masih terkunci
  const onWindowFocus = () => {
    const pwdInput = document.getElementById(pwdInputId);
    if (pwdInput) {
      pwdInput.focus({ preventScroll: true });
    } else {
      window.removeEventListener('focus', onWindowFocus);
    }
  };
  window.addEventListener('focus', onWindowFocus);

  // Tangani saat tab menjadi aktif/visible kembali
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      const pwdInput = document.getElementById(pwdInputId);
      if (pwdInput) {
        setTimeout(() => pwdInput.focus({ preventScroll: true }), 100);
      } else {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
}

function removeOverlay() {
  const overlay = document.getElementById('browser-lock-overlay-12345');
  if (overlay) {
    overlay.remove();
  }
  
  disableLockProtections();
  
  // If we are on the dedicated lock page, redirect back to the original URL
  if (window.location.protocol === 'chrome-extension:' && window.location.pathname.endsWith('lock.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = urlParams.get('redirect') || 'chrome://newtab/';
    
    if (chrome.tabs && chrome.tabs.getCurrent) {
      chrome.tabs.getCurrent((tab) => {
        if (tab && tab.id) {
          chrome.tabs.update(tab.id, { url: redirectUrl });
        } else {
          chrome.tabs.update(null, { url: redirectUrl });
        }
      });
    } else {
      window.location.href = redirectUrl;
    }
  }
}

async function verifyPassword() {
  const inputEl = document.getElementById('browser-lock-password-12345');
  const errorEl = document.getElementById('browser-lock-error-12345');
  const passwordEntered = inputEl.value;

  const localData = await chrome.storage.local.get(['password']);
  const actualPassword = localData.password;
  
  if (!actualPassword) return;

  if (passwordEntered === actualPassword) {
    // Cek apakah ini Manual Lock mode
    const sessionData = await chrome.storage.session.get(['isManualLock']);

    if (sessionData.isManualLock) {
      // Manual Lock: kirim ke background untuk broadcast hapus overlay ke semua tab
      // Background TIDAK akan menjalankan auto-open URL
      chrome.runtime.sendMessage({ action: 'MANUAL_UNLOCK' }, () => {
        chrome.runtime.lastError;
      });
      removeOverlay();
    } else {
      // Startup Lock: alur normal
      await chrome.storage.local.set({ isLocked: false });
      removeOverlay();
    }
  } else {
    errorEl.style.display = 'block';
    inputEl.value = '';
    inputEl.focus();
  }
}

// Initial check
checkLockStatus();

// Listen for changes in local storage (so tabs sync unlock)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.isLocked) {
    if (changes.isLocked.newValue === false) {
      removeOverlay();
    } else if (changes.isLocked.newValue === true) {
      showOverlay();
    }
  }
});

// ─── Manual Lock Message Listener ────────────────────────────────────────────
// Tangkap pesan dari background.js untuk tampilkan/hapus overlay manual lock.
// Overlay diinjeksi langsung ke halaman yang sedang aktif (tanpa redirect).
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SHOW_MANUAL_LOCK_OVERLAY') {
    showOverlay();
    sendResponse({ success: true });
  }

  if (message.action === 'REMOVE_MANUAL_LOCK_OVERLAY') {
    removeOverlay();
    sendResponse({ success: true });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
