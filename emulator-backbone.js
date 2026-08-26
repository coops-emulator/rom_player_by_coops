/**
 * emulator-backbone.js
 * ═══════════════════════════════════════════════════════════════════════
 * Vendored build of `coops_emulator_backbone` for ROM Player by Coops.
 * Source: https://github.com/coops-emulator (coops_emulator_backbone),
 * src/core-registry.js + src/rewind-profiles.js + src/emulator-engine.js,
 * concatenated and stripped of `import`/`export` so it can load as a
 * plain classic <script> alongside index.html's own non-module script
 * (no build step, matching the rest of this project). Logic is otherwise
 * unmodified from the source package — see that package's own README
 * and docs/CHANGELOG.md for the full history of what it fixed and why.
 *
 * ROM Player's own launch() previously hand-rolled EmulatorJS's `EJS_*`
 * globals directly. This backbone is what ROM Player itself now boots
 * through, wrapping the real, documented EmulatorJS loader instead.
 *
 * Exposes: window.CoopsEmulatorBackbone = {
 *   EmulatorEngine, DEFAULT_CDN_PATH,
 *   CORE_REGISTRY, getSystemConfig, detectSystemsByExtension, systemsRequiringThreads,
 *   REWIND_PROFILES, getRewindProfile,
 * }
 * ═══════════════════════════════════════════════════════════════════════
 */
(function (global) {
  "use strict";

  // ── core-registry.js ────────────────────────────────────────────────
  /**
   * Maps every console this engine supports to the "system" identifier
   * EmulatorJS's own loader.js expects as EJS_core.
   *
   * System identifiers were verified against:
   *   - https://emulatorjs.org/docs/systems/ (per-system embed examples)
   *   - https://cdn.emulatorjs.org/stable/data/cores/ (live core file listing)
   *   - https://emulatorjs.org/docs4devs/cores/ (core-to-system mapping table)
   * with a live re-check on 2026-08-12. See coops_emulator_backbone's
   * src/core-registry.js for the full provenance notes.
   */
  const CORE_REGISTRY = {
    nes:          { label: "NES",             system: "nes",         cores: ["nestopia", "fceumm"],       extensions: ["nes", "fds", "unf", "unif"], bios: null, verified: true },
    snes:         { label: "SNES",            system: "snes",        cores: ["snes9x", "bsnes"],           extensions: ["sfc", "smc"],                 bios: null, verified: true },
    gb:           { label: "Game Boy",        system: "gb",          cores: ["gambatte"],                  extensions: ["gb"],                          bios: null, verified: true },
    // NOTE: EmulatorJS has no separate "gbc" system id - GB and GBC ROMs
    // both boot through EJS_core = "gb" via the same gambatte/mgba cores
    // (verified against https://emulatorjs.org/docs/systems/nintendo-game-boy/).
    // system:"gbc" was an unverified guess that broke GBC boots. Fixed 2026-08-13.
    gbc:          { label: "Game Boy Color",  system: "gb",          cores: ["gambatte"],                  extensions: ["gbc"],                         bios: null, verified: true },
    gba:          { label: "GBA",             system: "gba",         cores: ["mgba"],                      extensions: ["gba"],                         bios: { required: false, file: "gba_bios.bin" }, verified: true },
    n64:          { label: "N64",             system: "n64",         cores: ["mupen64plus_next", "parallel_n64"], extensions: ["n64", "z64", "v64"],    bios: null, verified: true },
    genesis:      { label: "Genesis",         system: "segaMD",      cores: ["genesis_plus_gx"],           extensions: ["md", "gen", "bin", "smd"],     bios: null, verified: true },
    segaCD:       { label: "Sega CD",         system: "segaCD",      cores: ["genesis_plus_gx"],           extensions: ["cue", "chd", "iso"],           bios: { required: true, files: ["bios_CD_U.bin", "bios_CD_E.bin", "bios_CD_J.bin"] }, verified: true },
    sega32x:      { label: "Sega 32X",        system: "sega32x",     cores: ["picodrive"],                 extensions: ["32x"],                         bios: null, verified: true },
    saturn:       { label: "Saturn",          system: "segaSaturn",  cores: ["yabause"],                   extensions: ["cue", "chd", "iso"],           bios: { required: true, files: ["sega_101.bin", "mpr-17933.bin"] }, verified: true },
    gameGear:     { label: "Game Gear",       system: "segaGG",      cores: ["genesis_plus_gx"],           extensions: ["gg"],                          bios: null, verified: true },
    masterSystem: { label: "Master System",   system: "segaMS",      cores: ["smsplus", "genesis_plus_gx"], extensions: ["sms"],                        bios: null, verified: true },
    psx:          { label: "PS1",             system: "psx",         cores: ["mednafen_psx_hw", "pcsx_rearmed"], extensions: ["cue", "chd", "pbp", "iso"], bios: { required: false, files: ["scph5501.bin", "scph5500.bin", "scph5502.bin"] }, verified: true },
    psp:          { label: "PSP",             system: "psp",         cores: ["ppsspp"],                    extensions: ["iso", "cso", "pbp"],           bios: { required: false, file: "PPSSPP_BIOS.bin" }, verified: true, requiresThreads: true },
    nds:          { label: "NDS",             system: "nds",         cores: ["melonds", "desmume2015"],    extensions: ["nds"],                         bios: { required: false, files: ["bios7.bin", "bios9.bin", "firmware.bin"] }, verified: true },
    atari2600:    { label: "Atari 2600",      system: "atari2600",   cores: ["stella2014"],                extensions: ["a26", "bin"],                  bios: null, verified: true },
    atari7800:    { label: "Atari 7800",      system: "atari7800",   cores: ["prosystem"],                 extensions: ["a78", "bin"],                  bios: null, verified: true },
    lynx:         { label: "Atari Lynx",      system: "lynx",        cores: ["handy"],                     extensions: ["lnx"],                         bios: { required: false, file: "lynxboot.img" }, verified: true },
    pcEngine:     { label: "PC Engine",       system: "pce",         cores: ["mednafen_pce"],              extensions: ["pce", "cue"],                  bios: null, verified: true },
    neoGeoPocket: { label: "Neo Geo Pocket",  system: "ngp",         cores: ["mednafen_ngp"],              extensions: ["ngp", "ngc"],                  bios: null, verified: true },
    wonderswan:   { label: "WonderSwan",      system: "ws",          cores: ["mednafen_wswan"],            extensions: ["ws", "wsc"],                   bios: null, verified: true },
    coleco:       { label: "ColecoVision",    system: "coleco",      cores: ["gearcoleco"],                extensions: ["col"],                         bios: null, verified: true },
    threeDo:      { label: "3DO",             system: "3do",         cores: ["opera"],                     extensions: ["cue", "iso"],                  bios: { required: true, file: "panafz1.bin" }, verified: true },
    c64:          { label: "Commodore 64",    system: "c64",         cores: ["vice_x64sc"],                extensions: ["d64", "prg", "crt"],           bios: null, verified: true },
    arcade:       { label: "Arcade (FBNeo)",  system: "arcade",      cores: ["fbneo"],                     extensions: ["zip"],                         bios: null, verified: true },
    neogeo:       { label: "Neo Geo",         system: "arcade",      cores: ["fbneo"],                     extensions: ["zip"],                         bios: { required: true, file: "neogeo.zip" }, verified: true },
    // MSX intentionally omitted — the "bluemsx" core it used to map to no
    // longer exists in EmulatorJS's live core listing (verified 2026-08-12).
  };

  function getSystemConfig(systemId) {
    const cfg = CORE_REGISTRY[systemId];
    if (!cfg) throw new Error(`Unknown system id "${systemId}". Valid ids: ${Object.keys(CORE_REGISTRY).join(", ")}`);
    return cfg;
  }

  function detectSystemsByExtension(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    return Object.entries(CORE_REGISTRY)
      .filter(([, cfg]) => cfg.extensions.includes(ext))
      .map(([id]) => id);
  }

  function systemsRequiringThreads() {
    return Object.entries(CORE_REGISTRY)
      .filter(([, cfg]) => cfg.requiresThreads)
      .map(([id]) => id);
  }

  // ── rewind-profiles.js ──────────────────────────────────────────────
  // Ported directly from ROM Player by Coops's own production launch()
  // tuning (this file's counterpart is where those numbers originated).
  const REWIND_PROFILES = {
    psx:  { bufferSize: 512, granularity: 4 },
    n64:  { bufferSize: 256, granularity: 3 },
    gba:  { bufferSize: 256, granularity: 1 },
    snes: { bufferSize: 256, granularity: 1 },
    nes:  { bufferSize: 128, granularity: 1 },
    gb:   { bufferSize: 128, granularity: 1 },
    gbc:  { bufferSize: 128, granularity: 1 },
    genesis: { bufferSize: 128, granularity: 1 },
    // PSP: rewind is disabled outright, not just tuned down. Rewind works
    // by having the core serialize its FULL state — CPU + ALL of VRAM +
    // the texture cache — into the ring buffer every `granularity` frames.
    // ppsspp is already the heaviest core this app runs (single beta 3D
    // core, threaded, no other system here comes close to its per-frame
    // state size), so that periodic full-state snapshot lands as a
    // recurring hitch on top of the emulation itself — this shows up as
    // stutter/audio-crackle rather than an evenly slow game. No other
    // system pays anywhere near this tax. See loadGame() below for how
    // `disabled` is honored — it fully skips reserving/writing the
    // rewind buffer rather than just shrinking it.
    psp: { disabled: true },
    default: { bufferSize: 128, granularity: 2 },
  };

  function getRewindProfile(systemId) {
    return REWIND_PROFILES[systemId] || REWIND_PROFILES.default;
  }

  // ── boot-generation guard ───────────────────────────────────────────
  // FIX (2026-08-16): EmulatorJS is only designed to boot ONCE per page
  // load (see loadGame()'s own error message below). ROM Player is an SPA
  // — Back, then launch a different game, never does a full page reload —
  // so it's possible for a PREVIOUS game's loader.js/core download to
  // still be in flight when a new game starts booting. window.EJS_ready
  // and window.EJS_onGameStart are plain globals shared by every boot
  // attempt on the page (backbone path AND the legacy direct-EJS_* path
  // in index.html both write to the same globals). If that stale boot
  // finally finishes late, it calls whatever is CURRENTLY assigned to
  // window.EJS_ready/EJS_onGameStart — i.e. the NEW game's callbacks —
  // which hides the splash and marks the new session as started even
  // though the real emulator for the new ROM never finished booting.
  // Symptom: full player UI renders (badge, quick save/load, restart)
  // over a dead black canvas. Root cause, not a CORS/timeout issue, and
  // it can happen on ANY system - heavier cores (N64) just show it most
  // because they're more likely to still be mid-download when a player
  // gets impatient and backs out, or double-taps a game tile.
  //
  // Fix: a single shared generation counter. Every loadGame() call bumps
  // it and captures its own value; every EJS_* callback the engine wires
  // up is wrapped so it's a no-op if the generation has moved on by the
  // time it actually fires. destroy() also bumps it immediately, so
  // cleanup() reliably invalidates whatever boot was previously in
  // flight - even the legacy fallback path, which calls
  // CoopsEmulatorBackbone.guardCallback()/nextBootGeneration() directly
  // (see index.html's launch()/cleanup()) since it never goes through
  // EmulatorEngine at all.
  let _bootGeneration = 0;
  function nextBootGeneration() {
    return ++_bootGeneration;
  }
  function currentBootGeneration() {
    return _bootGeneration;
  }
  function guardCallback(fn) {
    const myGeneration = currentBootGeneration();
    return function guarded(...args) {
      if (myGeneration !== currentBootGeneration()) {
        console.warn(
          "[coops-emulator-backbone] Ignored a stale EJS callback from a superseded " +
          `boot (gen ${myGeneration} vs current ${currentBootGeneration()}). Expected if ` +
          "the player backed out or switched games while a previous one was still loading."
        );
        return;
      }
      return fn(...args);
    };
  }

  // ── emulator-engine.js ──────────────────────────────────────────────
  const DEFAULT_CDN_PATH = "https://cdn.emulatorjs.org/stable/data/";

  // Flat 45s was too tight for heavier cores on a cold CDN cache / slower
  // connection (independent of the boot-generation race above - a
  // legitimately slow download shouldn't be misreported as "unreachable
  // URL / bad system id"). Bumped per-system; light cores keep 45s.
  const BOOT_TIMEOUT_MS = {
    n64: 90000, psx: 75000, segaCD: 75000, saturn: 75000, threeDo: 75000,
    psp: 90000, nds: 60000, arcade: 60000, neogeo: 60000,
    default: 45000,
  };
  function resolveTimeout(systemId, opts) {
    if (opts.timeoutMs != null) return opts.timeoutMs;
    return BOOT_TIMEOUT_MS[systemId] || BOOT_TIMEOUT_MS.default;
  }
  // Exposed so callers (e.g. index.html's launch-splash safety timer) can
  // size their own "don't trap the user" fallback to at least as long as
  // the boot itself is legitimately allowed to take for this system —
  // otherwise a flat, system-agnostic safety timer shorter than a heavy
  // core's real timeout will force-hide a loading UI while a genuinely
  // still-loading game (not a stuck one) continues invisibly behind it.
  function getBootTimeout(systemId) {
    return BOOT_TIMEOUT_MS[systemId] || BOOT_TIMEOUT_MS.default;
  }

  class EmulatorEngine {
    constructor(container, opts = {}) {
      if (!container || container.nodeType !== 1) {
        throw new Error("EmulatorEngine requires a container DOM element (a <div>, not a <canvas>).");
      }
      this.container = container;
      this.pathToData = opts.pathToData || DEFAULT_CDN_PATH;
      this.systemId = null;
      this._booted = false;
      this._loaderInjected = false;
      this._objectUrls = [];
      this._pendingTimer = null;
      this._pendingReject = null;

      if (!this.container.id) {
        this.container.id = `emu-forge-player-${Math.random().toString(36).slice(2, 9)}`;
      }
    }

    static listSystems() {
      return Object.entries(CORE_REGISTRY).map(([id, cfg]) => ({ id, label: cfg.label, verified: cfg.verified }));
    }

    static detectSystem(filename) {
      return detectSystemsByExtension(filename);
    }

    async loadGame(systemId, rom, opts = {}) {
      if (this._booted) {
        throw new Error(
          "loadGame() was already called once on this EmulatorEngine instance. " +
          "EmulatorJS boots via a single loader.js include per page load. Create a " +
          "fresh container + EmulatorEngine (or reload the page) to load a different game."
        );
      }
      if (rom == null) {
        throw new Error("loadGame() needs a rom argument (a URL string, File, or Blob).");
      }

      const cfg = getSystemConfig(systemId);

      if (cfg.requiresThreads && typeof crossOriginIsolated !== "undefined" && !crossOriginIsolated) {
        throw new Error(
          `${cfg.label} requires SharedArrayBuffer, which requires this page to be served with ` +
          `Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp ` +
          `response headers (this is a real browser security requirement, not an EmulatorJS quirk). ` +
          `"crossOriginIsolated" is currently false. See deploy/ in coops_emulator_backbone for header ` +
          `configs that fix this.`
        );
      }

      if (cfg.bios?.required && !opts.biosUrl) {
        const files = cfg.bios.files || [cfg.bios.file];
        throw new Error(
          `${cfg.label} requires a BIOS file before it can boot (${files.join(" or ")}). ` +
          `Pass it as opts.biosUrl (a URL string, File, or Blob) to loadGame().`
        );
      }

      window.EJS_player = `#${this.container.id}`;
      window.EJS_core = opts.core || cfg.system;
      window.EJS_pathtodata = this.pathToData;
      window.EJS_gameUrl = this._toUrl(rom);
      if (opts.biosUrl) window.EJS_biosUrl = this._toUrl(opts.biosUrl);
      if (cfg.requiresThreads) window.EJS_threads = true;

      const gameName = opts.gameName || this._deriveGameName(rom);
      if (gameName) {
        window.EJS_gameName = gameName;
        window.EJS_gameID = gameName;
      }

      window.EJS_startOnLoaded = opts.startOnLoaded ?? true;

      if (opts.color) window.EJS_color = opts.color;
      if (opts.backgroundColor) window.EJS_backgroundColor = opts.backgroundColor;

      if (opts.rewind !== false) {
        const profile =
          opts.rewind && typeof opts.rewind === "object"
            ? { ...getRewindProfile(systemId), ...opts.rewind }
            : getRewindProfile(systemId);

        if (profile.disabled) {
          // System-level override (see REWIND_PROFILES, e.g. psp) — rewind
          // costs more than it's worth for this core. Explicitly tell EJS
          // it's off rather than just skipping the buffer-size/granularity
          // keys below: EJS_rewindEnabled and EJS_defaultOptions are plain
          // shared globals (same boot-generation-guard caveat as
          // onGameStart etc. above), so a PREVIOUS game's "enabled" value
          // must be actively overwritten here, not left alone, or it can
          // leak into this boot.
          window.EJS_rewindEnabled = false;
          window.EJS_defaultOptions = Object.assign(window.EJS_defaultOptions || {}, {
            rewind_enable: "disabled",
          });
        } else {
          window.EJS_rewindEnabled = true;
          window.EJS_rewindGranularity = profile.granularity;
          window.EJS_defaultOptions = Object.assign(window.EJS_defaultOptions || {}, {
            rewind_enable: "enabled",
            rewind_buffer_size: String(profile.bufferSize),
            rewind_granularity: String(profile.granularity),
          });
        }
      }

      if (opts.defaultOptions) {
        window.EJS_defaultOptions = Object.assign(window.EJS_defaultOptions || {}, opts.defaultOptions);
      }

      this.systemId = systemId;

      // Bump the shared boot generation FIRST, before touching any EJS_*
      // global. Anything a still-in-flight previous boot calls after this
      // point is provably stale and gets ignored by guardCallback() below.
      const myGeneration = nextBootGeneration();

      // Wire up onGameStart/onSaveState/onLoadState/onExit HERE, not in
      // their own on*() setter methods. Those setters are typically called
      // by the caller BEFORE loadGame() (see index.html's launch()) — if
      // guardCallback() wrapped them there, they'd capture whatever
      // generation was current at THAT point, which is one bump earlier
      // than myGeneration above. Every real, successful game start would
      // then look "stale" against the generation this loadGame() call
      // actually uses, and get silently dropped — which is exactly what
      // happened until this fix: onGameStart never fired through its real
      // path, only ever via the 12s splash safety-timer fallback, so the
      // loading overlay sat there for the full 12 seconds no matter how
      // fast the game had actually finished loading underneath it.
      // Wiring them here, right after the SAME bump everything else in
      // this loadGame() call uses, guarantees they can never mismatch.
      window.EJS_onGameStart = guardCallback(this._onGameStartFn || (() => {}));
      if (this._onSaveStateFn) window.EJS_onSaveState = guardCallback(this._onSaveStateFn);
      if (this._onLoadStateFn) window.EJS_onLoadState = guardCallback(this._onLoadStateFn);
      if (this._onExitFn) window.EJS_onExit = guardCallback(this._onExitFn);

      const timeoutMs = resolveTimeout(systemId, opts);
      const readyPromise = new Promise((resolve, reject) => {
        this._pendingReject = reject;
        const timer = setTimeout(() => {
          if (myGeneration !== currentBootGeneration()) return; // superseded — don't surface a stale error
          reject(new Error(
            `EJS_ready did not fire within ${timeoutMs}ms. Likely causes: the ROM/BIOS URL is ` +
            `unreachable, "${window.EJS_core}" isn't a real EmulatorJS system id for this pathToData ` +
            `version, or a CORS/network failure silently stalled the core download.`
          ));
        }, timeoutMs);
        this._pendingTimer = timer;
        window.EJS_ready = guardCallback(() => { clearTimeout(timer); resolve(); });
      });

      if (!this._loaderInjected) {
        this._loaderInjected = true;
        await this._injectScript(`${this.pathToData}loader.js`);
      }

      await readyPromise;
      this._booted = true;
      this._pendingTimer = null;
      this._pendingReject = null;
    }

    destroy() {
      // Invalidate any boot still in flight (from this instance, or an
      // earlier one this replaced) so a late window.EJS_ready/
      // EJS_onGameStart from it can't hijack whatever launches next.
      nextBootGeneration();
      if (this._pendingTimer) { clearTimeout(this._pendingTimer); this._pendingTimer = null; }
      if (this._pendingReject) {
        try { this._pendingReject(new Error("Superseded by a new game launch.")); } catch { /* best effort */ }
        this._pendingReject = null;
      }
      this.container.innerHTML = "";
      this._booted = false;
      for (const url of this._objectUrls) {
        try { URL.revokeObjectURL(url); } catch { /* best effort */ }
      }
      this._objectUrls = [];
    }

    _toUrl(rom) {
      if (typeof rom === "string") return rom;
      if (typeof Blob !== "undefined" && rom instanceof Blob) {
        const url = URL.createObjectURL(rom);
        this._objectUrls.push(url);
        return url;
      }
      throw new Error("rom/biosUrl must be a URL string, File, or Blob.");
    }

    _deriveGameName(rom) {
      if (typeof File !== "undefined" && rom instanceof File) return rom.name;
      if (typeof rom === "string") {
        try {
          const path = rom.startsWith("blob:") ? rom : new URL(rom, typeof location !== "undefined" ? location.href : "http://x").pathname;
          const last = path.split("/").filter(Boolean).pop();
          return last ? decodeURIComponent(last) : null;
        } catch {
          return null;
        }
      }
      return null;
    }

    _injectScript(src) {
      return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${src} - check pathToData / network / CORS.`));
        document.head.appendChild(s);
      });
    }

    onGameStart(fn) { this._onGameStartFn = fn; }
    onSaveState(fn) { this._onSaveStateFn = fn; }
    onLoadState(fn) { this._onLoadStateFn = fn; }
    onExit(fn) { this._onExitFn = fn; }

    getStateBytes() {
      this._assertBooted();
      return window.EJS_emulator.gameManager.getState();
    }

    loadStateBytes(bytes) {
      this._assertBooted();
      window.EJS_emulator.gameManager.loadState(bytes);
    }

    _assertBooted() {
      if (!this._booted || !window.EJS_emulator) {
        throw new Error("No game is booted yet - call loadGame() and await it first.");
      }
    }

    pause() { this._assertBooted(); window.EJS_emulator.pause?.(); }
    play() { this._assertBooted(); window.EJS_emulator.play?.(); }
    requestFullscreen() { this._assertBooted(); window.EJS_emulator.fullscreen?.(); }
  }

  global.CoopsEmulatorBackbone = {
    EmulatorEngine,
    DEFAULT_CDN_PATH,
    CORE_REGISTRY,
    getSystemConfig,
    detectSystemsByExtension,
    systemsRequiringThreads,
    REWIND_PROFILES,
    getRewindProfile,
    // Boot-generation guard, exported so index.html's legacy fallback path
    // (Virtual Boy/Intellivision/Vectrex/MSX — see launch()'s comment) can
    // protect its own direct window.EJS_* assignments with the SAME shared
    // counter EmulatorEngine uses. Both paths write to the same globals,
    // so both must invalidate through the same counter or a stale boot on
    // one path can still hijack a fresh boot on the other.
    guardCallback,
    nextBootGeneration,
    currentBootGeneration,
    getBootTimeout,
  };
})(window);
