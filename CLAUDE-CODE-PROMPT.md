# CLAUDE CODE PROMPT — copy everything below this line

Build me a production-ready, voice-first iPhone web app called **NOTED** for musicians finalizing mixes. I'll deploy it to a real URL (Netlify/GitHub Pages) and install it via Add to Home Screen, so build it as a proper PWA.

## The product and workflow

I'm a musician. When finalizing a mix/master, I export the bounce to my phone, then listen on bike rides, car rides, and walks. While listening I notice things to fix — "bring the vocal up 1dB," "snare too bright," "cut the pad here." Today I lose these notes or fumble with my Notes app. NOTED fixes this:

1. I load the audio file (MP3/M4A/WAV/AIFF/FLAC) from my Files app
2. I press play once (on-screen) and put my phone away
3. From now on, my headphone remote IS the interface:
   - **Pause on the remote** → the mix pauses, the mic starts recording immediately, and a pin lands 3 seconds before the pause point
   - I just talk
   - **Play on the remote** → my spoken note saves to that timestamp and the mix resumes
   - If I paused and said nothing, nothing is saved
4. Later at my DAW, I see all notes sorted by time, check them off as I fix them, and can export the list as text

## NON-NEGOTIABLE: hands-free pause-to-talk

Voice capture is the entire point of this app, and the headphone play/pause button is the only control I use during a listening session. The flow is **pause → talk → play**. NO screen taps, NO keyboard, NO typing flow, NO intermediate save button.

- Playback runs through an `<audio>` element on a blob URL (needed so MediaSession → hardware buttons work). Web Audio is used only to decode waveform peaks.
- Wire `navigator.mediaSession.setActionHandler('play', ...)` and `('pause', ...)`. Also set `MediaSession` metadata with the track title so the lock screen shows it.
- The `<audio>` element's `'pause'` event drives the state machine: enter LISTENING, pin the timestamp at `Math.max(0, currentTime - 3)`, start `webkitSpeechRecognition`, show a full-screen LISTENING overlay with a big pinned timestamp, section label, pulsing green mic, and live transcript.
- The `'play'` event drives the exit: stop recognition, save a note if the transcript has any content (silence → save nothing), and resume playback.
- Fallback for browsers without SpeechRecognition: record an audio voice memo via `getUserMedia` + `MediaRecorder`, attach the blob to the note, play back from the notes list.
- Show which mic is in use (e.g. "mic: airpods") via `enumerateDevices` — iOS auto-routes to the headphone mic when headphones are connected.
- Handle: rapid double-presses (idempotent — no duplicate notes), seek while paused (pin does not change; transcript continues), and end-of-track while listening (save if any).
- On-screen fallback: a Drop-a-note button that pauses (same code path), and a "▶ Save & continue" button in the overlay that plays (same code path). Both exist for people without headphones — the primary interaction remains headphone-only.
- Request mic permission once on first pause; on subsequent pauses it's silent.

## Features (all present in the current prototype — keep them all)

- **Reaction rewind**: notes pin 3 seconds BEFORE the pause point (by the time you react, the moment passed). Timestamp can be nudged ±1s from the edit sheet.
- **Waveform**: render actual waveform from the decoded audio (Web Audio API peaks), green progress fill, white playhead, tap/drag to scrub. Note pins shown as dots on the waveform; tap a pin to jump there (land 1s before).
- **Transport**: play/pause, −10s/+10s, playback rate 0.75× / 1× / 1.25×. Big monospace timecode readout (m:ss.s / total).
- **Quick tags** (available in the edit sheet on existing notes): Levels, EQ, Vocals, Drums, Low end, FX, Arrangement, Stereo, Cut this.
- **Section markers**: name sections at the playhead (Verse, Chorus 2, Drop…). Current section shows under the timecode, and every note auto-labels with the section it landed in.
- **Notes list**: sorted by time, shows timestamp (tap to jump + play), tags, text, section, memo play button if present. Per-note: done checkbox (count shows "2/7 fixed"), edit, delete.
- **Export**: copies all notes to clipboard as clean text: `1:23 (Chorus 2) [Vocals] — bring vocal up 1dB`, with track name and date header. Also add iOS share sheet via `navigator.share`.
- **Persistence**: notes + markers keyed by track filename in `localStorage` under the `noted:` prefix; voice memo audio in IndexedDB (TODO). Reloading the same file restores everything.
- **PWA**: manifest.json, app icons, service worker for offline shell, `apple-mobile-web-app-capable`, black-translucent status bar, `viewport-fit=cover`, safe-area insets. Must feel like a native app from the home screen.

## Technical lessons from the prototype (don't repeat these mistakes)

- The earlier build used `AudioBufferSourceNode` for playback because it needed to work inside a sandbox that blocked `<audio>` elements. On a real HTTPS deploy `<audio>` is the correct choice — MediaSession needs it and iOS lock-screen controls are trivial with it. **Keep Web Audio only for decoding the AudioBuffer that produces the waveform peaks.**
- File picker: use a `<label>`-wrapped `<input type="file" accept="audio/*,...">`, not a JS-clicked hidden input.
- Speech recognition requires HTTPS and real Safari — it is blocked inside sandboxed iframes/previews.
- iOS SpeechRecognition ends the session on its own periodically — restart it inside `onend` while `listenState === 'listening'` (idempotent guard against races on stop).
- Mind memory: decoding long WAVs is heavy; decode once, keep one buffer, revoke old blob URLs when swapping files.
- **Do not use `window.storage`** — that was a sandbox API from an earlier environment and does not exist in real browsers. Use `localStorage` for notes/markers and IndexedDB for memo blobs.

## Design system (extracted from melomaniacstudios.com — follow exactly)

- **Minimal.** Background `#080808`, text `#fff`, muted `rgba(255,255,255,.38)`, hairline borders `rgba(255,255,255,.07)`.
- **Single accent: `#b8f06e`** (Melomaniac Labs chartreuse). White is secondary. Absolutely NO orange, brown, amber, or muted/warm-dirty tones.
- **Type:** **Bebas Neue** for the logotype and hero headline (Google Fonts). **DM Mono** for body, labels, timecodes, tags, buttons.
- **Header pattern:** eyebrow `— 03 · Melomaniac Labs` above `NOTED` in Bebas Neue letter-spacing .22em. Tagline right-aligned in Bebas Neue small.
- Big pulsing green mic circle as the LISTENING overlay centerpiece; big pill-shaped green "Drop a note" button fixed at the bottom of the session view.
- Clean layouts with **no orphaned single words on a line** — use `text-wrap: balance` on headings/paragraphs/hints.
- Notes as a quiet divider list, not cards. Restraint everywhere; the mic circle is the one bold element.

## Deliverables

- Static site I can drag-deploy (index.html + assets, or a tiny build), mobile-first at ~390px wide
- README with one-paragraph deploy instructions (Netlify Drop / GitHub Pages)
- Test the pause-to-talk flow carefully: pause→silence→play (no empty note), pause→talk→play (note saved, song resumes), rapid double-presses, seek while paused, end-of-track while listening, permission denial, SR-unavailable → memo fallback, and memo playback
