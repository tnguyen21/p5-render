/**
 * Wraps global-mode p5.js sketches into instance mode.
 *
 * Most sketches in the wild use global mode:
 *   function setup() { createCanvas(400, 400); }
 *   function draw()  { background(220); circle(200, 200, 100); }
 *
 * We wrap them in instance mode using `with(p)` so that all p5
 * globals resolve to the instance. This requires non-strict mode.
 */

/**
 * Heuristic to detect if user code is already in instance mode.
 *
 * Instance mode sketches look like:
 *   (p) => { p.setup = ... }
 *   function(p) { p.setup = ... }
 *   new p5(function(p) { ... })
 *   new p5((p) => { ... })
 *
 * Global mode sketches define setup/draw at the top level.
 */
function isInstanceMode(code: string): boolean {
  const trimmed = code.trim();

  // Matches: new p5(...)
  if (/^\s*new\s+p5\s*\(/.test(trimmed)) {
    return true;
  }

  // Matches: (p) => { ... } or function(p) { ... } as the entire code
  // (i.e., code that is just a sketch function, not calling new p5)
  if (/^\s*(\(?\s*\w+\s*\)?\s*=>|function\s*\(\s*\w+\s*\))/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * If the code is global mode, wrap it in an instance-mode adapter.
 * If it's already instance mode, return it as-is.
 *
 * Returns the code string that, when evaluated, produces a sketch
 * function suitable for `new p5(fn)`.
 */
export function wrapGlobalSketch(code: string): { wrapped: string; isGlobal: boolean } {
  if (isInstanceMode(code)) {
    return { wrapped: code, isGlobal: false };
  }

  // Wrap global-mode code using `with(p)` so that bare references
  // like `createCanvas`, `background`, `circle` resolve to p.createCanvas, etc.
  // We also need to hoist function declarations: the user code may define
  // `function setup()` and `function draw()` which need to be assignable
  // to p.setup and p.draw. The `with(p)` block handles this because
  // assignments to `setup` and `draw` inside the block go to `p` via
  // the with-scope.
  //
  // However, function declarations in a `with` block bind to the
  // enclosing function scope, NOT to the with-object. So we need to
  // explicitly assign them. We detect common lifecycle functions and
  // assign them after running the code.

  const lifecycleFunctions = [
    "preload",
    "setup",
    "draw",
    "mousePressed",
    "mouseReleased",
    "mouseMoved",
    "mouseDragged",
    "mouseClicked",
    "doubleClicked",
    "mouseWheel",
    "keyPressed",
    "keyReleased",
    "keyTyped",
    "windowResized",
  ];

  // Build the assignment block: if `setup` is defined as a function in scope, assign it to p.setup
  const assignments = lifecycleFunctions
    .map((fn) => `    if (typeof ${fn} === 'function') p.${fn} = ${fn};`)
    .join("\n");

  const wrapped = `(function(p) {
  with (p) {
${code}
  }
${assignments}
})`;

  return { wrapped, isGlobal: true };
}
