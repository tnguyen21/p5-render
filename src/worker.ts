/**
 * Long-lived worker subprocess for rendering sketches.
 *
 * Runs as a child process (via child_process.fork) so that native-addon
 * crashes (Rust panics in skia-canvas, segfaults in headless-gl) only
 * kill this subprocess — the parent and other workers survive.
 *
 * Protocol:
 *   Worker → Parent: { type: "ready" }
 *   Parent → Worker: { id: number, options: RendererOptions }
 *   Worker → Parent: { type: "result", id: number, result: RenderResult }
 *     (frames/partial_frames are base64-encoded for transfer)
 */

import { renderSketchInProcess } from "./renderer.js";

function send(msg: any): void {
  process.send!(msg);
}

process.on("message", async (msg: { id: number; options: any }) => {
  try {
    const result = await renderSketchInProcess(msg.options);
    if (result.ok) {
      send({
        type: "result",
        id: msg.id,
        result: { ...result, frames: result.frames.map((f) => f.toString("base64")) },
      });
    } else {
      send({
        type: "result",
        id: msg.id,
        result: { ...result, partial_frames: result.partial_frames.map((f) => f.toString("base64")) },
      });
    }
  } catch (err) {
    send({
      type: "result",
      id: msg.id,
      result: { ok: false, error: err instanceof Error ? err.message : String(err), logs: [], partial_frames: [] },
    });
  }
});

// Signal ready after all imports have resolved
send({ type: "ready" });
