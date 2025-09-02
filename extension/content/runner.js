// extension/content/runner.js
(function () {
  const { sleep, log } = window.JAX || {};
  const Sites = window.JobApplyXSites || {};
  let enabled = false;
  let backend = 'http://localhost:3001';
  const visited = new Set();

  async function getState() {
    return await new Promise(resolve => chrome.runtime.sendMessage({ type: 'JOBAPPLYX_GET_STATE' }, resolve));
  }

  function currentSite() {
    // Order: LinkedIn → Indeed → ZipRecruiter (if you also register those on window.JobApplyXSites)
    if (Sites.LinkedIn && typeof Sites.LinkedIn.domainMatch === 'function' && Sites.LinkedIn.domainMatch()) return Sites.LinkedIn;
    if (Sites.Indeed   && typeof Sites.Indeed.domainMatch   === 'function' && Sites.Indeed.domainMatch())   return Sites.Indeed;
    if (Sites.ZipRecruiter && typeof Sites.ZipRecruiter.domainMatch === 'function' && Sites.ZipRecruiter.domainMatch()) return Sites.ZipRecruiter;
    return null;
  }

  async function loop() {
    while (enabled) {
      const site = currentSite();
      if (!site) { await sleep(1200); continue; }

      try {
        const state = await getState();
        backend = state?.backend || backend;

        // Pull profile (roles/locations for LinkedIn search)
        let profile = {};
        try { const resp = await fetch(`${backend}/api/profile`).then(r=>r.json()); profile = resp.profile || {}; } catch {}

        if (typeof site.isListingPage === 'function' && site.isListingPage()) {
          await site.scanAndOpenEasyApply({ profile, backend, visited });
        } else if (typeof site.applyIfEasy === 'function') {
          const done = await site.applyIfEasy({ backend, profile, visited });
          // For LinkedIn we close the modal ourselves and stay on the search page
          // For sites that navigate away, you can history.back() here if needed
        }
      } catch (e) {
        log && log('Runner error', e);
      }

      await sleep(700 + Math.random()*700);
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'JOBAPPLYX_TOGGLE') { enabled = !!msg.enabled; if (enabled) loop(); }
  });

  getState().then(s => { enabled = !!s?.enabled; backend = s?.backend || backend; if (enabled) loop(); });
})();
