(function () {
  const { sleep, log } = window.JAX;
  const Sites = window.JobApplyXSites || {};
  const STATE_KEY = "jobapplyx_state";

  let enabled = false;
  let backend = "http://localhost:3001";
  let busy = false;
  const visited = new Set(); // URLs we've already considered this session

  async function getState() {
    return await new Promise((resolve) =>
      chrome.runtime.sendMessage({ type: "JOBAPPLYX_GET_STATE" }, resolve)
    );
  }

  function currentSite() {
    if (Sites.Indeed?.domainMatch()) return Sites.Indeed;
    if (Sites.ZipRecruiter?.domainMatch()) return Sites.ZipRecruiter;
    if (Sites.LinkedIn?.domainMatch()) return Sites.LinkedIn;
    return null;
  }

  async function loop() {
    while (enabled) {
      const site = currentSite();
      if (!site) { await sleep(1200); continue; }

      try {
        const state = await getState();
        backend = state.backend || backend;

        const profResp = await fetch(`${backend}/api/profile`).then(r=>r.json());
        const profile = profResp.profile || {};
        const threshold =
          Number(profile.apply_threshold) ||
          Number(profile?.answers?.apply_threshold) ||
          60;

        if (busy) { await sleep(500); continue; }

        if (site.isListingPage()) {
          busy = true;
          const opened = await site.scanAndOpenEasyApply({ profile, backend, threshold, visited });
          busy = !!opened;
        } else {
          busy = true;
          const done = await site.applyIfEasy({ backend, profile, threshold, visited });
          busy = false;
          if (done) { history.back(); await sleep(1200); }
        }
      } catch (e) {
        log("Runner error", e);
        busy = false;
      }

      await sleep(600 + Math.random() * 700);
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "JOBAPPLYX_TOGGLE") {
      enabled = !!msg.enabled;
      if (enabled) loop();
    }
  });

  getState().then((s) => {
    enabled = !!s.enabled; backend = s.backend || backend;
    if (enabled) loop();
  });
})();
