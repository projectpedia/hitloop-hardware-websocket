/* global HitloopDeviceManager */

(() => {
  const DEFAULT_FIELDS = [
    { key: "aX", label: "aX" },
    { key: "aY", label: "aY" },
    { key: "aZ", label: "aZ" },
    { key: "dNW", label: "dNW" },
    { key: "dNE", label: "dNE" },
    { key: "dSE", label: "dSE" },
    { key: "dSW", label: "dSW" },
    { key: "tap", label: "tap" },
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function setFooter(msg) {
    const el = $("footerMessage");
    if (el) el.textContent = msg || "";
  }

  function setStatus(kind, text) {
    const dot = $("statusDot");
    const label = $("statusText");
    if (label) label.textContent = text || "";
    if (!dot) return;
    if (kind === "ok") dot.style.background = "var(--ok)";
    else if (kind === "warn") dot.style.background = "var(--warn)";
    else if (kind === "danger") dot.style.background = "var(--danger)";
    else dot.style.background = "rgba(255,255,255,0.25)";
  }

  function normalizeFieldValue(fieldKey, sensorData) {
    // sensorData fields are: ax, ay, az, dNW, dNE, dSE, dSW, tap
    if (!sensorData) return undefined;
    if (fieldKey === "aX") return sensorData.ax;
    if (fieldKey === "aY") return sensorData.ay;
    if (fieldKey === "aZ") return sensorData.az;
    return sensorData[fieldKey];
  }

  function varNameFor(deviceIdHex, fieldKey) {
    const idUpper = String(deviceIdHex || "").slice(0, 4).toUpperCase();
    return `device_${idUpper}_${fieldKey}`;
  }

  function safeClipboardWrite(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  function insertIntoStrudel(replEl, text) {
    if (!replEl || !replEl.editor || !replEl.editor.editor) return false;
    const view = replEl.editor.editor;
    const sel = view.state.selection.main;
    const from = sel.from;
    const to = sel.to;
    view.dispatch({ changes: { from, to, insert: text } });
    view.focus();
    return true;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const wsUrlInput = $("wsUrl");
    const connectBtn = $("connectBtn");
    const disconnectBtn = $("disconnectBtn");
    const deviceCountEl = $("deviceCount");
    const filterInput = $("filterInput");
    const varsList = $("varsList");
    const fieldChips = $("fieldChips");
    const autoEvalToggle = $("autoEvalToggle");
    const evalBtn = $("evalBtn");
    const stopBtn = $("stopBtn");
    const replEl = $("repl");

    const defaultWsUrl =
      (window.APP_CONFIG && window.APP_CONFIG.wsDefaultUrl) || "ws://localhost:5003/";
    if (wsUrlInput && !wsUrlInput.value) wsUrlInput.value = defaultWsUrl;

    let manager = null;
    let renderQueued = false;
    let fieldsEnabled = new Set(DEFAULT_FIELDS.map((f) => f.key));
    let lastActiveVarNames = new Set();
    let autoEvalDebounceTimer = null;
    let lastEvalAt = 0;

    function getFilterText() {
      return String(filterInput?.value || "")
        .trim()
        .toLowerCase();
    }

    function updateDeviceCount() {
      const count = manager ? manager.getDeviceCount() : 0;
      if (deviceCountEl) deviceCountEl.textContent = `devices: ${count}`;
    }

    function renderFieldChips() {
      if (!fieldChips) return;
      fieldChips.innerHTML = "";

      for (const f of DEFAULT_FIELDS) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        chip.setAttribute("aria-pressed", fieldsEnabled.has(f.key) ? "true" : "false");
        chip.textContent = f.label;
        chip.addEventListener("click", () => {
          if (fieldsEnabled.has(f.key)) fieldsEnabled.delete(f.key);
          else fieldsEnabled.add(f.key);
          renderFieldChips();
          scheduleRender();
        });
        fieldChips.appendChild(chip);
      }
    }

    function isPlaying() {
      try {
        return Boolean(replEl?.editor?.repl?.scheduler?.started);
      } catch (_e) {
        return false;
      }
    }

    function scheduleAutoEvaluate() {
      if (!autoEvalToggle?.checked) return;
      if (!isPlaying()) return;

      // Debounce + rate limit: keep audio stable, but update quickly.
      const now = Date.now();
      const minGapMs = 120;
      const dueIn = Math.max(0, minGapMs - (now - lastEvalAt));

      if (autoEvalDebounceTimer) return;
      autoEvalDebounceTimer = setTimeout(async () => {
        autoEvalDebounceTimer = null;
        try {
          // While playing, evaluate without autostart to avoid restarting transport.
          await replEl?.editor?.evaluate(false);
          lastEvalAt = Date.now();
          setFooter(`auto-evaluated @ ${new Date(lastEvalAt).toLocaleTimeString()}`);
        } catch (e) {
          setFooter(`auto-eval error: ${String(e?.message || e)}`);
        }
      }, dueIn);
    }

    function setGlobalsAndCollectEntries() {
      const entries = [];
      const activeNow = new Set();

      if (!manager) {
        // Clear globals if disconnected
        for (const name of lastActiveVarNames) {
          try {
            delete window[name];
          } catch (_e) {}
        }
        lastActiveVarNames = new Set();
        return { entries };
      }

      for (const [deviceId, device] of manager.getAllDevices()) {
        const data = device.getSensorData();
        for (const fieldKey of fieldsEnabled) {
          const name = varNameFor(deviceId, fieldKey);
          const value = normalizeFieldValue(fieldKey, data);
          activeNow.add(name);

          // Expose as direct global.
          window[name] = value;

          entries.push({
            name,
            value,
            deviceId: String(deviceId).slice(0, 4).toUpperCase(),
            fieldKey,
          });
        }
      }

      // Remove stale globals from previously connected devices/fields.
      for (const oldName of lastActiveVarNames) {
        if (!activeNow.has(oldName)) {
          try {
            delete window[oldName];
          } catch (_e) {}
        }
      }
      lastActiveVarNames = activeNow;

      return { entries };
    }

    function renderVars() {
      renderQueued = false;
      updateDeviceCount();
      if (!varsList) return;

      const { entries } = setGlobalsAndCollectEntries();
      const filter = getFilterText();
      const filtered = !filter
        ? entries
        : entries.filter((e) => e.name.toLowerCase().includes(filter));

      filtered.sort((a, b) => {
        if (a.deviceId !== b.deviceId) return a.deviceId.localeCompare(b.deviceId);
        return a.fieldKey.localeCompare(b.fieldKey);
      });

      varsList.innerHTML = "";

      if (!manager) {
        const empty = document.createElement("div");
        empty.className = "hint";
        empty.textContent = "Connect to the WebSocket server to see variables.";
        varsList.appendChild(empty);
        return;
      }

      if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.className = "hint";
        empty.textContent = filter
          ? "No matches. Try a different filter."
          : "No devices yet. Power on / connect a device to the socket server.";
        varsList.appendChild(empty);
        return;
      }

      for (const item of filtered) {
        const row = document.createElement("div");
        row.className = "var";
        row.title = "Click to copy. Shift-click to insert at cursor.";
        row.addEventListener("click", (ev) => {
          if (ev.shiftKey) {
            const ok = insertIntoStrudel(replEl, item.name);
            if (ok) setFooter(`inserted: ${item.name}`);
            else setFooter("Could not insert into Strudel editor (not ready yet).");
            return;
          }
          safeClipboardWrite(item.name);
          setFooter(`copied: ${item.name}`);
        });

        const name = document.createElement("div");
        name.className = "var__name";
        name.textContent = item.name;

        const value = document.createElement("div");
        value.className = "var__value";
        value.textContent =
          typeof item.value === "boolean" ? String(item.value) : String(item.value ?? "—");

        row.appendChild(name);
        row.appendChild(value);
        varsList.appendChild(row);
      }
    }

    function scheduleRender() {
      if (renderQueued) return;
      renderQueued = true;
      requestAnimationFrame(renderVars);
    }

    function attachManagerHooks(mgr) {
      // Trigger UI + optional auto re-evaluate whenever frames arrive.
      const originalParse = mgr.parseAndUpdateDevice.bind(mgr);
      mgr.parseAndUpdateDevice = (frame) => {
        const ok = originalParse(frame);
        if (ok) {
          scheduleRender();
          scheduleAutoEvaluate();
        }
        return ok;
      };

      const originalPrune = mgr.pruneInactive.bind(mgr);
      mgr.pruneInactive = () => {
        originalPrune();
        scheduleRender();
      };
    }

    async function connect() {
      const url = String(wsUrlInput?.value || "").trim();
      if (!url) return;

      try {
        setFooter("");
        setStatus("warn", "connecting…");
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;

        manager = new HitloopDeviceManager(url);
        attachManagerHooks(manager);
        await manager.connect();
        scheduleRender();
      } catch (e) {
        setStatus("danger", "error");
        setFooter(`connect error: ${String(e?.message || e)}`);
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
      }
    }

    function disconnect() {
      try {
        manager?.disconnect?.();
      } catch (_e) {}
      manager = null;
      setStatus(null, "disconnected");
      setFooter("disconnected");
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
      scheduleRender();
    }

    function updateConnectionStatusLoop() {
      const ws = manager?.ws;
      const ready = ws && ws.readyState === WebSocket.OPEN;
      if (ready) {
        setStatus("ok", `connected • devices: ${manager.getDeviceCount()}`);
      } else if (manager) {
        setStatus("warn", "connecting…");
      } else {
        setStatus(null, "disconnected");
      }
    }

    async function evaluatePlay() {
      try {
        setFooter("");
        // User gesture: this is usually required for audio.
        await replEl?.editor?.evaluate(true);
        lastEvalAt = Date.now();
        setFooter(`evaluated @ ${new Date(lastEvalAt).toLocaleTimeString()}`);
      } catch (e) {
        setFooter(`eval error: ${String(e?.message || e)}`);
      }
    }

    function stop() {
      try {
        replEl?.editor?.stop?.();
        setFooter("stopped");
      } catch (e) {
        setFooter(`stop error: ${String(e?.message || e)}`);
      }
    }

    // Wire UI
    renderFieldChips();
    scheduleRender();

    connectBtn?.addEventListener("click", connect);
    disconnectBtn?.addEventListener("click", disconnect);
    filterInput?.addEventListener("input", scheduleRender);
    evalBtn?.addEventListener("click", evaluatePlay);
    stopBtn?.addEventListener("click", stop);

    // Keep status + stale removals fresh even if no frames arrive.
    setInterval(updateConnectionStatusLoop, 250);
    setInterval(scheduleRender, 1000);

    // Helpful footer when Strudel emits state updates.
    replEl?.addEventListener("update", (ev) => {
      const st = ev?.detail;
      const started = st?.scheduler?.started;
      if (typeof started === "boolean") {
        setFooter(started ? "playing" : "stopped");
      }
    });
  });
})();

