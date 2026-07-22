// In-memory Set untuk mencegah race condition.
// KRITIS: .add() harus dipanggil SEBELUM await apapun agar tidak ada
// celah waktu di mana dua handler memproses tab yang sama.
const processingTabIds = new Set();

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const data = await chrome.storage.local.get(['password']);
    if (!data.password) {
      chrome.tabs.create({ url: 'setup.html' });
      return;
    }
  }

  const data = await chrome.storage.local.get(['password']);
  if (data.password) {
    await chrome.storage.local.set({ isLocked: true });
    lockChromeTabs();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get(['password']);
  if (data.password) {
    await chrome.storage.local.set({ isLocked: true });
    lockChromeTabs();
  }
});

// Intercept chrome:// URLs (including newtab) when locked.
// canRecreate: true jika dipanggil dari onCreated (tab baru),
//              false jika dari onUpdated (tab lama ganti URL).
async function checkAndRedirect(tabId, url, canRecreate = false) {
  if (!url || !url.startsWith('chrome://')) return;

  // Guard synchronous — HARUS sebelum await apapun.
  // JavaScript single-threaded: tidak ada kode lain yang bisa berjalan
  // antara .has() dan .add() ini.
  if (processingTabIds.has(tabId)) return;
  processingTabIds.add(tabId);

  try {
    const data = await chrome.storage.local.get(['isLocked', 'password']);
    if (!data.password || data.isLocked === false) {
      processingTabIds.delete(tabId);
      return;
    }

    const sessionData = await chrome.storage.session.get(['firstLockTabId']);
    const lockUrl = chrome.runtime.getURL(`lock.html?redirect=${encodeURIComponent(url)}`);

    if (!sessionData.firstLockTabId) {
      if (canRecreate) {
        // Re-create Tab Trick:
        // Hapus tab lama, buat baru di posisi sama.
        // Tab yang dibuat via chrome.tabs.create() mendapat fokus di
        // viewport (bukan address bar) sehingga autofocus password bekerja.
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            processingTabIds.delete(tabId);
            return;
          }
          const tabIndex = tab.index;
          // Buat tab baru dulu (langsung tampil & fokus di viewport),
          // lalu hapus tab lama — mencegah flash akibat tab kosong sejenak
          chrome.tabs.create({ url: lockUrl, index: tabIndex, active: true }, (newTab) => {
            chrome.storage.session.set({ firstLockTabId: newTab.id });
            processingTabIds.delete(tabId);
            chrome.tabs.remove(tabId);
          });
        });
      } else {
        // Untuk onUpdated: cukup update URL, tidak perlu re-create
        chrome.tabs.update(tabId, { url: lockUrl }, () => {
          chrome.storage.session.set({ firstLockTabId: tabId });
          processingTabIds.delete(tabId);
        });
      }
    } else if (sessionData.firstLockTabId !== tabId) {
      // Tab lain selain lock tab utama: fokuskan tab lock & tutup tab ini
      processingTabIds.delete(tabId);
      chrome.tabs.update(sessionData.firstLockTabId, { active: true });
      chrome.tabs.remove(tabId);
    } else {
      processingTabIds.delete(tabId);
    }
  } catch (e) {
    processingTabIds.delete(tabId);
  }
}

// Reset session jika tab lock pertama tidak sengaja ditutup
chrome.tabs.onRemoved.addListener(async (tabId) => {
  processingTabIds.delete(tabId);
  const sessionData = await chrome.storage.session.get(['firstLockTabId']);
  if (sessionData.firstLockTabId === tabId) {
    await chrome.storage.session.remove('firstLockTabId');
  }
});

function lockChromeTabs() {
  chrome.tabs.query({}, async (tabs) => {
    const data = await chrome.storage.local.get(['password']);
    if (!data.password) return;

    const sessionData = await chrome.storage.session.get(['firstLockTabId']);
    let firstLockId = sessionData.firstLockTabId;

    for (const tab of tabs) {
      const url = tab.pendingUrl || tab.url;
      if (!url || !url.startsWith('chrome://')) continue;

      const tabId = tab.id;
      const tabIndex = tab.index;

      // Jika tab sudah diproses oleh checkAndRedirect (onCreated), skip
      if (processingTabIds.has(tabId)) continue;
      processingTabIds.add(tabId);

      const lockUrl = chrome.runtime.getURL(`lock.html?redirect=${encodeURIComponent(url)}`);

      if (!firstLockId) {
        // Re-create Tab Trick untuk tab pertama agar fokus di viewport.
        // Buat tab baru dulu, lalu hapus tab lama (mencegah flash)
        await new Promise((resolve) => {
          chrome.tabs.create({ url: lockUrl, index: tabIndex, active: true }, (newTab) => {
            firstLockId = newTab.id;
            chrome.storage.session.set({ firstLockTabId: newTab.id });
            processingTabIds.delete(tabId);
            chrome.tabs.remove(tabId);
            resolve();
          });
        });
      } else {
        // Tab berikutnya: cukup update URL
        chrome.tabs.update(tabId, { url: lockUrl }, () => {
          processingTabIds.delete(tabId);
        });
      }
    }
  });
}

// onCreated: tab baru → gunakan re-create trick (canRecreate = true)
chrome.tabs.onCreated.addListener((tab) => {
  const url = tab.pendingUrl || tab.url;
  checkAndRedirect(tab.id, url, true);
});

// onUpdated: tab lama ganti URL → update biasa (canRecreate = false)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.pendingUrl || tab.url;
  checkAndRedirect(tabId, url, false);
});

// Auto-Open Startup Tabs Logic
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.isLocked) {
    const wasLocked = changes.isLocked.oldValue !== false;
    const isNowUnlocked = changes.isLocked.newValue === false;

    if (wasLocked && isNowUnlocked) {
      const sessionData = await chrome.storage.session.get(['hasOpenedStartupTabs']);
      if (!sessionData.hasOpenedStartupTabs) {
        const localData = await chrome.storage.local.get(['autoOpenUrls', 'closeOtherTabsOnUnlock']);
        const urls = localData.autoOpenUrls || [];

        if (urls.length > 0) {
          const closeOther = localData.closeOtherTabsOnUnlock;

          chrome.tabs.query({ currentWindow: true }, async (tabs) => {
            const activeTab = tabs.find(t => t.active);
            const currentTabIndex = activeTab ? activeTab.index : 0;
            const existingTabIds = tabs.map(t => t.id);

            for (let i = 0; i < urls.length; i++) {
              await chrome.tabs.create({
                url: urls[i],
                active: i === urls.length - 1,
                index: Math.max(0, currentTabIndex + i)
              });
            }

            if (closeOther) {
              chrome.tabs.remove(existingTabIds);
            }
          });
        }

        await chrome.storage.session.set({ hasOpenedStartupTabs: true });
      }
    }
  }
});
