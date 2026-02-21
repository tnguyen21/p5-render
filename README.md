# p5-render

Headless p5.js renderer. Takes a sketch, outputs PNGs. No browser needed.

Built on jsdom + skia-canvas — jsdom provides the DOM, skia-canvas does the actual drawing.

## Setup

```
npm install
npm run build
```

Requires Node >= 22.

## CLI

```bash
# render a sketch to PNG
p5-render sketch.js -o output.png

# multi-frame
p5-render sketch.js --frames 60 --out-dir frames/

# pipe from stdin
echo 'function setup() { createCanvas(400,400); background(220); circle(200,200,100); }' | p5-render -o out.png

# with options
p5-render sketch.js -o out.png --seed 42 --width 800 --height 600 --timeout 10000

# batch mode (JSONL input, each line has {id, code})
p5-render batch sketches.jsonl --out-dir renders/
```

## API

```ts
import { renderSketch } from "p5-render";

const result = await renderSketch({
  code: `function setup() { createCanvas(400,400); background(220); circle(200,200,100); }`,
  frames: 1,
  seed: 42,
});

if (result.ok) {
  fs.writeFileSync("out.png", result.frames[0]);
} else {
  console.error(result.error);
}
```

Options:
- `code` — sketch source (global or instance mode)
- `width`, `height` — canvas size (default 400x400, max 4096)
- `frames` — number of frames to render (default 1)
- `frameRate` — simulated frame rate (default 60)
- `seed` — deterministic random seed
- `timeout` — max execution time in ms (default 5000)
- `assets` — `Record<string, Buffer>` map for `loadImage()` / `loadFont()`
- `isolate` — run in a worker thread (kills synchronous infinite loops)

## Dev commands

```bash
npm run build          # compile ts
npm test               # run tests (vitest)
npm run test:watch     # watch mode
npm run bench          # run perf benchmarks
npm run lint           # biome check
npm run format         # biome format
```

### Benchmarks

```bash
npx tsx bench/runner.ts                       # run all
npx tsx bench/runner.ts --sketch noop         # single sketch
npx tsx bench/runner.ts --save baseline.json  # save baseline
npx tsx bench/runner.ts --compare baseline.json  # compare against baseline
```

### Render all test sketches

Render every test sketch to PNG for visual inspection:

```bash
bun run render-all            # outputs to test/renders/
bun run render-all /tmp/out   # custom output directory
open test/renders/            # browse results
```

### Real-world sketch test

Batch-render a sample of real OpenProcessing sketches from `data/openprocessing/train.jsonl` and report success/failure rates with error breakdowns:

```bash
npx tsx ../scripts/test-render-sample.ts                          # default: 1000 sketches, concurrency 2
npx tsx ../scripts/test-render-sample.ts --sample 500             # smaller sample
npx tsx ../scripts/test-render-sample.ts --sample 1000 --concurrency 8 --timeout 10000
```

Results are written incrementally to `data/render-test-results.jsonl` (survives crashes).

### Reference images

Test sketches are compared against browser-rendered reference PNGs (when they exist).

```bash
npx tsx test/generate-references.ts   # regenerate via Playwright + Chromium
```
