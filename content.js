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
  
  const focusInput = () => {
    window.focus(); // Attempt to pull focus to the window document
    const pwdInput = document.getElementById('browser-lock-password-12345');
    if (pwdInput) {
      pwdInput.focus();
      pwdInput.click(); // Sometimes a programmatic click helps
    }
  };
  
  focusInput();
  setTimeout(focusInput, 50);
  setTimeout(focusInput, 300);
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
  
  if (!actualPassword) return; // Should not happen if overlay is shown

  if (passwordEntered === actualPassword) {
    await chrome.storage.local.set({ isLocked: false });
    removeOverlay();
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
