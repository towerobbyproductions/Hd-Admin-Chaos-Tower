// config
const UNIVERSE_ID = '9678437015';
const GROUP_ID = '102552180';
const ROOT_PLACE_ID = '71240146627158';
const gamesApi = `https://games.roproxy.com/v1/games?universeIds=${UNIVERSE_ID}`;

// elements
const el = {
  about: document.getElementById('communityAbout'),
  members: document.getElementById('membersCount'),
  experiencesGrid: document.getElementById('experiencesGrid'),
  experiencesCount: document.getElementById('experiencesCount'),
  communityName: document.getElementById('communityName'),
  communityAvatar: document.getElementById('communityAvatar'),
  ownerLink: document.getElementById('ownerLink'),
  themeToggle: document.getElementById('themeToggle'),
  langToggle: document.getElementById('langToggle'),
  viewOnRoblox: document.getElementById('viewOnRoblox')
};

// I18N (same as before)
const I18N = {
  en: { by:'By', view_roblox:'View Community in Roblox', about:'About', experiences:'Experiences', members_suffix:'Members', loading_about:'Loading about…', experience_singular:'1 Experience', active_suffix:'active', visits_suffix:'visits' },
  ru: { by:'Автор', view_roblox:'Открыть сообщество в Roblox', about:'О нас', experiences:'Игры', members_suffix:'участников', loading_about:'Загрузка описания…', experience_singular:'1 игра', active_suffix:'активных', visits_suffix:'посещений' }
};

let currentLang = localStorage.getItem('siteLang') || window.__SITE_LANG || 'en';

// apply translations
function applyTranslations(){
  document.querySelectorAll('[data-i18n]').forEach(elm=>{
    const key = elm.getAttribute('data-i18n');
    if (I18N[currentLang] && I18N[currentLang][key]) elm.textContent = I18N[currentLang][key];
  });
  if (el.langToggle) el.langToggle.textContent = currentLang.toUpperCase();
  if (el.viewOnRoblox) el.viewOnRoblox.textContent = I18N[currentLang].view_roblox;
}
applyTranslations();

// Theme utilities: ensure exactly one of html.dark / html.light
function getTheme(){
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}
function setTheme(t){ 
  if (t === 'light') { document.documentElement.classList.add('light'); document.documentElement.classList.remove('dark'); }
  else { document.documentElement.classList.add('dark'); document.documentElement.classList.remove('light'); }
  localStorage.setItem('theme', t);
  updateThemeButton();
}
function updateThemeButton(){
  if (!el.themeToggle) return;
  const cur = getTheme();
  el.themeToggle.textContent = cur === 'dark' ? '🌙' : '☀️';
  el.themeToggle.setAttribute('aria-pressed', cur === 'dark' ? 'true' : 'false');
}

// initialize theme (if script inlined already set class, keep it; but normalize)
(function initTheme(){
  const stored = localStorage.getItem('theme');
  const theme = stored || (document.documentElement.classList.contains('light') ? 'light' : 'dark');
  setTheme(theme);
})();

// hook theme toggle
if (el.themeToggle){
  el.themeToggle.addEventListener('click', ()=>{
    const now = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(now);
  });
}

// language toggle
if (el.langToggle){
  el.langToggle.addEventListener('click', ()=>{
    currentLang = currentLang === 'en' ? 'ru' : 'en';
    localStorage.setItem('siteLang', currentLang);
    document.documentElement.lang = currentLang;
    applyTranslations();
  });
}

// helpers
function fmt(n){ return new Intl.NumberFormat().format(n); }

// placeholders
el.about.textContent = I18N[currentLang].loading_about;
el.members.textContent = 'Loading…';

// fetch games data
fetch(gamesApi)
  .then(r=>r.ok? r.json() : Promise.reject(r))
  .then(json=>{
    if (!json.data || !json.data.length) throw new Error('No game data');
    const g = json.data[0];

    el.communityName.textContent = 'Tower Obby Productions';
    el.communityAvatar.src = 'https://tr.rbxcdn.com/180DAY-a96d76930a4b8fd8835dfb3715d21838/150/150/Image/Webp/noFilter';

    el.about.textContent = g.sourceDescription || g.description || 'No description provided.';

    const fav = g.favoritedCount || 0;
    const visits = g.visits || 0;
    const playing = g.playing || 0;
    let ratingPercent = 0;
    if (visits > 0) {
      ratingPercent = Math.round((fav / (visits / 1000)) * 100);
      if (!isFinite(ratingPercent) || ratingPercent < 0) ratingPercent = 0;
      if (ratingPercent > 99) ratingPercent = 99;
    }

    // create card
    const card = document.createElement('a');
    card.className = 'exp-card';
    card.href = `https://www.roblox.com/games/${ROOT_PLACE_ID}/`;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';

    const thumb = document.createElement('img');
    thumb.src = 'https://tr.rbxcdn.com/180DAY-0d89850eddf82db8a49293be85d3ae68/512/512/Image/Webp/noFilter';
    thumb.alt = g.name || 'Experience';
    thumb.className = 'exp-thumb';

    const info = document.createElement('div'); info.className = 'exp-info';

    const title = document.createElement('div'); title.className = 'exp-title';
    const priceStr = (g.price && g.price > 0) ? ` [${g.price} Robux]` : (g.price === 0 ? ' [Free]' : '');
    title.textContent = (g.name || 'HD Admin Chaos Tower') + priceStr;

    const meta = document.createElement('div'); meta.className = 'exp-meta mt-1';
    const activeText = `${fmt(playing)} ${I18N[currentLang].active_suffix}`;
    const visitsText = `${fmt(visits)} ${I18N[currentLang].visits_suffix}`;

    meta.innerHTML = `<div class="flex items-center gap-2">
                        <span class="exp-rating">${ratingPercent}%</span>
                        <span>${activeText}</span>
                        <span>•</span>
                        <span>${visitsText}</span>
                      </div>
                      <div class="mt-1 text-sm">${g.genre_l1 || g.genre || ''} · ${g.genre_l2 || ''}</div>`;

    info.appendChild(title); info.appendChild(meta);
    card.appendChild(thumb); card.appendChild(info);
    el.experiencesGrid.appendChild(card);

    el.experiencesCount.textContent = I18N[currentLang].experience_singular;
  })
  .catch(err=>{
    console.error(err);
    el.about.textContent = 'Unable to load game info.';
    el.experiencesCount.textContent = '0';
    const fallback = document.createElement('div');
    fallback.className = 'p-4 text-sm';
    fallback.textContent = 'Failed to load experiences.';
    el.experiencesGrid.appendChild(fallback);
  });

// fetch group info (best-effort)
(async function fetchGroup(){
  try {
    const res = await fetch(`https://groups.roproxy.com/v1/groups/${GROUP_ID}`);
    if (!res.ok) throw new Error('group fetch failed');
    const data = await res.json();
    const members = data.memberCount || data.membersCount || (data.data && data.data.memberCount);
    const about = data.description || data.about;
    if (members) el.members.textContent = `${fmt(members)} ${I18N[currentLang].members_suffix}`;
    else el.members.textContent = '65K+ ' + I18N[currentLang].members_suffix;
    if (about && el.about.textContent.includes('Loading')) el.about.textContent = about;
  } catch(e){
    el.members.textContent = '65K+ ' + I18N[currentLang].members_suffix;
  }
})();
