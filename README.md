# MIXRIDE

Voice-first mix notes for musicians. Load your bounce, listen, tap, talk — every note pins to the exact second in the song.

## Run it locally
No build step. From this folder:

```bash
npx serve .
```

Open the URL it prints. Note: the mic requires HTTPS or localhost — local works for desktop testing, but to test on your iPhone you need a deployed URL.

## Deploy (pick one)

**Netlify Drop** — drag this folder onto https://app.netlify.com/drop → instant URL.

**GitHub Pages** — push this folder to a repo, then Settings → Pages → deploy from main branch.

Open the URL on your iPhone in Safari → Share → **Add to Home Screen**. Allow mic access on first note. Done.

## Files
- `index.html` — the entire app (single file, no dependencies)
- `CLAUDE.md` — project context Claude Code reads automatically
- `CLAUDE-CODE-PROMPT.md` — full product spec and roadmap

## Continue building
Open this folder in VS Code, start Claude Code, and say: "Read CLAUDE-CODE-PROMPT.md and continue from index.html."
