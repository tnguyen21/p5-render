import { describe, it, expect } from "vitest";
import { renderSketch } from "../src/index.js";
import { comparePngs } from "./compare.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKETCHES_DIR = path.join(__dirname, "sketches");
const REFERENCES_DIR = path.join(__dirname, "references");

const HIGH_SIMILARITY = 0.95;
const REAL_WORLD_SIMILARITY = 0.85;

function readSketch(filename: string): string {
  return fs.readFileSync(path.join(SKETCHES_DIR, filename), "utf-8");
}

async function testSingleFrame(sketchFile: string, similarityThreshold = HIGH_SIMILARITY, options: Record<string, unknown> = {}) {
  const code = readSketch(sketchFile);
  const name = sketchFile.replace(/\.js$/, "");
  const result = await renderSketch({ code, ...options });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.frames.length).toBeGreaterThanOrEqual(1);

  const refPath = path.join(REFERENCES_DIR, `${name}.png`);
  if (fs.existsSync(refPath)) {
    const reference = fs.readFileSync(refPath);
    const comparison = await comparePngs(result.frames[0], reference);
    expect(comparison.similarity).toBeGreaterThan(similarityThreshold);
  }
}

// Tiers 1-6: single-frame render tests
const singleFrameSketches: [string, string][] = [
  ["01_blank_canvas.js", "blank canvas"],
  ["02_single_circle.js", "single circle"],
  ["03_fill_stroke.js", "fill and stroke"],
  ["04_rect_and_ellipse.js", "rect and ellipse"],
  ["05_lines_and_points.js", "lines and points"],
  ["06_triangle_quad.js", "triangle and quad"],
  ["07_arcs.js", "arcs"],
  ["08_background_color.js", "background color"],
  ["09_no_fill_no_stroke.js", "noFill noStroke"],
  ["10_alpha_transparency.js", "alpha transparency"],
  ["11_translate.js", "translate"],
  ["12_rotate.js", "rotate"],
  ["13_scale.js", "scale"],
  ["14_push_pop.js", "push/pop"],
  ["15_combined_transforms.js", "combined transforms"],
  ["16_nested_transforms.js", "nested transforms"],
  ["17_hsb_mode.js", "HSB mode"],
  ["18_hsl_mode.js", "HSL mode"],
  ["19_lerp_color.js", "lerpColor"],
  ["20_blend_modes.js", "blend modes"],
  ["21_color_object.js", "color object"],
  ["22_begin_end_shape.js", "beginShape/endShape"],
  ["23_curve_vertex.js", "curveVertex"],
  ["24_bezier_vertex.js", "bezierVertex"],
  ["25_close_shape.js", "close shape"],
  ["26_contour.js", "contour"],
  ["27_complex_path.js", "complex path"],
  ["28_basic_text.js", "basic text"],
  ["29_text_size_align.js", "text size and align"],
  ["30_text_style.js", "text style"],
  ["31_text_leading.js", "text leading"],
  ["32_load_pixels.js", "loadPixels"],
  ["33_set_pixels.js", "set pixels"],
  ["34_pixel_manipulation.js", "pixel manipulation"],
  ["35_create_image.js", "createImage"],
  ["37_image_filter.js", "image filter"],
  ["38_get_region.js", "get region"],
];

describe("Single-frame rendering", () => {
  for (const [file, label] of singleFrameSketches) {
    it(label, () => testSingleFrame(file));
  }
});

describe("loadImage", () => {
  it("loads from assets map", async () => {
    const { Canvas } = await import("skia-canvas");
    const c = new Canvas(64, 64);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 64, 64);
    const testPng = Buffer.from(c.toBufferSync("png"));

    const code = readSketch("36_load_image.js");
    const result = await renderSketch({ code, assets: { "test.png": testPng } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frames.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Noise and randomness", () => {
  for (const file of ["39_random_seed.js", "40_noise_seed.js", "41_random_gaussian.js", "42_noise_2d.js"]) {
    it(file.replace(/\.js$/, "").replace(/_/g, " "), () => testSingleFrame(file, HIGH_SIMILARITY, { seed: 42 }));
  }
});

describe("Multi-frame rendering", () => {
  const cases: [string, string, number][] = [
    ["animation basic", "43_animation_basic.js", 60],
    ["frame count", "44_frame_count.js", 60],
    ["noLoop", "45_no_loop.js", 5],
    ["redraw", "46_redraw.js", 5],
    ["frame rate timing", "47_frame_rate_timing.js", 60],
  ];

  for (const [label, file, frames] of cases) {
    it(label, async () => {
      const code = readSketch(file);
      const result = await renderSketch({ code, frames });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.frames.length).toBe(frames);
    });
  }
});

describe("Real-world sketches", () => {
  const files = [
    "50_flow_field.js", "51_recursive_tree.js", "52_circle_packing.js",
    "53_truchet_tiles.js", "54_lissajous.js", "55_reaction_diffusion.js",
    "56_voronoi.js", "57_spirograph.js", "58_maze_generator.js", "59_generative_landscape.js",
  ];

  for (const file of files) {
    it(file.replace(/\.js$/, "").replace(/_/g, " "), () =>
      testSingleFrame(file, REAL_WORLD_SIMILARITY, { seed: 42, timeout: 10000 }),
    );
  }
});

describe("Error handling", () => {
  it("syntax error returns structured error", async () => {
    const result = await renderSketch({ code: readSketch("60_syntax_error.js") });
    expect(result.ok).toBe(false);
  });

  it("runtime error (undefined reference)", async () => {
    const result = await renderSketch({ code: readSketch("61_runtime_error.js") });
    expect(result.ok).toBe(false);
  });

  it("infinite loop triggers timeout", async () => {
    const result = await renderSketch({ code: readSketch("62_infinite_loop.js"), timeout: 2000, isolate: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Timeout");
  }, 10000);

  it("huge canvas gets clamped", async () => {
    const result = await renderSketch({ code: readSketch("63_huge_canvas.js") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.width).toBeLessThanOrEqual(4096);
    expect(result.height).toBeLessThanOrEqual(4096);
  });

  it("no createCanvas still works", async () => {
    const result = await renderSketch({ code: readSketch("64_no_create_canvas.js") });
    expect(result.ok).toBe(true);
  });

  it("NaN coordinates do not crash", async () => {
    const result = await renderSketch({ code: readSketch("65_nan_coordinates.js") });
    expect(result.ok).toBe(true);
  });

  it("missing setup still works", async () => {
    const result = await renderSketch({ code: readSketch("66_missing_setup.js") });
    expect(result.ok).toBe(true);
  });

  it("console.log capped at 1000", async () => {
    const result = await renderSketch({ code: readSketch("68_massive_console_log.js") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.logs.length).toBeLessThanOrEqual(1000);
  });
});
