/**
 * Long-lived worker thread for rendering sketches.
 *
 * Loads all heavy dependencies (jsdom, skia-canvas, gl) once on startup,
 * then processes render requests sent via parentPort messages.
 *
 * Protocol:
 *   Worker → Parent: { type: "ready" }
 *   Parent → Worker: { id: number, options: RendererOptions }
 *   Worker → Parent: { type: "result", id: number, result: RenderResult }
 *     (frames/partial_frames are base64-encoded for transfer)
 */

import { parentPort } from "node:worker_threads";
import { renderSketchInProcess } from "./renderer.js";

if (!parentPort) {
  throw new Error("worker.ts must be run as a worker thread");
}

const port = parentPort;

port.on("message", async (msg: { id: number; options: any }) => {
  try {
    const result = await renderSketchInProcess(msg.options);
    if (result.ok) {
      port.postMessage({
        type: "result",
        id: msg.id,
        result: { ...result, frames: result.frames.map((f) => f.toString("base64")) },
      });
    } else {
      port.postMessage({
        type: "result",
        id: msg.id,
        result: { ...result, partial_frames: result.partial_frames.map((f) => f.toString("base64")) },
      });
    }
  } catch (err) {
    port.postMessage({
      type: "result",
      id: msg.id,
      result: { ok: false, error: err instanceof Error ? err.message : String(err), logs: [], partial_frames: [] },
    });
  }
});

// Signal ready after all imports have resolved
port.postMessage({ type: "ready" });
