# MIXRIDE — Melomaniac Labs integration (addendum to CLAUDE-CODE-PROMPT.md)

MIXRIDE is joining melomaniacstudios.com as the third Melomaniac Labs product. This addendum overrides the standalone branding in the original prompt. Read this AFTER the original spec — all functionality and the voice-first rule are unchanged.

## Positioning

- Product number: **03 · Melomaniac Labs**
- Name: **MIXRIDE** (matches the one-word convention: MANIFOLD, FREQUENCY, MIXRIDE)
- Tagline (their style is short and poetic): **"Talk to your mix."**
- Longer description for the product card, matching the site's voice:
  "Load your bounce. Ride, walk, drive. The second something bugs you, just talk — every note pins to the exact moment in the song, ready for your next session."
- Feature chips (site uses these under each product): `Voice Notes · Timestamped · Any Audio Format · Works Offline`

## Rebrand — extract, don't invent

1. Fetch https://www.melomaniacstudios.com and its CSS (it's a Webflow site; grab the linked stylesheet).
2. Extract the actual design tokens: background, text, muted, accent color(s), border treatment, font families (headings vs body), letter-spacing on headers, button styles.
3. Replace MIXRIDE's current tokens (`--orange:#ff6a00` accent on `#0a0a0a`) with the studio's palette so the app looks native to the brand. Keep the layout minimal and dark; only re-skin.
4. Update the header: replace the standalone MIXRIDE logotype with the Labs pattern used on the site, e.g. `03 · Melomaniac Labs` eyebrow above `MIXRIDE`, in the site's heading type.
5. Keep the user's non-negotiables regardless of palette: minimal layout, monospace timecodes, `text-wrap: balance`, one bold element (the mic circle / note button, now in the studio accent color).

## Hosting & wiring into the site

The main site is Webflow, which can't host a standalone JS app well. Do this instead:

1. Deploy MIXRIDE as a static site (Netlify or Vercel — free tier).
2. Point a subdomain: **mixride.melomaniacstudios.com** (CNAME from the domain DNS to the host). Subdomain gets automatic HTTPS → the mic works, which is the whole product.
3. On the Webflow site, add a product section for 03 · MIXRIDE mirroring the Manifold/Frequency sections: number, name, tagline, description, feature chips, and a `Launch MIXRIDE →` button linking to the subdomain.
4. Add MIXRIDE to the Early Access section copy ("Manifold turns any audio into a reactive 3D sculpture. Frequency finds your song in four questions. MIXRIDE lets you talk to your mix. These are the first three.") and to the Live product list.
5. PWA polish for the subdomain: update `manifest.json` name to "MIXRIDE — Melomaniac Labs", theme color to the studio background, and generate app icons in the new palette so Add to Home Screen looks branded.

## Definition of done

- mixride.melomaniacstudios.com live over HTTPS, mic working on iPhone Safari
- App visually indistinguishable from a native Melomaniac Labs product (tokens extracted, not guessed)
- Product card live on melomaniacstudios.com linking to it
