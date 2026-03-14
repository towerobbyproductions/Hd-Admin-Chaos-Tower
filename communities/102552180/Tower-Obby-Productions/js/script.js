// config
const WORKER_URL = 'https://young-breeze-5b43.robloxtop1742.workers.dev'; // <- вставь свой Worker URL
const ROOT_PLACE_ID = '71240146627158';

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

// placeholders
el.about.textContent = 'Loading…';
el.members.textContent = 'Loading…';

// fetch group info
fetch(`${WORKER_URL}/group`)
  .then(r => r.json())
  .then(data => {
    const members = data.memberCount || data.membersCount || '65K+';
    const about = data.description || '';
    el.members.textContent = `${members.toLocaleString()} Members`;
    if (el.about.textContent.includes('Loading')) el.about.textContent = about;
  })
  .catch(err => {
    console.error(err);
    el.members.textContent = '65K+ Members';
  });

// fetch games info
fetch(`${WORKER_URL}/games`)
  .then(r => r.json())
  .then(json => {
    if (!json.data || !json.data.length) throw new Error('No game data');
    const g = json.data[0];

    el.communityName.textContent = 'Tower Obby Productions';
    el.communityAvatar.src = 'https://tr.rbxcdn.com/180DAY-a96d76930a4b8fd8835dfb3715d21838/150/150/Image/Webp/noFilter';
    el.about.textContent = g.sourceDescription || g.description || el.about.textContent;

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
    const activeText = `${g.playing || 0} active`;
    const visitsText = `${g.visits || 0} visits`;
    meta.innerHTML = `<div>${activeText} • ${visitsText}</div>`;

    info.appendChild(title); info.appendChild(meta);
    card.appendChild(thumb); card.appendChild(info);
    el.experiencesGrid.appendChild(card);
    el.experiencesCount.textContent = '1 Experience';
  })
  .catch(err => {
    console.error(err);
    el.experiencesGrid.innerHTML = '<div class="p-4 text-sm">Failed to load experiences.</div>';
    el.experiencesCount.textContent = '0';
  });
