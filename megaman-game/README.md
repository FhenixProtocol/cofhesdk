# Mega Man — Parallax Platformer

A small HTML5 Canvas platformer built with real Mega Man NES sprites and a
procedurally-rendered, multi-layer parallax background.

## Play

Serve the directory over any static HTTP server (audio + image loading needs
`http://`, not `file://`), then open `index.html`:

```bash
cd megaman-game
python3 -m http.server 8765
# then visit http://localhost:8765/
```

## Controls

| Action | Keys |
| --- | --- |
| Move | `←` / `→` or `A` / `D` |
| Jump | `Space` / `W` / `↑` |
| Shoot | `J` / `X` / `Z` |
| Toggle music | `M` |

## What's in it

- Real Mega Man sprite sheet (idle / run / jump / shoot variants, mirrored for facing direction)
- Authentic Mega Man 2 SFX (jump, buster shot) and Heat Man stage BGM
- Four-layer parallax background rendered programmatically at startup:
  starfield + moon, distant mountains, illuminated city skyline, industrial pipe stacks
- Hand-built level with brick platforms and gaps
- Three enemy types with distinct AI:
  - **Walker** — patrols a section of ground
  - **Met** — hides under an invincible helmet, peeks, fires a 3-shot spread
  - **Flyer** — sine-wave flight pattern, drops shots at the player
- HP bar, lives, score, screen-shake-free invulnerability flicker, particle FX

## Files

```
megaman-game/
  index.html        — title screen + HUD shell
  styles.css        — HUD / title screen styling
  game.js           — game loop, physics, rendering, AI
  assets/
    megamansheet.png            — player sprite sheet (50x50 cells)
    megamanbullet.png           — extras sheet (kept for future use)
    MegaMan2HeatManMapBG.png    — kept as a reference asset
    music.mp3                   — Heat Man stage BGM
    jump.wav, shoot.wav         — SFX
```

## Asset credits

Player sprites, music, and SFX are from the
[MegamanClone project on GitHub](https://github.com/DavidRamirez1/MegamanClone),
which ripped them from Mega Man 2 (Capcom, 1988). The Heat Man background was
mapped by Rick N. Bruns (nesmaps.com). These assets are used for educational /
non-commercial purposes; Mega Man and all related sprites are © Capcom.
