// lock-page.js
// Script khusus untuk halaman lock.html
// Form sudah ada di HTML statis, script ini hanya handle logika verifikasi

function preventDefaultAction(e) {
  e.preventDefault();
}

function preventInspectElement(e) {
  if (e.key === 'F12') {
    e.preventDefault();
    return false;
  }
  if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
    e.preventDefault();
    return false;
  }
  if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
    e.preventDefault();
    return false;
  }
}

function enableLockProtections() {
  document.addEventListener('contextmenu', preventDefaultAction);
  document.addEventListener('keydown', preventInspectElement, { capture: true });
}

async function verifyPassword() {
  const inputEl = document.getElementById('browser-lock-password-12345');
  const errorEl = document.getElementById('browser-lock-error-12345');
  const passwordEntered = inputEl.value;

  const localData = await chrome.storage.local.get(['password']);
  const actualPassword = localData.password;

  if (!actualPassword) return;

  if (passwordEntered === actualPassword) {
    await chrome.storage.local.set({ isLocked: false });

    // Redirect kembali ke URL asal
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = urlParams.get('redirect') || 'chrome://newtab/';

    chrome.tabs.getCurrent((tab) => {
      if (tab && tab.id) {
        chrome.tabs.update(tab.id, { url: redirectUrl });
      } else {
        window.location.href = redirectUrl;
      }
    });
  } else {
    errorEl.style.display = 'block';
    inputEl.value = '';
    inputEl.focus();
  }
}

async function init() {
  // Cek apakah memang harus terkunci, jika tidak → redirect langsung
  const localData = await chrome.storage.local.get(['isLocked', 'password']);
  if (!localData.password || localData.isLocked === false) {
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = urlParams.get('redirect') || 'chrome://newtab/';
    chrome.tabs.getCurrent((tab) => {
      if (tab && tab.id) {
        chrome.tabs.update(tab.id, { url: redirectUrl });
      } else {
        window.location.href = redirectUrl;
      }
    });
    return;
  }

  // Aktifkan proteksi
  enableLockProtections();

  // Pasang event listener tombol & enter
  document.getElementById('browser-lock-submit-12345').addEventListener('click', verifyPassword);
  document.getElementById('browser-lock-password-12345').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyPassword();
  });

  // Pastikan fokus ada di input password
  // (autofocus di HTML sudah menangani ini, tapi ini sebagai fallback)
  const pwdInput = document.getElementById('browser-lock-password-12345');
  if (pwdInput && document.activeElement !== pwdInput) {
    pwdInput.focus();
  }

  // === Focus Trap ===
  // Cegah fokus berpindah dari input password saat user klik atau aktivitas apapun.

  // 1. Tangkap mousedown di seluruh dokumen.
  //    preventDefault pada mousedown mencegah browser memindahkan fokus,
  //    tapi mouseup/click tetap jalan sehingga tombol Unlock masih bisa diklik.
  document.addEventListener('mousedown', (e) => {
    const pwdInput = document.getElementById('browser-lock-password-12345');
    const submitBtn = document.getElementById('browser-lock-submit-12345');
    if (e.target !== pwdInput && e.target !== submitBtn) {
      e.preventDefault();
      pwdInput.focus();
    }
  });

  // 2. Cegah Tab & Shift+Tab memindahkan fokus keluar dari input
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const pwdInput = document.getElementById('browser-lock-password-12345');
      if (pwdInput) pwdInput.focus();
    }
  });

  // 3. Fallback: jika fokus tetap berpindah (edge case), langsung kembalikan
  const pwdInputEl = document.getElementById('browser-lock-password-12345');
  if (pwdInputEl) {
    pwdInputEl.addEventListener('blur', () => {
      // Delay kecil agar blur dari klik tombol Unlock tidak di-cancel
      setTimeout(() => {
        const el = document.getElementById('browser-lock-password-12345');
        if (el && document.activeElement !== el) {
          el.focus();
        }
      }, 10);
    });
  }

  // Kembalikan fokus ke input saat user balik ke tab ini
  window.addEventListener('focus', () => {
    const pwdInput = document.getElementById('browser-lock-password-12345');
    if (pwdInput) pwdInput.focus();
  });
}

init();
