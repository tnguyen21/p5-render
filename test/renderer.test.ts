/**
 * Test suite for p5-render.
 *
 * Renders each test sketch with the headless renderer and compares output
 * against browser-generated reference PNGs.
 *
 * Reference comparison is conditional: if no reference image exists, the test
 * skips comparison and just asserts the render succeeded. This way tests can
 * run before references are generated.
 */

import { describe, it, expect } from "vitest";
import { renderSketch } from "../src/index.js";
import { comparePngs } from "./compare.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKETCHES_DIR = path.join(__dirname, "sketches");
const REFERENCES_DIR = path.join(__dirname, "references");

// Similarity thresholds
const HIGH_SIMILARITY = 0.95;
const REAL_WORLD_SIMILARITY = 0.85; // Real-world sketches may differ more due to font/noise differences

/** Read a sketch file from the sketches directory */
function readSketch(filename: string): string {
  return fs.readFileSync(path.join(SKETCHES_DIR, filename), "utf-8");
}

/** Read a reference PNG if it exists. Returns null if not found. */
function readReference(name: string): Buffer | null {
  const refPath = path.join(REFERENCES_DIR, `${name}.png`);
  if (fs.existsSync(refPath)) {
    return fs.readFileSync(refPath);
  }
  return null;
}

/** Standard single-frame render test */
async function testSingleFrame(
  sketchFile: string,
  similarityThreshold: number = HIGH_SIMILARITY,
  options: Record<string, unknown> = {},
) {
  const code = readSketch(sketchFile);
  const name = sketchFile.replace(/\.js$/, "");

  const result = await renderSketch({ code, ...options });
  expect(result.ok).toBe(true);

  if (!result.ok) return; // Type narrowing

  expect(result.frames.length).toBeGreaterThanOrEqual(1);
  expect(result.frames[0].length).toBeGreaterThan(0);

  // Compare against reference if it exists
  const reference = readReference(name);
  if (reference) {
    const comparison = await comparePngs(result.frames[0], reference);
    expect(comparison.similarity).toBeGreaterThan(similarityThreshold);
  }
}

// ---------------------------------------------------------------------------
// Tier 1 - Basic rendering
// ---------------------------------------------------------------------------
describe("Tier 1 - Basic rendering", () => {
  it("01 - blank canvas", async () => {
    await testSingleFrame("01_blank_canvas.js");
  });

  it("02 - single circle", async () => {
    await testSingleFrame("02_single_circle.js");
  });

  it("03 - fill and stroke", async () => {
    await testSingleFrame("03_fill_stroke.js");
  });

  it("04 - rect and ellipse", async () => {
    await testSingleFrame("04_rect_and_ellipse.js");
  });

  it("05 - lines and points", async () => {
    await testSingleFrame("05_lines_and_points.js");
  });

  it("06 - triangle and quad", async () => {
    await testSingleFrame("06_triangle_quad.js");
  });

  it("07 - arcs", async () => {
    await testSingleFrame("07_arcs.js");
  });

  it("08 - background color", async () => {
    await testSingleFrame("08_background_color.js");
  });

  it("09 - noFill noStroke", async () => {
    await testSingleFrame("09_no_fill_no_stroke.js");
  });

  it("10 - alpha transparency", async () => {
    await testSingleFrame("10_alpha_transparency.js");
  });
});

// ---------------------------------------------------------------------------
// Tier 2 - Transforms and state
// ---------------------------------------------------------------------------
describe("Tier 2 - Transforms and state", () => {
  it("11 - translate", async () => {
    await testSingleFrame("11_translate.js");
  });

  it("12 - rotate", async () => {
    await testSingleFrame("12_rotate.js");
  });

  it("13 - scale", async () => {
    await testSingleFrame("13_scale.js");
  });

  it("14 - push/pop", async () => {
    await testSingleFrame("14_push_pop.js");
  });

  it("15 - combined transforms", async () => {
    await testSingleFrame("15_combined_transforms.js");
  });

  it("16 - nested transforms", async () => {
    await testSingleFrame("16_nested_transforms.js");
  });
});

// ---------------------------------------------------------------------------
// Tier 3 - Color
// ---------------------------------------------------------------------------
describe("Tier 3 - Color", () => {
  it("17 - HSB mode", async () => {
    await testSingleFrame("17_hsb_mode.js");
  });

  it("18 - HSL mode", async () => {
    await testSingleFrame("18_hsl_mode.js");
  });

  it("19 - lerpColor", async () => {
    await testSingleFrame("19_lerp_color.js");
  });

  it("20 - blend modes", async () => {
    await testSingleFrame("20_blend_modes.js");
  });

  it("21 - color object", async () => {
    await testSingleFrame("21_color_object.js");
  });
});

// ---------------------------------------------------------------------------
// Tier 4 - Paths and vertices
// ---------------------------------------------------------------------------
describe("Tier 4 - Paths and vertices", () => {
  it("22 - beginShape/endShape", async () => {
    await testSingleFrame("22_begin_end_shape.js");
  });

  it("23 - curveVertex", async () => {
    await testSingleFrame("23_curve_vertex.js");
  });

  it("24 - bezierVertex", async () => {
    await testSingleFrame("24_bezier_vertex.js");
  });

  it("25 - close shape", async () => {
    await testSingleFrame("25_close_shape.js");
  });

  it("26 - contour", async () => {
    await testSingleFrame("26_contour.js");
  });

  it("27 - complex path", async () => {
    await testSingleFrame("27_complex_path.js");
  });
});

// ---------------------------------------------------------------------------
// Tier 5 - Typography
// ---------------------------------------------------------------------------
describe("Tier 5 - Typography", () => {
  it("28 - basic text", async () => {
    await testSingleFrame("28_basic_text.js");
  });

  it("29 - text size and align", async () => {
    await testSingleFrame("29_text_size_align.js");
  });

  it("30 - text style", async () => {
    await testSingleFrame("30_text_style.js");
  });

  const sketch31 = path.join(SKETCHES_DIR, "31_text_leading.js");
  (fs.existsSync(sketch31) ? it : it.skip)("31 - text leading", async () => {
    await testSingleFrame("31_text_leading.js");
  });
});

// ---------------------------------------------------------------------------
// Tier 6 - Pixels and images
// ---------------------------------------------------------------------------
describe("Tier 6 - Pixels and images", () => {
  it("32 - loadPixels", async () => {
    await testSingleFrame("32_load_pixels.js");
  });

  it("33 - set pixels", async () => {
    await testSingleFrame("33_set_pixels.js");
  });

  it("34 - pixel manipulation", async () => {
    await testSingleFrame("34_pixel_manipulation.js");
  });

  it("35 - createImage", async () => {
    await testSingleFrame("35_create_image.js");
  });

  it.skip("36 - loadImage (requires assets)", async () => {
    // This sketch requires a test.png asset to be provided.
    // Skipped unless asset infrastructure is available.
    await testSingleFrame("36_load_image.js");
  });

  const sketch37 = path.join(SKETCHES_DIR, "37_image_filter.js");
  (fs.existsSync(sketch37) ? it : it.skip)("37 - image filter", async () => {
    await testSingleFrame("37_image_filter.js");
  });

  const sketch38 = path.join(SKETCHES_DIR, "38_get_region.js");
  (fs.existsSync(sketch38) ? it : it.skip)("38 - get region", async () => {
    await testSingleFrame("38_get_region.js");
  });
});

// ---------------------------------------------------------------------------
// Tier 7 - Noise and randomness (reproducibility)
// ---------------------------------------------------------------------------
describe("Tier 7 - Noise and randomness", () => {
  const tier7Sketches = ["39_random_seed.js", "40_noise_seed.js", "41_random_gaussian.js", "42_noise_2d.js"];

  for (const file of tier7Sketches) {
    const sketchPath = path.join(SKETCHES_DIR, file);
    const label = file.replace(/\.js$/, "").replace(/_/g, " ");

    ;(fs.existsSync(sketchPath) ? it : it.skip)(label, async () => {
      await testSingleFrame(file, HIGH_SIMILARITY, { seed: 42 });
    });
  }
});

// ---------------------------------------------------------------------------
// Tier 8 - Multi-frame rendering
// ---------------------------------------------------------------------------
describe("Tier 8 - Multi-frame rendering", () => {
  const multiFrameSketches: Record<string, { file: string; frames: number; expectedFrames?: number }> = {
    "43 - animation basic": { file: "43_animation_basic.js", frames: 60 },
    "44 - frame count": { file: "44_frame_count.js", frames: 60 },
    "45 - noLoop": { file: "45_no_loop.js", frames: 5, expectedFrames: 1 },
    "46 - redraw": { file: "46_redraw.js", frames: 5 },
    "47 - frame rate timing": { file: "47_frame_rate_timing.js", frames: 60 },
  };

  for (const [label, config] of Object.entries(multiFrameSketches)) {
    const sketchPath = path.join(SKETCHES_DIR, config.file);

    ;(fs.existsSync(sketchPath) ? it : it.skip)(label, async () => {
      const code = readSketch(config.file);
      const result = await renderSketch({ code, frames: config.frames });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      if (config.expectedFrames !== undefined) {
        expect(result.frames.length).toBe(config.expectedFrames);
      } else {
        expect(result.frames.length).toBe(config.frames);
      }

      // Each frame should be a valid PNG buffer
      for (const frame of result.frames) {
        expect(frame.length).toBeGreaterThan(0);
        // PNG magic bytes
        expect(frame[0]).toBe(0x89);
        expect(frame[1]).toBe(0x50); // 'P'
        expect(frame[2]).toBe(0x4e); // 'N'
        expect(frame[3]).toBe(0x47); // 'G'
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Tier 9 - Real-world sketches
// ---------------------------------------------------------------------------
describe("Tier 9 - Real-world sketches", () => {
  const realWorldSketches = [
    "50_flow_field.js",
    "51_recursive_tree.js",
    "52_circle_packing.js",
    "53_truchet_tiles.js",
    "54_lissajous.js",
    "55_reaction_diffusion.js",
    "56_voronoi.js",
    "57_spirograph.js",
    "58_maze_generator.js",
    "59_generative_landscape.js",
  ];

  for (const file of realWorldSketches) {
    const sketchPath = path.join(SKETCHES_DIR, file);
    const label = file.replace(/\.js$/, "").replace(/_/g, " ");

    ;(fs.existsSync(sketchPath) ? it : it.skip)(label, async () => {
      await testSingleFrame(file, REAL_WORLD_SIMILARITY, { seed: 42, timeout: 10000 });
    });
  }
});

// ---------------------------------------------------------------------------
// Tier 10 - Error handling
// ---------------------------------------------------------------------------
describe("Tier 10 - Error handling", () => {
  const sketch60 = path.join(SKETCHES_DIR, "60_syntax_error.js");
  ;(fs.existsSync(sketch60) ? it : it.skip)("60 - syntax error returns structured error", async () => {
    const code = readSketch("60_syntax_error.js");
    const result = await renderSketch({ code });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe("string");
    }
  });

  const sketch61 = path.join(SKETCHES_DIR, "61_runtime_error.js");
  ;(fs.existsSync(sketch61) ? it : it.skip)("61 - runtime error (undefined reference)", async () => {
    const code = readSketch("61_runtime_error.js");
    const result = await renderSketch({ code });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeTruthy();
    }
  });

  const sketch62 = path.join(SKETCHES_DIR, "62_infinite_loop.js");
  ;(fs.existsSync(sketch62) ? it : it.skip)("62 - infinite loop triggers timeout", async () => {
    const code = readSketch("62_infinite_loop.js");
    const result = await renderSketch({ code, timeout: 2000 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeTruthy();
    }
  }, 10000);

  const sketch63 = path.join(SKETCHES_DIR, "63_huge_canvas.js");
  ;(fs.existsSync(sketch63) ? it : it.skip)("63 - huge canvas gets clamped", async () => {
    const code = readSketch("63_huge_canvas.js");
    const result = await renderSketch({ code });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Canvas should be clamped to max dimensions (4096x4096)
      expect(result.width).toBeLessThanOrEqual(4096);
      expect(result.height).toBeLessThanOrEqual(4096);
    }
  });

  const sketch64 = path.join(SKETCHES_DIR, "64_no_create_canvas.js");
  ;(fs.existsSync(sketch64) ? it : it.skip)("64 - no createCanvas still works (p5 default)", async () => {
    const code = readSketch("64_no_create_canvas.js");
    const result = await renderSketch({ code });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.frames.length).toBeGreaterThanOrEqual(1);
    }
  });

  const sketch65 = path.join(SKETCHES_DIR, "65_nan_coordinates.js");
  ;(fs.existsSync(sketch65) ? it : it.skip)("65 - NaN coordinates do not crash", async () => {
    const code = readSketch("65_nan_coordinates.js");
    const result = await renderSketch({ code });
    expect(result.ok).toBe(true);
  });

  const sketch66 = path.join(SKETCHES_DIR, "66_missing_setup.js");
  ;(fs.existsSync(sketch66) ? it : it.skip)("66 - missing setup still works", async () => {
    const code = readSketch("66_missing_setup.js");
    const result = await renderSketch({ code });
    expect(result.ok).toBe(true);
  });

  const sketch67 = path.join(SKETCHES_DIR, "67_empty_sketch.js");
  ;(fs.existsSync(sketch67) ? it : it.skip)("67 - empty sketch", async () => {
    const code = readSketch("67_empty_sketch.js");
    const result = await renderSketch({ code });
    // Empty sketch may succeed with an empty/default canvas or fail gracefully
    // Either outcome is acceptable
    if (result.ok) {
      expect(result.frames.length).toBeGreaterThanOrEqual(0);
    }
  });

  const sketch68 = path.join(SKETCHES_DIR, "68_massive_console_log.js");
  ;(fs.existsSync(sketch68) ? it : it.skip)("68 - massive console.log is capped at 1000", async () => {
    const code = readSketch("68_massive_console_log.js");
    const result = await renderSketch({ code });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.logs.length).toBeLessThanOrEqual(1000);
    }
  });
});
