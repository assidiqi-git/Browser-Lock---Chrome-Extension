chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const data = await chrome.storage.local.get(['password']);
    if (!data.password) {
      chrome.tabs.create({ url: 'setup.html' });
      return; // Do not lock yet, let the user set the password
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

// Intercept chrome:// URLs (including newtab) when locked
async function checkAndRedirect(tabId, url) {
  if (!url || !url.startsWith('chrome://')) return;
  
  const data = await chrome.storage.local.get(['isLocked', 'password']);
  if (data.password && data.isLocked !== false) {
    const sessionData = await chrome.storage.session.get(['firstLockTabId']);
    
    if (!sessionData.firstLockTabId) {
      await chrome.storage.session.set({ firstLockTabId: tabId });
      const lockUrl = chrome.runtime.getURL(`lock.html?redirect=${encodeURIComponent(url)}`);
      chrome.tabs.update(tabId, { url: lockUrl });
    } else if (sessionData.firstLockTabId !== tabId) {
      // Fokuskan kembali ke tab pertama dan tutup tab yang baru
      chrome.tabs.update(sessionData.firstLockTabId, { active: true });
      chrome.tabs.remove(tabId);
    }
  }
}

// Reset session jika tab lock pertama tidak sengaja ditutup
chrome.tabs.onRemoved.addListener(async (tabId) => {
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
      if (url && url.startsWith('chrome://')) {
        if (!firstLockId) {
          firstLockId = tab.id;
          await chrome.storage.session.set({ firstLockTabId: tab.id });
        }
        const lockUrl = chrome.runtime.getURL(`lock.html?redirect=${encodeURIComponent(url)}`);
        chrome.tabs.update(tab.id, { url: lockUrl });
      }
    }
  });
}

chrome.tabs.onCreated.addListener((tab) => {
  const url = tab.pendingUrl || tab.url;
  checkAndRedirect(tab.id, url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.pendingUrl || tab.url;
  checkAndRedirect(tabId, url);
});

// Auto-Open Startup Tabs Logic
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.isLocked) {
    const wasLocked = changes.isLocked.oldValue !== false;
    const isNowUnlocked = changes.isLocked.newValue === false;
    
    if (wasLocked && isNowUnlocked) {
      const sessionData = await chrome.storage.session.get(['hasOpenedStartupTabs']);
      if (!sessionData.hasOpenedStartupTabs) {
        const localData = await chrome.storage.local.get(['autoOpenUrls']);
        const urls = localData.autoOpenUrls || [];
        
        if (urls.length > 0) {
          // Get the current active tab to find its index
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTabIndex = (tabs && tabs.length > 0) ? tabs[0].index : 0;
            
            // Open each URL in a new tab, positioned to the left of the active tab
            urls.forEach((url, i) => {
              chrome.tabs.create({ 
                url, 
                active: false,
                index: Math.max(0, currentTabIndex + i)
              });
            });
          });
        }
        
        // Mark as opened for this session
        await chrome.storage.session.set({ hasOpenedStartupTabs: true });
      }
    }
  }
});
