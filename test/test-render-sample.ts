/**
 * Sample real p5js sketches from a JSONL dataset and test if p5-render can render them.
 * Reports success/failure rates and error breakdowns.
 *
 * Usage:
 *   npx tsx test/test-render-sample.ts <input.jsonl> [--sample N] [--timeout MS] [--concurrency N] [--out-dir DIR]
 *
 * Example:
 *   npx tsx test/test-render-sample.ts ../data/openprocessing/train.jsonl --sample 1000 --concurrency 8
 *   npx tsx test/test-render-sample.ts ../data/openprocessing/train.jsonl --sample 100 --out-dir test/render-sample-output
 */

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSketch } from "../src/renderer.js";
import { destroyPool } from "../src/pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Sketch {
  id: number;
  title: string;
  mode: string;
  code: string[];
}

// Parse CLI args
const argv = process.argv.slice(2);
let inputPath: string | undefined;
let sampleSize = 1000;
let timeout = 5000;
let concurrency = 2;
let outDir: string | undefined;

for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--sample") { sampleSize = parseInt(argv[++i], 10); continue; }
  if (argv[i] === "--timeout") { timeout = parseInt(argv[++i], 10); continue; }
  if (argv[i] === "--concurrency") { concurrency = parseInt(argv[++i], 10); continue; }
  if (argv[i] === "--out-dir") { outDir = argv[++i]; continue; }
  if (!argv[i].startsWith("-") && !inputPath) { inputPath = argv[i]; continue; }
}

if (!inputPath) {
  console.error("Usage: npx tsx test/test-render-sample.ts <input.jsonl> [--sample N] [--timeout MS] [--concurrency N] [--out-dir DIR]");
  process.exit(1);
}

const resolvedInput = resolve(inputPath);
const RESULTS_PATH = resolve(__dirname, "render-sample-results.jsonl");
const resolvedOutDir = outDir ? resolve(outDir) : undefined;

if (resolvedOutDir) mkdirSync(resolvedOutDir, { recursive: true });

// Load and filter to p5js
console.log(`Loading sketches from ${resolvedInput}...`);
if (resolvedOutDir) console.log(`Saving PNGs to ${resolvedOutDir}/`);
const lines = readFileSync(resolvedInput, "utf-8").split("\n").filter((l) => l.trim());
const allSketches: Sketch[] = [];
for (const line of lines) {
  const obj = JSON.parse(line);
  if (obj.mode === "p5js") allSketches.push(obj);
}
console.log(`Found ${allSketches.length} p5js sketches`);

// Deterministic shuffle with seed
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sample = seededShuffle(allSketches, 12345).slice(0, sampleSize);
console.log(`Sampled ${sample.length} sketches\n`);

// Track results
interface Result {
  id: number;
  title: string;
  ok: boolean;
  error?: string;
  phase?: string;
  duration_ms?: number;
  width?: number;
  height?: number;
}

let completed = 0;
let successes = 0;
let failures = 0;
const errorCategories = new Map<string, number>();

function categorizeError(error: string): string {
  if (error.includes("Timeout")) return "timeout";
  if (error.includes("is not defined")) {
    const match = error.match(/(\w+) is not defined/);
    return match ? `undefined: ${match[1]}` : "undefined_var";
  }
  if (error.includes("is not a function")) return "not_a_function";
  if (error.includes("Cannot read properties of")) return "null_property_access";
  if (error.includes("did not produce a function")) return "not_a_sketch_function";
  if (error.includes("setup() to complete")) return "setup_timeout";
  if (error.includes("SyntaxError") || error.includes("Unexpected token")) return "syntax_error";
  if (error.includes("Maximum call stack")) return "stack_overflow";
  if (error.includes("could not capture frame")) return "no_frame_captured";
  if (error.includes("loadImage") || error.includes("loadFont") || error.includes("loadSound")) return "missing_asset";
  if (error.includes("WebGL") || error.includes("WEBGL")) return "webgl";
  return "other";
}

async function renderOne(sketch: Sketch, idx: number): Promise<Result> {
  const code = sketch.code.join("\n");
  const label = `[${idx + 1}/${sample.length}] #${sketch.id} "${sketch.title}"`;
  process.stdout.write(`\r\x1b[K${label} ...`);

  try {
    const result = await renderSketch({
      code,
      timeout,
      isolate: true,
      seed: 42,
    });

    if (result.ok) {
      if (resolvedOutDir) {
        writeFileSync(join(resolvedOutDir, `${sketch.id}.png`), result.frames[0]);
      }
      process.stdout.write(`\r\x1b[K${label} \x1b[32mok\x1b[0m ${result.duration_ms}ms\n`);
      return {
        id: sketch.id,
        title: sketch.title,
        ok: true,
        duration_ms: result.duration_ms,
        width: result.width,
        height: result.height,
      };
    } else {
      const cat = categorizeError(result.error);
      process.stdout.write(`\r\x1b[K${label} \x1b[31mfail\x1b[0m [${cat}] ${result.error.slice(0, 80)}\n`);
      return {
        id: sketch.id,
        title: sketch.title,
        ok: false,
        error: result.error,
        phase: result.phase,
      };
    }
  } catch (err: any) {
    process.stdout.write(`\r\x1b[K${label} \x1b[31mcrash\x1b[0m ${(err?.message || String(err)).slice(0, 80)}\n`);
    return {
      id: sketch.id,
      title: sketch.title,
      ok: false,
      error: err?.message || String(err),
      phase: "crash",
    };
  }
}

async function main() {
  // Clear previous results
  writeFileSync(RESULTS_PATH, "");

  const startTime = Date.now();

  // Process in small batches
  for (let i = 0; i < sample.length; i += concurrency) {
    const batch = sample.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((s, j) => renderOne(s, i + j)));

    for (const r of batchResults) {
      completed++;
      if (r.ok) {
        successes++;
      } else {
        failures++;
        const cat = categorizeError(r.error || "unknown");
        errorCategories.set(cat, (errorCategories.get(cat) || 0) + 1);
      }
      // Append incrementally so we don't lose data on crash
      appendFileSync(RESULTS_PATH, JSON.stringify(r) + "\n");
    }
  }

  await destroyPool();

  // Final report
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Results (${totalTime}s total) ===`);
  console.log(`Total:    ${completed}`);
  console.log(`Success:  ${successes} (${(successes / completed * 100).toFixed(1)}%)`);
  console.log(`Failures: ${failures} (${(failures / completed * 100).toFixed(1)}%)`);
  console.log(`\n--- Error breakdown ---`);

  const sorted = [...errorCategories.entries()].sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sorted) {
    console.log(`  ${cat}: ${count} (${(count / failures * 100).toFixed(1)}%)`);
  }

  console.log(`\nDetailed results: ${RESULTS_PATH}`);
  if (resolvedOutDir) console.log(`Rendered PNGs:    ${resolvedOutDir}/`);
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
