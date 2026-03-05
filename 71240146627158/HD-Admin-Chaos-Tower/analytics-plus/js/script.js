// Конфигурация Supabase — ЗАМЕНИТЕ НА СВОИ ЗНАЧЕНИЯ
const SUPABASE_CONFIG = {
  url: 'https://scejfyvngsmjqsxvgewl.supabase.co', // пример: https://abcd1234.supabase.co
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjZWpmeXZuZ3NtanFzeHZnZXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTczMTEsImV4cCI6MjA4ODI3MzMxMX0.QxD-eQ8a5FXofemsB5KwI4yfFfcOWRfqhgaDI-6Z2ZI'
};

const GAME_CONFIG = {
  universeId: '9678437015',
  apiUrl: 'https://games.roproxy.com/v1/games?universeIds=9678437015'
};

// -------- ИНИЦИАЛИЗАЦИЯ SUPABASE (без конфликта) --------
// Используем window.supabaseClient как глобальный контейнер,
// чтобы предотвратить повторное объявление переменной "supabase".
let supabaseClient = window.supabaseClient || null;

// Если клиент ещё не создан и библиотека загружена — создаём его.
try {
  if (!supabaseClient && window.supabase && window.supabase.createClient
      && SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey) {
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    // Сохраняем в window, чтобы другие скрипты могли переиспользовать
    window.supabaseClient = supabaseClient;
    console.info('Supabase client initialized.');
  } else if (!window.supabase) {
    console.warn('Supabase library not found (cdn не загружен?)');
  }
} catch (e) {
  console.error('Ошибка при инициализации Supabase:', e);
}

// -------- Состояние и переменные --------
let currentLang = 'en';
let charts = {};
let updateInterval;
let currentChartType = 'line';

// DOM-элементы будут получены внутри DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // Получаем элементы
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

  // Логируем отсутствующие элементы (для отладки)
  Object.entries(elements).forEach(([k, v]) => { if (!v) console.warn(`Элемент ${k} не найден (id=${k})`); });

  initTheme(elements);
  initLanguage(elements);
  setupEventListeners(elements);

  // стартовая загрузка
  loadAllData(elements).then(() => {
    setupRealtimeSubscription(elements);
    startAutoUpdate();
  });
});

// -------- Тема и язык --------
function initTheme(elements) {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark');
    if (elements?.themeToggle) elements.themeToggle.textContent = '☀️';
  } else {
    document.documentElement.classList.add('dark');
    if (elements?.themeToggle) elements.themeToggle.textContent = '🌙';
  }
}
function toggleTheme(elements) {
  const html = document.documentElement;
  if (html.classList.contains('dark')) {
    html.classList.remove('dark');
    if (elements?.themeToggle) elements.themeToggle.textContent = '☀️';
    localStorage.setItem('theme', 'light');
  } else {
    html.classList.add('dark');
    if (elements?.themeToggle) elements.themeToggle.textContent = '🌙';
    localStorage.setItem('theme', 'dark');
  }
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
    const text = el.getAttribute(`data-lang-${currentLang}`);
    if (text != null) el.textContent = text;
  });
}

// -------- События UI --------
function setupEventListeners(elements) {
  if (elements?.themeToggle) elements.themeToggle.addEventListener('click', () => toggleTheme(elements));
  if (elements?.langToggle) elements.langToggle.addEventListener('click', () => toggleLanguage(elements));
  if (elements?.refreshBtn) elements.refreshBtn.addEventListener('click', () => loadAllData(elements, true));
  document.querySelectorAll('.chart-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active', 'bg-roblox-blue', 'text-white'));
      btn.classList.add('active', 'bg-roblox-blue', 'text-white');
      currentChartType = btn.dataset.type || 'line';
      updateCharts();
    });
  });
}

// -------- Загрузка всех данных --------
async function loadAllData(elements = {}, showRefresh = false) {
  try {
    if (showRefresh && elements.refreshBtn) {
      elements.refreshBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>${currentLang === 'en' ? 'Loading...' : 'Загрузка...'}`;
    }

    await Promise.allSettled([
      loadCurrentStats(elements),
      loadHistoricalData(elements),
      loadRecords(elements),
      loadPeakHours(elements),
      loadWeekdayDistribution(elements)
    ]);

    if (elements.lastUpdate) elements.lastUpdate.textContent = new Date().toLocaleTimeString();

    if (showRefresh && elements.refreshBtn) {
      elements.refreshBtn.innerHTML = `<i class="fas fa-sync-alt mr-2"></i>${currentLang === 'en' ? 'Refresh' : 'Обновить'}`;
    }
  } catch (e) {
    console.error('loadAllData error:', e);
  }
}

// -------- Текущие статистики --------
async function loadCurrentStats(elements) {
  if (!elements) return;
  try {
    const res = await fetch(GAME_CONFIG.apiUrl).catch(() => null);
    if (res && res.ok) {
      const json = await res.json();
      const game = json?.data?.[0];
      if (game) {
        if (elements.currentOnline) elements.currentOnline.textContent = formatNumber(game.playing);
        if (elements.totalVisits) elements.totalVisits.textContent = formatNumber(game.visits);
        if (elements.favorites) elements.favorites.textContent = formatNumber(game.favoritedCount);

        // Сохраняем в Supabase, если есть
        if (supabaseClient) {
          supabaseClient.from('player_stats').insert([{
            universe_id: GAME_CONFIG.universeId,
            active_players: game.playing,
            total_visits: game.visits,
            favorites: game.favoritedCount
          }]).catch(e => console.warn('saveStats supabase error', e));
        }

        await loadDailyRecord(elements, game.playing);
        await loadAllTimePeak(elements);
        await calculateFavoritesGrowth(elements, game.favoritedCount);
        return;
      }
    }
    // fallback
    if (elements.currentOnline) elements.currentOnline.textContent = '-';
  } catch (e) {
    console.error('loadCurrentStats:', e);
  }
}

async function loadDailyRecord(elements, currentOnline) {
  if (!elements) return;
  if (!supabaseClient) {
    if (elements.dailyRecord) elements.dailyRecord.textContent = formatNumber(currentOnline);
    return;
  }
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabaseClient.from('daily_records')
      .select('value')
      .eq('universe_id', GAME_CONFIG.universeId)
      .eq('record_type', 'online')
      .eq('recorded_at', today)
      .single();

    if (!data || currentOnline > (data.value || 0)) {
      if (elements.dailyRecord) {
        elements.dailyRecord.textContent = formatNumber(currentOnline);
        elements.dailyRecord.classList.add('text-green-500');
      }
      await supabaseClient.from('daily_records').upsert({
        universe_id: GAME_CONFIG.universeId,
        record_type: 'online',
        value: currentOnline,
        recorded_at: today
      }, { onConflict: ['universe_id','record_type','recorded_at'] }).catch(e => console.warn('upsert daily_records', e));
    } else {
      if (elements.dailyRecord) {
        elements.dailyRecord.textContent = formatNumber(data.value);
        elements.dailyRecord.classList.remove('text-green-500');
      }
    }
  } catch (e) {
    console.error('loadDailyRecord:', e);
  }
}

async function loadAllTimePeak(elements) {
  if (!elements || !supabaseClient) return;
  try {
    const { data } = await supabaseClient.from('daily_records')
      .select('value,recorded_at')
      .eq('universe_id', GAME_CONFIG.universeId)
      .eq('record_type', 'online')
      .order('value', { ascending: false })
      .limit(1)
      .single();
    if (data) {
      if (elements.allTimePeak) elements.allTimePeak.textContent = formatNumber(data.value);
      if (elements.peakDate) elements.peakDate.textContent = new Date(data.recorded_at).toLocaleDateString(currentLang === 'en' ? 'en-US' : 'ru-RU');
    }
  } catch (e) {
    console.error('loadAllTimePeak:', e);
  }
}

async function calculateFavoritesGrowth(elements, currentFavorites) {
  if (!elements || !supabaseClient) return;
  try {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const { data } = await supabaseClient.from('player_stats')
      .select('favorites')
      .eq('universe_id', GAME_CONFIG.universeId)
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    if (data) {
      const base = data.favorites || 1;
      const growth = ((currentFavorites - base) / base * 100).toFixed(1);
      if (elements.favoritesGrowth) {
        elements.favoritesGrowth.textContent = `${growth >= 0 ? '+' : ''}${growth}%`;
        elements.favoritesGrowth.className = growth >= 0 ? 'text-green-500' : 'text-red-500';
      }
    }
  } catch (e) {
    console.error('calculateFavoritesGrowth:', e);
  }
}

// -------- Графики (фоллбеки, чтобы не было пусто) --------
async function loadHistoricalData(elements) {
  try {
    const labels = [];
    const data = [];
    for (let i = 24; i >= 0; i--) {
      const t = new Date(); t.setHours(t.getHours() - i, 0, 0, 0);
      labels.push(t.toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'ru-RU', { hour: '2-digit', minute: '2-digit' }));
      data.push(Math.floor(Math.random() * 120) + 80);
    }
    createCharts(labels, data);
  } catch (e) {
    console.error('loadHistoricalData:', e);
  }
}

function createCharts(labels, data) {
  try {
    const el = document.getElementById('onlineChart');
    if (!el) return;
    const ctx = el.getContext('2d');
    if (charts.main) charts.main.destroy();
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#fff' : '#333';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

    charts.main = new Chart(ctx, {
      type: currentChartType,
      data: {
        labels,
        datasets: [{
          label: currentLang === 'en' ? 'Players' : 'Игроки',
          data,
          borderColor: '#00A2FF',
          backgroundColor: currentChartType === 'bar' ? 'rgba(0,162,255,0.25)' : 'rgba(0,162,255,0.08)',
          tension: 0.4,
          fill: currentChartType === 'line'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor } } },
        scales: {
          y: { grid: { color: gridColor }, ticks: { color: textColor } },
          x: { grid: { color: gridColor }, ticks: { color: textColor } }
        }
      }
    });
  } catch (e) {
    console.error('createCharts:', e);
  }
}

function updateCharts() {
  if (!charts.main) return;
  const isDark = document.documentElement.classList.contains('dark');
  const palette = isDark ? { text: '#fff', grid: 'rgba(255,255,255,0.08)' } : { text: '#333', grid: 'rgba(0,0,0,0.08)' };
  charts.main.config.type = currentChartType;
  charts.main.data.datasets[0].backgroundColor = currentChartType === 'bar' ? 'rgba(0,162,255,0.25)' : 'rgba(0,162,255,0.08)';
  charts.main.options.plugins.legend.labels.color = palette.text;
  charts.main.options.scales.x.ticks.color = palette.text;
  charts.main.options.scales.x.grid.color = palette.grid;
  charts.main.options.scales.y.ticks.color = palette.text;
  charts.main.options.scales.y.grid.color = palette.grid;
  charts.main.update();
}

// -------- Пиковые часы и история рекордов --------
async function loadPeakHours(elements) {
  if (!elements || !elements.peakHours) return;
  if (!supabaseClient) {
    elements.peakHours.innerHTML = Array.from({length:5}).map((_,i)=>`
      <div class="flex items-center justify-between p-3 bg-gray-200 dark:bg-gray-800 rounded-lg">
        <div class="flex items-center gap-3">
          <span class="text-lg font-bold text-roblox-blue">#${i+1}</span>
          <span>${new Date().toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'ru-RU', {hour:'2-digit', minute:'2-digit'})}</span>
        </div>
        <span class="font-semibold">${formatNumber(Math.floor(Math.random()*200)+80)}</span>
      </div>
    `).join('');
    return;
  }

  try {
    const { data, error } = await supabaseClient.from('hourly_stats')
      .select('hour,max_players')
      .eq('universe_id', GAME_CONFIG.universeId)
      .order('max_players', { ascending: false })
      .limit(5);

    if (error || !data) {
      elements.peakHours.innerHTML = '<div class="text-gray-500">No data</div>';
      return;
    }
    elements.peakHours.innerHTML = data.map((item, idx) => {
      const dt = (item.hour && !isNaN(Date.parse(item.hour))) ? new Date(item.hour) : (new Date().setHours(Number(item.hour) || 0, 0, 0, 0));
      const timeLabel = new Date(dt).toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'ru-RU', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="flex items-center justify-between p-3 bg-gray-200 dark:bg-gray-800 rounded-lg">
          <div class="flex items-center gap-3">
            <span class="text-lg font-bold text-roblox-blue">#${idx+1}</span>
            <span>${timeLabel}</span>
          </div>
          <span class="font-semibold">${formatNumber(item.max_players)}</span>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('loadPeakHours:', e);
    elements.peakHours.innerHTML = '<div class="text-gray-500">Error</div>';
  }
}

async function loadRecords(elements) {
  if (!elements || !elements.recordsTable) return;
  if (!supabaseClient) {
    elements.recordsTable.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No records (Supabase not configured)</td></tr>';
    return;
  }
  try {
    const { data, error } = await supabaseClient.from('daily_records')
      .select('*')
      .eq('universe_id', GAME_CONFIG.universeId)
      .order('recorded_at', { ascending: false })
      .limit(10);

    if (error || !data || !data.length) {
      elements.recordsTable.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No records</td></tr>';
      return;
    }

    elements.recordsTable.innerHTML = data.map((record, index) => {
      const prevValue = index < data.length - 1 ? data[index + 1].value : record.value;
      const diff = record.value - prevValue;
      return `
        <tr class="record-${record.record_type}">
          <td>${new Date(record.recorded_at).toLocaleDateString(currentLang === 'en' ? 'en-US' : 'ru-RU')}</td>
          <td>${translateRecordType(record.record_type)}</td>
          <td class="font-bold">${formatNumber(record.value)}</td>
          <td class="${diff > 0 ? 'text-green-500' : diff < 0 ? 'text-red-500' : ''}">${diff > 0 ? '+' : ''}${formatNumber(diff)}</td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    console.error('loadRecords:', e);
    elements.recordsTable.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Error</td></tr>';
  }
}

function translateRecordType(type) {
  const translations = {
    'online': { en: 'Online Players', ru: 'Онлайн игроки' },
    'visits': { en: 'Visits', ru: 'Посещения' },
    'favorites': { en: 'Favorites', ru: 'Избранное' }
  };
  return translations[type]?.[currentLang] || type;
}

// -------- РЕАЛТАЙМ ПОДПИСКА --------
function setupRealtimeSubscription(elements) {
  if (!supabaseClient) return;
  try {
    supabaseClient.channel('player_stats_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'player_stats',
        filter: `universe_id=eq.${GAME_CONFIG.universeId}`
      }, payload => {
        if (!payload?.new) return;
        if (elements?.currentOnline) elements.currentOnline.textContent = formatNumber(payload.new.active_players);
        if (elements?.totalVisits) elements.totalVisits.textContent = formatNumber(payload.new.total_visits || '-');
        highlightElement(elements?.currentOnline);
      })
      .subscribe()
      .onError(err => console.warn('Realtime subscription error:', err));
  } catch (e) {
    console.error('setupRealtimeSubscription:', e);
  }
}

// -------- Утилиты --------
function startAutoUpdate() {
  if (updateInterval) clearInterval(updateInterval);
  updateInterval = setInterval(() => loadAllData(), 300000); // 5 мин
}

function formatNumber(num) {
  if (num === null || num === undefined) return '-';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function highlightElement(el) {
  if (!el) return;
  el.classList.add('data-updated');
  setTimeout(() => el.classList.remove('data-updated'), 1000);
}
