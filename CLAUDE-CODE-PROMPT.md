# CLAUDE CODE PROMPT — copy everything below this line

Build me a production-ready, voice-first iPhone web app called **MIXRIDE** for musicians finalizing mixes. I'll deploy it to a real URL (Netlify/GitHub Pages) and install it via Add to Home Screen, so build it as a proper PWA.

## The product and workflow

I'm a musician. When finalizing a mix/master, I export the bounce to my phone, then listen on bike rides, car rides, and walks. While listening I notice things to fix — "bring the vocal up 1dB," "snare too bright," "cut the pad here." Today I lose these notes or fumble with my Notes app. MIXRIDE fixes this:

1. I load the audio file (MP3/M4A/WAV/AIFF/FLAC) from my Files app
2. I press play and listen
3. The moment something bugs me, I tap one big button — playback pauses, the mic starts listening IMMEDIATELY, and I just talk
4. My spoken note is saved, pinned to the exact timestamp in the song
5. Playback resumes automatically
6. Later at my DAW, I see all notes sorted by time, check them off as I fix them, and can export the list as text

## NON-NEGOTIABLE: voice-first

Voice capture is the entire point of this app. The flow is tap → talk → done. NO keyboard, NO typing flow, NO visible text input in the capture flow. Typing has zero value to me.

- When the note sheet opens, the mic must already be listening (Web Speech API `webkitSpeechRecognition` — works in real Safari over HTTPS)
- Live transcript displayed as I speak
- Tap once to stop, note auto-saves (or one Save tap max)
- Fallback if speech recognition fails: record an audio voice memo (`getUserMedia` + `MediaRecorder`) attached to the note, playable from the notes list, stored in IndexedDB
- A tiny "edit" affordance may exist on already-saved notes for fixing transcription, but it must be hidden by default — never part of the capture flow
- Show which mic is in use (e.g. "mic: airpods") via `enumerateDevices` — iOS auto-routes to headphone mic when connected
- Request mic permission once on first use, handle gracefully

## Features (all of these exist in my current prototype — keep them all)

- **Reaction rewind**: notes pin 3 seconds BEFORE the tap (by the time you react, the moment passed). ±1s nudge buttons on the timestamp.
- **Waveform**: render actual waveform from the decoded audio (Web Audio API peaks), orange progress fill, white playhead, tap/drag to scrub. Note pins shown as dots on the waveform; tap a pin to jump there (land 1s before).
- **Transport**: play/pause, −10s/+10s, playback rate 0.75× / 1× / 1.25×. Big monospace timecode readout (m:ss.s / total).
- **Quick tags** on notes: Levels, EQ, Vocals, Drums, Low end, FX, Arrangement, Stereo, Cut this.
- **Section markers**: name sections at the playhead (Verse, Chorus 2, Drop…). Current section shows under the timecode, and every note auto-labels with the section it landed in.
- **Notes list**: sorted by time, shows timestamp (tap to jump + play), tags, text, section, memo play button if present. Per-note: done checkbox (count shows "2/7 fixed"), edit, delete.
- **Export**: copies all notes to clipboard as clean text: `1:23 (Chorus 2) [Vocals] — bring vocal up 1dB`, with track name and date header. Also add iOS share sheet via `navigator.share`.
- **Persistence**: notes + markers keyed by track filename in localStorage; voice memo audio in IndexedDB. Reloading the same file restores everything. ("Resume playback after saving" toggle, default on.)
- **PWA**: manifest.json, app icons, service worker for offline shell, `apple-mobile-web-app-capable`, black-translucent status bar, `viewport-fit=cover`, safe-area insets. Must feel like a native app from the home screen.

## Technical lessons from the prototype (don't repeat these mistakes)

- Use a **Web Audio API playback engine** (decode to AudioBuffer, play via AudioBufferSourceNode with manual offset/seek/rate tracking) rather than relying solely on an `<audio>` tag with blob URLs — the buffer is needed for the waveform anyway and playback through it is bulletproof. First play must come from a user gesture (iOS), and resume a suspended AudioContext before playing.
- File picker: use a `<label>`-wrapped `<input type="file" accept="audio/*,...">`, not a JS-clicked hidden input.
- Speech recognition requires HTTPS and real Safari — it is blocked inside sandboxed iframes/previews, which is why we're deploying for real.
- Mind memory: decoding long WAVs is heavy; decode once, keep one buffer, revoke old object URLs.

## Design system (my standing preferences — follow exactly)

- **Minimal.** Background #0a0a0a (near black), text white, muted gray #9a9a9a, hairline borders #262626.
- **Single accent: bright tangerine orange #FF6A00** (Tangerine Bank logo orange). White is the secondary. Absolutely NO brown, amber, or muted/warm-dirty tones.
- Monospace (ui-monospace/SF Mono) for timecode, tags, and labels; system sans for everything else.
- Big pulsing orange mic circle as the capture centerpiece; big pill-shaped orange "Drop a note" button fixed at the bottom.
- Clean layouts with **no orphaned single words on a line** — use `text-wrap: balance` on headings/paragraphs/hints.
- Notes as a quiet divider list, not cards. Restraint everywhere; the mic circle is the one bold element.

## Deliverables

- Static site I can drag-deploy (index.html + assets, or a tiny build), mobile-first at ~390px wide
- README with one-paragraph deploy instructions (Netlify Drop / GitHub Pages)
- Test the mic flow logic carefully: start/stop states, permission denial, SR-unavailable → memo fallback, and memo playback
