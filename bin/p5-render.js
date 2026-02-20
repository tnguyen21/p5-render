#!/usr/bin/env node

/**
 * p5-render CLI
 *
 * Usage:
 *   p5-render <sketch.js> -o <output.png> [--frames N] [--seed N] [--timeout N] [--width N] [--height N]
 *   p5-render batch <input.jsonl> --out-dir <dir> [--concurrency N]
 *   echo 'function setup() { ... }' | p5-render -o output.png
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createReadStream } from "fs";
import { createInterface } from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Arg parsing (no extra deps)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    command: "render", // "render" or "batch"
    input: null,
    output: null,
    outDir: null,
    frames: 1,
    seed: undefined,
    timeout: 5000,
    width: undefined,
    height: undefined,
    concurrency: 4,
    isolate: false,
  };

  const positional = [];
  let i = 2;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "batch") {
      args.command = "batch";
      i++;
      continue;
    }

    if (arg === "-o" || arg === "--output") {
      args.output = argv[++i];
    } else if (arg === "--out-dir") {
      args.outDir = argv[++i];
    } else if (arg === "--frames") {
      args.frames = parseInt(argv[++i], 10);
    } else if (arg === "--seed") {
      args.seed = parseInt(argv[++i], 10);
    } else if (arg === "--timeout") {
      args.timeout = parseInt(argv[++i], 10);
    } else if (arg === "--width") {
      args.width = parseInt(argv[++i], 10);
    } else if (arg === "--height") {
      args.height = parseInt(argv[++i], 10);
    } else if (arg === "--concurrency") {
      args.concurrency = parseInt(argv[++i], 10);
    } else if (arg === "--isolate") {
      args.isolate = true;
    } else if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    } else {
      process.stderr.write(`Unknown option: ${arg}\n`);
      process.exit(1);
    }

    i++;
  }

  // Assign positional args
  if (args.command === "batch" && positional.length > 0) {
    args.input = positional[0];
  } else if (positional.length > 0) {
    args.input = positional[0];
  }

  return args;
}

function printUsage() {
  process.stderr.write(`
Usage:
  p5-render <sketch.js> -o <output.png> [options]
  p5-render batch <input.jsonl> --out-dir <dir> [--concurrency N]
  cat sketch.js | p5-render -o output.png

Options:
  -o, --output <path>    Output PNG path (or directory for multi-frame)
  --frames <N>           Number of frames to render (default: 1)
  --seed <N>             Random seed for reproducibility
  --timeout <N>          Max execution time in ms (default: 5000)
  --width <N>            Override canvas width
  --height <N>           Override canvas height
  --out-dir <dir>        Output directory for batch mode
  --concurrency <N>      Batch concurrency (default: 4)
  --isolate              Run sketch in worker thread (enables hard timeout)
  -h, --help             Show this help message
`);
}

// ---------------------------------------------------------------------------
// Read code from file or stdin
// ---------------------------------------------------------------------------

async function readCodeFromStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
  });
}

async function getCode(inputPath) {
  if (inputPath) {
    const resolved = path.resolve(inputPath);
    if (!fs.existsSync(resolved)) {
      process.stderr.write(`File not found: ${resolved}\n`);
      process.exit(1);
    }
    return fs.readFileSync(resolved, "utf-8");
  }

  // Check if stdin has data (non-TTY)
  if (!process.stdin.isTTY) {
    return readCodeFromStdin();
  }

  process.stderr.write("Error: No input file specified and stdin is a TTY.\n");
  printUsage();
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Import renderSketch
// ---------------------------------------------------------------------------

async function loadRenderSketch() {
  // Try compiled dist first, fall back to src (for tsx)
  try {
    const mod = await import(path.join(__dirname, "..", "dist", "index.js"));
    return mod.renderSketch;
  } catch {
    try {
      const mod = await import(path.join(__dirname, "..", "src", "index.js"));
      return mod.renderSketch;
    } catch (err) {
      process.stderr.write("Error: Could not load p5-render library.\n");
      process.stderr.write("Run `npm run build` first, or use `npx tsx bin/p5-render.js`.\n");
      process.stderr.write(`  ${err}\n`);
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------------------
// Single render
// ---------------------------------------------------------------------------

async function doRender(renderSketch, args) {
  const code = await getCode(args.input);

  const opts = {
    code,
    frames: args.frames,
    timeout: args.timeout,
  };

  if (args.seed !== undefined) opts.seed = args.seed;
  if (args.width !== undefined) opts.width = args.width;
  if (args.height !== undefined) opts.height = args.height;
  if (args.isolate) opts.isolate = true;

  const result = await renderSketch(opts);

  if (!result.ok) {
    process.stderr.write(`Render failed: ${result.error}\n`);
    if (result.errorLine) {
      process.stderr.write(`  at line ${result.errorLine}\n`);
    }
    process.exit(1);
  }

  // Write output
  const outputPath = args.output;

  if (!outputPath) {
    // If no output specified, write first frame to stdout as raw PNG
    if (result.frames.length > 0) {
      process.stdout.write(result.frames[0]);
    }
    return;
  }

  if (result.frames.length === 1) {
    // Single frame: write directly to output path
    const resolved = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, result.frames[0]);
    process.stderr.write(`Wrote ${resolved} (${result.frames[0].length} bytes)\n`);
  } else {
    // Multi-frame: output path is treated as a directory
    const dir = path.resolve(outputPath);
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < result.frames.length; i++) {
      const framePath = path.join(dir, `frame_${String(i).padStart(4, "0")}.png`);
      fs.writeFileSync(framePath, result.frames[i]);
    }
    process.stderr.write(`Wrote ${result.frames.length} frames to ${dir}/\n`);
  }

  // Print timing info
  if (result.duration_ms !== undefined) {
    process.stderr.write(`Render time: ${result.duration_ms}ms\n`);
  }

  // Print logs if any
  if (result.logs && result.logs.length > 0) {
    process.stderr.write(`Sketch logs (${result.logs.length}):\n`);
    for (const log of result.logs.slice(0, 20)) {
      process.stderr.write(`  ${log}\n`);
    }
    if (result.logs.length > 20) {
      process.stderr.write(`  ... and ${result.logs.length - 20} more\n`);
    }
  }
}

// ---------------------------------------------------------------------------
// Batch render
// ---------------------------------------------------------------------------

async function doBatch(renderSketch, args) {
  if (!args.input) {
    process.stderr.write("Error: batch mode requires an input JSONL file.\n");
    process.exit(1);
  }

  if (!args.outDir) {
    process.stderr.write("Error: batch mode requires --out-dir.\n");
    process.exit(1);
  }

  const outDir = path.resolve(args.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  // Read JSONL entries
  const entries = [];
  const rl = createInterface({
    input: createReadStream(path.resolve(args.input)),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch (err) {
      process.stderr.write(`Skipping invalid JSON line: ${trimmed.slice(0, 80)}...\n`);
    }
  }

  process.stderr.write(`Loaded ${entries.length} entries. Rendering with concurrency=${args.concurrency}...\n`);

  let completed = 0;
  let failed = 0;

  // Process entries with concurrency limit
  const queue = [...entries];

  async function worker() {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) break;

      const id = entry.id || `sketch_${completed + failed}`;
      const code = entry.code;

      if (!code) {
        process.stderr.write(`Skipping entry ${id}: no "code" field\n`);
        failed++;
        continue;
      }

      const opts = {
        code,
        frames: entry.frames || args.frames,
        timeout: entry.timeout || args.timeout,
        seed: entry.seed ?? args.seed,
        width: entry.width ?? args.width,
        height: entry.height ?? args.height,
        isolate: true,
      };

      try {
        const result = await renderSketch(opts);
        if (result.ok && result.frames.length > 0) {
          const outPath = path.join(outDir, `${id}.png`);
          fs.writeFileSync(outPath, result.frames[0]);
          completed++;
        } else {
          process.stderr.write(`Failed: ${id}: ${result.error || "no frames"}\n`);
          failed++;
        }
      } catch (err) {
        process.stderr.write(`Error: ${id}: ${err}\n`);
        failed++;
      }

      if ((completed + failed) % 100 === 0) {
        process.stderr.write(`  Progress: ${completed + failed}/${entries.length} (${completed} ok, ${failed} failed)\n`);
      }
    }
  }

  // Launch workers
  const workers = [];
  for (let w = 0; w < args.concurrency; w++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  process.stderr.write(`\nBatch complete: ${completed} succeeded, ${failed} failed out of ${entries.length}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  const renderSketch = await loadRenderSketch();

  if (args.command === "batch") {
    await doBatch(renderSketch, args);
  } else {
    await doRender(renderSketch, args);
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
