/**
 * p5-render — Headless p5.js renderer
 *
 * Public API. Exports renderSketch() and associated types.
 */

export { renderSketch } from "./renderer.js";
export type {
  RendererOptions as RenderOptions,
  RenderSuccess,
  RenderError,
  RenderResult,
} from "./renderer.js";
