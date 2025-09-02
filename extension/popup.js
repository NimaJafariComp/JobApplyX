const STATE_KEY = 'jobapplyx_state';
const byId = (id) => document.getElementById(id);


async function refresh() {
const state = (await chrome.storage.sync.get(STATE_KEY))[STATE_KEY];
const toggle = byId('toggle');
toggle.setAttribute('aria-pressed', String(!!state.enabled));
toggle.textContent = state.enabled ? 'On' : 'Off';
try {
const r = await fetch(`${state.backend}/api/queue`);
const { items } = await r.json();
byId('queued').textContent = items.filter(i=>i.status==='pending').length;
byId('answered').textContent = items.filter(i=>i.status==='answered').length;
} catch (e) {}
}


document.getElementById('toggle').addEventListener('click', async () => {
const state = (await chrome.storage.sync.get(STATE_KEY))[STATE_KEY];
state.enabled = !state.enabled;
await chrome.storage.sync.set({ [STATE_KEY]: state });
chrome.action.setBadgeText({ text: state.enabled ? 'ON' : '' });
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'JOBAPPLYX_TOGGLE', enabled: state.enabled });
refresh();
});


byId('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());


refresh();