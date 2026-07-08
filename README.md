# NOTED

Voice-first mix notes for musicians. Load your bounce, put your phone away, and let the headphone play/pause button do the work — pause when something bugs you and just talk, play to save the note and keep listening. Every note pins to the exact second in the song.

Third product under [Melomaniac Labs](https://www.melomaniacstudios.com).

## Run it locally
No build step. From this folder:

```bash
npx serve .
```

Open the URL it prints. Note: the mic and MediaSession API both require HTTPS. Localhost works for desktop testing, but to test on your iPhone you need a deployed URL (or a Cloudflare / ngrok HTTPS tunnel to `localhost:3000`).

## Deploy (pick one)

**Netlify Drop** — drag this folder onto https://app.netlify.com/drop → instant URL.

**GitHub Pages** — push this folder to a repo, then Settings → Pages → deploy from main branch.

**Melomaniac Labs subdomain** — point `noted.melomaniacstudios.com` at whichever host you picked (see `NOTED-REBRAND.md`).

Open the URL on your iPhone in Safari → Share → **Add to Home Screen**. Allow mic access on the first pause. From then on, everything is headphone-only.

## Files
- `index.html` — the entire app (single file, no dependencies)
- `CLAUDE.md` — project context Claude Code reads automatically
- `CLAUDE-CODE-PROMPT.md` — full product spec
- `NOTED-REBRAND.md` — Melomaniac Labs positioning, tokens, and hosting plan

## Continue building
Open this folder in VS Code, start Claude Code, and say: "Read CLAUDE-CODE-PROMPT.md and NOTED-REBRAND.md and continue from index.html."
