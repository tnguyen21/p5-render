/**
 * Render all test sketches to PNG files for visual inspection.
 *
 * Usage: bun run render-all [output-dir]
 *   Default output: test/renders/
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { renderSketch } from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKETCHES_DIR = path.join(__dirname, "sketches");

// Sketches that need special options
const NEEDS_SEED = new Set(["39_random_seed", "40_noise_seed", "41_random_gaussian", "42_noise_2d"]);
const SKIP = new Set(["36_load_image", "60_syntax_error", "61_runtime_error", "62_infinite_loop"]);

async function main() {
  const outDir = path.resolve(process.argv[2] || path.join(__dirname, "renders"));
  fs.mkdirSync(outDir, { recursive: true });

  const files = fs.readdirSync(SKETCHES_DIR).filter((f) => f.endsWith(".js")).sort();
  let ok = 0;
  let fail = 0;

  for (const file of files) {
    const name = file.replace(/\.js$/, "");
    if (SKIP.has(name)) {
      console.log(`  skip ${name}`);
      continue;
    }

    const code = fs.readFileSync(path.join(SKETCHES_DIR, file), "utf-8");
    const opts: Record<string, any> = { code, timeout: 10000 };
    if (NEEDS_SEED.has(name)) opts.seed = 42;

    const result = await renderSketch(opts);
    if (result.ok && result.frames.length > 0) {
      fs.writeFileSync(path.join(outDir, `${name}.png`), result.frames[0]);
      console.log(`  ok   ${name}`);
      ok++;
    } else {
      const err = result.ok ? "no frames" : result.error;
      console.log(`  FAIL ${name}: ${err}`);
      fail++;
    }
  }

  console.log(`\nDone: ${ok} rendered, ${fail} failed → ${outDir}/`);
}

main();
