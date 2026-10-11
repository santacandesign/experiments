# Fish Friends — p5.js prototype

A throwaway feel-prototype for the client: make a fish out of your own face, name it,
give it a voice, and watch it swim. Static HTML/JS — no build step, no backend, no deps
to install.

## What it does

1. **`index.html`** — the make-a-fish flow, three steps:
   - **face** — front camera with live face tracking. Rings mark the eyes, brows and mouth
     it has found, so you can see what is about to be taken before you snap. Falls back to a
     photo picker if the camera is refused, and to drawn eyes if no face can be found.
   - **name and look** — 14 characters, plus every control that shapes the creature
     (species, colour, fishiness) next to a live preview of the actual creature. The preview
     swims back and forth on purpose: turning is what shows the eye swapping sides.
   - **voice** — hold the button to record, hard 5-second cap, playback preview.
2. **`aquarium.html`** — the tank. Your fish (face + name + voice) and two stand-in friends
   swim in front of a planted reef and a cast of scenery fish. **Tap your fish** and it plays your clip through the bubbly filter,
   wiggling and blowing bubbles in time with the audio.

Everything is stored in `localStorage` under `fishfriends.myfish.v1`, so the fish survives
a reload. `＋ new fish` restarts the flow and replaces it.

## Deliberately not in this build

Feeding, the health "battery", decay, death/revival, and friends with their own
faces or voices — all in `Fishfriends_featuredoc.md`, none of it here. The generic fish are
scenery only. This prototype is the create-a-fish moment and the tank, nothing else.

## Running it

Camera and microphone need a **secure context**. `file://` will not work — the flow will
fall back to the photo picker and the fish will be silent.

Locally:

```bash
cd prototype && python3 serve.py
```

then open `http://localhost:8777` (localhost counts as secure). `serve.py` is
`http.server` plus `Cache-Control: no-store` — without that, editing a `.js` file and
reloading keeps running the previous version, which is a memorable way to waste an
afternoon. Any static server works for the client build.

To send it to the client, drop the folder on any static host with HTTPS — Netlify drop,
Vercel, GitHub Pages, S3 + CloudFront. No configuration needed.

## Files

| File | What's in it |
|---|---|
| `index.html` / `js/create.js` | the three-step flow, live viewfinder, face-centred capture |
| `js/fishhead.js` | turning a detected face into a fish head — the wrap, the cut-out, the eye domes |
| `js/facerig.mjs` | MediaPipe Face Landmarker, loaded as a module and published as `window.FaceRig` |
| `aquarium.html` / `js/aquarium.js` | the tank: the cast, swimming, tap-to-talk, the demo states |
| `js/reef.js` | everything in the tank that isn't a creature: water, reef, planting, sand, light, bubbles |
| `js/creatures.js` | every species: silhouette, fins, markings, where the eye goes |
| `js/paint.js` | the dials (`Look`), colour maths (`Col`), fish colour schemes and shared textures (`Paint`) |
| `js/samples.js` | the two stand-in friends and their painted eyes |
| `js/shared.js` | swatch colours, `localStorage` wrapper, line helpers, `drawMyFish` |
| `js/voice.js` | `MediaRecorder` capture + the Web Audio "bubbly cartoon fish" chain |
| `css/style.css` | the hand-drawn UI shell |

## How your creature is made

Every creature in the tank, yours included, comes from one registry in
`js/creatures.js`: nine species — **fish, long, round, tiny, seahorse, starfish, whale, manta, shark** —
each owning its proportions, silhouette, appendages, patterning and where an eye belongs.
Picking your species is picking from the same list the scenery is drawn from.

The creature is **drawn**, in the palette, in the hand-drawn language of the reference art.
The only photographic thing on it is **one eye**.

That is a deliberate reversal of two earlier versions. The first wrapped a whole
photographic head onto the body; real skin against flat vector colour reads as a photo
pasted onto a drawing, and no amount of edge-feathering fixed it. The second kept the eye,
brow and lips — better, but still three fragments competing with the flat art. One eye is
enough to carry identity, and it made the bake six times cheaper: ~135KB per creature
against ~400KB.

- **The eye** is sampled through a fisheye (`pow(r, 1 + 0.85·fish)`) so the middle
  magnifies, shaded like a sphere, finished with a wobbly navy ink ring. Fishiness scales
  how far it bulges.
- **Two are baked**, one from each half of the face. The tank draws whichever matches the
  swim direction, so the eye changes side when the creature turns around.
- **Detail on every body**: a belly band, a head cap behind a gill line with a cheek band,
  markings (dashes, scale crescents, rings, spots), a wet gloss streak, a soft belly shade
  and riso grain. All of it clipped to the body path, which is why each species defines its
  silhouette as a context path rather than a p5 shape — the same path fills it, inks it and
  clips the patterning inside it.
- **The ordinary fish (fish, round, tiny) are built from a side profile**, not an oval: a
  thickness curve `u^a·(1−u)^b` from nose to tail wrist, giving a rounded snout, a high
  shoulder and a narrow wrist for the forked tail. Fins, belly, cap and markings all anchor
  to that same curve, and the back half bends with the tail beat.
- **The seahorse is built differently** from the rest. Instead of a closed outline it has a
  *centreline* — a list of `[x, y, halfWidth]` points walked from the snout, down the neck
  and body, then around a shrinking spiral for the tail — offset by its half-width to make
  the outline. A closed bezier cannot taper and curl at once; a spine can. Its coronet, nape
  spines, dorsal fan, segment rings and pectoral fin are all anchored to fractions along that
  same spine, so nothing can drift off the body. Watch the fractions: the snout alone is the
  first ~17% of the smoothed spine, which is where the anchors go if you assume otherwise.
## How they move

Every species has its own motion model in `swim()`, because a tank where everything glides
at one constant speed reads as a screensaver rather than as animals.

| species | model | what it does |
|---|---|---|
| fish, tiny | `burst` | Burst-and-coast, the way most fish actually swim: a few hard tail strokes, then a glide. The tail goes still during the glide, which is most of the time. |
| long | `undulate` | Anguilliform. A wave runs continuously down the body — the body outline genuinely bends, because it is a ribbon along a sine spine rather than a rigid oval. Never coasts. |
| round | `hover` | Deep-bodied fish row with their pectoral fins: slow, fussy, and stopping constantly to hang in one place. |
| seahorse | `seahorse` | A famously poor swimmer. Hovers almost still, flutters the dorsal fin non-stop, and repositions by **rolling and unrolling its tail** — thrust arrives on the unroll, and the same phase drives the coil in the drawing. |
| starfish | `crawl` | Does not swim. Drifts slowly, turns slowly, stays low where a starfish would be. |
| whale | `cruise` | Holds its line, turns slowly, crosses the tank rather than pottering about. |

Two supporting pieces: **effort** (0–1) is how hard a creature is working right now, and it
scales the tail beat, so a coasting fish holds its tail still. **Tail beat rate** is a
property of the species (`beat`), not a random number — a whale at 0.045, a seahorse
fluttering at 0.62. Small fish also loosely follow a drifting shoal centre instead of each
picking their own destination.

- A starfish never mirrors — it has no front. A seahorse stays upright; leaning one over
  looks broken.

## Colour

Every creature is in full, very saturated colour, as on the reference sheet — and **no
creature is one colour**. A colour is a *scheme* (`Paint.SCHEMES` in `paint.js`): a body,
a belly, a head cap, a cheek band, fins in a contrasting colour, markings and a gloss.
The make-a-fish swatches are the eight scheme bodies; a stored fish keeps only its body
hex and gets the accents back from there (an older save is matched to the nearest hue).

| scheme | body | belly | head | fins |
|---|---|---|---|---|
| ember | `#FF4A1C` | pink | pale pink | olive |
| goldie | `#FF8A12` | cream | — | lilac |
| sunny | `#FFC612` | orange | — | sky blue |
| bubblegum | `#FF8FB8` | pale pink | — | green |
| lagoon | `#0F8A4B` | sky blue | — | pink |
| reef | `#10B4CC` | yellow | — | pink |
| periwinkle | `#93A9FF` | pale blue | orange | green |
| moss | `#8C9C14` | orange | lilac | periwinkle |

Everything is inked in a warm near-black (`Paint.INK`). Scenery creatures are marked
`blend: true` and given a `depth`: the further back, the smaller, thinner-inked and more
hazed into the water. The **scenery colour** dial decides how far that goes — at 1 the
scenery is as bright as your fish, at 0 it sinks into the water and only people stand out.

## The two stand-in friends

`js/samples.js` — **maya** (ember fish, brown eyes) and **theo** (goldie round fish, green eyes).
There are no photos in the prototype, so each face is *painted* onto a canvas laid out like a
real capture — skin with undertone, socket shadow, lid crease, brow hairs, lashes, sclera
with veins and a caruncle, an iris with fibres, crypts and a limbal ring, a wet catchlight,
sensor noise — then passed through `FaceParts.bake` exactly as a camera frame would be. So
the eyes get the same fisheye dome and ink ring as yours. It's seeded, so they look the same
on every load. Tapping one gets a wiggle and bubbles; they have no voice.

## The look

Flat, saturated, inked — the reference sheet — on a bright reef. `js/reef.js` draws the
tank back to front: turquoise water lit from above (`#3FCAD6` → `#139DB6` → `#0B6A8E` at
the defaults) with a sun pool and wavering surface lines; two hazy layers of far reef;
distant shoals; hazed mid planting; warm sand with ripples, pebbles, shells, rocks, branching
and brain corals and sea fans; then caustics and light shafts. In front of the scenery fish:
inked seagrass, kelp with floats, ruffled sea lettuce, red sea whips and anemones, all
swaying. Tall planting goes to the sides and low planting to the middle, so there's always
open water. Distance is done the illustrator's way: further things are paler and bluer, and
lose their ink.

The layout is seeded, so a colour dial rebakes the same reef rather than reshuffling it;
only the density dials replant. Plant heights are capped by screen width so a tall phone
doesn't grow a forest up to the middle of the tank.

Outlines are redrawn with a new wobble seed every few frames (the **line boil** dial),
which gives the shimmer hand-inked animation has.

## The dials

Tap **🎛 dials** in the tank. Groups:

- **water** — hue, depth, saturation, distance haze, light shafts, caustics, bubbles,
  floating specks, vignette, paper grain
- **plants** — density, hue, saturation, red stems, sway, sand warmth
- **fish** — saturation, brightness, outline weight and darkness, markings, gloss, fin
  rays, shading, riso texture, line wobble, line boil
- **tank** — scenery colour, number of scenery fish, distant shoals, fish size, swim speed

Presets: **reference** (the defaults), **neon**, **pastel**, **storybook**, **clean**,
**deep**. Values persist in `localStorage` under `fishfriends.look.v2`, and the make-a-fish
preview reads the same ones. **copy values** puts the current set on the clipboard so a look
can be baked in as the new `def`s in `Look.DIALS`. Double-click a dial to reset it.

## The fish head

`js/fishhead.js` takes a face plus MediaPipe's 478 landmarks and returns an RGBA sticker —
head silhouette, ink outline and bulging eyes all baked in — so the tank just draws it and
nothing ML-ish runs per frame while fish are swimming.

- **Cut-out.** The face-oval landmark ring is rasterised into a mask, so the room behind you
  is discarded. Anywhere the wrap reaches past the edge of the face, it fills with a skin
  tone averaged off both cheeks and the forehead, rather than showing background.
- **Face-centred crop.** The source is cropped to the detected face, not to the video frame,
  so the wrap gets a big face to sample whether you're at arm's length or across the room.
- **Profile wrap.** One half of the face maps nose-to-ear across the front 70% of the head:
  the facial midline lands on the snout, the cheek runs back toward the gill. Behind the face
  it dissolves into skin. Honest limitation: a frontal photo contains no profile information,
  so this is a stylisation, not a real side view.
- **One eye, and it changes.** Two heads are baked per fish, one from each half of the face.
  The tank draws whichever matches the swim direction, so you see one eye at a time and the
  other side of your face appears when the fish turns around.
- **The eye.** Re-sampled through a fisheye (`pow(r, 1 + 0.85·fish)`) into a dome, lifted
  high onto the skull where a fish keeps it, so it breaks the top of the silhouette as
  fishiness climbs. The outline is stroked through an `evenodd` clip excluding the dome, so
  a bulging eye occludes the outline instead of being crossed by it.
- **Mouth on the snout.** The horizontal stretch exponent is raised near the mouth's height
  only, dragging the mouth forward onto the snout without distorting the rest of the face.
- **Top of the head.** The head's upper edge is pinned just above the face oval. Reaching
  higher samples outside the oval, where there is no face — only the skin fill — which is
  what produced a flat pale band across the forehead.

Everything is driven by one 0–1 `fish` value. At 0 you get the plain cut-out face in a head
shape; at 1, full pufferfish.

## The voice filter

`Voice.play()` in `js/voice.js`: playback rate `1.42` (pitch up), an LFO warbling a very
short delay line (the "swimming" pitch), highpass 320Hz → +7dB peak at 2.1kHz →
lowpass 5.2kHz, plus a 0.4s synthetic reverb at 28% wet. Synthesised bubble pops are
scheduled at the start and end of every line.

Two knobs worth playing with in front of the client: `src.playbackRate.value` (how
cartoonish) and `lfo.frequency.value` / `lfoGain.gain.value` (how seasick).

## Known limits

- One fish per browser, by design — it's how you tell yours apart from the scenery.
- First run pulls ~6.7MB (2.9MB of MediaPipe wasm, gzipped, plus the 3.8MB model) from
  Google's CDN. The camera works immediately and the wrap switches on when it lands, but on
  a bad connection the client will see the plain feed for a few seconds first.
- Two eye patches are stored as PNG (they need alpha), so a creature is ~135KB in
  `localStorage` — far inside the ~5MB budget.
- Head roll is ignored: the eye is cut axis-aligned. Fine for people looking at a camera.
- p5's `textFont()` hands its whole argument to the canvas font shorthand, so a quoted
  multi-family stack (`"Gaegu, 'Chalkboard SE', sans-serif"`) silently falls back to the 2D
  default serif — which is why name tags used to be the only serif in the app. `useAppFont()`
  in `shared.js` sets one family and re-applies it once the webfont has actually loaded.
- Clips are held as base64 in `localStorage`; a 5s clip is well inside the ~5MB budget,
  but this is not how the real app should store audio.
- iOS needs a tap before any sound plays; the pages call `Voice.unlock()` on first touch.
- Recording needs iOS 14.3+ for `MediaRecorder`.
