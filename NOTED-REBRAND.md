# NOTED — Melomaniac Labs integration (addendum to CLAUDE-CODE-PROMPT.md)

NOTED is joining melomaniacstudios.com as the third Melomaniac Labs product. This addendum overrides the standalone branding in the original prompt. Read this AFTER the original spec — all functionality and the hands-free pause-to-talk rule are unchanged.

## Positioning

- Product number: **03 · Melomaniac Labs**
- Name: **NOTED** (matches the one-word convention: MANIFOLD, FREQUENCY, NOTED)
- Tagline (their style is short and poetic): **"Talk to your mix."**
- Longer description for the product card, matching the site's voice:
  "Load your bounce. Ride, walk, drive. The second something bugs you, just tap pause on your headphones and talk — every note pins to the exact moment, ready for your next session."
- Feature chips (site uses these under each product): `Voice Notes · Timestamped · Any Audio Format · Works Offline`

## Rebrand — extract, don't invent

The tokens below were pulled from the live site's inline `:root` and Webflow CSS on 2026-07-08 and are what `index.html` uses today:

- Background `--bg: #080808`
- Text `#ffffff`, muted `rgba(255,255,255,.38)`, hairline `rgba(255,255,255,.07)`
- Accent `--accent: #b8f06e` (chartreuse), hover `#cbff7e`
- Fonts: **Bebas Neue** for the logotype and hero headline, **DM Mono** (300/400/500) for body and labels
- Header pattern: eyebrow `— 03 · Melomaniac Labs` above `NOTED` in Bebas Neue letter-spacing .22em; tagline right-aligned in Bebas Neue small

If any of the site tokens change, re-fetch the linked Webflow CSS and the inline `<style>` in the homepage `<head>` — do not eyeball values.

## Hosting & wiring into the site

The main site is Webflow, which can't host a standalone JS app well. Do this instead:

1. Deploy NOTED as a static site (Netlify or Vercel — free tier).
2. Point the apex domain: **notedbymm.com** — four A records to the GitHub Pages addresses, plus `www` as a CNAME to `armiiinsaber.github.io.` (pointing `www` at the apex instead leaves it out of the certificate). Automatic HTTPS → the mic works, which is the whole product.
3. On the Webflow site, add a product section for 03 · NOTED mirroring the Manifold/Frequency sections: number, name, tagline, description, feature chips, and a `Launch NOTED →` button linking to the subdomain.
4. Add NOTED to the Early Access section copy ("Manifold turns any audio into a reactive 3D sculpture. Frequency finds your song in four questions. NOTED lets you talk to your mix. These are the first three.") and to the Live product list.
5. PWA polish for the subdomain: update `manifest.json` name to "NOTED — Melomaniac Labs", theme color to `#080808`, and generate app icons in the new palette so Add to Home Screen looks branded.

## Definition of done

- notedbymm.com live over HTTPS, headphone play/pause driving the capture flow on iPhone Safari
- App visually indistinguishable from a native Melomaniac Labs product (tokens extracted, not guessed)
- Product card live on melomaniacstudios.com linking to it
