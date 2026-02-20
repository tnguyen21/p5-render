/**
 * Generate reference PNG images by rendering each test sketch in a real browser via Playwright.
 *
 * For each .js file in test/sketches/:
 * 1. Launch a Chromium page
 * 2. Create an HTML page that loads p5.js from node_modules and the sketch
 * 3. Wait for setup() + draw() to complete
 * 4. Screenshot JUST the canvas element
 * 5. Save to test/references/<sketch-name>.png
 *
 * Multi-frame sketches (43-47) capture multiple frames.
 * Error sketches (60-68) are skipped — they don't need reference images.
 *
 * Usage: npx tsx test/generate-references.ts
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKETCHES_DIR = path.join(__dirname, "sketches");
const REFERENCES_DIR = path.join(__dirname, "references");
const P5_JS_PATH = path.join(__dirname, "..", "node_modules", "p5", "lib", "p5.js");

// Sketches in the 60-68 range are error/edge-case sketches that won't render properly in browser either
const ERROR_SKETCH_RANGE = { min: 60, max: 68 };

// Multi-frame sketches need special handling
const MULTI_FRAME_SKETCHES: Record<string, number[]> = {
  "43_animation_basic": [0, 30, 59],
  "44_frame_count": [0, 15, 59],
  "45_no_loop": [0],
  "46_redraw": [0, 1],
  "47_frame_rate_timing": [0, 30, 59],
};

// Wait times: single frame sketches vs multi-frame
const SINGLE_FRAME_WAIT_MS = 800;

function getSketchNumber(filename: string): number {
  const match = filename.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : -1;
}

function getSketchName(filename: string): string {
  return filename.replace(/\.js$/, "");
}

function isErrorSketch(num: number): boolean {
  return num >= ERROR_SKETCH_RANGE.min && num <= ERROR_SKETCH_RANGE.max;
}

function isMultiFrameSketch(name: string): boolean {
  return name in MULTI_FRAME_SKETCHES;
}

function buildHtml(sketchCode: string, p5Code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; padding: 0; overflow: hidden; background: white; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script>${p5Code}</script>
  <script>
    // Hook to track p5 instance and rendering state
    window._p5Done = false;
    window._p5Instance = null;
    window._p5FrameCount = 0;

    // Patch p5 to capture the instance
    var _origP5Init = p5.prototype._setup;
    p5.prototype._setup = function() {
      window._p5Instance = this;
      return _origP5Init.apply(this, arguments);
    };

    var _origDraw = p5.prototype._draw;
    p5.prototype._draw = function() {
      var result = _origDraw.apply(this, arguments);
      window._p5FrameCount = this.frameCount;
      if (this._loop === false || this.frameCount >= 1) {
        window._p5Done = true;
      }
      return result;
    };
  </script>
  <script>${sketchCode}</script>
</body>
</html>`;
}

function buildMultiFrameHtml(sketchCode: string, p5Code: string, targetFrame: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; padding: 0; overflow: hidden; background: white; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script>${p5Code}</script>
  <script>
    window._p5Done = false;
    window._p5Instance = null;
    window._p5FrameCount = 0;
    window._targetFrame = ${targetFrame};

    var _origP5Init = p5.prototype._setup;
    p5.prototype._setup = function() {
      window._p5Instance = this;
      return _origP5Init.apply(this, arguments);
    };

    var _origDraw = p5.prototype._draw;
    p5.prototype._draw = function() {
      var result = _origDraw.apply(this, arguments);
      window._p5FrameCount = this.frameCount;
      // Mark done when we've reached the target frame
      if (this.frameCount >= window._targetFrame + 1) {
        window._p5Done = true;
      }
      return result;
    };
  </script>
  <script>${sketchCode}</script>
</body>
</html>`;
}

async function generateSingleFrameReference(
  page: any,
  sketchCode: string,
  p5Code: string,
  outputPath: string,
): Promise<void> {
  const html = buildHtml(sketchCode, p5Code);
  await page.setContent(html);

  // Wait for p5 to finish setup and at least one draw
  try {
    await page.waitForFunction(() => window._p5Done === true, { timeout: 5000 });
  } catch {
    // Fallback: wait a fixed time
    await page.waitForTimeout(SINGLE_FRAME_WAIT_MS);
  }

  // Extra settle time for rendering
  await page.waitForTimeout(100);

  // Screenshot just the canvas element
  const canvas = await page.$("canvas");
  if (!canvas) {
    console.warn(`  No canvas found, skipping`);
    return;
  }

  const screenshot = await canvas.screenshot({ type: "png" });
  fs.writeFileSync(outputPath, screenshot);
}

async function generateMultiFrameReference(
  page: any,
  sketchCode: string,
  p5Code: string,
  sketchName: string,
  frames: number[],
): Promise<void> {
  for (const frameIdx of frames) {
    const html = buildMultiFrameHtml(sketchCode, p5Code, frameIdx);
    await page.setContent(html);

    try {
      await page.waitForFunction(() => window._p5Done === true, { timeout: 10000 });
    } catch {
      await page.waitForTimeout(2000);
    }

    await page.waitForTimeout(100);

    const canvas = await page.$("canvas");
    if (!canvas) {
      console.warn(`  No canvas found for frame ${frameIdx}, skipping`);
      continue;
    }

    const outputPath = path.join(REFERENCES_DIR, `${sketchName}_frame${frameIdx}.png`);
    const screenshot = await canvas.screenshot({ type: "png" });
    fs.writeFileSync(outputPath, screenshot);
    console.log(`  Saved frame ${frameIdx} -> ${path.basename(outputPath)}`);
  }
}

async function main() {
  // Ensure references directory exists
  fs.mkdirSync(REFERENCES_DIR, { recursive: true });

  // Read p5.js source
  const p5Code = fs.readFileSync(P5_JS_PATH, "utf-8");

  // Get all sketch files
  const sketchFiles = fs
    .readdirSync(SKETCHES_DIR)
    .filter((f) => f.endsWith(".js"))
    .sort();

  console.log(`Found ${sketchFiles.length} sketch files`);

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 800, height: 800 },
    deviceScaleFactor: 1,
  });

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of sketchFiles) {
    const num = getSketchNumber(file);
    const name = getSketchName(file);

    // Skip error sketches
    if (isErrorSketch(num)) {
      console.log(`Skipping error sketch: ${file}`);
      skipped++;
      continue;
    }

    console.log(`Rendering: ${file}`);
    const sketchCode = fs.readFileSync(path.join(SKETCHES_DIR, file), "utf-8");

    const page = await context.newPage();

    try {
      if (isMultiFrameSketch(name)) {
        await generateMultiFrameReference(page, sketchCode, p5Code, name, MULTI_FRAME_SKETCHES[name]);
      } else {
        const outputPath = path.join(REFERENCES_DIR, `${name}.png`);
        await generateSingleFrameReference(page, sketchCode, p5Code, outputPath);
        console.log(`  Saved -> ${name}.png`);
      }
      generated++;
    } catch (err) {
      console.error(`  ERROR rendering ${file}:`, err);
      errors++;
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log(`\nDone: ${generated} generated, ${skipped} skipped, ${errors} errors`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
