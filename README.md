# Lance Morrison Warpgate

A portfolio you fly through. Scrolling moves a camera through space, past a warpgate and three sectors of worlds, one world per project. Nova, a Live2D character, rides along in the corner as navigator and steps up to centre stage at her own stop. Every film and prototype opens inside the site and runs in the browser.

It's a static site: plain HTML, CSS and JavaScript modules, with three.js and Lenis loaded from jsDelivr. There is no build step.

## Run it locally

```bash
python3 -m http.server 8790
```

Then open http://localhost:8790. It needs to be served over HTTP (not opened as a file) because the modules, Nova's model and the works load with `fetch`.

## Put it online

Any static host works. For GitHub Pages:

1. Push this folder to a repository (for example `LStar977/portfolio`).
2. In the repository's Settings, open Pages and set the source to the `main` branch, root folder.

The largest files are the two anime openings in `works/` (about 50 MB each, every file under 8 MB) and the Lantern Gorge film in `assets/media/` (35 MB), so the repository is about 160 MB in total.

## How it's organised

| Path | What it is |
| --- | --- |
| `index.html` | All the copy, one `<section>` per stop. Each stop's `data-*` attributes set its accent colour, where its world sits on screen, and Nova's line and mood. |
| `css/site.css` | The cockpit HUD, the dossiers, and the two layouts: fixed "flight" panels on desktop, a normal scrolling page on phones and with reduced motion. |
| `js/main.js` | Wires everything together and runs the frame loop. |
| `js/scene.js` | Renderer, starfields, warp streaks, nebula, the camera's route (`ROUTE`) and post effects. |
| `js/worlds.js` | One procedural world per stop: the gate, the Represent star and its 1,460 lights, TITAN's rings, the Distill vortex, the Contrail globe, and the rest. |
| `js/flight.js` | Turns scroll position into a place on the route, and keeps the panels, HUD and route map in step. |
| `js/nova.js` | Loads Nova's rig, types her lines, follows the pointer and moves her between the comm window and the stage. |
| `js/audio.js` | Sound, synthesized live. Off until a visitor turns it on. |
| `js/theater.js` | Opens a work (a page or a video) over the cockpit. |
| `assets/media/` | Preview loops, posters, screenshots and the Lantern Gorge film. |
| `assets/nova/` | Nova's model, the v5 motion rig, the Live2D Cubism Core runtime and its licences, and Nova Studio (`viewer/`). |
| `works/` | The playable pieces: both anime openings, Count Me In, The Record in Light, Represent Reimagined, the TITAN preview, Radar and the Golden Acropolis tour. |

## Changing things

- **Copy:** edit the section in `index.html`. Nova's line for a stop is its `data-line`.
- **Add a stop:** add a `<section class="stop" data-stop="your-id" ...>` in `index.html`, add a world builder to `BUILDERS` in `js/worlds.js`, and add an entry with the same id to `ROUTE` in `js/scene.js`, in the same order as the sections.
- **Contact:** the last stop only links to GitHub. Add an email address there if you want one.

## Credits and licences

- Nova's model uses Live2D Cubism Core, under the Live2D Proprietary Software License. The licence files are in `assets/nova/vendor/licenses/`.
- The Contrail globe's land dots are sampled from Natural Earth's 110m land data, by way of the `world-atlas` package.
- Icons are from Phosphor Icons (MIT).
- Typefaces: Anybody, Geist, Geist Mono, Shippori Mincho B1 and M PLUS Rounded 1c, from Google Fonts.
