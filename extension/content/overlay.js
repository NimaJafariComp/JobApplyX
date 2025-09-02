(function () {
  if (window.__jobapplyx_overlay_injected) return;
  window.__jobapplyx_overlay_injected = true;
  const root = document.createElement("div");
  root.id = "jobapplyx-overlay";
  root.innerHTML = `<div class="panel"><h3>JobApplyX — Missing Info</h3><div id="qa"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button id="ja-cancel">Cancel</button><button id="ja-send">Submit</button></div></div>`;
  document.documentElement.appendChild(root);
  const qa = root.querySelector("#qa");

  window.JobApplyXOverlay = {
    async ask(missing) {
      qa.innerHTML = "";
      for (const m of missing) {
        const row = document.createElement("div");
        row.className = "q";
        row.innerHTML = `<label>${m.label || m.question}</label><input data-key="${
          m.key || m.label
        }" placeholder="Type answer"/>`;
        qa.appendChild(row);
      }
      root.style.display = "block";
      return new Promise((resolve, reject) => {
        root.querySelector("#ja-cancel").onclick = () => {
          root.style.display = "none";
          reject(new Error("cancel"));
        };
        root.querySelector("#ja-send").onclick = () => {
          const inputs = Array.from(qa.querySelectorAll("input,textarea"));
          const answers = {};
          for (const i of inputs) answers[i.getAttribute("data-key")] = i.value;
          root.style.display = "none";
          resolve(answers);
        };
      });
    },
    async notice(html) {
      qa.innerHTML = `<div class="q" style="font-size:14px; line-height:1.4">${html}</div>`;
      root.style.display = "block";
      return new Promise((resolve, reject) => {
        root.querySelector("#ja-cancel").onclick = () => {
          root.style.display = "none";
          reject(new Error("cancel"));
        };
        const send = root.querySelector("#ja-send");
        send.textContent = "Continue";
        send.onclick = () => {
          root.style.display = "none";
          resolve(true);
        };
      });
    },
  };
})();
