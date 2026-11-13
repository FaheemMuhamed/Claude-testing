# Higgsfield generation brief: Cinderdeep (game art)

Paste everything inside the box below into **Claude chat or Cowork** (with the Higgsfield
connector on) so it runs on the unlimited trial. When it finishes, bring back the
**list of job IDs** (index → job_id). That's all I need to pull the files here.

---

```text
Please generate these game assets with the Higgsfield tools, using my unlimited trial:
set use_unlim: true on EVERY generate call. Never fall back to credits; if unlim is refused, stop and tell me.

STYLE FORMULA (append it byte-for-byte where a prompt says {STYLE}):
hand-painted digital illustration with bold ink linework and visible painterly brush texture, chunky readable silhouettes with thick near-black outlines, environment in desaturated slate blue and charcoal stone with deep teal shadows, hero in warm ember orange and bone-white tones contrasting the cold surroundings, enemies in sickly violet and ash grey, hazards and pickups marked with bright gold glow, moody underworld atmosphere with warm rim light, high contrast between game elements and backgrounds, clean readable silhouettes, consistent top-down three-quarter perspective across all assets

SUFFIXES:
{SPRITE_M} = , on a solid uniform bright magenta #FF00FF background, no shadows cast on the background, no ground plane, nothing cropped at the edges, generous empty margin above the head and below the feet
{SPRITE_G} = , on a solid uniform bright green #00FF00 background, no shadows cast on the background, no ground plane, nothing cropped at the edges, generous empty margin above the head and below the feet
{TILE}     = , perfectly seamless edges that wrap horizontally and vertically, no border, no vignette, flat even lighting, no single focal object
{BG}       = , no characters, no UI elements, slightly muted detail so foreground game elements stay readable, soft depth layering
{UI_M}     = , on a solid uniform bright magenta #FF00FF background, crisp edges, no drop shadow outside the element
{UI_G}     = , on a solid uniform bright green #00FF00 background, crisp edges, no drop shadow outside the element

STEP 1: images. Use generate_image_batch, model nano_banana_2, resolution 2k, count 1, use_unlim true.
Aspect ratio 1:1 for all, except index 6 (16:9).

0  hero:       game sprite of the hooded ember knight facing right holding a short glowing ember sword, standing ready stance, single character/object, full body visible, centered, {STYLE}{SPRITE_M}
1  wisp:       game sprite of the floating ash wraith with clawed hands and tattered smoky lower body, facing right, single character/object, full body visible, centered, {STYLE}{SPRITE_G}
2  slinger:    game sprite of the hunched husk slinger, a gaunt hooded creature holding a glowing violet orb sling, facing right, single character/object, full body visible, centered, {STYLE}{SPRITE_G}
3  brute:      game sprite of the hulking cinder golem, a massive stone brute with cracked glowing violet seams and huge fists, facing right, single character/object, full body visible, centered, {STYLE}{SPRITE_G}
4  warden:     game sprite of the hollow chained warden, a towering armored jailer with an empty glowing violet helm, broken chains wrapped around its arms and a great hooked halberd, facing right, single character/object, full body visible, centered, {STYLE}{SPRITE_G}
5  floor:      seamless tileable game texture tile of large plain cracked dark slate flagstones only, stone slabs and mortar gaps, absolutely no objects, no props, no icons, no creatures, no decorations, viewed from directly above, uniform pattern density, {STYLE}{TILE}
6  title:      game background of a vast underworld cavern with a long broken stone stairway rising toward a distant warm light far above, wide establishing view, {STYLE}{BG}
7  icon_flame: game UI element: a round boon icon medallion showing a blazing orange flame sigil, single element, centered, {STYLE}{UI_G}
8  icon_frost: game UI element: a round boon icon medallion showing a frozen icy blue crystal wave sigil, single element, centered, {STYLE}{UI_M}
9  icon_storm: game UI element: a round boon icon medallion showing a crackling yellow lightning bolt sigil, single element, centered, {STYLE}{UI_M}
10 wall:       seamless tileable game texture tile of a dark carved underworld stone wall top with rough brick courses and teal moss in cracks, viewed from directly above, uniform pattern density, {STYLE}{TILE}
11 door:       game sprite of a heavy arched stone dungeon doorway sealed by a glowing gold rune barrier, front view, single object, centered, {STYLE}{SPRITE_G}

Wait for all 12 to finish (jobs_wait), then continue.

STEP 2: animation key poses. generate_image_batch, model nano_banana_2, 2k, 1:1, use_unlim true.
Pass the STEP 1 job as a media reference: medias [{ value: <job_id>, role: "image_references" }].

12 hero_run_key    (ref = job 0): the same hooded ember knight from the reference image, identical design and colors, facing right, caught mid-stride in a running pose with one leg forward, full body in frame, {STYLE}{SPRITE_M}
13 hero_attack_key (ref = job 0): the same hooded ember knight from the reference image, identical design and colors, facing right, winding up a sword slash with the glowing ember sword raised behind the shoulder, full body in frame, {STYLE}{SPRITE_M}
14 hero_dash_key   (ref = job 0): the same hooded ember knight from the reference image, identical design and colors, facing right, low forward lunge as if dashing, cloak streaming behind, full body in frame, {STYLE}{SPRITE_M}
15 warden_attack_key (ref = job 4): the same hollow chained warden from the reference image, identical design and colors, facing right, halberd raised high overhead ready to strike, full body in frame, {STYLE}{SPRITE_G}

Wait for all 4 to finish, then continue.

STEP 3: animations. generate_video_batch, model seedance_2_5, mode "omni_reference", duration 4,
resolution 720p, aspect_ratio "1:1" (pass it explicitly), generate_audio false, use_unlim true.
LOOP rows: pass the SAME image as start_image AND end_image. ONCE rows: start_image only.
Append this NEGATIVE block to every video prompt:
" Camera locked, no camera movement, no zoom, subject stays fully in frame, plain static background. The character performs ONLY this action, nothing else happens. The subject keeps facing the SAME direction for the entire video, never turns around, never rotates toward or away from the camera."

16 hero_idle    LOOP  image = job 0  : smooth idle breathing cycle, subtle weight shift, cloak gently swaying. The sword stays inert and is never swung.
17 hero_run     LOOP  image = job 12 : full running cycle in place, legs and cloak moving, body stays in place. The sword stays inert and is never swung.
18 hero_attack  ONCE  image = job 13 : single fast sword slash forward, sharp strike, brief follow-through.
19 hero_dash    ONCE  image = job 14 : one quick forward lunge burst in place with cloak whipping, then recover.
20 wisp_float   LOOP  image = job 1  : hovering in place, smoky tatters drifting, claws flexing slowly.
21 slinger_idle LOOP  image = job 2  : swaying hunched idle, orb sling swinging slowly in a small circle. Never throws the orb.
22 brute_walk   LOOP  image = job 3  : heavy stomping walk cycle in place, shoulders rolling, glowing seams pulsing.
23 warden_idle  LOOP  image = job 4  : menacing idle breathing, chains swaying, helm glow pulsing. The halberd stays inert and is never swung.
24 warden_attack ONCE image = job 15 : single heavy overhead halberd strike slamming down in front.

Wait for all to finish. Then reply with a plain list:  index  name  job_id   (all 25 rows).
```

---

## Notes for me (when the IDs come back)
- Images: chroma-key (magenta / green as listed), union-bbox crop, resize to in-game sizes.
- Videos: ffmpeg every frame → pick 12–16 evenly spaced (keep first + last; drop last for LOOP) →
  key out the background per frame → grid spritesheet named
  `{asset}_{action}_f{n}_{w}x{h}_g{c}x{r}_fps{fps}_{loop|once}.png`.
