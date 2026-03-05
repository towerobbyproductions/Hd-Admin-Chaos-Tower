// Конфигурация
const CONFIG = {
    UNIVERSE_ID: '9678437015',
    API_URL: 'https://games.roproxy.com/v1/games?universeIds=9678437015',
    CACHE_KEY: 'roblox_game_data',
    CACHE_DURATION: 300000, // 5 минут
    AUTO_SLIDE_INTERVAL: 5000 // 5 секунд
};

// Состояние приложения
let currentLang = 'en';
let currentSlide = 0;
let autoSlideInterval;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initLanguage();
    fetchGameData();
    setupEventListeners();
    initAutoSlide();
});

// ========== УПРАВЛЕНИЕ ТЕМОЙ ==========
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
        document.getElementById('themeToggle').textContent = '☀️';
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const themeButton = document.getElementById('themeToggle');

    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        themeButton.textContent = '☀️';
        localStorage.setItem('theme', 'light');
    } else {
        html.classList.add('dark');
        themeButton.textContent = '🌙';
        localStorage.setItem('theme', 'dark');
    }
}

// ========== УПРАВЛЕНИЕ ЯЗЫКОМ ==========
function initLanguage() {
    const savedLang = localStorage.getItem('language') || 'en';
    currentLang = savedLang;
    updateLanguage();
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'ru' : 'en';
    localStorage.setItem('language', currentLang);
    updateLanguage();
}

function updateLanguage() {
    const langButton = document.getElementById('langToggle');
    langButton.textContent = currentLang === 'en' ? 'RU' : 'EN';

    // Обновляем все элементы с атрибутами языка
    document.querySelectorAll('[data-lang-en]').forEach(el => {
        const text = el.getAttribute(`data-lang-${currentLang}`);
        if (text) {
            el.textContent = text;
        }
    });
}

// ========== СЛАЙДЕР ИЗОБРАЖЕНИЙ ==========
function changeSlide(direction) {
    const wrapper = document.getElementById('sliderWrapper');
    if (!wrapper) return;
    
    const totalSlides = wrapper.children.length;
    if (totalSlides === 0) return;

    currentSlide = (currentSlide + direction + totalSlides) % totalSlides;
    wrapper.style.transform = `translateX(-${currentSlide * 100}%)`;
}

function initAutoSlide() {
    // Очищаем предыдущий интервал если есть
    if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
    }
    
    // Запускаем авто-слайд
    autoSlideInterval = setInterval(() => {
        changeSlide(1);
    }, CONFIG.AUTO_SLIDE_INTERVAL);
}

// Останавливаем авто-слайд при наведении на слайдер
function setupSliderHover() {
    const slider = document.querySelector('.slider-container');
    if (slider) {
        slider.addEventListener('mouseenter', () => {
            clearInterval(autoSlideInterval);
        });
        
        slider.addEventListener('mouseleave', () => {
            initAutoSlide();
        });
    }
}

// ========== ПОЛУЧЕНИЕ ДАННЫХ ИГРЫ ==========
async function fetchGameData() {
    try {
        showLoadingState();
        
        // Проверяем кэш
        const cached = getCache();
        if (cached) {
            updateUI(cached);
            hideLoadingState();
            return;
        }

        // Запрашиваем из API
        const response = await fetch(CONFIG.API_URL);
        if (!response.ok) throw new Error('Failed to fetch game data');

        const data = await response.json();
        if (data.data && data.data.length > 0) {
            const gameData = data.data[0];
            setCache(gameData);
            updateUI(gameData);
        }
        
        hideLoadingState();
    } catch (error) {
        console.error('Error fetching game data:', error);
        handleFetchError(error);
    }
}

function showLoadingState() {
    // Добавляем класс загрузки к основным элементам
    document.querySelectorAll('.stat-card').forEach(el => {
        el.classList.add('loading');
    });
}

function hideLoadingState() {
    document.querySelectorAll('.stat-card').forEach(el => {
        el.classList.remove('loading');
    });
}

function handleFetchError(error) {
    document.getElementById('gameTitle').textContent = 'Error loading game data';
    document.getElementById('gameDescription').textContent = 
        currentLang === 'en' 
            ? 'Failed to load game data. Please try again later.' 
            : 'Не удалось загрузить данные игры. Пожалуйста, попробуйте позже.';
}

// ========== УПРАВЛЕНИЕ КЭШЕМ ==========
function getCache() {
    try {
        const cached = localStorage.getItem(CONFIG.CACHE_KEY);
        if (!cached) return null;

        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();

        if (now - timestamp < CONFIG.CACHE_DURATION) {
            return data;
        }

        localStorage.removeItem(CONFIG.CACHE_KEY);
        return null;
    } catch (error) {
        console.error('Cache read error:', error);
        return null;
    }
}

function setCache(data) {
    try {
        const cacheObject = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(cacheObject));
    } catch (error) {
        console.error('Cache write error:', error);
    }
}

// ========== ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ==========
function updateUI(gameData) {
    // Название
    document.getElementById('gameTitle').textContent = gameData.name || 'Roblox Game';
    document.title = `${gameData.name || 'Roblox Game'} - Play Online`;

    // Описание
    document.getElementById('gameDescription').textContent = 
        gameData.description || 'No description available.';

    // Статистика
    document.getElementById('activePlayers').textContent = formatNumber(gameData.playing || 0);
    document.getElementById('favorites').textContent = formatNumber(gameData.favoritedCount || 0);
    document.getElementById('visits').textContent = formatNumber(gameData.visits || 0);
    document.getElementById('serverSize').textContent = gameData.maxPlayers || '38';

    // Даты
    document.getElementById('created').textContent = formatDate(gameData.created);
    document.getElementById('updated').textContent = formatDate(gameData.updated);

    // Жанры
    document.getElementById('genre').textContent = gameData.genre || 'All';
    document.getElementById('subgenre').textContent = gameData.genre || 'All';

    // Ссылка на игру
    if (gameData.rootPlaceId) {
        document.getElementById('playLink').href = `https://www.roblox.com/games/${gameData.rootPlaceId}/`;
    }
    
    // Обновляем мета теги для SEO
    updateMetaTags(gameData);
}

function updateMetaTags(gameData) {
    // Обновляем Open Graph теги
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
        ogTitle.setAttribute('content', `${gameData.name || 'Roblox Game'} - Play Online`);
    }
    
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
        ogDescription.setAttribute('content', gameData.description?.substring(0, 160) || 'Play this exciting Roblox game online');
    }
    
    // Обновляем Twitter Card
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) {
        twitterTitle.setAttribute('content', `${gameData.name || 'Roblox Game'} - Play Online`);
    }
}

// ========== ФОРМАТИРОВАНИЕ ДАННЫХ ==========
function formatNumber(num) {
    if (!num && num !== 0) return '0';
    
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();

        return `${month}/${day}/${year}`;
    } catch (error) {
        console.error('Date formatting error:', error);
        return 'N/A';
    }
}

// ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========
function setupEventListeners() {
    const themeToggle = document.getElementById('themeToggle');
    const langToggle = document.getElementById('langToggle');
    
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    if (langToggle) {
        langToggle.addEventListener('click', toggleLanguage);
    }
    
    setupSliderHover();
}

// Экспортируем функции для глобального доступа (для onclick в HTML)
window.changeSlide = changeSlide;
