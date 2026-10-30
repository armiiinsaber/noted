# NOTED

Voice-first mix notes for musicians. Load your bounce, put your phone away, and let the headphone play/pause button do the work — pause when something bugs you and just talk, play to save the note and keep listening. Every note pins to the exact second in the song.

## Run it locally
No build step. From this folder:

```bash
npx serve .
```

Open the URL it prints. Note: the mic and MediaSession API both require HTTPS. Localhost works for desktop testing, but to test on your iPhone you need a deployed URL (or a Cloudflare / ngrok HTTPS tunnel to `localhost:3000`).

## Deploy (pick one)

**Netlify Drop** — drag this folder onto https://app.netlify.com/drop → instant URL.

**GitHub Pages** — push this folder to a repo, then Settings → Pages → deploy from main branch.

**Own domain** — `notedbymm.com` is the canonical home, served from GitHub Pages via the `CNAME` file (see `NOTED-REBRAND.md`). It replaced the old `noted.melomaniacstudios.com` subdomain.

Open the URL on your iPhone in Safari → Share → **Add to Home Screen**. Allow mic access on the first pause. From then on, everything is headphone-only.

## Files
- `index.html`: the entire app (single file, no dependencies)
- `fonts/`: Bricolage Grotesque, self-hosted, with its OFL licence
- `manifest.json`, `sw.js`, icons and `artwork.png`: the installed app and its lock screen card
- `CLAUDE.md` — project context Claude Code reads automatically
- `CLAUDE-CODE-PROMPT.md` — full product spec
- `NOTED-REBRAND.md` — historical: where the design tokens came from, plus the hosting plan. noted ships standalone now (no Labs numbering/attribution).

## Continue building
Open this folder in VS Code, start Claude Code, and say: "Read CLAUDE-CODE-PROMPT.md and NOTED-REBRAND.md and continue from index.html."
