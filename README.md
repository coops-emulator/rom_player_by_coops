[![Play Now](https://img.shields.io/badge/▶_Play_Now-romplayerbycoops.pages.dev-7c6af7?style=for-the-badge)](https://romplayerbycoops.pages.dev/)

*It's a PWA — open the link above, then use your browser's "Install" / "Add to Home Screen" prompt to get it as an app icon on desktop or mobile.*

# 🎮 ROM Player by Coops

A browser-based retro gaming PWA. Drop in a ROM, hit play — no installs, no extensions required.

🔗 **[romplayerbycoops.pages.dev](https://romplayerbycoops.pages.dev)**

---

## Supported Systems

| System | Notes |
|---|---|
| Nintendo NES | |
| Nintendo SNES | |
| Nintendo 64 | |
| Game Boy | |
| Game Boy Color | Color correction supported |
| Game Boy Advance | Color correction supported |
| Nintendo DS | BIOS optional |
| Virtual Boy | |
| PlayStation 1 | BIOS required |
| PlayStation Portable | BIOS optional |
| Sega Master System | |
| Sega Genesis / Mega Drive | |
| Sega CD | BIOS required |
| Sega Saturn | BIOS required |
| Sega 32X | |
| Sega Game Gear | |
| Neo Geo | |
| Neo Geo Pocket | |
| PC Engine / TurboGrafx-16 | |
| WonderSwan / WonderSwan Color | |
| Atari 2600 | |
| Atari Lynx | |
| ColecoVision | |
| Intellivision | |
| Vectrex | |
| MSX | |

---

## Features

**Core**
- Save states — save and load anytime
- Rewind — per-core tuned (PS1: 512MB buffer, GBA/SNES: 256MB)
- Cover art — auto-fetched via libretro thumbnail CDN
- Fullscreen — native + pseudo-fullscreen with iPhone notch support
- Gamepad support — plug in a controller and go
- Keyboard shortcuts — press `?` in-app for the cheat sheet
- Offline play — full PWA with service worker caching

**Library**
- ROM library with metadata stored in IndexedDB
- ROM binaries stored in OPFS for fast local access
- Playtime tracking and game history

**BIOS Management**
- Upload and store BIOS files locally (OPFS)
- Required: PS1, Sega CD, Saturn
- Optional: NDS, PSP

**Themes**
- Deep Space (default)
- NES, SNES, Game Boy, N64, Genesis, GBA, PS1

**Linkup Room**
- P2P File sharing between users via PeerJS
- No server — direct peer-to-peer

---

## Free vs Premium

| Feature | Free | Premium |
|---|---|---|
| Play ROMs | ✅ | ✅ |
| Save states | ✅ | ✅ |
| Rewind | ✅ | ✅ |
| Cover art | ✅ | ✅ |
| Linkup Room | ✅ | ✅ |
| Cloud save sync | ❌ | ✅ |
| Library sync across devices | ❌ | ✅ |
| Cloud ROM storage (Drive/Dropbox) | ❌ | ✅ |

Premium is **$3 AUD/month** — or by invite code.

---

## Tech Stack

- **[EmulatorJS](https://emulatorjs.org)** (libretro cores) — the actual emulation engine. All emulation happens here; ROM Player is a frontend around it.
- **[coops_emulator_backbone](https://github.com/coops-emulator/coops_emulator_backbone)** — our own wrapper around EmulatorJS (`emulator-backbone.js`), used to boot every system it covers. Replaced this app's previous hand-rolled `EJS_*` global wiring with a promise-based `loadGame()` API, a verified system-id registry, and actionable errors instead of silent black screens. Systems it doesn't cover yet (Virtual Boy, Intellivision, Vectrex, MSX) fall back to the original direct wiring.
- **PeerJS** — P2P ROM Exchange
- **Supabase** — auth + user profiles + premium status
- **Cloudflare Pages** — hosting + edge functions
- **IndexedDB + OPFS** — local ROM and save state storage
- **Service Worker** — offline support + PWA caching

---

## Credits

- **[EmulatorJS](https://emulatorjs.org)** does all the actual emulation (the libretro cores, the WASM runtime, the loader). ROM Player and coops_emulator_backbone are both just frontends around it — full credit to the EmulatorJS project and the libretro cores it bundles.
- **[coops_emulator_backbone](https://github.com/coops-emulator/coops_emulator_backbone)** is our own EmulatorJS wrapper, developed alongside this app; `emulator-backbone.js` in this repo is a vendored build of it.

---

## Deployment

```bash
# Stamp a new version and deploy
sh deploy.sh
```

Version timestamps are generated at deploy time (`YYYYMMDDHHMMSS` UTC) and written simultaneously to `index.html`, `sw.js`, and `version.json`. Never reuse an old timestamp — it will cause cache/update bugs.

---

## Notes

- ROM files are never uploaded to any server — everything stays on your device
- BIOS files are stored locally in OPFS, never transmitted
- Premium validation is handled server-side via Cloudflare Workers + Supabase

---

## Legal

ROM Player by Coops is an independent emulator project. It is not affiliated with, authorized, endorsed, or sponsored by Nintendo, Sony, Sega, SNK, Atari, NEC, Bandai, or any other hardware manufacturer or rights holder. All trademarks, system names, and brand names are the property of their respective owners.

ROM Player does not distribute, host, or facilitate the downloading of copyrighted ROM or BIOS files. Users are solely responsible for ensuring they have the legal right to use any software they load into the emulator.

This project is licensed under the [GNU General Public License v3.0](LICENSE).

---

*Built by [Coops](https://github.com/coops-emulator)*
