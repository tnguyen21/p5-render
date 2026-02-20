/**
 * CLI entry point for p5-render.
 *
 * Usage:
 *   p5-render <sketch.js> -o <output.png> [--frames N] [--seed N] [--timeout N] [--width N] [--height N]
 *   p5-render batch <input.jsonl> --out-dir <dir> [--concurrency N]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { renderSketch } from "./renderer.js";

interface CliArgs {
  command: "render" | "batch";
  input?: string;
  output?: string;
  outDir?: string;
  frames: number;
  seed?: number;
  timeout: number;
  width?: number;
  height?: number;
  concurrency: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2); // skip node and script path
  const result: CliArgs = {
    command: "render",
    frames: 1,
    timeout: 5000,
    concurrency: 4,
  };

  let i = 0;

  // Check for batch subcommand
  if (args[0] === "batch") {
    result.command = "batch";
    i = 1;
  }

  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      case "-o":
      case "--output":
        result.output = args[++i];
        break;
      case "--out-dir":
        result.outDir = args[++i];
        break;
      case "--frames":
        result.frames = parseInt(args[++i], 10);
        break;
      case "--seed":
        result.seed = parseInt(args[++i], 10);
        break;
      case "--timeout":
        result.timeout = parseInt(args[++i], 10);
        break;
      case "--width":
        result.width = parseInt(args[++i], 10);
        break;
      case "--height":
        result.height = parseInt(args[++i], 10);
        break;
      case "--concurrency":
        result.concurrency = parseInt(args[++i], 10);
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        // Positional argument: input file
        if (!arg.startsWith("-") && !result.input) {
          result.input = arg;
        } else {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
    i++;
  }

  return result;
}

function printHelp(): void {
  const help = `
p5-render — Headless p5.js renderer

Usage:
  p5-render <sketch.js> -o <output.png> [options]
  p5-render batch <input.jsonl> --out-dir <dir> [options]

Options:
  -o, --output <file>     Output file path (PNG)
  --frames <N>            Number of frames to render (default: 1)
  --seed <N>              Random seed for reproducibility
  --timeout <N>           Max execution time in ms (default: 5000)
  --width <N>             Override canvas width
  --height <N>            Override canvas height
  --out-dir <dir>         Output directory (for batch or multi-frame)
  --concurrency <N>       Batch concurrency (default: 4)
  -h, --help              Show this help message

Examples:
  p5-render sketch.js -o output.png
  p5-render sketch.js --frames 60 --out-dir frames/
  p5-render batch sketches.jsonl --out-dir renders/
  echo 'function setup() { createCanvas(400,400); background(220); }' | p5-render -o out.png
`.trim();
  console.log(help);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function renderSingle(args: CliArgs): Promise<void> {
  let code: string;

  if (args.input) {
    const inputPath = resolve(args.input);
    if (!existsSync(inputPath)) {
      console.error(`File not found: ${inputPath}`);
      process.exit(1);
    }
    code = readFileSync(inputPath, "utf-8");
  } else if (!process.stdin.isTTY) {
    code = await readStdin();
  } else {
    console.error("Error: No input file specified and no stdin input detected.");
    console.error("Run with --help for usage information.");
    process.exit(1);
    return; // unreachable, for TS
  }

  const result = await renderSketch({
    code,
    width: args.width,
    height: args.height,
    frames: args.frames,
    seed: args.seed,
    timeout: args.timeout,
  });

  if (!result.ok) {
    console.error(`Render error: ${result.error}`);
    if (result.phase) console.error(`Phase: ${result.phase}`);
    if (result.errorLine) console.error(`Line: ${result.errorLine}`);
    if (result.logs.length > 0) {
      console.error("Logs:");
      for (const log of result.logs) {
        console.error(`  ${log}`);
      }
    }
    process.exit(1);
  }

  // Determine output path
  if (args.frames === 1 || result.frames.length === 1) {
    // Single frame output
    const outputPath = args.output || "output.png";
    writeFileSync(resolve(outputPath), result.frames[0]);
    console.log(`Rendered: ${resolve(outputPath)} (${result.width}x${result.height}, ${result.duration_ms}ms)`);
  } else {
    // Multiple frames: write to directory
    const outDir = args.outDir || args.output || "frames";
    mkdirSync(resolve(outDir), { recursive: true });
    for (let i = 0; i < result.frames.length; i++) {
      const framePath = join(resolve(outDir), `frame_${String(i).padStart(4, "0")}.png`);
      writeFileSync(framePath, result.frames[i]);
    }
    console.log(
      `Rendered ${result.frames.length} frames to ${resolve(outDir)}/ (${result.width}x${result.height}, ${result.duration_ms}ms)`
    );
  }

  // Print captured logs
  if (result.logs.length > 0) {
    for (const log of result.logs) {
      console.log(`[sketch] ${log}`);
    }
  }
}

async function renderBatch(args: CliArgs): Promise<void> {
  if (!args.input) {
    console.error("Error: batch mode requires an input JSONL file");
    process.exit(1);
    return;
  }

  const outDir = args.outDir || "renders";
  mkdirSync(resolve(outDir), { recursive: true });

  const inputPath = resolve(args.input);
  if (!existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const content = readFileSync(inputPath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  let completed = 0;
  let errors = 0;

  // Simple sequential batch for now (concurrency can be added later with a pool)
  for (const line of lines) {
    let entry: { code: string; id: string; [key: string]: any };
    try {
      entry = JSON.parse(line);
    } catch {
      console.error(`Invalid JSON line: ${line.substring(0, 100)}...`);
      errors++;
      continue;
    }

    const id = entry.id || `sketch_${completed}`;
    const result = await renderSketch({
      code: entry.code,
      width: args.width,
      height: args.height,
      frames: args.frames,
      seed: args.seed,
      timeout: args.timeout,
    });

    if (result.ok) {
      const outPath = join(resolve(outDir), `${id}.png`);
      writeFileSync(outPath, result.frames[0]);
      completed++;
    } else {
      console.error(`[${id}] Error: ${result.error}`);
      errors++;
    }

    // Progress
    if ((completed + errors) % 10 === 0 || completed + errors === lines.length) {
      console.log(`Progress: ${completed + errors}/${lines.length} (${errors} errors)`);
    }
  }

  console.log(`Batch complete: ${completed} rendered, ${errors} errors, output in ${resolve(outDir)}/`);
}

export async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.command === "batch") {
    await renderBatch(args);
  } else {
    await renderSingle(args);
  }
}

// Run if this is the main module
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
