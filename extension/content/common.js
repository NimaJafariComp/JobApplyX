(function () {
  const JAX = (window.JAX = window.JAX || {});
  JAX.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  JAX.waitFor = async (sel, timeout = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const el = document.querySelector(sel);
      if (el) return el;
      await JAX.sleep(100);
    }
    throw new Error(`Timeout waiting for ${sel}`);
  };
  JAX.click = async (el) => {
    el.scrollIntoView({ block: "center" });
    await JAX.sleep(150);
    el.click();
    await JAX.sleep(400);
  };
  JAX.text = (el) => (el?.innerText || el?.textContent || "").trim();
  JAX.$all = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  JAX.log = (...args) => console.debug("[JobApplyX]", ...args);

  JAX.extractQuestions = function (root = document) {
    const qs = [];
    const inputs = JAX.$all("input, textarea, select", root).filter(
      (i) => i.offsetParent !== null
    );
    for (const el of inputs) {
      const label =
        el.getAttribute("aria-label") ||
        (el.id
          ? JAX.text(document.querySelector(`label[for="${el.id}"]`))
          : "") ||
        el.placeholder ||
        "";
      const type =
        el.tagName.toLowerCase() === "select" ? "select" : el.type || "text";
      if (!label) continue;
      qs.push({ el, label, type });
    }
    return qs;
  };

  JAX.fillText = function (el, value) {
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  JAX.selectChoice = function (el, value) {
    if (el.tagName.toLowerCase() === "select") {
      const opts = Array.from(el.options);
      let idx = opts.findIndex(
        (o) => o.text.trim().toLowerCase() === String(value).toLowerCase()
      );
      if (idx < 0)
        idx = opts.findIndex((o) =>
          o.text.toLowerCase().includes(String(value).toLowerCase())
        );
      if (idx >= 0) {
        el.selectedIndex = idx;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  };
})();
