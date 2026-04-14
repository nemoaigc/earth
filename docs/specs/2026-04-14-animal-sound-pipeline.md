# Spec: Animal sound asset pipeline

**Status:** draft · **Owner:** Eris · **Target:** P0

## Goal
Ship a real, listenable vocalisation for every one of the 20 species, so
the panel's **Hear Voice** button stops saying *Pending*.

## Non-goals
- Runtime audio generation. All assets are baked at build time and
  served as static files from `public/animal-sounds/`.
- Licensing review for 900+ species. Scope is strictly the current 20.

## Approach

### Source hierarchy (per animal, try in order)
1. **Wikimedia Commons** — real recordings where available. Mostly
   applies to endangered survivors (Bluebuck, rhinos, etc. — ~0 of
   our list, so this mostly returns null).
2. **ElevenLabs Sound Effect API** — `/v1/sound-generation`. Primary
   source for extinct species; we describe the target vocalisation
   and let the model synthesise 4–8 seconds of audio.
3. **Suno** — reserved as backup once their public API opens.

### Prompts
Every species gets a hand-written prompt (already stubbed in
`scripts/generate-animal-sounds.mjs`). Prompts must:
- Name the species + its closest living relative as reference
  ("dodo call, closest to a large pigeon, deep throaty coo")
- Describe the environment ("coastal rocks + surf" / "cloud forest")
- Cap duration at 6 seconds, looped downstream if needed

### Review loop
Generation is not fire-and-forget. The pipeline is:
1. Run `LOST_PLANET_SOUND_PROVIDER=elevenlabs node scripts/generate-animal-sounds.mjs`
2. Script writes `public/animal-sounds/{id}.v{N}.mp3` and updates
   `manifest.json` with `{ id, version, accepted: false, prompt }`
3. Human listens through `public/animal-sounds/_review.html`
   (a tiny standalone HTML that iterates manifest entries with
   play + accept/reject buttons)
4. Accept → `accepted: true`. Reject + note reason → flagged for
   regeneration with a new prompt or provider.
5. Only `accepted: true` entries are surfaced in the app. Rejected
   or missing entries keep the "Pending" state.

### Versioning
- `{id}.v1.mp3`, `{id}.v2.mp3` — never overwrite a previous accepted
  version. Lets us A/B without losing history.
- `manifest.json.files[id] = { file: 'goldentoad.v2.mp3', version: 2, accepted: true }`
- UI reads `files[id].file`; older versions stay on disk for rollback.

### Provenance
Every generated clip is AI-approximate, especially for extinct species.
Add a tiny badge to the Hear Voice button when `files[id].generated:
true`: "AI reconstruction — no original recording survives".

## Files touched
- `scripts/generate-animal-sounds.mjs` — already stubbed; extend the
  ElevenLabs adapter and add the versioning logic.
- `public/animal-sounds/_review.html` — new, ~80 lines vanilla JS,
  loads manifest and walks through clips.
- `public/animal-sounds/manifest.json` — schema upgrade:
  ```jsonc
  {
    "provider": "elevenlabs",
    "generatedAt": "...",
    "files": {
      "dodo": {
        "file": "dodo.v1.mp3",
        "version": 1,
        "accepted": true,
        "generated": true,
        "prompt": "...",
        "license": "ElevenLabs TOS (commercial usage requires Creator tier)"
      }
    }
  }
  ```
- `src/ui/AnimalPanel.ts` — read `files[id]?.file` instead of raw
  string; add the "AI reconstruction" micro-copy when `generated`.

## Open questions
- **Cost**: ElevenLabs sound-effect generations are ~$0.04/5s @ Creator
  tier. 20 × 3 attempts avg = 60 generations ≈ $2.40. Trivial.
- **Licensing**: ElevenLabs TOS allows commercial use on paid tiers
  only. Need to verify we're on the right plan before shipping.

## Acceptance
- All 20 files present with `accepted: true`
- `_review.html` runs offline via `file://` (no bundler)
- Clicking Hear Voice produces audio for every species
- Rejected regenerations don't leak into the app
