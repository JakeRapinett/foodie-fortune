/* ================= Foodie Fortune — app.js ================= */
(() => {
  "use strict";

  const STORAGE_KEY = "foodie_fortune_v1";

  const PALETTE = ["#E07A5F", "#81B29A", "#F2CC8F", "#3D405B", "#F4A261", "#2A9D8F"];

  const DEFAULT_CUISINES = [
    { id: "c_jp", name: "Japanese", emoji: "🍣", enabled: true },
    { id: "c_it", name: "Italian", emoji: "🍝", enabled: true },
    { id: "c_th", name: "Thai", emoji: "🍜", enabled: true },
    { id: "c_kr", name: "Korean", emoji: "🍗", enabled: true },
    { id: "c_mx", name: "Mexican", emoji: "🌮", enabled: true },
    { id: "c_vn", name: "Vietnamese", emoji: "🥖", enabled: true },
    { id: "c_bg", name: "Burgers", emoji: "🍔", enabled: true },
    { id: "c_in", name: "Indian", emoji: "🍛", enabled: true },
    { id: "c_gr", name: "Greek", emoji: "🥙", enabled: true },
    { id: "c_me", name: "Middle Eastern", emoji: "🧆", enabled: true }
  ];

  const clone = (x) => JSON.parse(JSON.stringify(x));

  // --------------- Persistent config ---------------
  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const cfg = JSON.parse(raw);
      if (!Array.isArray(cfg.cuisines) || !cfg.cuisines.length) cfg.cuisines = clone(DEFAULT_CUISINES);
      return cfg;
    } catch (e) {
      return null;
    }
  }
  function saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) { /* storage may be unavailable (private mode) */ }
  }
  function defaultConfig() {
    return {
      partySize: 2,
      savedPlayers: ["Player 1", "Player 2"],
      vetoesEnabled: true,
      lastMode: "takeaway",
      cuisines: clone(DEFAULT_CUISINES)
    };
  }

  let config = loadConfig();

  // --------------- In-memory session ---------------
  const session = {
    mode: "takeaway",
    isSpinning: false,
    currentRotation: 0,
    winner: null,
    players: [],
    eliminatedCuisineIds: []
  };

  function initSessionFromConfig() {
    session.mode = config.lastMode || "takeaway";
    session.isSpinning = false;
    session.winner = null;
    session.eliminatedCuisineIds = [];
    session.players = config.savedPlayers.map((name, i) => ({ id: i, name: name || `Player ${i + 1}`, hasVetoed: false }));
  }

  // --------------- DOM refs ---------------
  const $ = (id) => document.getElementById(id);
  const app = $("app");
  const partyLine = $("partyLine");
  const chipRow = $("chipRow");
  const spinBtn = $("spinBtn");
  const spinHint = $("spinHint");
  const pointer = $("pointer");
  const canvas = $("wheel");
  const ctx = canvas.getContext("2d");

  const modeTakeaway = $("modeTakeaway");
  const modeDineIn = $("modeDineIn");
  const modeCookHome = $("modeCookHome");

  // Modals
  const partyModal = $("partyModal");
  const cuisineModal = $("cuisineModal");
  const resultModal = $("resultModal");

  // --------------- Helpers ---------------
  function triggerHaptic(ms = 12) {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* unsupported */ }
  }

  function activeCuisines() {
    return config.cuisines.filter(c => c.enabled && !session.eliminatedCuisineIds.includes(c.id));
  }

  function fireConfetti() {
    try {
      if (window.confetti) {
        window.confetti({ particleCount: 140, spread: 75, origin: { y: 0.35 }, colors: PALETTE });
      }
    } catch (e) { /* optional CDN */ }
  }

  // ================= Wheel rendering =================
  const TAU = Math.PI * 2;
  const POINTER_ANGLE = -Math.PI / 2; // top (270deg)

  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const size = Math.round(rect.width);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWheel();
  }

  function colorFor(index, total) {
    let c = PALETTE[index % PALETTE.length];
    // Ensure last slice doesn't match first (wrap-around neighbor)
    if (index === total - 1 && c === PALETTE[0] && total > 1) {
      c = PALETTE[(index + 1) % PALETTE.length];
    }
    return c;
  }

  function drawWheel() {
    const rect = canvas.getBoundingClientRect();
    const size = rect.width;
    const r = size / 2;
    ctx.clearRect(0, 0, size, size);

    const list = activeCuisines();
    const n = list.length;
    if (n === 0) {
      ctx.fillStyle = "#ECE6DC";
      ctx.beginPath();
      ctx.arc(r, r, r - 2, 0, TAU);
      ctx.fill();
      return;
    }

    const arc = TAU / n;
    for (let i = 0; i < n; i++) {
      const start = session.currentRotation + i * arc;
      const end = start + arc;
      ctx.beginPath();
      ctx.moveTo(r, r);
      ctx.arc(r, r, r - 2, start, end);
      ctx.closePath();
      ctx.fillStyle = colorFor(i, n);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.stroke();

      // Label
      const mid = start + arc / 2;
      ctx.save();
      ctx.translate(r, r);
      ctx.rotate(mid);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      const label = `${list[i].emoji} ${list[i].name}`;
      const fontSize = Math.max(11, Math.min(16, r * 0.11 - n * 0.3));
      ctx.font = `700 ${fontSize}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 2;
      // Truncate if too long
      let text = label;
      const maxW = r - 28;
      if (ctx.measureText(text).width > maxW) {
        while (text.length > 3 && ctx.measureText(text + "…").width > maxW) text = text.slice(0, -1);
        text += "…";
      }
      ctx.fillText(text, r - 14, 0);
      ctx.restore();
    }
  }

  // ================= Spin physics =================
  let spinVelocity = 0;
  let lastTickSlice = -1;

  function sliceAtPointer() {
    const list = activeCuisines();
    const n = list.length;
    if (!n) return { index: -1, list };
    const arc = TAU / n;
    // Angle at the pointer relative to wheel rotation
    let a = (POINTER_ANGLE - session.currentRotation) % TAU;
    if (a < 0) a += TAU;
    const index = Math.floor(a / arc) % n;
    return { index, list };
  }

  function startSpin() {
    if (session.isSpinning) return;
    const list = activeCuisines();
    if (list.length < 2) {
      // Edge case: single cuisine -> auto-declare
      if (list.length === 1) {
        session.winner = list[0];
        openResult();
      }
      return;
    }
    session.isSpinning = true;
    spinBtn.disabled = true;
    spinVelocity = 0.35 + Math.random() * 0.20; // 0.35–0.55
    lastTickSlice = sliceAtPointer().index;
    requestAnimationFrame(spinStep);
  }

  function spinStep() {
    session.currentRotation = (session.currentRotation + spinVelocity) % TAU;
    spinVelocity *= 0.978;

    // tick detection
    const cur = sliceAtPointer().index;
    if (cur !== lastTickSlice) {
      lastTickSlice = cur;
      triggerHaptic(10);
      pointer.classList.add("tick");
      setTimeout(() => pointer.classList.remove("tick"), 70);
    }

    drawWheel();

    if (spinVelocity < 0.004) {
      session.isSpinning = false;
      const { index, list } = sliceAtPointer();
      session.winner = list[index] || list[0];
      spinBtn.disabled = false;
      openResult();
      return;
    }
    requestAnimationFrame(spinStep);
  }

  // ================= Result modal =================
  function deepLinks(cuisine, mode) {
    const name = cuisine.name;
    const maps = mode === "takeaway"
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " takeaway")}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " restaurants near me")}`;
    const uber = `https://www.ubereats.com/search?q=${encodeURIComponent(name)}`;
    const recipe = `https://www.recipetineats.com/?s=${encodeURIComponent(name)}`;
    return { maps, uber, recipe };
  }

  function canStillVeto() {
    if (!config.vetoesEnabled) return false;
    if (activeCuisines().length <= 1) return false;
    return session.players.some(p => !p.hasVetoed);
  }

  function openResult() {
    const w = session.winner;
    if (!w) return;
    $("resultEmoji").textContent = w.emoji;
    $("resultName").textContent = w.name;

    const { maps, uber, recipe } = deepLinks(w, session.mode);
    const cookHome = session.mode === "cook_home";
    $("mapsLink").href = maps;
    $("mapsLink").classList.toggle("hidden", cookHome);
    const uberLink = $("uberLink");
    uberLink.href = uber;
    uberLink.classList.toggle("hidden", session.mode !== "takeaway");
    const recipeLink = $("recipeLink");
    recipeLink.href = recipe;
    recipeLink.classList.toggle("hidden", !cookHome);

    const vetoSection = $("vetoSection");
    const finalBanner = $("finalBanner");

    if (canStillVeto()) {
      vetoSection.classList.remove("hidden");
      finalBanner.hidden = true;
      renderVetoButtons();
    } else {
      vetoSection.classList.add("hidden");
      finalBanner.hidden = false;
      fireConfetti();
      triggerHaptic(60);
    }

    show(resultModal);
  }

  function renderVetoButtons() {
    const wrap = $("vetoBtns");
    wrap.innerHTML = "";
    session.players.filter(p => !p.hasVetoed).forEach(p => {
      const b = document.createElement("button");
      b.className = "btn-veto";
      b.textContent = `🙅 ${p.name} Vetoes`;
      b.addEventListener("click", () => executeVeto(p));
      wrap.appendChild(b);
    });
  }

  function executeVeto(player) {
    player.hasVetoed = true;
    if (session.winner) session.eliminatedCuisineIds.push(session.winner.id);
    triggerHaptic(20);
    hide(resultModal);
    renderChips();
    drawWheel();
    setTimeout(() => startSpin(), 400);
  }

  // ================= Veto chips =================
  function renderChips() {
    chipRow.innerHTML = "";
    if (!config.vetoesEnabled) {
      const c = document.createElement("span");
      c.className = "chip spent";
      c.textContent = "Sudden Death — No Vetoes";
      chipRow.appendChild(c);
      return;
    }
    session.players.forEach(p => {
      const c = document.createElement("span");
      c.className = "chip" + (p.hasVetoed ? " spent" : "");
      c.textContent = p.hasVetoed ? `❌ ${p.name}: Spent` : `🟢 ${p.name}: 1 Veto`;
      chipRow.appendChild(c);
    });
  }

  // ================= Header / party line =================
  function renderPartyLine() {
    const names = session.players.map(p => p.name);
    let text;
    if (names.length === 1) text = names[0];
    else if (names.length === 2) text = `${names[0]} & ${names[1]}`;
    else text = names.slice(0, -1).join(", ") + " & " + names[names.length - 1];
    partyLine.innerHTML = `Dining Tonight: ${escapeHtml(text)} <span aria-hidden="true">✏️</span>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ================= Spin availability =================
  function refreshSpinState() {
    const n = activeCuisines().length;
    const ok = n >= 2;
    spinBtn.disabled = !ok || session.isSpinning;
    spinHint.hidden = ok;
  }

  // ================= Mode toggle =================
  function setMode(mode) {
    session.mode = mode;
    config.lastMode = mode;
    saveConfig();
    modeTakeaway.classList.toggle("is-active", mode === "takeaway");
    modeDineIn.classList.toggle("is-active", mode === "dine_in");
    modeCookHome.classList.toggle("is-active", mode === "cook_home");
    modeTakeaway.setAttribute("aria-selected", mode === "takeaway");
    modeDineIn.setAttribute("aria-selected", mode === "dine_in");
    modeCookHome.setAttribute("aria-selected", mode === "cook_home");
  }

  // ================= Modal show/hide =================
  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }

  // ================= Party Setup Modal =================
  let draftPartySize = 2;
  let draftVetoes = true;

  function openPartyModal() {
    draftPartySize = config.partySize || 2;
    draftVetoes = config.vetoesEnabled;
    updatePartySizeSeg();
    updateVetoSeg();
    renderNameInputs();
    show(partyModal);
  }

  function updatePartySizeSeg() {
    document.querySelectorAll("#partySizeSeg .seg-btn").forEach(btn => {
      const size = Number(btn.dataset.size);
      // "3+" button represents sizes >= 3
      const active = (size === 3 && draftPartySize >= 3) || size === draftPartySize;
      btn.classList.toggle("is-active", active);
    });
  }

  function updateVetoSeg() {
    document.querySelectorAll("#vetoSeg .seg-btn").forEach(btn => {
      btn.classList.toggle("is-active", (btn.dataset.veto === "true") === draftVetoes);
    });
  }

  function renderNameInputs() {
    const wrap = $("nameInputs");
    wrap.innerHTML = "";
    const existing = config.savedPlayers || [];
    for (let i = 0; i < draftPartySize; i++) {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "text-input";
      input.placeholder = `Player ${i + 1} Name`;
      input.maxLength = 18;
      input.value = existing[i] && !/^Player \d+$/.test(existing[i]) ? existing[i] : "";
      input.dataset.idx = String(i);
      wrap.appendChild(input);
    }
  }

  function saveParty() {
    const inputs = [...document.querySelectorAll("#nameInputs .text-input")];
    const names = inputs.map((inp, i) => inp.value.trim() || `Player ${i + 1}`);
    config.partySize = draftPartySize;
    config.savedPlayers = names;
    config.vetoesEnabled = draftVetoes;
    saveConfig();
    initSessionFromConfig();
    hide(partyModal);
    renderAll();
  }

  // ================= Cuisine Customizer =================
  function openCuisineModal() {
    renderCuisineList();
    show(cuisineModal);
  }

  function renderCuisineList() {
    const list = $("cuisineList");
    list.innerHTML = "";
    config.cuisines.forEach(c => {
      const row = document.createElement("div");
      row.className = "cuisine-row";

      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = c.enabled;
      cb.addEventListener("change", () => {
        c.enabled = cb.checked;
        saveConfig();
        drawWheel();
        refreshSpinState();
      });
      const emoji = document.createElement("span");
      emoji.className = "emoji";
      emoji.textContent = c.emoji;
      const name = document.createElement("span");
      name.textContent = c.name;
      label.append(cb, emoji, name);
      row.appendChild(label);

      // Custom cuisines (id prefix "cx_") are deletable
      if (c.id.startsWith("cx_")) {
        const del = document.createElement("button");
        del.className = "del-btn";
        del.textContent = "🗑️";
        del.setAttribute("aria-label", `Delete ${c.name}`);
        del.addEventListener("click", () => {
          config.cuisines = config.cuisines.filter(x => x.id !== c.id);
          saveConfig();
          renderCuisineList();
          drawWheel();
          refreshSpinState();
        });
        row.appendChild(del);
      }
      list.appendChild(row);
    });
  }

  function firstEmoji(str) {
    const s = (str || "").trim();
    if (!s) return "";
    // Grab the first user-perceived character (handles ZWJ/flag/skin-tone
    // sequences as one glyph) so a pasted "🍕 pizza" yields just "🍕".
    try {
      if (typeof Intl !== "undefined" && Intl.Segmenter) {
        const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
        const first = seg.segment(s)[Symbol.iterator]().next().value;
        if (first) return first.segment.trim();
      }
    } catch (e) { /* fall through to code-point split */ }
    return [...s][0] || "";
  }

  function addCuisine() {
    const input = $("newCuisineName");
    const emojiInput = $("newCuisineEmoji");
    const name = input.value.trim();
    if (!name) return;
    const emoji = firstEmoji(emojiInput.value) || "🍽️";
    config.cuisines.push({
      id: "cx_" + Date.now().toString(36),
      name,
      emoji,
      enabled: true
    });
    input.value = "";
    emojiInput.value = "";
    saveConfig();
    renderCuisineList();
    drawWheel();
    refreshSpinState();
  }

  function restoreDefaults() {
    config.cuisines = clone(DEFAULT_CUISINES);
    session.eliminatedCuisineIds = [];
    saveConfig();
    renderCuisineList();
    drawWheel();
    refreshSpinState();
  }

  // ================= Reset session =================
  function resetSession() {
    session.eliminatedCuisineIds = [];
    session.players.forEach(p => (p.hasVetoed = false));
    session.winner = null;
    hide(resultModal);
    renderAll();
  }

  // ================= Render all =================
  function renderAll() {
    renderPartyLine();
    renderChips();
    setMode(session.mode);
    drawWheel();
    refreshSpinState();
  }

  // ================= Event wiring =================
  function wireEvents() {
    spinBtn.addEventListener("click", startSpin);
    $("hub").addEventListener("click", startSpin);

    modeTakeaway.addEventListener("click", () => setMode("takeaway"));
    modeDineIn.addEventListener("click", () => setMode("dine_in"));
    modeCookHome.addEventListener("click", () => setMode("cook_home"));

    $("btnParty").addEventListener("click", openPartyModal);
    $("btnCuisines").addEventListener("click", openCuisineModal);
    $("btnReset").addEventListener("click", resetSession);

    // Party modal
    document.querySelectorAll("#partySizeSeg .seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        draftPartySize = Number(btn.dataset.size);
        if (draftPartySize === 3) draftPartySize = Math.max(3, Math.min(6, config.partySize >= 3 ? config.partySize : 3));
        updatePartySizeSeg();
        renderNameInputs();
      });
    });
    document.querySelectorAll("#vetoSeg .seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        draftVetoes = btn.dataset.veto === "true";
        updateVetoSeg();
      });
    });
    $("savePartyBtn").addEventListener("click", saveParty);

    // Cuisine modal
    $("addCuisineBtn").addEventListener("click", addCuisine);
    $("newCuisineName").addEventListener("keydown", (e) => { if (e.key === "Enter") addCuisine(); });
    $("newCuisineEmoji").addEventListener("keydown", (e) => { if (e.key === "Enter") addCuisine(); });
    $("restoreDefaultsBtn").addEventListener("click", restoreDefaults);
    $("closeCuisineBtn").addEventListener("click", () => hide(cuisineModal));

    // Result modal
    $("closeResultBtn").addEventListener("click", () => hide(resultModal));

    // Close modals when tapping the dark overlay
    [partyModal, cuisineModal, resultModal].forEach(m => {
      m.addEventListener("click", (e) => { if (e.target === m) hide(m); });
    });

    window.addEventListener("resize", sizeCanvas);
    window.addEventListener("orientationchange", () => setTimeout(sizeCanvas, 150));
  }

  // ================= Boot =================
  function boot() {
    app.hidden = false;
    wireEvents();

    if (config && Array.isArray(config.savedPlayers) && config.savedPlayers.length) {
      initSessionFromConfig();
      sizeCanvas();
      renderAll();
    } else {
      config = defaultConfig();
      initSessionFromConfig();
      sizeCanvas();
      renderAll();
      openPartyModal();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
