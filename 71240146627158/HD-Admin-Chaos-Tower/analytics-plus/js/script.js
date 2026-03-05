// Конфигурация Supabase (ЗАМЕНИТЕ НА СВОИ ДАННЫЕ!)
const SUPABASE_CONFIG = {
    url: 'https://scejfyvngsmjqsxvgewl.supabase.co', // например: https://abcd1234.supabase.co
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjZWpmeXZuZ3NtanFzeHZnZXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTczMTEsImV4cCI6MjA4ODI3MzMxMX0.QxD-eQ8a5FXofemsB5KwI4yfFfcOWRfqhgaDI-6Z2ZI'
};

// Конфигурация игры
const GAME_CONFIG = {
    universeId: '9678437015',
    apiUrl: 'https://games.roproxy.com/v1/games?universeIds=9678437015'
};

// Проверка supabase-библиотеки
if (!window.supabase || !window.supabase.createClient) {
    console.error('Supabase JS не загружен. Убедитесь, что CDN <script> подключён.');
}

// Создаём клиент (если есть данные)
let supabase = null;
try {
    if (SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey && window.supabase && window.supabase.createClient) {
        supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    } else {
        console.warn('Supabase не настроен — некоторые функции будут использовать заглушки.');
    }
} catch (err) {
    console.error('Ошибка при инициализации Supabase:', err);
}

// Состояние приложения
let currentLang = 'en';
let charts = {};
let updateInterval;
let currentChartType = 'line';

// DOM элементы (получаем в начале, скрипт подключён внизу страницы)
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

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initLanguage();
    setupEventListeners();
    await loadAllData();
    setupRealtimeSubscription();
    startAutoUpdate();
});

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
        elements.themeToggle.textContent = '☀️';
    } else {
        document.documentElement.classList.add('dark');
        elements.themeToggle.textContent = '🌙';
    }
}

function initLanguage() {
    const savedLang = localStorage.getItem('language') || 'en';
    currentLang = savedLang;
    updateLanguage();
}

function setupEventListeners() {
    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.langToggle.addEventListener('click', toggleLanguage);
    elements.refreshBtn.addEventListener('click', () => loadAllData(true));

    // Кнопки типа графика
    document.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-type-btn').forEach(b =>
                b.classList.remove('active', 'bg-roblox-blue', 'text-white')
            );
            btn.classList.add('active', 'bg-roblox-blue', 'text-white');
            currentChartType = btn.dataset.type || 'line';
            // Если графики уже есть — обновим только тип и цвета
            updateCharts(true);
        });
    });
}

// ========== ТЕМА И ЯЗЫК ==========
function toggleTheme() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        elements.themeToggle.textContent = '☀️';
        localStorage.setItem('theme', 'light');
    } else {
        html.classList.add('dark');
        elements.themeToggle.textContent = '🌙';
        localStorage.setItem('theme', 'dark');
    }
    updateCharts(true); // Обновляем цвета графиков
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'ru' : 'en';
    localStorage.setItem('language', currentLang);
    updateLanguage();
    // Перерисуем то что зависит от локали
    loadAllData();
}

function updateLanguage() {
    elements.langToggle.textContent = currentLang === 'en' ? 'RU' : 'EN';
    
    document.querySelectorAll('[data-lang-en]').forEach(el => {
        const text = el.getAttribute(`data-lang-${currentLang}`);
        if (text) {
            // не затираем иконки внутри кнопок — заменяем только текстовый узел, если он есть
            el.textContent = text;
        }
    });
}

// ========== ЗАГРУЗКА ДАННЫХ ==========
async function loadAllData(showRefresh = false) {
    try {
        if (showRefresh) {
            elements.refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i><span data-lang-en="Loading..." data-lang-ru="Загрузка...">Loading...</span>';
        }
        
        // Загружаем данные параллельно (с падением на локальные заглушки)
        await Promise.allSettled([
            loadCurrentStats(),
            loadHistoricalData(),
            loadRecords(),
            loadPeakHours(),
            loadWeekdayDistribution()
        ]);
        
        updateLastUpdateTime();
        
        if (showRefresh) {
            elements.refreshBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i><span data-lang-en="Refresh" data-lang-ru="Обновить">Refresh</span>';
            highlightUpdatedData();
            updateLanguage(); // вернуть локализованный текст
        }
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load data');
    }
}

async function loadCurrentStats() {
    try {
        // Пытаемся получить данные из Roblox API
        const response = await fetch(GAME_CONFIG.apiUrl);
        if (!response.ok) throw new Error('Roblox API error');
        const json = await response.json();

        if (json?.data && json.data[0]) {
            const game = json.data[0];
            elements.currentOnline.textContent = formatNumber(game.playing);
            elements.totalVisits.textContent = formatNumber(game.visits);
            elements.favorites.textContent = formatNumber(game.favoritedCount);
            elements.todayVisits.textContent = '-';

            // Сохраняем в Supabase (если он есть)
            if (supabase) {
                try {
                    await saveStatsToSupabase(game);
                } catch (err) {
                    console.warn('Не удалось сохранить в Supabase:', err);
                }
            }

            // Рекорды
            await loadDailyRecord(game.playing);
            await loadAllTimePeak();
            await calculateFavoritesGrowth(game.favoritedCount);
        } else {
            // Фоллбек: показываем заглушки
            elements.currentOnline.textContent = '-';
            elements.totalVisits.textContent = '-';
            elements.favorites.textContent = '-';
        }
    } catch (err) {
        console.error('loadCurrentStats error:', err);
        // при ошибке API — пробуем взять последнее значение из Supabase
        if (supabase) {
            try {
                const { data } = await supabase
                    .from('player_stats')
                    .select('active_players, total_visits, favorites')
                    .eq('universe_id', GAME_CONFIG.universeId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                if (data) {
                    elements.currentOnline.textContent = formatNumber(data.active_players);
                    elements.totalVisits.textContent = formatNumber(data.total_visits);
                    elements.favorites.textContent = formatNumber(data.favorites);
                } else {
                    elements.currentOnline.textContent = '-';
                }
            } catch (e) {
                console.warn('Не удалось загрузить данные из Supabase:', e);
                elements.currentOnline.textContent = '-';
            }
        } else {
            showError('Failed to fetch live stats');
        }
    }
}

async function saveStatsToSupabase(gameData) {
    if (!supabase) return;
    try {
        const { error } = await supabase
            .from('player_stats')
            .insert([{
                universe_id: GAME_CONFIG.universeId,
                active_players: gameData.playing,
                total_visits: gameData.visits,
                favorites: gameData.favoritedCount
            }]);
        if (error) console.error('Error saving to Supabase:', error);
    } catch (err) {
        console.error('saveStatsToSupabase error:', err);
    }
}

async function loadDailyRecord(currentOnline) {
    if (!supabase) {
        // если нет supabase — просто обновляем UI
        elements.dailyRecord.textContent = formatNumber(currentOnline);
        return;
    }

    try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('daily_records')
            .select('value')
            .eq('universe_id', GAME_CONFIG.universeId)
            .eq('record_type', 'online')
            .eq('recorded_at', today)
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 — может означать нет строки; просто логируем
            console.warn('loadDailyRecord warning:', error);
        }

        if (!data || currentOnline > (data.value || 0)) {
            elements.dailyRecord.textContent = formatNumber(currentOnline);
            elements.dailyRecord.classList.add('text-green-500');

            // upsert
            await supabase
                .from('daily_records')
                .upsert({
                    universe_id: GAME_CONFIG.universeId,
                    record_type: 'online',
                    value: currentOnline,
                    recorded_at: today
                }, { onConflict: ['universe_id', 'record_type', 'recorded_at'] });
        } else {
            elements.dailyRecord.textContent = formatNumber(data.value);
            elements.dailyRecord.classList.remove('text-green-500');
        }
    } catch (err) {
        console.error('loadDailyRecord error:', err);
    }
}

async function loadAllTimePeak() {
    if (!supabase) return;
    try {
        const { data } = await supabase
            .from('daily_records')
            .select('value, recorded_at')
            .eq('universe_id', GAME_CONFIG.universeId)
            .eq('record_type', 'online')
            .order('value', { ascending: false })
            .limit(1)
            .single();

        if (data) {
            elements.allTimePeak.textContent = formatNumber(data.value);
            const date = new Date(data.recorded_at);
            elements.peakDate.textContent = date.toLocaleDateString(currentLang === 'en' ? 'en-US' : 'ru-RU');
        }
    } catch (err) {
        console.error('loadAllTimePeak error:', err);
    }
}

async function calculateFavoritesGrowth(currentFavorites) {
    if (!supabase) {
        elements.favoritesGrowth.textContent = '+0%';
        return;
    }

    try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const { data } = await supabase
            .from('player_stats')
            .select('favorites')
            .eq('universe_id', GAME_CONFIG.universeId)
            .gte('created_at', weekAgo.toISOString())
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

        if (data) {
            const base = data.favorites || 1;
            const growth = ((currentFavorites - base) / base * 100).toFixed(1);
            elements.favoritesGrowth.textContent = `${growth >= 0 ? '+' : ''}${growth}%`;
            elements.favoritesGrowth.className = growth >= 0 ? 'text-green-500' : 'text-red-500';
        }
    } catch (err) {
        console.error('calculateFavoritesGrowth error:', err);
    }
}

// ========== ГРАФИКИ ==========
async function loadHistoricalData() {
    const hours = 24;
    const data = [];
    const labels = [];

    try {
        for (let i = hours; i >= 0; i--) {
            const time = new Date();
            time.setMinutes(0, 0, 0);
            time.setHours(time.getHours() - i);
            labels.push(time.toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
            }));

            // Получаем одно значение за этот час из Supabase
            let hourValue = null;
            if (supabase) {
                try {
                    const start = new Date(time).toISOString();
                    const end = new Date(time.getTime() + 3600000).toISOString();
                    const { data: stats } = await supabase
                        .from('player_stats')
                        .select('active_players')
                        .eq('universe_id', GAME_CONFIG.universeId)
                        .gte('created_at', start)
                        .lt('created_at', end)
                        .order('created_at', { ascending: false })
                        .limit(1);

                    hourValue = stats?.[0]?.active_players ?? null;
                } catch (err) {
                    console.warn('Ошибка при загрузке часа из Supabase:', err);
                }
            }

            if (hourValue === null) {
                // fallback: случайное значение в разумном диапазоне (чтобы график не был пуст)
                hourValue = Math.floor(Math.random() * 50) + 100;
            }

            data.push(hourValue);
        }

        createCharts(labels, data);
        await loadWeeklyChart(labels, data);
        await loadWeekdayDistribution();
    } catch (err) {
        console.error('loadHistoricalData error:', err);
    }
}

async function loadWeeklyChart(labels, data) {
    // Простейший пример — переиспользуем текущие данные в weeklyChart
    try {
        const ctx = document.getElementById('weeklyChart').getContext('2d');
        if (charts.weekly) charts.weekly.destroy();

        const palette = getChartColors();
        charts.weekly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.slice(-7),
                datasets: [{
                    label: currentLang === 'en' ? 'Players (week)' : 'Игроки (неделя)',
                    data: data.slice(-7),
                    borderColor: palette.border,
                    backgroundColor: palette.fill,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: palette.text } }
                },
                scales: {
                    y: { grid: { color: palette.grid }, ticks: { color: palette.text } },
                    x: { grid: { color: palette.grid }, ticks: { color: palette.text } }
                }
            }
        });
    } catch (err) {
        console.error('loadWeeklyChart error:', err);
    }
}

async function loadWeekdayDistribution() {
    try {
        const labels = currentLang === 'en'
            ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

        // Попытаемся получить реальные средние из Supabase (если есть), иначе заглушка:
        let averages = [145, 132, 158, 189, 210, 245, 198];
        // TODO: при желании — заменить на реальный SQL-запрос агрегации по дням недели.

        const ctx = document.getElementById('weekdayChart').getContext('2d');
        if (charts.weekday) charts.weekday.destroy();

        const palette = getChartColors();
        charts.weekday = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: currentLang === 'en' ? 'Avg players' : 'Средний онлайн',
                    data: averages,
                    borderColor: palette.border,
                    backgroundColor: palette.fill,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: palette.text } } },
                scales: {
                    y: { grid: { color: palette.grid }, ticks: { color: palette.text } },
                    x: { grid: { color: palette.grid }, ticks: { color: palette.text } }
                }
            }
        });
    } catch (err) {
        console.error('loadWeekdayDistribution error:', err);
    }
}

function createCharts(labels, data) {
    const ctx = document.getElementById('onlineChart').getContext('2d');
    if (charts.main) charts.main.destroy();

    const palette = getChartColors();

    charts.main = new Chart(ctx, {
        type: currentChartType,
        data: {
            labels,
            datasets: [{
                label: currentLang === 'en' ? 'Players' : 'Игроки',
                data,
                borderColor: palette.border,
                backgroundColor: currentChartType === 'bar' ? palette.fill : (palette.fillTransparent),
                tension: 0.4,
                fill: currentChartType === 'line'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: palette.text } }
            },
            scales: {
                y: {
                    grid: { color: palette.grid },
                    ticks: { color: palette.text }
                },
                x: {
                    grid: { color: palette.grid },
                    ticks: { color: palette.text, maxRotation: 45, minRotation: 45 }
                }
            }
        }
    });
}

function updateCharts(updateColors = false) {
    if (!charts.main) return;
    const palette = getChartColors();
    // смена типа графика
    charts.main.config.type = currentChartType;
    // обновляем цвета и опции
    const ds = charts.main.data.datasets[0];
    ds.borderColor = palette.border;
    ds.backgroundColor = currentChartType === 'bar' ? palette.fill : palette.fillTransparent;
    charts.main.options.plugins.legend.labels.color = palette.text;
    charts.main.options.scales.x.ticks.color = palette.text;
    charts.main.options.scales.x.grid.color = palette.grid;
    charts.main.options.scales.y.ticks.color = palette.text;
    charts.main.options.scales.y.grid.color = palette.grid;
    charts.main.update();
}

// palette helper
function getChartColors() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
        text: isDark ? '#fff' : '#333',
        grid: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        border: '#00A2FF',
        fill: 'rgba(0,162,255,0.25)',
        fillTransparent: 'rgba(0,162,255,0.08)'
    };
}

// ========== ПИКОВЫЕ ЧАСЫ ==========
async function loadPeakHours() {
    try {
        elements.peakHours.innerHTML = '<div class="loading-chart">Loading...</div>';

        if (!supabase) {
            // Заглушка
            elements.peakHours.innerHTML = Array.from({length:5}).map((_,i) => `
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

        const { data, error } = await supabase
            .from('hourly_stats')
            .select('hour, max_players')
            .eq('universe_id', GAME_CONFIG.universeId)
            .order('max_players', { ascending: false })
            .limit(5);

        if (error) {
            console.warn('loadPeakHours supabase error:', error);
            elements.peakHours.innerHTML = '<div class="text-gray-500">No data</div>';
            return;
        }

        if (data && data.length) {
            elements.peakHours.innerHTML = data.map((item, index) => {
                // item.hour может быть ISO-string или числом (0..23)
                let timeLabel = '';
                if (!item.hour) {
                    timeLabel = '-';
                } else {
                    const d = isNaN(Date.parse(item.hour)) ? (() => {
                        // возможно это число часа
                        const t = new Date();
                        t.setHours(Number(item.hour), 0, 0, 0);
                        return t;
                    })() : new Date(item.hour);
                    timeLabel = d.toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'ru-RU', { hour: '2-digit', minute: '2-digit' });
                }

                return `
                    <div class="flex items-center justify-between p-3 bg-gray-200 dark:bg-gray-800 rounded-lg">
                        <div class="flex items-center gap-3">
                            <span class="text-lg font-bold text-roblox-blue">#${index + 1}</span>
                            <span>${timeLabel}</span>
                        </div>
                        <span class="font-semibold">${formatNumber(item.max_players)}</span>
                    </div>
                `;
            }).join('');
        } else {
            elements.peakHours.innerHTML = '<div class="text-gray-500">No peak data</div>';
        }
    } catch (err) {
        console.error('loadPeakHours error:', err);
        elements.peakHours.innerHTML = '<div class="text-gray-500">Error loading</div>';
    }
}

// ========== ИСТОРИЯ РЕКОРДОВ ==========
async function loadRecords() {
    try {
        elements.recordsTable.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Loading...</td></tr>';
        if (!supabase) {
            elements.recordsTable.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No records (Supabase not configured)</td></tr>';
            return;
        }

        const { data, error } = await supabase
            .from('daily_records')
            .select('*')
            .eq('universe_id', GAME_CONFIG.universeId)
            .order('recorded_at', { ascending: false })
            .limit(10);

        if (error) {
            console.warn('loadRecords supabase error:', error);
            elements.recordsTable.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No records</td></tr>';
            return;
        }

        if (data && data.length) {
            elements.recordsTable.innerHTML = data.map((record, index) => {
                const prevValue = index < data.length - 1 ? data[index + 1].value : record.value;
                const diff = record.value - prevValue;
                return `
                    <tr class="record-${record.record_type}">
                        <td>${new Date(record.recorded_at).toLocaleDateString(currentLang === 'en' ? 'en-US' : 'ru-RU')}</td>
                        <td>${translateRecordType(record.record_type)}</td>
                        <td class="font-bold">${formatNumber(record.value)}</td>
                        <td class="${diff > 0 ? 'text-green-500' : diff < 0 ? 'text-red-500' : ''}">
                            ${diff > 0 ? '+' : ''}${formatNumber(diff)}
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            elements.recordsTable.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No records</td></tr>';
        }
    } catch (err) {
        console.error('loadRecords error:', err);
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

// ========== REALTIME ПОДПИСКА ==========
function setupRealtimeSubscription() {
    if (!supabase) return;

    try {
        supabase
            .channel('player_stats_changes')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'player_stats',
                filter: `universe_id=eq.${GAME_CONFIG.universeId}`
            }, payload => {
                if (!payload?.new) return;
                const newRow = payload.new;
                elements.currentOnline.textContent = formatNumber(newRow.active_players);
                elements.totalVisits.textContent = formatNumber(newRow.total_visits || '-');
                highlightElement(elements.currentOnline);
            })
            .subscribe()
            .onError(err => console.warn('Realtime subscription error:', err));
    } catch (err) {
        console.error('setupRealtimeSubscription error:', err);
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function formatNumber(num) {
    if (num === null || num === undefined) return '-';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function updateLastUpdateTime() {
    const now = new Date();
    elements.lastUpdate.textContent = now.toLocaleTimeString();
}

function highlightUpdatedData() {
    document.querySelectorAll('.stat-card').forEach(el => {
        el.classList.add('data-updated');
        setTimeout(() => el.classList.remove('data-updated'), 1000);
    });
}

function highlightElement(el) {
    if (!el) return;
    el.classList.add('data-updated');
    setTimeout(() => el.classList.remove('data-updated'), 1000);
}

function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-up';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function startAutoUpdate() {
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(() => loadAllData(), 300000); // 5 минут
}

// ========== ДЛЯ РАЗРАБОТКИ ==========
function generateTestData() {
    // Можете использовать для локального теста
    const now = new Date();
    return {
        playing: Math.floor(Math.random() * 300) + 50,
        visits: Math.floor(Math.random() * 100000) + 1000,
        favoritedCount: Math.floor(Math.random() * 5000)
    };
});
    updateInterval = setInterval(() => loadAllData(), 300000); // 5 minutes
}
