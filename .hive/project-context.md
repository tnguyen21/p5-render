# Project Context — p5-render

## Overview
Headless p5.js renderer that executes sketch code strings in Node.js (no browser) and outputs PNG frames, designed for batch use in an LLM training pipeline.

## Architecture
- **`src/renderer.ts`** — Core render loop: sets up jsdom + skia-canvas environment, loads p5.js, injects sketch code, runs setup/draw, captures frames as PNG buffers. Supports both in-process and isolated (worker pool) execution.
- **`src/shim.ts`** — Creates the headless DOM environment: jsdom for DOM APIs, skia-canvas for Canvas 2D, headless-gl for WebGL. Patches `document.createElement('canvas')` to route drawing through skia-canvas.
- **`src/pool.ts` + `src/worker.ts`** — Child-process-based worker pool for isolated rendering. Workers are long-lived (fork once, reuse). WebGL sketches are serialized to a dedicated worker (headless-gl limitation). IPC uses base64-encoded PNG frames.
- **`src/global-mode-adapter.ts`** — Wraps global-mode p5 sketches (bare `setup`/`draw` functions) into instance mode via `with(p) { ... }` so they work in the headless environment.
- **`src/sandbox.ts`** — Resource limits: canvas dimension clamping (4096x4096 max), console capture (1000 line cap), timeout wrapper, structured error parsing with source location extraction.
- **`src/clock.ts`** — Deterministic time: `millis()`, `deltaTime`, `frameCount` derived purely from frame count and configured frame rate. No real clock.
- **`src/assets.ts` + `src/sound-stubs.ts`** — Stub out network-dependent APIs (`loadImage`, `loadFont`, `loadJSON`, `loadSound`, etc.) with in-memory asset map or no-ops to prevent hangs.

Data flow: code string -> `renderSketch()` -> jsdom+skia-canvas environment -> p5.js instance mode -> `setup()` -> optional warmup draws -> capture draws -> PNG `Buffer[]` result.

## Key Files
- `src/renderer.ts` — Core rendering logic, `renderSketch()` and `renderSketchInProcess()` entry points
- `src/shim.ts` — jsdom + skia-canvas + headless-gl environment creation, canvas element patching
- `src/pool.ts` — Worker pool management (child_process.fork), WebGL serialization, timeout/crash recovery
- `src/worker.ts` — Child process worker that receives render requests over IPC
- `src/global-mode-adapter.ts` — `with(p)` wrapper for global-mode sketches, lifecycle function detection
- `src/sandbox.ts` — Dimension clamping, console capture, error parsing, timeout utility
- `src/clock.ts` — Deterministic time simulation for reproducible renders
- `src/assets.ts` — Asset loader patches (loadImage, loadFont, loadJSON, etc.)
- `src/sound-stubs.ts` — Comprehensive p5.sound API stubs (SoundFile, FFT, Oscillator, etc.)
- `src/cli.ts` — CLI with single-render and batch-render (JSONL) modes
- `src/index.ts` — Public API exports
- `test/renderer.test.ts` — Main test suite: 70+ test sketches across 10 tiers
- `test/compare.ts` — Pixel-level PNG comparison (per-channel MAE -> similarity score)
- `bench/runner.ts` — Benchmark harness with cold/warm timing and baseline comparison
- `SPEC.md` — Detailed design spec (architecture, API, test plan, performance targets)

## Build & Test
- **Language**: TypeScript (ES2022 target, Node16 module resolution), strict mode
- **Package manager**: bun (`bun install`); node >=22.0.0 required at runtime
- **Build**: `bun run build` (runs `tsc`, outputs to `dist/`)
- **Test**: `bun run test` (runs `vitest run`); tests render ~70 sketches and compare against reference PNGs
- **Lint**: `npx @biomejs/biome check src/ test/ bench/`
- **Format**: `npx @biomejs/biome format --write src/ test/ bench/`
- **Type check**: `tsc` (strict mode, via build)
- **Pre-commit**: N/A
- **Quirks**:
  - Worker pool requires compiled `dist/worker.js` to exist — must run `bun run build` before using `--isolate` or batch mode
  - Native deps (`skia-canvas`, `gl`) can segfault; the worker pool is designed to survive this
  - `gl` (headless-gl) only supports WebGL 1.0 and one active GL context per process
  - Reference images generated via Playwright (`bun run generate-references`) — requires Chrome
  - Test for infinite loops (`62_infinite_loop.js`) requires `isolate: true` and has a 10s vitest timeout

## Conventions
- ESM throughout (`"type": "module"` in package.json, `.js` extensions in imports)
- `any` used liberally for p5.js/jsdom interop (p5 has no usable TS types in this context)
- Error results are structured: `{ ok: false, error, errorLine, phase, logs, partial_frames }`
- Success results: `{ ok: true, frames: Buffer[], width, height, duration_ms, logs }`
- Sketch phases tracked as `"preload" | "setup" | "draw" | "init"` for error attribution
- Console output captured and returned in results, not printed to stdout
- `queueMicrotask` used to decrement p5's preload counter for stubbed asset loaders
- Test sketches are numbered by tier (01-09 basics, 10-16 transforms, 17-21 color, etc.)
- Worker IPC protocol: `{ type: "ready" }`, `{ id, options }`, `{ type: "result", id, result }` with base64 frames

## Dependencies & Integration
- **skia-canvas** v2 — Canvas 2D implementation backed by Skia (Rust bindings), used for all 2D rendering and PNG output
- **jsdom** v26 — DOM shim providing `document`, `window`, `createElement`, event system that p5.js requires
- **p5** v1.11 — The p5.js library itself, loaded as a script into the jsdom window
- **gl** v8 (headless-gl) — WebGL 1.0 implementation for WEBGL-mode sketches, lazily loaded
- **vitest** v3 — Test framework
- **playwright** — Dev dependency for generating browser-rendered reference images
- **tsx** — Dev dependency for running TypeScript directly (test scripts, benchmarks)
- No network access at runtime; all assets provided via in-memory `AssetMap`

## Gotchas
- **Two CLI implementations exist**: `bin/p5-render.js` (plain JS, standalone) and `src/cli.ts` (TypeScript, more features like `--warmup`/`--simulate-interaction`). They have diverged; `src/cli.ts` is the canonical one.
- **`with(p)` requires sloppy mode**: The global-mode adapter uses `with` statements, which are forbidden in strict mode. The `new Function()` constructor creates sloppy-mode functions, making this work.
- **headless-gl single-context limitation**: Only one process thread can create GL contexts. The pool pins all WebGL renders to a single dedicated worker.
- **p5 init is async**: p5.js uses `setTimeout` internally during initialization. The renderer polls with `stepFrame()` + `yieldToEventLoop()` up to 50 times waiting for setup to complete.
- **Filter CPU path forced**: `p.filter()` is monkey-patched to pass `false` as the third arg, forcing the CPU path because p5 v1.11+ defaults to WebGL for filters, which fails headless.
- **Seed applied twice**: Random seed is set both before p5 construction (for top-level `random()` calls) and in the wrapped `setup()` to ensure determinism.
- **`createCapture` stubbed**: Camera access would hang; returns a fake video element with enough surface area for p5 to not crash.
- **Canvas dimensions clamped globally**: Both in `sandbox.ts` (at the options level) and in `shim.ts` (at the canvas element level) to 4096x4096.
- **Base64 frame transfer**: Worker pool serializes PNG buffers as base64 strings over IPC, then decodes on the parent side. This adds overhead for large/many frames.
