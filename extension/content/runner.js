(function () {
  const { sleep, log } = window.JAX;
  const Sites = window.JobApplyXSites || {};
  const STATE_KEY = "jobapplyx_state";
  let enabled = false;
  let backend = "http://localhost:3001";

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
      if (!site) {
        await sleep(1500);
        continue;
      }
      try {
        const state = await getState();
        backend = state.backend || backend;
        const prof = await fetch(`${backend}/api/profile`).then((r) => r.json());
        const roles = prof.profile?.roles || [];

        if (site.isListingPage()) {
          await site.scanAndOpenEasyApply(roles);
        } else {
          const done = await site.applyIfEasy({ backend });
          if (done) {
            history.back();
            await sleep(1200);
          }
        }
      } catch (e) {
        log("Runner error", e);
      }
      await sleep(1200 + Math.random() * 800);
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "JOBAPPLYX_TOGGLE") {
      enabled = !!msg.enabled;
      if (enabled) loop();
    }
  });

  getState().then((s) => {
    enabled = !!s.enabled;
    backend = s.backend || backend;
    if (enabled) loop();
  });
})();
