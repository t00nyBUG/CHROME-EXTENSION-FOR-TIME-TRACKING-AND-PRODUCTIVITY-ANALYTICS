// Background script for Chrome extension
let currentTab = null;
let startTime = null;
let timeData = {};

// Website categories
const PRODUCTIVE_SITES = [
  'github.com',
  'stackoverflow.com',
  'developer.mozilla.org',
  'docs.google.com',
  'notion.so',
  'codepen.io',
  'jsfiddle.net',
  'repl.it',
  'aws.amazon.com',
  'console.cloud.google.com'
];

const UNPRODUCTIVE_SITES = [
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'youtube.com',
  'netflix.com',
  'reddit.com',
  'tiktok.com',
  'twitch.tv',
  'pinterest.com'
];

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Productivity Tracker installed');
  // Set up periodic data sync
  chrome.alarms.create('syncData', { periodInMinutes: 5 });
});

// Handle tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await handleTabChange(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    await handleTabChange(tabId);
  }
});

// Handle window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus
    await saveCurrentSession();
    currentTab = null;
  } else {
    // Browser gained focus
    const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
    if (tabs.length > 0) {
      await handleTabChange(tabs[0].id);
    }
  }
});

async function handleTabChange(tabId) {
  // Save previous session
  await saveCurrentSession();
  
  // Start new session
  const tab = await chrome.tabs.get(tabId);
  if (tab && tab.url && !tab.url.startsWith('chrome://')) {
    currentTab = {
      id: tabId,
      url: tab.url,
      domain: getDomain(tab.url),
      title: tab.title
    };
    startTime = Date.now();
  } else {
    currentTab = null;
  }
}

async function saveCurrentSession() {
  if (currentTab && startTime) {
    const duration = Date.now() - startTime;
    const domain = currentTab.domain;
    
    // Get existing data
    const result = await chrome.storage.local.get(['timeData']);
    const data = result.timeData || {};
    
    // Update time data
    const today = new Date().toDateString();
    if (!data[today]) data[today] = {};
    if (!data[today][domain]) {
      data[today][domain] = {
        time: 0,
        visits: 0,
        category: categorizeWebsite(domain),
        title: currentTab.title
      };
    }
    
    data[today][domain].time += duration;
    data[today][domain].visits += 1;
    
    // Save to local storage
    await chrome.storage.local.set({ timeData: data });
    
    // Sync to backend
    try {
      await fetch('http://localhost:3000/api/time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: today,
          domain: domain,
          time: duration,
          category: data[today][domain].category,
          title: currentTab.title
        })
      });
    } catch (error) {
      console.log('Backend sync failed:', error);
    }
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

function categorizeWebsite(domain) {
  if (PRODUCTIVE_SITES.some(site => domain.includes(site))) {
    return 'productive';
  } else if (UNPRODUCTIVE_SITES.some(site => domain.includes(site))) {
    return 'unproductive';
  }
  return 'neutral';
}

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncData') {
    saveCurrentSession();
  }
});

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTodayData') {
    getTodayData().then(sendResponse);
    return true;
  }
});

async function getTodayData() {
  const today = new Date().toDateString();
  const result = await chrome.storage.local.get(['timeData']);
  const data = result.timeData || {};
  return data[today] || {};
}