const STATE_KEY = 'jobapplyx_state';


async function load() {
const state = (await chrome.storage.sync.get(STATE_KEY))[STATE_KEY] || { backend: 'http://localhost:3001' };
document.getElementById('backend').value = state.backend || '';
try {
const r = await fetch(`${state.backend}/api/profile`);
const { profile, resume_text } = await r.json();
document.getElementById('profile').value = JSON.stringify(profile, null, 2);
document.getElementById('roles').value = (profile.roles || []).join(', ');
document.getElementById('locations').value = (profile.locations || []).join(', ');
document.getElementById('resume').value = resume_text || '';
} catch (e) {}
}


async function save() {
const backend = document.getElementById('backend').value.trim();
const roles = document.getElementById('roles').value.split(',').map(s=>s.trim()).filter(Boolean);
const locations = document.getElementById('locations').value.split(',').map(s=>s.trim()).filter(Boolean);
let profile;
try { profile = JSON.parse(document.getElementById('profile').value || '{}'); } catch { alert('Profile JSON invalid'); return; }
profile.roles = roles; profile.locations = locations;


await chrome.storage.sync.set({ [STATE_KEY]: { ...(await chrome.storage.sync.get(STATE_KEY))[STATE_KEY], backend } });
await fetch(`${backend}/api/profile`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ profile }) });
alert('Saved');
}


async function uploadResumeText() {
const backend = document.getElementById('backend').value.trim();
const text = document.getElementById('resume').value;
await fetch(`${backend}/api/resume`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text }) });
alert('Resume text saved on server');
}


document.getElementById('save').addEventListener('click', save);


document.getElementById('uploadResume').addEventListener('click', uploadResumeText);


load();