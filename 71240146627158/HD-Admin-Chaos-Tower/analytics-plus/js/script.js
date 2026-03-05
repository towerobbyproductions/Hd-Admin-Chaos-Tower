// ====== Config: вставь свои данные ======
const SUPABASE_CONFIG = {
    url: 'https://scejfyvngsmjqsxvgewl.supabase.co', // Заменить
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjZWpmeXZuZ3NtanFzeHZnZXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTczMTEsImV4cCI6MjA4ODI3MzMxMX0.QxD-eQ8a5FXofemsB5KwI4yfFfcOWRfqhgaDI-6Z2ZI' // Заменить
};

const GAME_CONFIG = {
    universeId: '9678437015',
    apiUrl: `https://games.roproxy.com/v1/games?universeIds=9678437015`
};

// ====== Инициализация Supabase (без падений) ======
let supabase = null;
let SUPABASE_ENABLED = false;
try {
    if (SUPABASE_CONFIG.url.includes('your-project') || SUPABASE_CONFIG.anonKey.includes('your-anon-key')) {
        console.warn('Supabase config placeholders detected — замените url и anonKey в js/script.js');
    } else {
        supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        SUPABASE_ENABLED = true;
    }
} catch (e) {
    console.error('Supabase init failed:', e);
    SUPABASE_ENABLED = false;
}

// ====== State and DOM elements ======
let currentLang = 'en';
let charts = {};
let currentChartType = 'line';
let updateInterval = null;

const elements = {
    lastUpdate: () => document.getElementById('lastUpdate'),
    currentOnline: () => document.getElementById('currentOnline'),
    dailyRecord: () => document.getElementById('dailyRecord'),
    allTimePeak: () => document.getElementById('allTimePeak'),
    peakDate: () => document.getElementById('peakDate'),
    totalVisits: () => document.getElementById('totalVisits'),
    todayVisits: () => document.getElementById('todayVisits'),
    favorites: () => document.getElementById('favorites'),
    favoritesGrowth: () => document.getElementById('favoritesGrowth'),
    refreshBtn: () => document.getElementById('refreshData'),
    themeToggle: () => document.getElementById('themeToggle'),
    langToggle: () => document.getElementById('langToggle'),
    recordsTable: () => document.getElementById('recordsTable'),
    peakHours: () => document.getElementById('peakHours')
};

// ====== Utils ======
function showError(message) {
    console.error(message);
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function formatNumber(num) {
    if (num === null || num === undefined) return '-';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
}

function highlightElement(el) {
    if (!el) return;
    el.classList.add('data-updated');
    setTimeout(() => el.classList.remove('data-updated'), 1000);
}

// ====== Theme / Language ======
function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    const html = document.documentElement;
    if (saved === 'dark') {
        html.classList.add('dark');
        elements.themeToggle().textContent = '🌙';
    } else {
        html.classList.remove('dark');
        elements.themeToggle().textContent = '☀️';
    }
}

function toggleTheme() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        elements.themeToggle().textContent = '☀️';
        localStorage.setItem('theme', 'light');
    } else {
        html.classList.add('dark');
        elements.themeToggle().textContent = '🌙';
        localStorage.setItem('theme', 'dark');
    }
    updateCharts(); // перерисуем графики
}

function initLanguage() {
    const saved = localStorage.getItem('language') || 'en';
    currentLang = saved;
    updateLanguage();
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'ru' : 'en';
    localStorage.setItem('language', currentLang);
    updateLanguage();
}

function updateLanguage() {
    const toggle = elements.langToggle();
    if (toggle) toggle.textContent = currentLang === 'en' ? 'RU' : 'EN';
    document.querySelectorAll('[data-lang-en]').forEach(el => {
        const txt = el.getAttribute(`data-lang-${currentLang}`);
        if (txt !== null) el.textContent = txt;
    });
}

// ====== Initialization and event listeners ======
document.addEventListener('DOMContentLoaded', async () => {
    try {
        initTheme();
        initLanguage();
        setupEventListeners();
        await loadAllData();
        if (SUPABASE_ENABLED) setupRealtimeSubscription();
        startAutoUpdate();
    } catch (e) {
        console.error('Initialization error:', e);
        showError('Initialization failed — check console.');
    }
});

function setupEventListeners() {
    const tBtn = elements.themeToggle();
    const lBtn = elements.langToggle();
    const rBtn = elements.refreshBtn();
    if (tBtn) tBtn.addEventListener('click', toggleTheme);
    if (lBtn) lBtn.addEventListener('click', toggleLanguage);
    if (rBtn) rBtn.addEventListener('click', () => loadAllData(true));

    document.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active', 'bg-roblox-blue', 'text-white'));
            btn.classList.add('active', 'bg-roblox-blue', 'text-white');
            currentChartType = btn.dataset.type;
            updateCharts();
        });
    });
}

// ====== Load everything ======
async function loadAllData(showRefresh = false) {
    try {
        if (showRefresh && elements.refreshBtn()) {
            elements.refreshBtn().innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...';
        }
        await Promise.all([
            loadCurrentStats(),
            loadHistoricalData(),
            loadRecords(),
            loadPeakHours()
        ]);
        updateLastUpdateTime();
        if (showRefresh && elements.refreshBtn()) {
            elements.refreshBtn().innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Refresh';
            document.querySelectorAll('.stat-card').forEach(el => {
                el.classList.add('data-updated');
                setTimeout(() => el.classList.remove('data-updated'), 800);
            });
        }
    } catch (err) {
        console.error('Error loading all data', err);
        showError('Failed to load data');
    }
}

// ====== Current stats (Roblox API + optionally save to Supabase) ======
async function loadCurrentStats() {
    try {
        const resp = await fetch(GAME_CONFIG.apiUrl);
        const json = await resp.json();
        if (!json || !json.data || !json.data[0]) {
            showError('Roblox API returned empty data');
            return;
        }
        const game = json.data[0];
        elements.currentOnline().textContent = formatNumber(game.playing);
        elements.totalVisits().textContent = formatNumber(game.visits);
        elements.favorites().textContent = formatNumber(game.favoritedCount);

        // сохраняем в Supabase (только если включено)
        if (SUPABASE_ENABLED) {
            try {
                const { error } = await supabase
                    .from('player_stats')
                    .insert([{
                        universe_id: GAME_CONFIG.universeId,
                        active_players: game.playing,
                        total_visits: game.visits,
                        favorites: game.favoritedCount
                    }]);
                if (error) console.warn('Supabase insert warning:', error);
            } catch (e) {
                console.error('Supabase save error:', e);
            }
        }

        // рекорд дня и другие показатели
        await loadDailyRecord(game.playing);
        await loadAllTimePeak();
        await calculateFavoritesGrowth(game.favoritedCount);

    } catch (e) {
        console.error('loadCurrentStats error:', e);
        showError('Could not fetch current stats');
    }
}

// ====== Daily record (use record_date column) ======
async function loadDailyRecord(currentOnline) {
    if (!SUPABASE_ENABLED) {
        elements.dailyRecord().textContent = formatNumber(currentOnline);
        return;
    }

    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        // ищем по record_date (DATE). Если у тебя в БД нет record_date — сообщи, сделаем по recorded_at диапазону
        const { data, error } = await supabase
            .from('daily_records')
            .select('value')
            .eq('universe_id', GAME_CONFIG.universeId)
            .eq('record_type', 'online')
            .eq('record_date', today)
            .maybeSingle();

        if (!data || !data.value || currentOnline > data.value) {
            elements.dailyRecord().textContent = formatNumber(currentOnline);
            elements.dailyRecord().classList.add('text-green-500');
            // upsert (on conflict by record_date)
            const upObj = {
                universe_id: GAME_CONFIG.universeId,
                record_type: 'online',
                value: currentOnline,
                recorded_at: new Date().toISOString(),
                record_date: today
            };
            const { error: upErr } = await supabase
                .from('daily_records')
                .upsert(upObj, { onConflict: 'universe_id,record_type,record_date' });
            if (upErr) console.warn('Upsert record error:', upErr);
        } else {
            elements.dailyRecord().textContent = formatNumber(data.value);
            elements.dailyRecord().classList.remove('text-green-500');
        }
    } catch (e) {
        console.error('loadDailyRecord error:', e);
    }
}

// ====== All-time peak ======
async function loadAllTimePeak() {
    if (!SUPABASE_ENABLED) return;
    try {
        const { data, error } = await supabase
            .from('daily_records')
            .select('value,record_date')
            .eq('universe_id', GAME_CONFIG.universeId)
            .eq('record_type', 'online')
            .order('value', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (data) {
            elements.allTimePeak().textContent = formatNumber(data.value);
            const date = data.record_date ? new Date(data.record_date) : new Date(data.recorded_at || Date.now());
            elements.peakDate().textContent = date.toLocaleDateString(currentLang === 'en' ? 'en-US' : 'ru-RU');
        }
    } catch (e) {
        console.error('loadAllTimePeak error:', e);
    }
}

// ====== Favorites growth ======
async function calculateFavoritesGrowth(currentFavorites) {
    if (!SUPABASE_ENABLED) {
        elements.favoritesGrowth().textContent = '+0%';
        return;
    }
    try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { data, error } = await supabase
            .from('player_stats')
            .select('favorites')
            .eq('universe_id', GAME_CONFIG.universeId)
            .gte('created_at', weekAgo.toISOString())
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (data && data.favorites !== null && data.favorites !== undefined && data.favorites !== 0) {
            const growth = ((currentFavorites - data.favorites) / data.favorites * 100).toFixed(1);
            elements.favoritesGrowth().textContent = `${growth >= 0 ? '+' : ''}${growth}%`;
            elements.favoritesGrowth().className = growth >= 0 ? 'text-green-500' : 'text-red-500';
        }
    } catch (e) {
        console.error('calculateFavoritesGrowth error:', e);
    }
}

// ====== Historical (24h) ======
async function loadHistoricalData() {
    try {
        const hours = 24;
        const labels = [];
        const data = [];

        for (let i = hours; i >= 0; i--) {
            const time = new Date();
            time.setHours(time.getHours() - i);
            labels.push(time.toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'ru-RU', { hour: '2-digit', minute: '2-digit' }));

            if (!SUPABASE_ENABLED) {
                data.push(Math.floor(Math.random() * 50) + 100);
                continue;
            }

            // Интервал [time, time + 1h)
            const from = time.toISOString();
            const to = new Date(time.getTime() + 3600000).toISOString();

            const { data: stats, error } = await supabase
                .from('player_stats')
                .select('active_players,created_at')
                .eq('universe_id', GAME_CONFIG.universeId)
                .gte('created_at', from)
                .lt('created_at', to)
                .order('created_at', { ascending: false })
                .limit(1);

            const val = (stats && stats[0] && stats[0].active_players) ? stats[0].active_players : Math.floor(Math.random() * 50) + 100;
            data.push(val);
        }

        createCharts(labels, data);
    } catch (e) {
        console.error('loadHistoricalData error:', e);
    }
}

// ====== Create charts ======
function createCharts(labels, data) {
    try {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#fff' : '#333';
        const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

        // main chart
        const ctx = document.getElementById('onlineChart').getContext('2d');
        if (charts.main) charts.main.destroy();

        charts.main = new Chart(ctx, {
            type: currentChartType,
            data: {
                labels,
                datasets: [{
                    label: currentLang === 'en' ? 'Players' : 'Игроки',
                    data,
                    borderColor: '#00A2FF',
                    backgroundColor: currentChartType === 'bar' ? '#00A2FF' : 'rgba(0,162,255,0.12)',
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
                    x: { grid: { color: gridColor }, ticks: { color: textColor, maxRotation: 45, minRotation: 45 } }
                }
            }
        });
    } catch (e) {
        console.error('createCharts error:', e);
    }
}

function updateCharts() {
    if (charts.main) {
        charts.main.config.type = currentChartType;
        charts.main.update();
    }
}

// ====== Peak hours ======
async function loadPeakHours() {
    try {
        if (!SUPABASE_ENABLED) {
            elements.peakHours().innerHTML = '<div class="text-gray-500">No data</div>';
            return;
        }
        const { data, error } = await supabase
            .from('hourly_stats')
            .select('hour,max_players')
            .eq('universe_id', GAME_CONFIG.universeId)
            .order('max_players', { ascending: false })
            .limit(5);

        if (data) {
            elements.peakHours().innerHTML = data.map((item, idx) => {
                const time = new Date(item.hour);
                const timeStr = time.toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'ru-RU', { hour: '2-digit', minute: '2-digit' });
                return `<div class="flex items-center justify-between p-3 bg-gray-200 dark:bg-gray-800 rounded-lg">
                    <div class="flex items-center gap-3">
                        <span class="text-lg font-bold text-roblox-blue">#${idx + 1}</span>
                        <span>${timeStr}</span>
                    </div>
                    <span class="font-semibold">${formatNumber(item.max_players)}</span>
                </div>`;
            }).join('');
        }
    } catch (e) {
        console.error('loadPeakHours error:', e);
    }
}

// ====== Records table ======
async function loadRecords() {
    try {
        if (!SUPABASE_ENABLED) {
            elements.recordsTable().innerHTML = '<tr><td colspan="4" class="text-center py-4">No data</td></tr>';
            return;
        }
        const { data, error } = await supabase
            .from('daily_records')
            .select('*')
            .eq('universe_id', GAME_CONFIG.universeId)
            .order('record_date', { ascending: false })
            .limit(10);

        if (data && data.length) {
            elements.recordsTable().innerHTML = data.map((rec, idx) => {
                const prev = data[idx + 1] ? data[idx + 1].value : rec.value;
                const diff = rec.value - prev;
                const date = rec.record_date ? new Date(rec.record_date) : new Date(rec.recorded_at || Date.now());
                return `<tr class="record-${rec.record_type}">
                    <td>${date.toLocaleDateString()}</td>
                    <td>${translateRecordType(rec.record_type)}</td>
                    <td class="font-bold">${formatNumber(rec.value)}</td>
                    <td class="${diff > 0 ? 'text-green-500' : diff < 0 ? 'text-red-500' : ''}">${diff > 0 ? '+' : ''}${formatNumber(diff)}</td>
                </tr>`;
            }).join('');
        } else {
            elements.recordsTable().innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No records</td></tr>';
        }
    } catch (e) {
        console.error('loadRecords error:', e);
    }
}

function translateRecordType(type) {
    const t = {
        online: { en: 'Online Players', ru: 'Онлайн игроки' },
        visits: { en: 'Visits', ru: 'Посещения' },
        favorites: { en: 'Favorites', ru: 'Избранное' }
    };
    return t[type] ? t[type][currentLang] : type;
}

// ====== Realtime subscription (if supabase enabled) ======
function setupRealtimeSubscription() {
    if (!SUPABASE_ENABLED) return;
    try {
        supabase
            .channel('player_stats_changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'player_stats', filter: `universe_id=eq.${GAME_CONFIG.universeId}` }, payload => {
                if (payload && payload.new) {
                    elements.currentOnline().textContent = formatNumber(payload.new.active_players);
                    highlightElement(elements.currentOnline());
                }
            })
            .subscribe();
    } catch (e) {
        console.error('Realtime subscription failed:', e);
    }
}

// ====== Helpers ======
function updateLastUpdateTime() {
    const now = new Date();
    elements.lastUpdate().textContent = now.toLocaleTimeString();
}

function startAutoUpdate() {
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(() => loadAllData(), 300000); // 5 minutes
}
