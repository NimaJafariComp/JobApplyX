const STATE_KEY = 'jobapplyx_state';


chrome.runtime.onInstalled.addListener(() => {
chrome.storage.sync.set({ [STATE_KEY]: { enabled: false, backend: 'http://localhost:3001' } });
});


chrome.action.onClicked.addListener(async (tab) => {
const state = (await chrome.storage.sync.get(STATE_KEY))[STATE_KEY];
const next = { ...state, enabled: !state.enabled };
await chrome.storage.sync.set({ [STATE_KEY]: next });
chrome.action.setBadgeText({ text: next.enabled ? 'ON' : '' });
if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'JOBAPPLYX_TOGGLE', enabled: next.enabled });
});


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
if (msg?.type === 'JOBAPPLYX_GET_STATE') {
chrome.storage.sync.get(STATE_KEY).then(v => sendResponse(v[STATE_KEY]));
return true; // async
}
});
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'JOBAPPLYX_PING') { sendResponse({ ok: true }); return true; }
});