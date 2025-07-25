const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dashboard')));

// Data storage file
const DATA_FILE = path.join(__dirname, 'data', 'timeData.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

// Load data from file
async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// Save data to file
async function saveData(data) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// API Routes

// Get all time data
app.get('/api/data', async (req, res) => {
  try {
    const data = await loadData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load data' });
  }
});

// Add time entry
app.post('/api/time', async (req, res) => {
  try {
    const { date, domain, time, category, title } = req.body;
    const data = await loadData();
    
    if (!data[date]) data[date] = {};
    if (!data[date][domain]) {
      data[date][domain] = {
        time: 0,
        visits: 0,
        category: category,
        title: title
      };
    }
    
    data[date][domain].time += time;
    data[date][domain].visits += 1;
    data[date][domain].category = category;
    data[date][domain].title = title;
    
    await saveData(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// Get weekly report
app.get('/api/report/weekly', async (req, res) => {
  try {
    const data = await loadData();
    const report = generateWeeklyReport(data);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Get productivity analysis
app.get('/api/analysis', async (req, res) => {
  try {
    const data = await loadData();
    const analysis = generateProductivityAnalysis(data);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate analysis' });
  }
});

// Update website category
app.put('/api/category', async (req, res) => {
  try {
    const { domain, category } = req.body;
    const data = await loadData();
    
    // Update category for all instances of this domain
    Object.keys(data).forEach(date => {
      if (data[date][domain]) {
        data[date][domain].category = category;
      }
    });
    
    await saveData(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Helper functions
function generateWeeklyReport(data) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  const weeklyData = {};
  let totalTime = 0;
  let productiveTime = 0;
  let unproductiveTime = 0;
  
  Object.entries(data).forEach(([dateStr, dayData]) => {
    const date = new Date(dateStr);
    if (date >= oneWeekAgo) {
      weeklyData[dateStr] = dayData;
      
      Object.values(dayData).forEach(siteData => {
        totalTime += siteData.time;
        if (siteData.category === 'productive') {
          productiveTime += siteData.time;
        } else if (siteData.category === 'unproductive') {
          unproductiveTime += siteData.time;
        }
      });
    }
  });
  
  return {
    totalTime,
    productiveTime,
    unproductiveTime,
    neutralTime: totalTime - productiveTime - unproductiveTime,
    productivityScore: totalTime > 0 ? Math.round((productiveTime / totalTime) * 100) : 0,
    dailyBreakdown: weeklyData,
    topSites: getTopSites(weeklyData, 10)
  };
}

function generateProductivityAnalysis(data) {
  const analysis = {
    totalDays: Object.keys(data).length,
    averageDailyTime: 0,
    mostProductiveDay: null,
    leastProductiveDay: null,
    categoryBreakdown: { productive: 0, unproductive: 0, neutral: 0 },
    trends: []
  };
  
  if (analysis.totalDays === 0) return analysis;
  
  let totalTime = 0;
  let maxProductiveTime = 0;
  let minProductiveTime = Infinity;
  
  Object.entries(data).forEach(([date, dayData]) => {
    let dayTotal = 0;
    let dayProductive = 0;
    
    Object.values(dayData).forEach(siteData => {
      dayTotal += siteData.time;
      totalTime += siteData.time;
      
      if (siteData.category === 'productive') {
        dayProductive += siteData.time;
        analysis.categoryBreakdown.productive += siteData.time;
      } else if (siteData.category === 'unproductive') {
        analysis.categoryBreakdown.unproductive += siteData.time;
      } else {
        analysis.categoryBreakdown.neutral += siteData.time;
      }
    });
    
    if (dayProductive > maxProductiveTime) {
      maxProductiveTime = dayProductive;
      analysis.mostProductiveDay = { date, time: dayProductive };
    }
    
    if (dayProductive < minProductiveTime) {
      minProductiveTime = dayProductive;
      analysis.leastProductiveDay = { date, time: dayProductive };
    }
  });
  
  analysis.averageDailyTime = Math.round(totalTime / analysis.totalDays);
  
  return analysis;
}

function getTopSites(data, limit = 10) {
  const siteMap = {};
  
  Object.values(data).forEach(dayData => {
    Object.entries(dayData).forEach(([domain, siteData]) => {
      if (!siteMap[domain]) {
        siteMap[domain] = { ...siteData, domain };
      } else {
        siteMap[domain].time += siteData.time;
        siteMap[domain].visits += siteData.visits;
      }
    });
  });
  
  return Object.values(siteMap)
    .sort((a, b) => b.time - a.time)
    .slice(0, limit);
}

// Start server
app.listen(PORT, () => {
  console.log(`Productivity Tracker backend running on http://localhost:${PORT}`);
});

module.exports = app;