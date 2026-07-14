document.getElementById('save-btn').addEventListener('click', async () => {
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const statusDiv = document.getElementById('status');

  statusDiv.textContent = '';
  statusDiv.className = '';

  if (!newPassword || !confirmPassword) {
    showStatus('Please fill in all fields.', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    showStatus('Passwords do not match.', 'error');
    return;
  }

  try {
    await chrome.storage.local.set({ 
      password: newPassword,
      isLocked: false // Start unlocked so they can continue browsing right now
    });
    
    showStatus('Password set successfully! You can close this tab.', 'success');
    
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
    
    setTimeout(() => {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        if (tabs.length === 1) {
          chrome.tabs.update(null, { url: 'chrome://newtab/' });
        } else {
          window.close();
        }
      });
    }, 2000);
  } catch (err) {
    showStatus('An error occurred. Please try again.', 'error');
  }
});

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = type;
}

document.getElementById('show-password').addEventListener('change', (e) => {
  const type = e.target.checked ? 'text' : 'password';
  document.getElementById('new-password').type = type;
  document.getElementById('confirm-password').type = type;
});
