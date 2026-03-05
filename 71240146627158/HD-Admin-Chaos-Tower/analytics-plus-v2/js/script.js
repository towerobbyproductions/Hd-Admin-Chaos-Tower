// js/script.js — client-side (uses GAS proxy endpoints)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbym3iWz4yiwmWAKkhy_5LRR3YXBlRPHVU0U1rJg3uwN2por7kGwOH2KUjP-IYz52BstWA/exec'; // <- вставьте сюда Web app URL
const API_TOKEN = 's3cr3t-XYZ'; // <- должен совпадать с API_TOKEN в Script Properties

const GAME_CONFIG = {
  universeId: '9678437015',
  robloxApi: 'https://games.roproxy.com/v1/games?universeIds=9678437015'
};

let currentLang = 'en';
let charts = {};
let updateInterval;
let currentChartType = 'line';

// DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    lastUpdate: document.getElementById('lastUpdate'),
    currentOnline: document.getElementById('currentOnline'),
    dailyRecord: document.getElementById('dailyRecord'),
    allTimePeak: document.getElementById('allTimePeak'),
    peakDate: document.getElementById('peakDate'),
    totalVisits: document.getElementById('totalVisits'),
    todayVisits: document.getElementById('todayVisits'),
    favorites: document.getElementById('favorites'),
    favoritesGrowth: document.getElementById('favoritesGrowth'),
    refreshBtn: document.getElementById('refreshData'),
    themeToggle: document.getElementById('themeToggle'),
    langToggle: document.getElementById('langToggle'),
    recordsTable: document.getElementById('recordsTable'),
    peakHours: document.getElementById('peakHours')
  };

  initTheme(elements);
  initLanguage(elements);
  setupEventListeners(elements);

  loadAllData(elements).then(() => startAutoUpdate());
});

// helpers to call GAS
async function apiGet(action, params = {}) {
  const url = new URL(GAS_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('token', API_TOKEN);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
  const r = await fetch(url.toString(), { method: 'GET' });
  return r.json();
}
async function apiPost(action, body = {}) {
  const payload = Object.assign({}, body, { action, token: API_TOKEN });
  const r = await fetch(GAS_URL, { method: 'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
  return r.json();
}

// theme & language
function initTheme(elements) {
  const saved = localStorage.getItem('theme') || 'dark';
  if (saved === 'light') { document.documentElement.classList.remove('dark'); if (elements?.themeToggle) elements.themeToggle.textContent='☀️'; }
  else { document.documentElement.classList.add('dark'); if (elements?.themeToggle) elements.themeToggle.textContent='🌙'; }
}
function toggleTheme(elements) {
  const html = document.documentElement;
  if (html.classList.contains('dark')) { html.classList.remove('dark'); if (elements?.themeToggle) elements.themeToggle.textContent='☀️'; localStorage.setItem('theme','light'); }
  else { html.classList.add('dark'); if (elements?.themeToggle) elements.themeToggle.textContent='🌙'; localStorage.setItem('theme','dark'); }
  updateCharts();
}
function initLanguage(elements) {
  currentLang = localStorage.getItem('language') || 'en';
  updateLanguage(elements);
}
function toggleLanguage(elements) {
  currentLang = currentLang === 'en' ? 'ru' : 'en';
  localStorage.setItem('language', currentLang);
  updateLanguage(elements);
  loadAllData(elements);
}
function updateLanguage(elements) {
  if (elements?.langToggle) elements.langToggle.textContent = currentLang === 'en' ? 'RU' : 'EN';
  document.querySelectorAll('[data-lang-en]').forEach(el => {
    const txt = el.getAttribute(`data-lang-${currentLang}`);
    if (txt != null) el.textContent = txt;
  });
}
function setupEventListeners(elements) {
  if (elements?.themeToggle) elements.themeToggle.addEventListener('click', ()=>toggleTheme(elements));
  if (elements?.langToggle) elements.langToggle.addEventListener('click', ()=>toggleLanguage(elements));
  if (elements?.refreshBtn) elements.refreshBtn.addEventListener('click', ()=>loadAllData(elements, true));
  document.querySelectorAll('.chart-type-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.chart-type-btn').forEach(b=>b.classList.remove('active','bg-roblox-blue','text-white'));
      btn.classList.add('active','bg-roblox-blue','text-white');
      currentChartType = btn.dataset.type||'line';
      updateCharts();
    });
  });
}

// load everything
async function loadAllData(elements = {}, showRefresh=false) {
  try {
    if (showRefresh && elements.refreshBtn) elements.refreshBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>${currentLang==='en'?'Loading...':'Загрузка...'}`;

    await Promise.allSettled([
      loadCurrentStats(elements),
      loadHistoricalData(elements),
      loadRecords(elements),
      loadPeakHours(elements),
      loadWeekdayDistribution(elements),
      loadWeeklyComparison(elements)
    ]);

    if (elements.lastUpdate) elements.lastUpdate.textContent = new Date().toLocaleTimeString();
    if (showRefresh && elements.refreshBtn) elements.refreshBtn.innerHTML = `<i class="fas fa-sync-alt mr-2"></i>${currentLang==='en'?'Refresh':'Обновить'}`;
  } catch(e){ console.error('loadAllData', e); }
}

// current stats -> Roblox + store via GAS (your recorder also fills DB on schedule)
async function loadCurrentStats(elements) {
  if (!elements) return;
  try {
    const res = await fetch(GAME_CONFIG.robloxApi).catch(()=>null);
    if (res && res.ok) {
      const j = await res.json();
      const game = j?.data?.[0];
      if (game) {
        if (elements.currentOnline) elements.currentOnline.textContent = formatNumber(game.playing);
        if (elements.totalVisits) elements.totalVisits.textContent = formatNumber(game.visits);
        if (elements.favorites) elements.favorites.textContent = formatNumber(game.favoritedCount);

        // write to Supabase via GAS (non-blocking)
        apiPost('insert_player_stats', { row: {
          universe_id: GAME_CONFIG.universeId,
          active_players: game.playing,
          total_visits: game.visits,
          favorites: game.favoritedCount,
          created_at: new Date().toISOString()
        }}).catch(e=>console.warn('insert_player_stats', e));

        // upsert daily record
        const today = new Date().toISOString().split('T')[0];
        apiPost('upsert_daily_record', { record: {
          universe_id: GAME_CONFIG.universeId,
          record_type: 'online',
          value: game.playing,
          recorded_at: new Date().toISOString()
        }}).catch(e=>console.warn('upsert_daily_record', e));

        // favorites growth
        await calculateFavoritesGrowth(elements, game.favoritedCount);
        // all-time peak
        const peak = await apiGet('get_all_time_peak');
        if (Array.isArray(peak) && peak.length) {
          elements.allTimePeak.textContent = formatNumber(peak[0].value);
          if (elements.peakDate) elements.peakDate.textContent = new Date(peak[0].recorded_at).toLocaleDateString(currentLang === 'en' ? 'en-US' : 'ru-RU');
        }

        return;
      }
    }
    if (elements.currentOnline) elements.currentOnline.textContent = '-';
  } catch(e){ console.error('loadCurrentStats', e); }
}

async function calculateFavoritesGrowth(elements, currentFavorites) {
  if (!elements) return;
  try {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
    const since = weekAgo.toISOString();
    const data = await apiGet('get_player_stats_since', { since });
    if (Array.isArray(data) && data.length) {
      const base = data[0].favorites || 1;
      const growth = ((currentFavorites - base) / base * 100).toFixed(1);
      if (elements.favoritesGrowth) { elements.favoritesGrowth.textContent = `${growth>=0?'+':''}${growth}%`; elements.favoritesGrowth.className = growth>=0 ? 'text-green-500' : 'text-red-500'; }
    }
  } catch(e){ console.error('calculateFavoritesGrowth', e); }
}

// HISTORICAL 24h chart (real data)
async function loadHistoricalData(elements) {
  try {
    const data = await apiGet('get_historical_24h');
    if (!Array.isArray(data)) return;
    const labels = data.map(d=> new Date(d.label).toLocaleTimeString(currentLang==='en'?'en-US':'ru-RU',{hour:'2-digit',minute:'2-digit'}));
    // use avg if available otherwise max fallback
    const values = data.map(d=> d.avg !== null ? d.avg : (d.max || 0));
    createCharts(labels, values);
  } catch(e){ console.error('loadHistoricalData', e); }
}

// weekly comparison (last 7 days averages)
async function loadWeeklyComparison(elements) {
  try {
    const data = await apiGet('get_weekly_comparison');
    if (!Array.isArray(data)) return;
    const labels = data.map(d=> {
      const dt = new Date(d.date + 'T00:00:00Z');
      return dt.toLocaleDateString(currentLang==='en'?'en-US':'ru-RU', { month:'short', day:'numeric' });
    });
    const values = data.map(d=> d.avg || 0);
    renderSmallChart('weeklyChart', labels, values, currentLang==='en'?'Avg players':'Среднее игроков');
  } catch(e){ console.error('loadWeeklyComparison', e); }
}

// weekday distribution
async function loadWeekdayDistribution(elements) {
  try {
    const data = await apiGet('get_weekday_distribution', { weeks: 6 });
    if (!Array.isArray(data)) return;
    const labels = data.map(d=> d.label);
    const values = data.map(d=> d.avg || 0);
    renderSmallChart('weekdayChart', labels, values, currentLang==='en'?'Avg players':'Среднее игроков');
  } catch(e){ console.error('loadWeekdayDistribution', e); }
}

// peak hours from hourly_stats
async function loadPeakHours(elements) {
  if (!elements) return;
  try {
    const data = await apiGet('get_hourly');
    if (Array.isArray(data) && data.length) {
      elements.peakHours.innerHTML = data.slice(0,5).map((item,idx)=>{
        const hour = item.hour;
        const timeLabel = hour ? (isNaN(Date.parse(hour)) ? (new Date().toLocaleTimeString(currentLang==='en'?'en-US':'ru-RU',{hour:'2-digit',minute:'2-digit'})) : new Date(hour).toLocaleTimeString(currentLang==='en'?'en-US':'ru-RU',{hour:'2-digit',minute:'2-digit'})) : '-';
        return `<div class="flex items-center justify-between p-3 bg-gray-200 dark:bg-gray-800 rounded-lg"><div class="flex items-center gap-3"><span class="text-lg font-bold text-roblox-blue">#${idx+1}</span><span>${timeLabel}</span></div><span class="font-semibold">${formatNumber(item.max_players)}</span></div>`;
      }).join('');
      return;
    }
    if (elements.peakHours) elements.peakHours.innerHTML = '<div class="text-gray-500">No data</div>';
  } catch(e){ console.error('loadPeakHours', e); if (elements?.peakHours) elements.peakHours.innerHTML = '<div class="text-gray-500">Error</div>'; }
}

// record history
async function loadRecords(elements) {
  if (!elements) return;
  try {
    const data = await apiGet('get_records');
    if (Array.isArray(data) && data.length) {
      elements.recordsTable.innerHTML = data.map((record, index) => {
        const prevValue = index < data.length - 1 ? data[index + 1].value : record.value;
        const diff = record.value - prevValue;
        return `<tr class="record-${record.record_type}"><td>${new Date(record.recorded_at).toLocaleDateString(currentLang==='en'?'en-US':'ru-RU')}</td><td>${translateRecordType(record.record_type)}</td><td class="font-bold">${formatNumber(record.value)}</td><td class="${diff>0?'text-green-500':diff<0?'text-red-500':''}">${diff>0?'+':''}${formatNumber(diff)}</td></tr>`;
      }).join('');
      return;
    }
    elements.recordsTable.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No records</td></tr>';
  } catch(e){ console.error('loadRecords', e); if (elements) elements.recordsTable.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Error</td></tr>'; }
}

function translateRecordType(type) {
  const translations = { 'online': {en:'Online Players', ru:'Онлайн игроки'}, 'visits':{en:'Visits',ru:'Посещения'}, 'favorites':{en:'Favorites',ru:'Избранное'} };
  return translations[type]?.[currentLang] || type;
}

// chart helpers
function createCharts(labels, data) {
  const el = document.getElementById('onlineChart');
  if (!el) return;
  const ctx = el.getContext('2d');
  if (charts.main) charts.main.destroy();
  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#fff' : '#333';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  charts.main = new Chart(ctx, {
    type: currentChartType,
    data: { labels: labels, datasets: [{ label: currentLang==='en'?'Players':'Игроки', data: data, borderColor:'#00A2FF', backgroundColor: currentChartType==='bar' ? 'rgba(0,162,255,0.25)' : 'rgba(0,162,255,0.08)', tension:0.4, fill: currentChartType==='line' }]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:textColor}}}, scales:{ y:{grid:{color:gridColor}, ticks:{color:textColor}}, x:{grid:{color:gridColor}, ticks:{color:textColor}} } }
  });
}

function renderSmallChart(canvasId, labels, data, label) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ctx = el.getContext('2d');
  if (charts[canvasId]) charts[canvasId].destroy();
  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#fff' : '#333';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  charts[canvasId] = new Chart(ctx, { type: 'bar', data:{ labels, datasets:[{ label: label, data }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:textColor}}}, scales:{ y:{grid:{color:gridColor}, ticks:{color:textColor}}, x:{grid:{color:gridColor}, ticks:{color:textColor}} } } });
}

function updateCharts() {
  if (!charts.main) return;
  charts.main.config.type = currentChartType;
  charts.main.data.datasets[0].backgroundColor = currentChartType==='bar' ? 'rgba(0,162,255,0.25)' : 'rgba(0,162,255,0.08)';
  charts.main.update();
}

// utils
function startAutoUpdate(){ if (updateInterval) clearInterval(updateInterval); updateInterval = setInterval(()=> loadAllData(), 300000); }
function formatNumber(num){ if (num === null || num === undefined) return '-'; if (num >= 1000000) return (num/1000000).toFixed(1)+'M'; if (num >= 1000) return (num/1000).toFixed(1)+'K'; return num.toString(); }
function highlightElement(el){ if (!el) return; el.classList.add('data-updated'); setTimeout(()=>el.classList.remove('data-updated'),1000); }
