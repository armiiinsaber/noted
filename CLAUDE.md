# NOTED — project context for Claude Code

Voice-first PWA for musicians taking timestamped mix notes while listening to a bounce on rides/walks. Third product under **Melomaniac Labs**. Full spec lives in `CLAUDE-CODE-PROMPT.md`; brand/positioning in `NOTED-REBRAND.md` — read both before changing anything.

## Current state
`index.html` is a single-file app. Playback runs through an `<audio>` element on a blob URL, wired to `navigator.mediaSession` so the **headphone play/pause button IS the interface**: pause → mic starts and pins a note 3s back, play → transcript saves (if any) and the mix resumes. Web Audio is used only to decode waveform peaks. Notes/markers persist in `localStorage` keyed by track filename. Voice memo audio is in-session only (blob URL) — IndexedDB persistence is not yet wired.

## Hard rules
- **Hands-free pause-to-talk is the core interaction.** Playing = listening to the mix. Paused = mic on, recording. No in-between. Any pause after first play triggers the LISTENING overlay; any play saves the note (if non-empty) and resumes. Silence saves nothing. Never break this by adding a modal or an intermediate confirm step in the capture flow.
- Voice-first: never surface a keyboard in capture. A hidden edit affordance on saved notes is the only text-input surface.
- Persistence: notes/markers in `localStorage` under the `noted:` prefix (migration from legacy `mixride:` prefix is in place). Voice memos in IndexedDB is a TODO. **Do NOT use `window.storage`** — that was a sandbox API from an earlier environment and does not exist in real browsers.
- Playback goes through the `<audio>` element (blob URL) — NOT `AudioBufferSourceNode`. `MediaSession` action handlers `'play'` and `'pause'` must be set so headphone buttons and lock-screen controls work. First play still needs a user gesture on iOS.
- Target: iPhone Safari, installed via Add to Home Screen. Keep PWA meta tags; manifest + service worker + icons are still TODO.

## Design system (extracted from melomaniacstudios.com — do not deviate)
- Background `#080808`, text `#fff`, muted `rgba(255,255,255,.38)`, hairlines `rgba(255,255,255,.07)`.
- Single accent: **`#b8f06e`** (Melomaniac Labs chartreuse). White is secondary. No orange, brown, amber, or muted warm tones — the standalone-orange from earlier drafts was overridden by the rebrand.
- Fonts: **Bebas Neue** for the logotype and hero headline (via Google Fonts); **DM Mono** for body, labels, timecodes, tags.
- Header pattern: eyebrow `— 03 · Melomaniac Labs` above the product name in Bebas Neue, letter-spacing .22em.
- `text-wrap: balance` on headings/paragraphs/hints — no orphaned single words on a line.
- One bold element (the green mic circle in the listening overlay / Drop-a-note pill); everything else quiet.

## Definition of done
Deployed to `noted.melomaniacstudios.com` over HTTPS, installed to home screen, where pressing **pause on the headphone remote** immediately starts recognition and pressing **play** saves the transcript pinned to the moment before pause.
