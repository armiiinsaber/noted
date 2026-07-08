# MIXRIDE — project context for Claude Code

Voice-first PWA for musicians taking timestamped mix notes while listening to a bounce on rides/walks. Full spec lives in `CLAUDE-CODE-PROMPT.md` — read it before changing anything.

## Current state
`index.html` is a working single-file prototype: Web Audio playback engine, real waveform with note pins, 3s reaction-rewind capture, tags, section markers, done-tracking, clipboard export. Voice capture (SpeechRecognition + MediaRecorder memo fallback) is implemented but only activates on a real HTTPS deployment — sandboxed previews block the mic, which is why the project moved here.

## Hard rules
- Voice-first is the entire product: tap → talk → save. Never surface a keyboard or typing flow in capture. A hidden edit affordance on saved notes is the only exception.
- Persistence: notes/markers keyed by track filename (localStorage), voice memo audio in IndexedDB. Do NOT use `window.storage` — that was a sandbox API from the prototype environment and does not exist in real browsers; replace any remaining references.
- Playback goes through the Web Audio engine (AudioBuffer + AudioBufferSourceNode with manual offset/seek/rate). First play from a user gesture; resume suspended AudioContext.
- Target: iPhone Safari, installed via Add to Home Screen. Keep PWA meta tags, add manifest + service worker + icons.

## Design system (user's standing preferences — do not deviate)
- Minimal. Background #0a0a0a, white text, muted #9a9a9a, hairlines #262626.
- Single accent: bright tangerine orange `#FF6A00`. White secondary. No brown/amber/muted warm tones, ever.
- Monospace for timecode/tags/labels; system sans elsewhere.
- `text-wrap: balance` on headings/paragraphs — no orphaned single words on a line.
- One bold element (the orange mic circle / note button); everything else quiet.

## Definition of done
Deployed to a public HTTPS URL (GitHub Pages or Netlify) where tapping "Drop a note" starts the mic immediately and a spoken note saves to the correct timestamp.
