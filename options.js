document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get(['password']);
  if (!data.password) {
    window.location.href = 'setup.html';
  }
});

document.getElementById('save-btn').addEventListener('click', async () => {
  const currentPasswordInput = document.getElementById('current-password').value;
  const newPasswordInput = document.getElementById('new-password').value;
  const confirmPasswordInput = document.getElementById('confirm-password').value;
  const statusDiv = document.getElementById('status');

  statusDiv.textContent = '';
  statusDiv.className = '';

  if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
    showStatus('Please fill in all fields.', 'error');
    return;
  }

  if (newPasswordInput !== confirmPasswordInput) {
    showStatus('New passwords do not match.', 'error');
    return;
  }

  try {
    const data = await chrome.storage.local.get(['password']);
    const actualPassword = data.password;

    if (!actualPassword) return;

    if (currentPasswordInput !== actualPassword) {
      showStatus('Current password is incorrect.', 'error');
      return;
    }

    await chrome.storage.local.set({ password: newPasswordInput });
    showStatus('Password updated successfully.', 'success');
    
    // Clear fields
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
  } catch (err) {
    showStatus('An error occurred. Please try again.', 'error');
  }
});

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = type;
}

// Auto-Open URLs Logic
const urlListElement = document.getElementById('url-list');
const newUrlInput = document.getElementById('new-url');
const addUrlBtn = document.getElementById('add-url-btn');

async function renderUrls() {
  const data = await chrome.storage.local.get(['autoOpenUrls']);
  const urls = data.autoOpenUrls || [];
  urlListElement.innerHTML = '';
  
  urls.forEach((url, index) => {
    const li = document.createElement('li');
    li.textContent = url;
    
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', async () => {
      urls.splice(index, 1);
      await chrome.storage.local.set({ autoOpenUrls: urls });
      renderUrls();
    });
    
    li.appendChild(removeBtn);
    urlListElement.appendChild(li);
  });
}

addUrlBtn.addEventListener('click', async () => {
  let url = newUrlInput.value.trim();
  if (!url) return;
  
  // Basic validation and formatting
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  const data = await chrome.storage.local.get(['autoOpenUrls']);
  const urls = data.autoOpenUrls || [];
  urls.push(url);
  
  await chrome.storage.local.set({ autoOpenUrls: urls });
  newUrlInput.value = '';
  renderUrls();
});

// Initialize URL list and settings on load
renderUrls();

const closeOtherTabsCheckbox = document.getElementById('close-other-tabs');
if (closeOtherTabsCheckbox) {
  chrome.storage.local.get(['closeOtherTabsOnUnlock']).then((data) => {
    closeOtherTabsCheckbox.checked = data.closeOtherTabsOnUnlock || false;
  });
  closeOtherTabsCheckbox.addEventListener('change', async (e) => {
    await chrome.storage.local.set({ closeOtherTabsOnUnlock: e.target.checked });
  });
}

// Manual Lock
document.getElementById('manual-lock-btn').addEventListener('click', async () => {
  const lockStatusDiv = document.getElementById('lock-status');
  lockStatusDiv.textContent = '';

  // Kirim pesan ke background.js untuk memicu Manual Lock
  chrome.runtime.sendMessage({ action: 'MANUAL_LOCK' }, (response) => {
    if (chrome.runtime.lastError) {
      lockStatusDiv.style.color = '#dc3545';
      lockStatusDiv.textContent = 'Failed to lock. Please try again.';
      return;
    }
    if (response && response.success) {
      lockStatusDiv.style.color = '#28a745';
      lockStatusDiv.textContent = '✓ Browser locked successfully.';
      setTimeout(() => { lockStatusDiv.textContent = ''; }, 3000);
    }
  });
});
