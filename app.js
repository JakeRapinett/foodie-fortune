/* ================= Foodie Fortune — app.js ================= */
(() => {
  "use strict";

  const STORAGE_KEY = "foodie_fortune_v1";

  // Wheel/confetti palette — read live from the active theme's CSS variables
  // so a theme switch recolours the wheel in one place.
  const PALETTE_VARS = ["--terracotta", "--sage", "--mustard", "--slate", "--coral", "--teal"];
  const PALETTE_FALLBACK = ["#E07A5F", "#81B29A", "#F2CC8F", "#3D405B", "#F4A261", "#2A9D8F"];
  function palette() {
    try {
      const cs = getComputedStyle(document.documentElement);
      const out = PALETTE_VARS.map(v => (cs.getPropertyValue(v) || "").trim());
      if (out.every(Boolean)) return out;
    } catch (e) { /* fall through */ }
    return PALETTE_FALLBACK;
  }

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

  // ================= Themes (palette via CSS data-theme + copy below) =================
  const THEME_IDS = ["classic", "party", "games"];
  const THEMES = {
    classic: {
      partyLinePrefix: "Dining Tonight",
      modeTakeaway: "🛋️ Takeaway",
      modeDineIn: "🍽️ Dine-In",
      modeCookHome: "🧑‍🍳 Cook In",
      spinBtn: "🎲 SPIN THE WHEEL",
      resultKicker: "🎉 THE WHEEL HAS SPOKEN!",
      vetoPrompt: "Not feeling it? Spend a veto:",
      vetoBtn: (name) => `🙅 ${name} Vetoes`,
      finalBanner: "🔒 No Vetoes Left — The Wheel's Decision is Final!",
      chipReady: (name) => `🟢 ${name}: 1 Veto`,
      chipSpent: (name) => `❌ ${name}: Spent`,
      suddenDeath: "Sudden Death — No Vetoes",
      vetoesLabel: "Vetoes Left:",
      partyTitle: "Who's Eating? 🍴",
      saveParty: "Let's Eat 🎲",
      menuTitle: "Tonight's Menu ⚙️"
    },
    party: {
      partyLinePrefix: "Tonight's Feast",
      modeTakeaway: "🎁 Delivery",
      modeDineIn: "🥂 Go Out",
      modeCookHome: "🍳 Home Feast",
      spinBtn: "🎉 SPIN TO FEAST",
      resultKicker: "🥳 THE FEAST IS SET!",
      vetoPrompt: "Not vibing? Use a reroll:",
      vetoBtn: (name) => `🙅 ${name} Rerolls`,
      finalBanner: "🔒 No Rerolls Left — The Feast is Locked In!",
      chipReady: (name) => `🟢 ${name}: 1 Reroll`,
      chipSpent: (name) => `❌ ${name}: Spent`,
      suddenDeath: "Sudden Death — No Rerolls",
      vetoesLabel: "Rerolls Left:",
      partyTitle: "Who's Partying? 🎉",
      saveParty: "Let's Party 🎉",
      menuTitle: "Tonight's Spread ⚙️"
    },
    games: {
      partyLinePrefix: "The Party",
      modeTakeaway: "🛖 Provisions",
      modeDineIn: "🏰 Venture Out",
      modeCookHome: "🔥 Cook Rations",
      spinBtn: "🎲 ROLL FOR DINNER",
      resultKicker: "⚔️ THE DICE DECREE!",
      vetoPrompt: "Reject the quest? Spend a reroll:",
      vetoBtn: (name) => `🎲 ${name} Rerolls`,
      finalBanner: "🔒 No Rerolls Left — The Dice Are Cast!",
      chipReady: (name) => `🎲 ${name}: 1 Reroll`,
      chipSpent: (name) => `💀 ${name}: Spent`,
      suddenDeath: "Sudden Death — No Rerolls",
      vetoesLabel: "Rerolls Left:",
      partyTitle: "Gather the Party 🎲",
      saveParty: "Begin the Quest 🎲",
      menuTitle: "The Provisions ⚙️"
    }
  };
  function currentTheme() {
    return THEMES[config && THEME_IDS.includes(config.theme) ? config.theme : "classic"];
  }

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
      theme: "classic",
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
  const themeModal = $("themeModal");

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
        window.confetti({ particleCount: 140, spread: 75, origin: { y: 0.35 }, colors: palette() });
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
    const pal = palette();
    let c = pal[index % pal.length];
    // Ensure last slice doesn't match first (wrap-around neighbor)
    if (index === total - 1 && c === pal[0] && total > 1) {
      c = pal[(index + 1) % pal.length];
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
      try {
        ctx.fillStyle = (getComputedStyle(document.documentElement).getPropertyValue("--line") || "#ECE6DC").trim() || "#ECE6DC";
      } catch (e) { ctx.fillStyle = "#ECE6DC"; }
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
      b.textContent = currentTheme().vetoBtn(p.name);
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
    const t = currentTheme();
    chipRow.innerHTML = "";
    if (!config.vetoesEnabled) {
      const c = document.createElement("span");
      c.className = "chip spent";
      c.textContent = t.suddenDeath;
      chipRow.appendChild(c);
      return;
    }
    session.players.forEach(p => {
      const c = document.createElement("span");
      c.className = "chip" + (p.hasVetoed ? " spent" : "");
      c.textContent = p.hasVetoed ? t.chipSpent(p.name) : t.chipReady(p.name);
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
    partyLine.innerHTML = `${escapeHtml(currentTheme().partyLinePrefix)}: ${escapeHtml(text)}`;
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

  // ================= Theme =================
  function applyTheme() {
    const id = config && THEME_IDS.includes(config.theme) ? config.theme : "classic";
    const t = THEMES[id];
    document.documentElement.setAttribute("data-theme", id);

    // Static labels
    modeTakeaway.textContent = t.modeTakeaway;
    modeDineIn.textContent = t.modeDineIn;
    modeCookHome.textContent = t.modeCookHome;
    spinBtn.textContent = t.spinBtn;
    $("resultKicker").textContent = t.resultKicker;
    $("vetoPrompt").textContent = t.vetoPrompt;
    $("finalBanner").textContent = t.finalBanner;
    $("vetoesLabel").textContent = t.vetoesLabel;
    $("partyTitle").textContent = t.partyTitle;
    $("savePartyBtn").textContent = t.saveParty;
    $("cuisineTitle").textContent = t.menuTitle;

    // Reflect selection in the theme picker
    document.querySelectorAll("#themeList .theme-card").forEach(card => {
      const active = card.dataset.themeId === id;
      card.classList.toggle("is-active", active);
      card.setAttribute("aria-checked", active ? "true" : "false");
    });

    // Dynamic strings + wheel colours
    renderPartyLine();
    renderChips();
    drawWheel();
  }

  function setTheme(id) {
    if (!THEME_IDS.includes(id)) return;
    config.theme = id;
    saveConfig();
    applyTheme();
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
  const MAX_PLAYERS = 6;
  let draftPartySize = 2;
  let draftVetoes = true;
  let draftNames = []; // live names while the modal is open (survives add/remove re-renders)

  function openPartyModal() {
    draftPartySize = config.partySize || 2;
    draftVetoes = config.vetoesEnabled;
    // Seed editable drafts from saved names, blanking the generic "Player N" placeholders
    draftNames = Array.from({ length: draftPartySize }, (_, i) => {
      const n = (config.savedPlayers || [])[i];
      return n && !/^Player \d+$/.test(n) ? n : "";
    });
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

  // Read current input values back into draftNames so they survive a re-render
  function readNameInputs() {
    document.querySelectorAll("#nameInputs .text-input").forEach(inp => {
      const i = Number(inp.dataset.idx);
      if (!Number.isNaN(i)) draftNames[i] = inp.value;
    });
  }

  // Keep draftNames length aligned with draftPartySize
  function syncDraftNames() {
    readNameInputs();
    if (draftNames.length < draftPartySize) {
      while (draftNames.length < draftPartySize) draftNames.push("");
    } else if (draftNames.length > draftPartySize) {
      draftNames.length = draftPartySize;
    }
  }

  function renderNameInputs() {
    const wrap = $("nameInputs");
    wrap.innerHTML = "";
    const isGroup = draftPartySize >= 3;
    for (let i = 0; i < draftPartySize; i++) {
      const row = document.createElement("div");
      row.className = "name-row";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "text-input";
      input.placeholder = `Player ${i + 1} Name`;
      input.maxLength = 18;
      input.value = draftNames[i] || "";
      input.dataset.idx = String(i);
      row.appendChild(input);

      // In group mode, allow removing any row below the 2-player floor
      if (isGroup && draftPartySize > 2) {
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "name-remove";
        rm.setAttribute("aria-label", `Remove player ${i + 1}`);
        rm.textContent = "✕";
        rm.addEventListener("click", () => {
          readNameInputs();
          draftNames.splice(i, 1);
          draftPartySize = draftNames.length;
          updatePartySizeSeg();
          renderNameInputs();
        });
        row.appendChild(rm);
      }
      wrap.appendChild(row);
    }

    // "Add player" button for group mode, up to the max
    if (isGroup && draftPartySize < MAX_PLAYERS) {
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "add-player-btn";
      addBtn.textContent = "+ Add player";
      addBtn.addEventListener("click", () => {
        readNameInputs();
        draftNames.push("");
        draftPartySize = draftNames.length;
        updatePartySizeSeg();
        renderNameInputs();
      });
      wrap.appendChild(addBtn);
    } else if (isGroup && draftPartySize >= MAX_PLAYERS) {
      const note = document.createElement("p");
      note.className = "party-max-note";
      note.textContent = `Max ${MAX_PLAYERS} players`;
      wrap.appendChild(note);
    }
  }

  function saveParty() {
    readNameInputs();
    const names = draftNames.slice(0, draftPartySize).map((n, i) => (n || "").trim() || `Player ${i + 1}`);
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
    applyTheme();     // sets data-theme, all labels, party line, chips, and wheel colours
    setMode(session.mode);
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
    $("btnTheme").addEventListener("click", () => show(themeModal));
    $("btnReset").addEventListener("click", resetSession);

    // Theme modal
    document.querySelectorAll("#themeList .theme-card").forEach(card => {
      card.addEventListener("click", () => setTheme(card.dataset.themeId));
    });
    $("closeThemeBtn").addEventListener("click", () => hide(themeModal));

    // Party modal
    document.querySelectorAll("#partySizeSeg .seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        draftPartySize = Number(btn.dataset.size);
        if (draftPartySize === 3) draftPartySize = Math.max(3, Math.min(MAX_PLAYERS, config.partySize >= 3 ? config.partySize : 3));
        syncDraftNames();
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
    [partyModal, cuisineModal, resultModal, themeModal].forEach(m => {
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
