/**
 * emulator-backbone.js
 * ═══════════════════════════════════════════════════════════════════════
 * Vendored build of `coops_emulator_backbone` v2.6.0 for ROM Player by Coops.
 * Source: https://github.com/coops-emulator (coops_emulator_backbone),
 * src/core-registry.js + src/rewind-profiles.js + src/emulator-engine.js,
 * concatenated and stripped of `import`/`export` so it can load as a
 * plain classic <script> alongside index.html's own non-module script
 * (no build step, matching the rest of this project). Logic is otherwise
 * unmodified from the source package — see that package's own README
 * and docs/CHANGELOG.md (v2.6.0 entry) for the full history of what it
 * fixed and why, including the PSP audio-grain root cause
 * (coreOptions.ppsspp_cpu_core) and the EJS_threads/EJS_defaultOptions
 * cross-instance leak fix.
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
   * core-registry.js
   * ---------------------------------------------------------------------------
   * Maps every console this engine supports to the "system" identifier
   * EmulatorJS's own loader.js expects as EJS_core.
   *
   * REWRITTEN FROM THE ORIGINAL VERSION OF THIS FILE. The original mapped each
   * system directly to a raw libretro core binary name (e.g. nes -> "fceumm")
   * and had core-loader.js try to fetch/boot that binary itself. That doesn't
   * match how EmulatorJS actually works: EJS_core takes a *system* identifier
   * (e.g. "nes"), and EmulatorJS's own loader.js internally picks the right
   * core binary, fetches it from the right CDN path, decompresses it, and
   * boots it - see emulator-engine.js's header comment for the full story of
   * why this project now wraps that real loader instead of reimplementing it.
   *
   * System identifiers below were verified against:
   *   - https://emulatorjs.org/docs/systems/ (per-system embed examples)
   *   - https://cdn.emulatorjs.org/stable/data/cores/ (live core file listing)
   *   - https://emulatorjs.org/docs4devs/cores/ (core-to-system mapping table)
   * as of the date this file was written, PLUS a live re-check on 2026-08-12
   * against https://cdn.emulatorjs.org/stable/data/cores/ (confirmed every
   * core file referenced below currently exists, and that "bluemsx" - which
   * appeared in EmulatorJS's changelog historically - no longer exists there,
   * confirming MSX's removal below is still correct) and
   * https://emulatorjs.org/docs/systems/arcade/ (confirmed `EJS_core =
   * "arcade"` directly, including that Neo Geo runs through the same
   * "arcade" system - the two entries below that used to be flagged
   * `verified: false` are now confirmed and marked `verified: true`).
   * EmulatorJS adds/renames systems over time (e.g. "mame2003" was renamed to
   * "mame") - if a system stops working, check those sources before assuming
   * this file is wrong.
   *
   * A `verified: false` entry (none remain as of the 2026-08-12 re-check)
   * would mean the exact identifier string couldn't be confirmed against an
   * official source - double check it against
   * https://emulatorjs.org/docs/systems/ before relying on it. Listing a
   * guess as if it were confirmed would be exactly the kind of unverified
   * claim this rewrite exists to fix.
   */

  const CORE_REGISTRY = {
    nes:          { label: "NES",             system: "nes",         cores: ["nestopia", "fceumm"],       extensions: ["nes", "fds", "unf", "unif"], bios: null, verified: true },
    snes:         { label: "SNES",            system: "snes",        cores: ["snes9x", "bsnes"],           extensions: ["sfc", "smc"],                 bios: null, verified: true },
    gb:           { label: "Game Boy",        system: "gb",          cores: ["gambatte"],                  extensions: ["gb"],                          bios: null, verified: true },
    // NOTE: EmulatorJS has no separate "gbc" system id. Verified against
    // https://emulatorjs.org/docs/systems/nintendo-game-boy/ (and the GB Color
    // BIOS section of EmulatorJS's own README) - GB and GBC ROMs both boot
    // through EJS_core = "gb" via the same gambatte/mgba cores; loader.js picks
    // GBC mode automatically off the ROM header. Setting system:"gbc" here was
    // an unverified guess that broke GBC boots (EJS_core="gbc" isn't a real
    // EmulatorJS system, so loader.js has nothing to fetch) - fixed 2026-08-13.
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
    // PSP coreOptions.ppsspp_cpu_core: closes the loop on the "minor residual
    // audio crackle" flagged as not-yet-investigated in cdn-channels.js's
    // header comment. Root cause, confirmed via PPSSPP's own upstream source
    // (hrydgard/ppsspp, libretro/libretro.cpp): g_Config.iCpuCore defaults to
    // CPUCore::INTERPRETER specifically "to allow startup in platforms w/o
    // JIT capability" - a safe-but-slow fallback, not the fast path. Verified
    // by directly shipping this in ROM Player by Coops and confirming with a
    // real user on real hardware (2026-09-09): switching PSP's in-player CPU
    // Core setting from the default IR JIT to plain JIT resolved persistent
    // audio grain during normal gameplay entirely - a genuine CPU-headroom
    // shortfall, not (only) the separate Chromium/Safari WebAudio bug also
    // documented for this core (EmulatorJS/EmulatorJS#739). ppsspp_cpu_core
    // is the standard libretro-style core variable name, same convention as
    // this app's own rewind_enable/rewind_buffer_size options - see
    // emulator-engine.js's loadGame() for how CORE_REGISTRY[id].coreOptions
    // gets merged into EJS_defaultOptions. Applied as a DEFAULT only: a
    // player who's already saved their own override for this option in their
    // browser keeps their own choice, this only fixes the starting point for
    // everyone else. NOTE: two other things were tried and explicitly
    // reverted before landing on this - see docs/CHANGELOG.md for why
    // EJS_forceLegacyCores is NOT used here (caused a hard "Outdated
    // graphics driver" boot failure on a real device, confirmed reproduced
    // twice, worse than the problem it was meant to fix).
    psp:          { label: "PSP",             system: "psp",         cores: ["ppsspp"],                    extensions: ["iso", "cso", "pbp"],           bios: { required: false, file: "PPSSPP_BIOS.bin" }, verified: true, requiresThreads: true, coreOptions: { ppsspp_cpu_core: "JIT" } },
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
    // Neo Geo cartridges specifically run through the arcade/FBNeo system in
    // EmulatorJS rather than having their own EJS_core value - use `arcade`
    // above and a Neo Geo-formatted ROM zip. Listed separately here only so
    // it shows up under its own name in a UI; both entries point at fbneo.
    neogeo:       { label: "Neo Geo",         system: "arcade",      cores: ["fbneo"],                     extensions: ["zip"],                         bios: { required: true, file: "neogeo.zip" }, verified: true },
    // MSX was in the previous version of this registry mapped to a "bluemsx"
    // core. That core does not appear in EmulatorJS's live core listing as of
    // this writing (confirmed against https://cdn.emulatorjs.org/stable/data/cores/)
    // so it's left out entirely rather than shipped as an unverified guess -
    // add it back once you've confirmed EmulatorJS actually supports it.
  };

  function getSystemConfig(systemId) {
    const cfg = CORE_REGISTRY[systemId];
    if (!cfg) throw new Error(`Unknown system id "${systemId}". Valid ids: ${Object.keys(CORE_REGISTRY).join(", ")}`);
    return cfg;
  }

  /** Guess a system id from a ROM's file extension. Ambiguous extensions (cue/bin/iso/zip) return all matches. */
  function detectSystemsByExtension(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    return Object.entries(CORE_REGISTRY)
      .filter(([, cfg]) => cfg.extensions.includes(ext))
      .map(([id]) => id);
  }

  /** Systems whose default core build requires SharedArrayBuffer (COOP/COEP headers). See README "Cross-origin isolation" section. */
  function systemsRequiringThreads() {
    return Object.entries(CORE_REGISTRY)
      .filter(([, cfg]) => cfg.requiresThreads)
      .map(([id]) => id);
  }

  // ── rewind-profiles.js ──────────────────────────────────────────────
  /**
   * rewind-profiles.js
   * ---------------------------------------------------------------------------
   * Per-system rewind buffer/granularity tuning. Ported directly from ROM
   * Player by Coops's own live `launch()` function (index.html) rather than
   * invented here - that's a real, working production app with actual users,
   * so its tuning numbers are proven, not guessed.
   *
   * Why this varies per system: EmulatorJS's rewind works by periodically
   * snapshotting full save states into an in-memory ring buffer. Save-state
   * size varies enormously by system - a PS1 state is a few MB, an NES state
   * is a few hundred KB - so a single fixed buffer size/granularity either
   * wastes memory on simple systems or barely covers a few seconds on
   * complex ones. These profiles size each system's buffer to its actual
   * state size instead.
   */

  // bufferSize is in MB (EJS_rewindGranularity + rewind_buffer_size retroarch
  // option), granularity is frames between snapshots (lower = smoother
  // rewind, more memory/CPU cost per second of rewind coverage).
  const REWIND_PROFILES = {
    psx:  { bufferSize: 512, granularity: 4 }, // large states, coarser snapshots
    n64:  { bufferSize: 256, granularity: 3 },
    gba:  { bufferSize: 256, granularity: 1 }, // tiny states, fine-grained
    snes: { bufferSize: 256, granularity: 1 },
    nes:  { bufferSize: 128, granularity: 1 },
    gb:   { bufferSize: 128, granularity: 1 },
    gbc:  { bufferSize: 128, granularity: 1 },
    genesis: { bufferSize: 128, granularity: 1 },
    // PSP: rewind is disabled outright, not tuned down like everything else
    // here. Rewind works by serializing the core's FULL state - CPU + ALL of
    // VRAM + the texture cache - into the ring buffer every `granularity`
    // frames. ppsspp is a threaded, WASM, no-native-JIT 3D core - already the
    // heaviest thing this wrapper boots - so that periodic full-state
    // snapshot lands as a recurring hitch on top of the emulation itself:
    // stutter and audio-crackle, not just an evenly slow game. Verified by
    // actually shipping this exact change in ROM Player by Coops (the
    // production app this wrapper's tuning is ported from) and confirming
    // via the in-game experience that disabling it removes the periodic
    // hitch. See emulator-engine.js's loadGame() for how `disabled` is
    // honored - it fully skips reserving/writing the rewind buffer rather
    // than just shrinking it.
    psp: { disabled: true },
    default: { bufferSize: 128, granularity: 2 },
  };

  function getRewindProfile(systemId) {
    return REWIND_PROFILES[systemId] || REWIND_PROFILES.default;
  }

  // ── emulator-engine.js ──────────────────────────────────────────────
  /**
   * emulator-engine.js
   * ---------------------------------------------------------------------------
   * REWRITTEN FROM THE ORIGINAL VERSION OF THIS ENGINE.
   *
   * What was wrong with the original, found by checking it against the real,
   * live EmulatorJS CDN and documentation rather than trusting its own
   * comments:
   *   1. fetch-cores.js downloaded from a GitHub `raw.githubusercontent.com`
   *      path that isn't where EmulatorJS actually publishes core builds -
   *      confirmed 404 by checking the real listing at
   *      https://cdn.emulatorjs.org/stable/data/cores/.
   *   2. core-loader.js assumed each core ships as a `<core>.js` + `<core>.wasm`
   *      pair with a guessable global Module factory. The real format is a
   *      single bundled `<core>-wasm.data` file, loaded through EmulatorJS's
   *      OWN loader.js/emulator.js - not a generic Emscripten script tag.
   *   3. Save states used synthetic RetroArch hotkey keypresses (F2/F4) as a
   *      proxy for a real API. There IS a real, documented API:
   *      `EJS_emulator.gameManager.getState()` / `.loadState(bytes)`. *   4. PSP's only available build (`ppsspp-thread-wasm.data`) requires
   *      SharedArrayBuffer, which requires COOP/COEP response headers on
   *      whatever serves this page - the original never surfaced this.
   *   5. (Found after a user reported games not loading at all) EJS_gameUrl
   *      was being set directly to a raw File object from a <input type=file>.
   *      Confirmed via a working reference implementation (react-emulatorjs's
   *      own documented example) that the reliable, version-independent way
   *      to hand EmulatorJS a local file is `URL.createObjectURL(file)` -
   *      EmulatorJS's changelog mentions raw File support was added at some
   *      point, but that's not something this wrapper can assume the pinned
   *      CDN version has. Fixed in `_toUrl()` below.
   *   6. (Found the same session) PSP needs `EJS_threads = true` set
   *      explicitly - confirmed against EmulatorJS's own official PSP docs
   *      example at emulatorjs.org/docs/systems/psp/. It is NOT inferred
   *      automatically from crossOriginIsolated being true. This wrapper
   *      never set it at all before this fix.
   *   7. (Found from a live console/network log showing a successful boot but
   *      a black, never-playing screen) EJS_gameName/EJS_gameID were never
   *      set, matching a "gameId is not set" console warning - blob: URLs
   *      carry no filename, and EmulatorJS's own demo sets EJS_gameName
   *      alongside EJS_gameUrl for exactly that reason. Fixed via
   *      `_deriveGameName()`.
   *   8. (Same log) The actual cause of the black screen: EJS_startOnLoaded
   *      was never set. EmulatorJS's own official demo sets it explicitly;
   *      without it, EmulatorJS finishes booting and waits rather than
   *      auto-starting. Now defaults to true.
   *   9. (Found in a single-page-app deployment that launches a new game
   *      without a full page reload) A previous game's loader.js/core
   *      download can still be in flight when a new game starts booting.
   *      window.EJS_ready/EJS_onGameStart are plain globals shared by every
   *      boot attempt, so a stale boot finishing late calls the NEW game's
   *      callbacks - full player UI renders over a dead black canvas, on any
   *      system, not just a timeout/CORS case. Fixed via a shared
   *      boot-generation counter (see the guard code right above this class)
   *      that makes every EJS_* callback a no-op once superseded. Also
   *      bumped the flat 45s boot timeout to a per-system BOOT_TIMEOUT_MS
   *      table - heavier cores were hitting that ceiling on a cold CDN
   *      cache even on a clean, non-superseded boot.
   *   10. (Found chasing a real "audio grain during normal gameplay, not just
   *      on save-state load" report on PSP - see rewind-profiles.js and
   *      cdn-channels.js's own comments for the earlier chapters of this
   *      same investigation) window.EJS_threads and window.EJS_defaultOptions
   *      are BOTH plain globals this class only ever set/merged INTO, never
   *      reset. A consumer that creates a fresh EmulatorEngine per game
   *      (the normal pattern for a single-page app that doesn't reload
   *      between games) could have a threaded/tuned PREVIOUS boot's values
   *      silently leak into a DIFFERENT, later instance's boot - e.g. a psp
   *      session's EJS_threads=true or ppsspp_cpu_core staying active for a
   *      totally unrelated nes boot afterward. Fixed by explicitly setting
   *      EJS_threads = !!cfg.requiresThreads (both branches, not just the
   *      true case) and resetting EJS_defaultOptions = {} at the top of
   *      every loadGame() call before anything conditionally adds to it.
   *      While chasing that same report, also added per-system
   *      cfg.coreOptions support (see core-registry.js's psp entry) after
   *      confirming, via PPSSPP's own upstream source, that it defaults to
   *      a slow CPU-core mode for startup safety on platforms without JIT -
   *      switching that default fixed the actual audio grain. Two OTHER
   *      things were tried first and explicitly reverted: forcing
   *      EJS_forceLegacyCores caused a hard "Outdated graphics driver" boot
   *      failure on a real device (reproduced twice, across two different
   *      devices - not a one-off), and disabling EmulatorJS's own core
   *      cache for PSP was a bandage for a symptom of that same bad idea,
   *      not a fix in its own right. Neither is used here. See
   *      docs/CHANGELOG.md for the full paper trail.
   *
   * This version doesn't reimplement any of that. It configures the real
   * `EJS_*` globals EmulatorJS's own loader.js reads, injects that real
   * loader.js from a real CDN path (or a self-hosted mirror of the same
   * files - see README "Self-hosting" section for exactly what to mirror),
   * and wraps the real, documented lifecycle hooks and save-state API.
   *
   * Honest limitation, stated plainly: EmulatorJS is designed to be
   * configured once and booted via a single loader.js include per page load.
   * This engine mirrors that - `loadGame()` is meant to be called once per
   * page. Swapping to a different ROM mid-session isn't something I could
   * find a documented, reliable public API for, so this doesn't claim to
   * support it; reload the page (or re-render the container in a framework
   * that remounts it) to load a different game.
   */

  const DEFAULT_CDN_PATH = "https://cdn.emulatorjs.org/stable/data/";

  // ── boot-generation guard ───────────────────────────────────────────────
  // FIX (2026-08-16): EmulatorJS is only designed to boot ONCE per page load
  // (see loadGame()'s own error message below). A single-page app that backs
  // out of a game and launches a different one without a full page reload
  // can leave a PREVIOUS game's loader.js/core download still in flight when
  // a new game starts booting. window.EJS_ready and window.EJS_onGameStart
  // are plain globals shared by every boot attempt on the page - if that
  // stale boot finally finishes late, it calls whatever is CURRENTLY
  // assigned to those globals (i.e. the NEW game's callbacks), which hides
  // a loading UI and marks the new session as started even though the real
  // emulator for the new ROM never finished booting. Symptom: a full player
  // UI renders over a dead black canvas. Root cause, not a CORS/timeout
  // issue, and it can happen on ANY system - heavier cores (N64, PSP) just
  // show it most because they're more likely to still be mid-download when
  // a player gets impatient and backs out, or double-taps a game tile.
  //
  // Fix: a single shared generation counter. Every loadGame() call bumps it
  // and captures its own value; every EJS_* callback this engine wires up is
  // wrapped so it's a no-op if the generation has moved on by the time it
  // actually fires. destroy() also bumps it immediately, so cleanup()
  // reliably invalidates whatever boot was previously in flight.
  //
  // guardCallback/nextBootGeneration/currentBootGeneration are exported so a
  // consumer that ALSO drives window.EJS_* directly for systems outside this
  // engine's registry (e.g. a legacy/manual boot path for a system this
  // library doesn't cover) can protect its own callbacks with the SAME
  // shared counter - both paths write to the same globals, so both must
  // invalidate through the same counter or a stale boot on one path can
  // still hijack a fresh boot on the other.
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

  /**
   * The boot timeout (ms) that loadGame() will use for a given system id
   * unless overridden via opts.timeoutMs - exported so a caller (e.g. a
   * loading-splash safety timer) can size its own "don't trap the user"
   * fallback to at least as long as the boot itself is legitimately allowed
   * to take for this system. A flat, system-agnostic safety timer shorter
   * than a heavy core's real timeout will force-hide a loading UI while a
   * genuinely still-loading (not stuck) game continues invisibly behind it.
   *
   * @param {string} systemId
   * @returns {number}
   */
  function getBootTimeout(systemId) {
    return BOOT_TIMEOUT_MS[systemId] || BOOT_TIMEOUT_MS.default;
  }

  class EmulatorEngine {
    /**
     * @param {HTMLElement} container - an empty element EmulatorJS will fill
     *   with its own canvas, controls, and virtual gamepad. NOT a <canvas> -
     *   EmulatorJS creates its own canvas internally; handing it a canvas
     *   directly isn't part of its documented contract.
     * @param {object} [opts]
     * @param {string} [opts.pathToData] - defaults to the real public CDN.
     *   Point this at a local `/data/` folder instead for self-hosting - see
     *   README for exactly which files that folder needs to contain.
     */
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

    /**
     * Boots EmulatorJS's real loader against a ROM. `rom` can be a URL string,
     * a Blob, or a File - EmulatorJS supports all three for EJS_gameUrl.
     *
     * @param {string} systemId - a key from core-registry.js (e.g. "nes")
     * @param {string|Blob|File} rom
     * @param {object} [opts]
     * @param {string|Blob|File} [opts.biosUrl] - required if cfg.bios.required is true
     * @param {string} [opts.core] - force a specific core from cfg.cores instead of EmulatorJS's default pick
     * @param {number} [opts.timeoutMs] - how long to wait for EJS_ready before rejecting.
     *   Defaults to a per-system value from BOOT_TIMEOUT_MS (see getBootTimeout) -
     *   heavier cores (N64, PSP, disc-based systems) get longer than the 45000ms
     *   baseline so a legitimately slow cold-cache download isn't misreported as
     *   a stuck boot.
     * @param {string} [opts.gameName] - overrides the auto-derived EJS_gameName/EJS_gameID.
     * @param {boolean} [opts.startOnLoaded=true] - auto-start vs EmulatorJS's own manual start UI.
     * @param {string} [opts.color] - EJS_color, EmulatorJS's accent color theming.
     * @param {string} [opts.backgroundColor] - EJS_backgroundColor.
     * @param {boolean|object} [opts.rewind=true] - true for the built-in per-system profile
     *   (see rewind-profiles.js, ported from ROM Player by Coops's own production tuning -
     *   note PSP's built-in profile disables rewind entirely; see that file's comment),
     *   false to disable, or `{ bufferSize, granularity }` to override.
     * @param {object} [opts.defaultOptions] - merged into EJS_defaultOptions (raw libretro
     *   retroarch cfg keys a core reads on startup) - use this for anything not covered
     *   by a dedicated option above. Applied LAST, after the registry's own per-system
     *   cfg.coreOptions (see core-registry.js, e.g. psp's ppsspp_cpu_core) and the rewind
     *   keys below, so this always wins if a key collides with either.
     */
    async loadGame(systemId, rom, opts = {}) {
      if (this._booted) {
        throw new Error(
          "loadGame() was already called once on this EmulatorEngine instance. " +
          "EmulatorJS boots via a single loader.js include per page load - see " +
          "this file's header comment. Create a fresh container + EmulatorEngine " +
          "(or reload the page) to load a different game."
        );
      }
      if (rom == null) {
        throw new Error("loadGame() needs a rom argument (a URL string, File, or Blob).");
      }

      const cfg = getSystemConfig(systemId);

      if (cfg.requiresThreads && typeof crossOriginIsolated !== "undefined" && !crossOriginIsolated) {
        throw new Error(
          `${cfg.label} requires SharedArrayBuffer, which requires this page to be served with ` +
          `Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: credentialless ` +
          `response headers (this is a real browser security requirement, not an EmulatorJS quirk). ` +
          `"crossOriginIsolated" is currently false. See deploy/ for ready-made header configs, ` +
          `and README "Cross-origin isolation" for the full explanation.`
        );
      }

      if (cfg.bios?.required && !opts.biosUrl) {
        const files = cfg.bios.files || [cfg.bios.file];
        throw new Error(
          `${cfg.label} requires a BIOS file before it can boot (${files.join(" or ")}). ` +
          `Pass it as opts.biosUrl (a URL string, File, or Blob) to loadGame(). ` +
          `This is checked here, before touching EmulatorJS, so the failure is immediate ` +
          `and actionable instead of a silent black screen.`
        );
      }

      window.EJS_player = `#${this.container.id}`;
      window.EJS_core = opts.core || cfg.system;
      window.EJS_pathtodata = this.pathToData;
      window.EJS_gameUrl = this._toUrl(rom);
      if (opts.biosUrl) window.EJS_biosUrl = this._toUrl(opts.biosUrl);
      // Per EmulatorJS's own PSP docs example (emulatorjs.org/docs/systems/psp/),
      // EJS_threads must be explicitly set to true for threaded cores - it's
      // not inferred automatically just because crossOriginIsolated is true.
      // Both branches set explicitly (not just `if (cfg.requiresThreads)
      // window.EJS_threads = true`): this is a plain global shared by every
      // EmulatorEngine instance on the page, so a PREVIOUS instance's
      // threaded boot (e.g. psp) would otherwise leave EJS_threads = true
      // silently active for a NEXT instance's non-threaded boot, since
      // nothing else on the page resets it - confirmed as a real gap, not
      // just theoretical, once EJS_defaultOptions below was found to have
      // the exact same leak shape.
      window.EJS_threads = !!cfg.requiresThreads;

      // Reset to a clean slate for THIS boot before anything below adds to
      // it. window.EJS_defaultOptions is a plain shared global (same caveat
      // as EJS_threads immediately above) that every path below only ever
      // merges INTO via Object.assign - with nothing clearing it first, a
      // PREVIOUS EmulatorEngine instance's options (rewind settings, per-
      // system coreOptions like psp's ppsspp_cpu_core) could silently leak
      // into a DIFFERENT instance's boot later in the same page session,
      // since a consumer typically creates a fresh EmulatorEngine per game
      // rather than reloading the page between them.
      window.EJS_defaultOptions = {};

      // Per-system core option defaults (see core-registry.js, e.g. psp's
      // ppsspp_cpu_core) - same libretro-style variable mechanism as the
      // rewind options below, just per-system rather than universal. Applied
      // as a DEFAULT: EmulatorJS only uses this as the starting value when
      // the player hasn't already saved their own override for this option
      // in their browser, so anyone who's manually tuned this themselves
      // keeps their own choice.
      if (cfg.coreOptions) {
        window.EJS_defaultOptions = Object.assign(window.EJS_defaultOptions, cfg.coreOptions);
      }

      // EmulatorJS's own official demo (github.com/EmulatorJS/demo) sets
      // EJS_gameName alongside EJS_gameUrl specifically because a blob: URL
      // (what _toUrl() produces for a File/Blob rom) carries no filename of
      // its own - without this, EmulatorJS falls back to a generic name for
      // save-state keys/localStorage, which is exactly the "gameId is not
      // set" console warning. EJS_gameID's exact required format isn't fully
      // documented beyond being listed under "Game Options" in
      // emulatorjs.org/docs/options/, so this sets it to the same derived
      // name as a reasonable, safe default.
      const gameName = opts.gameName || this._deriveGameName(rom);
      if (gameName) {
        window.EJS_gameName = gameName;
        window.EJS_gameID = gameName;
      }

      // Confirmed against EmulatorJS's own official demo source
      // (github.com/EmulatorJS/demo/blob/main/index.html), which sets this
      // explicitly. Without it, EmulatorJS finishes booting (EJS_ready fires,
      // the core is loaded) but sits idle rather than auto-starting the game -
      // this was the actual cause of a "everything loads but the screen stays
      // black" report, distinct from and after the loading bugs fixed above.
      window.EJS_startOnLoaded = opts.startOnLoaded ?? true;

      // Theming - both are plain EmulatorJS options, passed through as-is.
      if (opts.color) window.EJS_color = opts.color;
      if (opts.backgroundColor) window.EJS_backgroundColor = opts.backgroundColor;

      // Rewind - defaults to the built-in per-system profile (see
      // rewind-profiles.js) rather than EmulatorJS's own one-size-fits-all
      // default, because save-state size varies enormously by system (a PS1
      // state is MBs, an NES state is KBs) - ROM Player by Coops's own live
      // production tuning is what these profiles are ported from.
      if (opts.rewind !== false) {
        const profile =
          opts.rewind && typeof opts.rewind === "object"
            ? { ...getRewindProfile(systemId), ...opts.rewind }
            : getRewindProfile(systemId);

        if (profile.disabled) {
          // System-level override (see rewind-profiles.js, e.g. psp) - rewind
          // costs more than it's worth for this core. Set EJS_rewindEnabled
          // to false explicitly rather than just skipping the buffer-size/
          // granularity keys below, since these are plain globals this
          // wrapper writes to directly - leaving them untouched wouldn't
          // reliably mean "off" if anything upstream ever defaults them on.
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

      // Bump the shared boot generation FIRST, before touching any of the
      // EJS_on*/EJS_ready globals below. Anything a still-in-flight previous
      // boot calls after this point is provably stale and gets ignored by
      // guardCallback() - see this file's boot-generation guard comment above
      // this class for the full story.
      const myGeneration = nextBootGeneration();

      // Wired here, not in onGameStart()/onSaveState()/etc. themselves - those
      // setters are typically called by the caller BEFORE loadGame(). Wrapping
      // them there would capture whatever generation was current at THAT
      // point, one bump earlier than myGeneration above, which would make
      // every real, successful game start look "stale" against the
      // generation this loadGame() call actually uses and get silently
      // dropped.
      window.EJS_onGameStart = guardCallback(this._onGameStartFn || (() => {}));
      if (this._onSaveStateFn) window.EJS_onSaveState = guardCallback(this._onSaveStateFn);
      if (this._onLoadStateFn) window.EJS_onLoadState = guardCallback(this._onLoadStateFn);
      if (this._onExitFn) window.EJS_onExit = guardCallback(this._onExitFn);

      const timeoutMs = resolveTimeout(systemId, opts);
      const readyPromise = new Promise((resolve, reject) => {
        this._pendingReject = reject;
        const timer = setTimeout(() => {
          if (myGeneration !== currentBootGeneration()) return; // superseded - don't surface a stale error
          reject(new Error(
            `EJS_ready did not fire within ${timeoutMs}ms. Likely causes: the ROM/BIOS URL is ` +
            `unreachable, "${window.EJS_core}" isn't a real EmulatorJS system id for this pathToData ` +
            `version, or a CORS/network failure silently stalled the core download. Open devtools' ` +
            `Network tab and look for failed requests under pathToData for the actual cause.`
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

    /**
     * Best-effort teardown. Stated honestly: EmulatorJS's real, documented
     * contract is "one loader.js per page load" (see this file's header
     * comment) - there is no public API confirmed to fully unwind a booted
     * instance. This removes what's safely removable (the container's
     * contents and this wrapper's own global hooks) so a container can be
     * hidden/unmounted without leaking obvious DOM, but does NOT claim the
     * underlying WASM instance/audio context are fully released - reloading
     * the page is still the only fully-clean way to load a second game.
     *
     * I deliberately do NOT call any EJS_emulator method here beyond what's
     * confirmed in this file's header comment (getState/loadState). I could
     * not verify a public "shut down cleanly" method exists, and calling an
     * unverified method name would be exactly the kind of unconfirmed claim
     * this rewrite exists to eliminate - so this only touches things this
     * wrapper itself owns: the DOM it was given and its own state flag.
     */
    destroy() {
      // Invalidate any boot still in flight (from this instance, or an
      // earlier one this replaced) so a late window.EJS_ready/EJS_onGameStart
      // from it can't hijack whatever launches next - see this file's
      // boot-generation guard comment above the class.
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

    /**
     * Normalizes a rom/bios argument into a real URL string EJS_gameUrl /
     * EJS_biosUrl can reliably fetch, regardless of which EmulatorJS version
     * is pinned. File/Blob support was added to EmulatorJS at some point per
     * its changelog, but I can't confirm every pathToData version has it -
     * converting to a real object URL via URL.createObjectURL() works on
     * every version, since it's just a URL by the time EmulatorJS sees it.
     * Object URLs created here are revoked in destroy().
     */
    _toUrl(rom) {
      if (typeof rom === "string") return rom;
      if (typeof Blob !== "undefined" && rom instanceof Blob) {
        const url = URL.createObjectURL(rom);
        this._objectUrls.push(url);
        return url;
      }
      throw new Error("rom/biosUrl must be a URL string, File, or Blob.");
    }

    /**
     * Derives a filename-based game name for EJS_gameName/EJS_gameID.
     * File objects carry a real `.name` (e.g. "Super Mario Bros.nes"); plain
     * Blobs and URL strings don't, so this falls back to the last path
     * segment of a URL, or null for a nameless Blob (EmulatorJS will use its
     * own generic fallback in that case - there's nothing more specific to
     * give it).
     */
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

    // ---- lifecycle hooks (wrap the real EJS_on* globals) ---------------------

    // Stored, not wired to window.EJS_on* directly - loadGame() wires them
    // through guardCallback() at boot time, once it knows this call's own
    // generation number. See this file's boot-generation guard comment
    // above the class for why that has to happen there, not here.
    onGameStart(fn) { this._onGameStartFn = fn; }
    onSaveState(fn) { this._onSaveStateFn = fn; }
    onLoadState(fn) { this._onLoadStateFn = fn; }
    onExit(fn) { this._onExitFn = fn; }

    // ---- save states: the real EJS_emulator.gameManager API ------------------
    // NOTE: EJS_emulator.gameManager.getState() returns a Uint8Array
    // synchronously as of the version documented at the top of this file
    // (older EmulatorJS releases returned a Promise - if you're pinned to an
    // old version, await the return value defensively).

    /** @returns {Uint8Array} raw save-state bytes, for you to persist however you like. */
    getStateBytes() {
      this._assertBooted();
      return window.EJS_emulator.gameManager.getState();
    }

    /** @param {Uint8Array} bytes - previously returned by getStateBytes(). */
    loadStateBytes(bytes) {
      this._assertBooted();
      window.EJS_emulator.gameManager.loadState(bytes);
    }

    _assertBooted() {
      if (!this._booted || !window.EJS_emulator) {
        throw new Error("No game is booted yet - call loadGame() and await it first.");
      }
    }

    // ---- convenience passthroughs to real EJS_emulator methods --------------

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
