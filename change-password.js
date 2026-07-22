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
