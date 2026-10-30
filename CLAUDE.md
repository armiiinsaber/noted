# NOTED — project context for Claude Code

Voice-first PWA for musicians taking timestamped mix notes while listening to a bounce on rides/walks. **Standalone product** — the Melomaniac Labs numbering/attribution ("— 03 · Melomaniac Labs") was removed for 1.0; do not reintroduce it. Full spec lives in `CLAUDE-CODE-PROMPT.md`; `NOTED-REBRAND.md` is historical (design-token provenance and hosting plan only).

## Current state
`index.html` is a single-file app. Playback runs through an `<audio>` element on a blob URL, wired to `navigator.mediaSession` so the **headphone play/pause button IS the interface**: pause → mic starts and pins a note 3s back, play → transcript saves (if any) and the mix resumes. Web Audio is used only to decode waveform peaks. Notes/markers persist in `localStorage` keyed by track filename. Voice memo audio is in-session only (blob URL) — IndexedDB persistence is not yet wired.

## Hard rules
- **Hands-free pause-to-talk is the core interaction.** Playing = listening to the mix. Paused = mic on, recording. No in-between. Any pause after first play triggers the LISTENING overlay; any play saves the note (if non-empty) and resumes. Silence saves nothing. Never break this by adding a modal or an intermediate confirm step in the capture flow.
- Voice-first: never surface a keyboard in capture. A hidden edit affordance on saved notes is the only text-input surface.
- Persistence: notes/markers in `localStorage` under the `noted:` prefix (migration from legacy `mixride:` prefix is in place). Voice memos in IndexedDB is a TODO. **Do NOT use `window.storage`** — that was a sandbox API from an earlier environment and does not exist in real browsers.
- Playback goes through the `<audio>` element (blob URL) — NOT `AudioBufferSourceNode`. `MediaSession` action handlers `'play'` and `'pause'` must be set so headphone buttons and lock-screen controls work. First play still needs a user gesture on iOS.
- Target: iPhone Safari, installed via Add to Home Screen. Keep PWA meta tags, `manifest.json`, `sw.js` (bump `CACHE` on every shipped change) and the icon set (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.svg`, `favicon-32.png`, `artwork.png` for the lock screen card).

## Design system (1.0 rebrand, locked by the founder; do not deviate)
- Feel: a beautiful record player for artists, not a tech app. Tasteful, playful, minimal.
- Colour: **all chartreuse**. Every screen (landing, player, how it works, notes, overlays) uses chartreuse `#B8F06E` as the ground and near-black ink `#141310` for type, the mark, icons and the waveform. No black or dark green backgrounds anywhere. Secondary text is ink at 70%; ink at 30% only for marks that need not be read (unplayed waveform). Played waveform solid ink. Primary button: ink fill, chartreuse text.
- Mark: the wave line, one continuous rounded stroke (flat start, rise, deep dip, tall peak, settle to flat). No letters. Two cuts in `index.html`'s SVG sprite: `mark-master` for display sizes, `mark-compact` (shorter flats, heavier stroke) for 16 to 40px. Icon files are generated from the same paths.
- Type: **Bricolage Grotesque** (OFL), self-hosted at `fonts/bricolage-grotesque.woff2` with its licence. Everything uses it, with the optical size axis on. Two weights only: 400 and 600. Timecodes use tabular numbers. Wordmark is lowercase `noted 1.0`, fully opaque.
- Buttons and text: sentence case, few borders, few uppercase labels, more air.
- Copy: no em dashes, en dashes, or hyphens used as punctuation. Fewest words. Short plain sentences.
- Every multi-line heading or paragraph has lines of roughly equal length (`text-wrap: balance` plus tuned measures). A short trailing line is a bug; check at 390px and 320px.
- The session is one viewport (100dvh, body locked, safe areas respected); only the notes and queue lists scroll, and with a queue they share one region as tabs.
- No eyebrow / product numbering above the wordmark; noted is standalone.
- One bold element (the ink mic circle in the listening overlay / the Drop a note pill); everything else quiet.

## Definition of done
Deployed to `notedbymm.com` over HTTPS, installed to home screen, where pressing **pause on the headphone remote** immediately starts recognition and pressing **play** saves the transcript pinned to the moment before pause.
