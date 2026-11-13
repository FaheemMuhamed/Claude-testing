# Cinderdeep

A small top-down action roguelike in the spirit of the genre: fight up through six underworld
chambers, take a blessing after each one, and defeat the Hollow Warden.

## Play
Open `index.html` through any static server, for example:

    python3 -m http.server 8000   # then visit http://localhost:8000

| Action | Keyboard / mouse | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | WASD / Arrows | Left stick | Left joystick |
| Aim | Mouse | Right stick | Auto-aim |
| Strike (3-hit combo, hold to chain) | J / Left click | X | STRIKE |
| Cast (projectile) | K / Right click | B | CAST |
| Dash (invulnerable) | Space / Shift | A | DASH |

## What's in it
- **Combat:** combo strikes with hit-stop and screen shake, a ranged cast, and a dash with i-frames.
- **Enemies:** ash wraiths lunge after a red tell, husk slingers keep distance and fire volleys,
  cinder golems charge along a telegraphed lane and stun themselves on walls.
- **Boss:** the Hollow Warden sweeps, fires orb rings and summons adds, then enrages at half
  health and adds wall-stunning charges.
- **Blessings** from three powers, each with three boons up to level 3:
  - Pyre: burn, fire trail, damage
  - Tide: slow, shard fan, ward
  - Gale: chain lightning, piercing cast, speed

  A healing draught is offered when you're low.
- Best chamber and escape count are kept in your browser.

Add `?debug` to the URL for an fps / entity overlay.

## Art
Every sprite, the floor tile, the title backdrop and the blessing icons were generated with
Higgsfield (GPT Image 2.6) from one shared style formula, then background-keyed and resized.
See `design/assets.csv`. Sound effects are synthesized live with WebAudio.
