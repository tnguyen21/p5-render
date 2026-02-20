# p5-render — Spec

## Goal

A Node.js library and CLI that accepts a p5.js sketch as a code string, executes it
headlessly (no browser), and outputs rendered frames as PNG images. Designed for batch
use in an LLM training pipeline where thousands of sketches need to be rendered quickly,
reliably, and deterministically.

---

## Non-goals

- Browser/client-side usage
- WebGL / WEBGL mode (2D canvas only, for now)
- Interactive features (mouse, keyboard, DOM elements)
- Audio, video, or webcam input
- Full Processing compatibility (p5.js only)

---

## Architecture

```
Sketch code string (JavaScript)
        │
        ▼
┌──────────────────────────────────┐
│  Renderer process                │
│                                  │
│  1. Minimal DOM shim (jsdom)     │
│  2. skia-canvas as Canvas impl   │
│  3. p5.js loaded in instance mode │
│  4. Sketch code injected & run   │
│  5. Frame(s) captured as PNG     │
└──────────────────────────────────┘
        │
        ▼
PNG buffer(s) + metadata (errors, frame count, timing)
```

### Why instance mode

p5.js has two modes:
- **Global mode**: pollutes the global namespace with `setup`, `draw`, `fill`, etc.
- **Instance mode**: `new p5((p) => { p.setup = ...; p.draw = ... })`

Instance mode is required for isolation. Multiple sketches in the same process must not
interfere with each other. All test sketches and documentation should use instance mode.

However — most sketches in the wild use global mode. The renderer must support both.
For global mode, wrap the user's code in an instance mode adapter:

```js
function wrapGlobalSketch(code) {
  return `(p) => {
    with (p) {
      ${code}
    }
  }`;
}
```

We do NOT enforce strict mode, so `with` is available. This is the simplest approach and
should handle the vast majority of global-mode sketches. If edge cases arise (e.g.,
sketches that shadow p5 method names with local variables), we can add a Proxy-based
fallback later.

---

## Interface

### Library API

```js
import { renderSketch } from "p5-render";

const result = await renderSketch({
  code: `function setup() { createCanvas(400, 400); }
         function draw() { background(220); circle(200, 200, 100); }`,

  // Options (all optional, with sane defaults)
  width: 400,            // override canvas width (default: from sketch's createCanvas)
  height: 400,           // override canvas height
  frames: 1,             // number of frames to render (default: 1)
  frameRate: 60,         // simulated frame rate (default: 60)
  seed: 42,              // random seed for reproducibility (default: none)
  timeout: 5000,         // max execution time in ms (default: 5000)
  assets: {              // pre-loaded assets (optional)
    "cat.png": Buffer,   // loadImage("cat.png") resolves to this buffer
    "font.ttf": Buffer,
  },
});

// result shape:
// {
//   ok: true,
//   frames: [Buffer, Buffer, ...],   // PNG buffers
//   width: 400,
//   height: 400,
//   duration_ms: 23,                  // wall-clock time to render
//   logs: ["console.log output..."],  // captured console.log output
// }
//
// or on failure:
// {
//   ok: false,
//   error: "ReferenceError: foo is not defined",
//   errorLine: 3,                    // line number in user code, if available
//   logs: [...],
//   partial_frames: [Buffer],        // any frames captured before the error
// }
```

### CLI

```bash
# Render a sketch file, output PNG
p5-render sketch.js -o output.png

# Render from stdin
echo 'function setup() { createCanvas(400,400); background(220); circle(200,200,100); }' \
  | p5-render -o output.png

# Render multiple frames
p5-render sketch.js --frames 60 -o frames/

# Batch render from a JSONL file (one sketch per line)
p5-render batch sketches.jsonl --out-dir renders/ --concurrency 8

# Render with seed for reproducibility
p5-render sketch.js -o output.png --seed 42
```

### Batch/server mode

For the LLM training pipeline, repeatedly spawning a CLI process is wasteful. Provide a
long-lived server mode:

```bash
# Start a render server on a Unix socket
p5-render serve --socket /tmp/p5-render.sock --workers 8
```

Or use the library API in a long-lived process (the primary use case).

---

## Dependencies

| Package | Purpose | Why this one |
|---------|---------|-------------|
| `skia-canvas` | Canvas 2D implementation | Backed by Skia (Chrome's engine) via Rust bindings. Faster than `node-canvas` (Cairo). Better text rendering. GPU-acceleratable. |
| `jsdom` | Minimal DOM shim | p5.js expects `document`, `window`, `createElement`. jsdom provides this. |
| `p5` | p5.js itself | Loaded once, reused across renders. Pin to a specific version for reproducibility. |

### Why `skia-canvas` over `node-canvas`

- **Performance**: Skia is consistently faster for path rendering, gradients, and compositing.
- **Text**: Better font fallback, better subpixel positioning.
- **Maintenance**: `skia-canvas` is actively maintained; `node-canvas` has a long history of build issues.
- **Backend**: Skia is what Chrome actually uses, so rendering fidelity vs. browser is higher.

### Why `jsdom` and not a lighter shim

p5.js touches a surprising amount of DOM API during initialization:
- `document.createElement('canvas')`
- `document.body.appendChild`
- `window.requestAnimationFrame`
- `window.innerWidth`, `window.innerHeight`
- `document.hasFocus()`
- Various event listener registration

A hand-rolled shim would need to stub all of these. jsdom handles it. The overhead is
~10ms on init, amortized to near-zero in server mode.

If jsdom proves too heavy or causes compatibility issues, we can replace it later with
a minimal shim — but start with jsdom for correctness.

---

## Reproducibility

### Random seed

p5.js uses its own PRNG via `randomSeed()` and `noiseSeed()`. When the renderer is
configured with a `seed` option:

1. Call `p.randomSeed(seed)` and `p.noiseSeed(seed)` before setup()
2. Override `Math.random` with a seeded PRNG (e.g., mulberry32) for any code that
   bypasses p5's random functions

This ensures identical output for the same sketch + seed, regardless of when or where
it's rendered. Critical for dataset generation and debugging.

### Deterministic frame timing

In a browser, `draw()` is called by `requestAnimationFrame` at whatever rate the browser
decides. Headlessly, we control time:

- `frameCount` advances by 1 each call
- `millis()` returns `frameCount * (1000 / frameRate)`
- `deltaTime` is fixed at `1000 / frameRate`

No real clock involved. Same sketch + seed + frame count = same output, always.

---

## Resource limits and sandboxing

LLM-generated sketches will be broken, pathological, or adversarial. The renderer must
handle all of these gracefully.

### Timeout

- Default: 5 seconds total wall-clock time per sketch
- Configurable via `timeout` option
- Implementation: run sketch in a worker thread with `worker_threads`, terminate on timeout
- Timeout produces an error result, not a crash

### Canvas size limits

- Max dimensions: 4096 x 4096 (configurable)
- If sketch calls `createCanvas(10000, 10000)`, clamp and log a warning
- Prevents OOM from absurd canvas allocations

### Infinite loops in draw()

- Each `draw()` call gets a per-frame timeout (e.g., 500ms)
- If a single frame exceeds this, abort and return partial results
- Track frame count; if sketch hasn't called `noLoop()` and we've rendered the requested
  frames, stop

### Memory limits

- Monitor heap usage per render
- If a sketch exceeds a threshold (e.g., 256MB), terminate it
- Use `worker_threads` so a killed sketch doesn't bring down the host process

### Console capture

- Override `console.log`, `console.warn`, `console.error` inside the sketch context
- Capture all output in an array, return it in the result
- Cap at 1000 lines to prevent memory abuse

---

## Error handling

Errors must be structured so the LLM can understand and fix them.

```js
{
  ok: false,
  error: "TypeError: Cannot read properties of undefined (reading 'x')",
  errorLine: 12,       // line in user code (not p5.js internals)
  errorColumn: 5,
  errorStack: "...",   // full stack trace (for debugging, not for LLM)
  phase: "draw",       // "setup" | "draw" | "preload" | "init"
  frameNumber: 34,     // which frame it died on (if during draw)
  logs: [...],
  partial_frames: [Buffer],  // frames captured before the error
}
```

### Source mapping

p5.js wraps user code in various ways. When an error occurs inside p5.js internals
(e.g., inside `image()` because of a bad argument), the stack trace points to p5.js
source, not user code. Where possible, trace back to the user's call site.

---

## p5.js API coverage

### Must work (core drawing)

These are the primitives that 95% of generative art sketches use:

**Shapes**
- `circle`, `ellipse`, `rect`, `square`, `triangle`, `quad`, `point`, `line`, `arc`

**Paths / vertices**
- `beginShape`, `endShape`, `vertex`, `curveVertex`, `bezierVertex`

**Color**
- `background`, `fill`, `noFill`, `stroke`, `noStroke`, `strokeWeight`
- `color`, `lerpColor`, `red`, `green`, `blue`, `alpha`, `hue`, `saturation`, `brightness`
- `colorMode` (RGB, HSB, HSL)

**Transforms**
- `translate`, `rotate`, `scale`, `push`, `pop`
- `applyMatrix`, `resetMatrix`, `shearX`, `shearY`

**Math & noise**
- `random`, `randomSeed`, `randomGaussian`
- `noise`, `noiseSeed`, `noiseDetail`
- `map`, `lerp`, `constrain`, `dist`, `mag`
- `sin`, `cos`, `tan`, `atan2`, `PI`, `TWO_PI`, `HALF_PI`
- `floor`, `ceil`, `round`, `abs`, `sqrt`, `pow`, `exp`, `log`
- `min`, `max`, `norm`
- `createVector` (p5.Vector class)

**Typography**
- `text`, `textSize`, `textFont`, `textAlign`, `textLeading`, `textWidth`, `textAscent`, `textDescent`
- `textStyle` (BOLD, ITALIC, NORMAL)

**Canvas control**
- `createCanvas`, `resizeCanvas`, `pixelDensity`
- `width`, `height`
- `frameCount`, `frameRate`, `millis`, `deltaTime`
- `loop`, `noLoop`, `redraw`

**Image / pixel manipulation**
- `loadPixels`, `updatePixels`, `get`, `set`, `pixels`
- `createImage`, `image`
- `loadImage` (resolved from `assets` map — no network access)
- `blend`, `copy`, `filter` (GRAY, INVERT, BLUR, etc.)

**Blending**
- `blendMode` (BLEND, ADD, MULTIPLY, SCREEN, etc.)

### Should work (nice to have)

- `createGraphics` (offscreen buffer)
- `bezier`, `curve` (standalone functions)
- `erase`, `noErase`
- `tint`, `noTint`
- `imageMode`, `rectMode`, `ellipseMode`
- `angleMode` (RADIANS, DEGREES)

### Explicitly unsupported

These will be stubbed to no-op or throw a clear error:

- `createCapture` (webcam)
- `createAudio`, `loadSound`
- All DOM manipulation (`createButton`, `createSlider`, `createDiv`, etc.)
- All event handlers (`mousePressed`, `keyPressed`, etc.) — `mouseX`/`mouseY` will be
  fixed at `width/2, height/2` so sketches that reference them don't crash
- `WEBGL` mode (return clear error: "WEBGL not supported in headless mode")
- `save`, `saveCanvas`, `saveFrames` (we control output, not the sketch)
- Network: `httpGet`, `httpPost`, `loadJSON`, `loadStrings`, `loadTable` from URLs

---

## Test suite

Tests should compare rendered output against reference images from a real browser. Use
pixel-level comparison with a tolerance threshold (e.g., SSIM > 0.98 or per-pixel
delta < 2/255).

### Tier 1 — Basic rendering (must pass before anything else)

```
test/sketches/
├── 01_blank_canvas.js          # createCanvas(400,400); background(220);
├── 02_single_circle.js         # background(220); circle(200,200,100);
├── 03_fill_stroke.js           # fill(255,0,0); stroke(0,0,255); strokeWeight(4); circle(200,200,100);
├── 04_rect_and_ellipse.js      # rect, ellipse with different modes
├── 05_lines_and_points.js      # line(), point() with various weights
├── 06_triangle_quad.js         # triangle(), quad()
├── 07_arcs.js                  # arc() with different modes (PIE, CHORD, OPEN)
├── 08_background_color.js      # background with RGB, HSB
├── 09_no_fill_no_stroke.js     # noFill, noStroke, combinations
└── 10_alpha_transparency.js    # fill with alpha, overlapping shapes
```

### Tier 2 — Transforms and state

```
├── 11_translate.js             # translate + draw shape
├── 12_rotate.js                # rotate around center
├── 13_scale.js                 # scale up and down
├── 14_push_pop.js              # nested push/pop with style changes
├── 15_combined_transforms.js   # translate + rotate + scale stacked
└── 16_nested_transforms.js     # multiple push/pop levels, verify correct isolation
```

### Tier 3 — Color

```
├── 17_hsb_mode.js              # colorMode(HSB); fill with HSB values
├── 18_hsl_mode.js              # colorMode(HSL)
├── 19_lerp_color.js            # gradient via lerpColor
├── 20_blend_modes.js           # ADD, MULTIPLY, SCREEN over colored rects
└── 21_color_object.js          # color(), red(), green(), blue(), alpha()
```

### Tier 4 — Paths and vertices

```
├── 22_begin_end_shape.js       # custom polygon with vertex()
├── 23_curve_vertex.js          # curveVertex() smooth curve
├── 24_bezier_vertex.js         # bezierVertex() cubic curves
├── 25_close_shape.js           # CLOSE vs open shapes
├── 26_contour.js               # beginContour/endContour for holes
└── 27_complex_path.js          # mixed vertex types in one shape
```

### Tier 5 — Typography

```
├── 28_basic_text.js            # text("hello", x, y)
├── 29_text_size_align.js       # textSize, textAlign (LEFT, CENTER, RIGHT)
├── 30_text_style.js            # BOLD, ITALIC
└── 31_text_leading.js          # multiline text with textLeading
```

### Tier 6 — Pixels and images

```
├── 32_load_pixels.js           # loadPixels, read pixel values
├── 33_set_pixels.js            # set() individual pixels, draw a gradient manually
├── 34_pixel_manipulation.js    # loadPixels + modify + updatePixels (e.g., invert)
├── 35_create_image.js          # createImage, draw into it, display it
├── 36_load_image.js            # loadImage from assets map, display it
├── 37_image_filter.js          # filter(GRAY), filter(INVERT), filter(BLUR, 3)
└── 38_get_region.js            # get(x, y, w, h) to copy a region
```

### Tier 7 — Noise and randomness (reproducibility)

```
├── 39_random_seed.js           # randomSeed(42); draw random dots; must be identical across runs
├── 40_noise_seed.js            # noiseSeed(42); draw noise field; must be identical across runs
├── 41_random_gaussian.js       # randomGaussian distribution visualization
└── 42_noise_2d.js              # 2D noise grid
```

### Tier 8 — Multi-frame rendering

```
├── 43_animation_basic.js       # circle moves right each frame; capture frames 0, 30, 59
├── 44_frame_count.js           # draw frameCount as text; verify it increments
├── 45_no_loop.js               # noLoop() in setup; should render exactly 1 frame
├── 46_redraw.js                # noLoop() + redraw(); verify it works
└── 47_frame_rate_timing.js     # millis() and deltaTime correctness at different frameRates
```

### Tier 9 — Real-world sketches

These are actual generative art patterns. The goal isn't pixel-perfect matching but
"does it render something reasonable and not crash."

```
├── 50_flow_field.js            # Perlin noise flow field with particles
├── 51_recursive_tree.js        # Recursive branching tree
├── 52_circle_packing.js        # Circle packing algorithm
├── 53_truchet_tiles.js         # Truchet tile grid
├── 54_lissajous.js             # Lissajous curve animation
├── 55_reaction_diffusion.js    # Reaction-diffusion (pixel-level compute)
├── 56_voronoi.js               # Voronoi diagram
├── 57_spirograph.js            # Parametric spirograph
├── 58_maze_generator.js        # Maze with DFS and rendering
└── 59_generative_landscape.js  # Layered noise landscape
```

### Tier 10 — Error handling and edge cases

```
├── 60_syntax_error.js          # broken JS — verify structured error return
├── 61_runtime_error.js         # reference undefined variable in draw()
├── 62_infinite_loop.js         # while(true){} in draw — verify timeout
├── 63_huge_canvas.js           # createCanvas(99999, 99999) — verify clamping
├── 64_no_create_canvas.js      # sketch that forgets createCanvas — should still work (p5 default)
├── 65_nan_coordinates.js       # circle(NaN, NaN, NaN) — should not crash
├── 66_missing_setup.js         # sketch with draw() but no setup()
├── 67_empty_sketch.js          # completely empty string
└── 68_massive_console_log.js   # console.log in a loop 100k times — verify cap
```

---

## Project structure

```
p5-render/
├── SPEC.md                     # this file
├── package.json
├── tsconfig.json               # TypeScript, strict mode
├── src/
│   ├── index.ts                # public API: renderSketch()
│   ├── renderer.ts             # core rendering logic
│   ├── shim.ts                 # DOM shim setup (jsdom + skia-canvas wiring)
│   ├── sandbox.ts              # sketch isolation, timeout, resource limits
│   ├── global-mode-adapter.ts  # wraps global-mode sketches into instance mode
│   ├── clock.ts                # deterministic time (millis, deltaTime, frameCount)
│   ├── assets.ts               # asset loading from buffers (images, fonts)
│   └── cli.ts                  # CLI entry point
├── test/
│   ├── sketches/               # all test sketch .js files
│   ├── references/             # reference PNGs rendered from a real browser
│   ├── generate-references.ts  # Playwright script to render reference PNGs in a real browser
│   ├── compare.ts              # SSIM / pixel-diff comparison utility
│   └── renderer.test.ts        # test runner: render each sketch, compare to reference
└── bin/
    └── p5-render               # CLI shim
```

---

## Reference image generation

To verify correctness, we need browser-rendered reference images.

1. Use Playwright to open a real Chrome browser
2. For each test sketch, inject it into an HTML page with real p5.js
3. Screenshot the canvas after N frames
4. Save as the reference PNG

This runs once (or when test sketches change). The CI pipeline compares headless output
against these references.

```bash
# Generate reference images (requires Chrome)
npm run generate-references

# Run comparison tests
npm test
```

---

## Performance targets

| Metric | Target | Notes |
|--------|--------|-------|
| Cold start (first render) | < 500ms | jsdom + p5.js init |
| Warm render (simple sketch, 1 frame) | < 50ms | amortized init |
| Warm render (complex sketch, 1 frame) | < 200ms | flow field, particle system |
| Batch throughput (simple, 8 workers) | > 500 sketches/min | target for training pipeline |
| Memory per worker | < 100MB | including V8 heap |

---

## Benchmarks

Performance tracking is critical — we need a baseline to catch regressions and measure
the impact of optimizations. Benchmarks run as a separate command, not part of the
regular test suite.

### Benchmark sketches

A curated set of sketches that stress different parts of the renderer. Each is tagged
with what it exercises.

```
bench/sketches/
├── noop.js                     # empty draw(), measures pure overhead
├── shapes_100.js               # 100 filled circles, basic shape throughput
├── shapes_10k.js               # 10,000 circles, shape throughput at scale
├── path_complex.js             # beginShape with 1000 vertices, path rendering
├── transforms_nested.js        # 50 nested push/pop + translate/rotate
├── noise_grid.js               # 100x100 noise-driven pixel grid, math + pixel writes
├── pixel_readwrite.js          # loadPixels, modify every pixel, updatePixels
├── text_heavy.js               # 200 text() calls with varying sizes
├── blend_modes.js              # overlapping rects with every blend mode
├── flow_field.js               # 5000 particles following noise field (real-world proxy)
├── animation_60f.js            # simple animation, 60 frames, measures multi-frame cost
└── animation_300f.js           # 300 frames, longer animation baseline
```

### What we measure

For each benchmark sketch:

| Metric | Description |
|--------|-------------|
| **cold_ms** | Time from `renderSketch()` call to PNG output, first run (includes all init) |
| **warm_ms** | Same, but with renderer already initialized (mean of 20 runs) |
| **warm_p50** | Median warm render time |
| **warm_p99** | 99th percentile warm render time (catches GC spikes) |
| **peak_heap_mb** | Peak V8 heap usage during render |
| **png_bytes** | Output PNG size (sanity check — catches blank renders) |

For batch benchmarks (additional):

| Metric | Description |
|--------|-------------|
| **throughput** | Sketches per second at concurrency 1, 4, 8 |
| **total_rss_mb** | Total process RSS at peak concurrency |

### Runner

```bash
# Run all benchmarks
npm run bench

# Run a specific benchmark
npm run bench -- --sketch noop

# Compare against saved baseline
npm run bench -- --compare baseline.json

# Save current results as new baseline
npm run bench -- --save baseline.json
```

### Output format

Results saved as JSON for programmatic comparison:

```json
{
  "timestamp": "2026-02-20T12:00:00Z",
  "node_version": "v22.x.x",
  "platform": "darwin-arm64",
  "p5_version": "1.11.3",
  "results": {
    "noop": {
      "cold_ms": 142,
      "warm_ms": 3.2,
      "warm_p50": 2.9,
      "warm_p99": 8.1,
      "peak_heap_mb": 48,
      "png_bytes": 1234
    },
    "shapes_10k": { ... },
    ...
  },
  "batch": {
    "sketch": "shapes_100",
    "count": 500,
    "concurrency_1_sps": 145,
    "concurrency_4_sps": 510,
    "concurrency_8_sps": 820,
    "peak_rss_mb": 380
  }
}
```

### Comparison output

When running with `--compare`, the runner prints a table highlighting regressions:

```
Benchmark          Warm (ms)   Δ         Status
─────────────────────────────────────────────────
noop               3.2         +0.1      ✓
shapes_100         12.4        +0.3      ✓
shapes_10k         89.2        +14.1     ⚠ REGRESSION (+18.8%)
path_complex       22.1        -2.3      ✓ (faster)
flow_field         156.3       +3.2      ✓
```

Flag any metric that regresses by more than 10% from baseline.

### Project structure (updated)

```
p5-render/
├── ...
├── bench/
│   ├── sketches/               # benchmark sketch .js files
│   ├── runner.ts               # benchmark harness
│   ├── compare.ts              # baseline comparison logic
│   └── baseline.json           # checked-in baseline results
```

---

## Open questions to resolve during implementation

1. **Global mode wrapping**: `with(p) { ... }` should work since we don't enforce strict
   mode. Still worth prototyping early to confirm p5.js behaves correctly under `with`.

2. **p5.js version pinning**: which version? Latest stable (1.x) or the new 2.0 beta?
   1.x has more real-world sketches, 2.0 has better ESM support. Start with 1.x.

3. **Font rendering**: fonts are the #1 source of cross-platform rendering differences.
   Bundle a default font (e.g., DejaVu Sans) and use it unless the sketch specifies one.
   This ensures deterministic text rendering.

4. **Worker threads vs. child processes**: worker threads share memory and are faster
   to spawn, but a crash in a worker can corrupt shared state. Child processes are
   heavier but fully isolated. Start with worker threads, switch if stability issues arise.

5. **createGraphics()**: this creates an offscreen p5.Renderer. Need to shim this to
   create another skia-canvas Canvas instance. Not trivial but not hard.

6. **Pixel density**: `pixelDensity(2)` doubles the actual canvas size. Support it, but
   default to `pixelDensity(1)` for determinism unless the sketch explicitly sets it.
