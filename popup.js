// Popup script
document.addEventListener('DOMContentLoaded', async () => {
  await loadTodayStats();
  
  // Event listeners
  document.getElementById('dashboardBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000' });
  });
  
  document.getElementById('resetBtn').addEventListener('click', resetTodayData);
});

async function loadTodayStats() {
  try {
    const data = await chrome.runtime.sendMessage({ action: 'getTodayData' });
    displayStats(data);
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

function displayStats(data) {
  let totalTime = 0;
  let productiveTime = 0;
  let unproductiveTime = 0;
  let websites = [];
  
  // Calculate totals
  Object.entries(data).forEach(([domain, info]) => {
    totalTime += info.time;
    websites.push({ domain, ...info });
    
    if (info.category === 'productive') {
      productiveTime += info.time;
    } else if (info.category === 'unproductive') {
      unproductiveTime += info.time;
    }
  });
  
  // Update display
  document.getElementById('totalTime').textContent = formatTime(totalTime);
  document.getElementById('productiveTime').textContent = formatTime(productiveTime);
  document.getElementById('unproductiveTime').textContent = formatTime(unproductiveTime);
  
  // Update progress bars
  const productivePercent = totalTime > 0 ? (productiveTime / totalTime) * 100 : 0;
  const unproductivePercent = totalTime > 0 ? (unproductiveTime / totalTime) * 100 : 0;
  
  document.getElementById('productiveProgress').style.width = `${productivePercent}%`;
  document.getElementById('unproductiveProgress').style.width = `${unproductivePercent}%`;
  
  // Display top websites
  websites.sort((a, b) => b.time - a.time);
  const websiteList = document.getElementById('websiteList');
  websiteList.innerHTML = '';
  
  websites.slice(0, 5).forEach(site => {
    const item = document.createElement('div');
    item.className = 'website-item';
    item.innerHTML = `
      <div style="display: flex; align-items: center; flex: 1;">
        <div class="category-dot category-${site.category}"></div>
        <div class="website-name" title="${site.domain}">${site.domain}</div>
      </div>
      <div class="website-time">${formatTime(site.time)}</div>
    `;
    websiteList.appendChild(item);
  });
}

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

async function resetTodayData() {
  if (confirm('Are you sure you want to reset today\'s data?')) {
    const today = new Date().toDateString();
    const result = await chrome.storage.local.get(['timeData']);
    const data = result.timeData || {};
    delete data[today];
    await chrome.storage.local.set({ timeData: data });
    await loadTodayStats();
  }
}