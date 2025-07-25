// Content script for time tracking
let isActive = true;
let lastActivity = Date.now();

// Track user activity
document.addEventListener('mousemove', updateActivity);
document.addEventListener('keypress', updateActivity);
document.addEventListener('scroll', updateActivity);
document.addEventListener('click', updateActivity);

function updateActivity() {
  lastActivity = Date.now();
  if (!isActive) {
    isActive = true;
    // Notify background script that user is active
    chrome.runtime.sendMessage({ action: 'userActive' });
  }
}

// Check for inactivity every 30 seconds
setInterval(() => {
  const now = Date.now();
  if (now - lastActivity > 30000 && isActive) { // 30 seconds of inactivity
    isActive = false;
    chrome.runtime.sendMessage({ action: 'userInactive' });
  }
}, 30000);

// Track page visibility
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    chrome.runtime.sendMessage({ action: 'pageHidden' });
  } else {
    chrome.runtime.sendMessage({ action: 'pageVisible' });
    updateActivity();
  }
});