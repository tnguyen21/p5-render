/**
 * Wraps global-mode p5.js sketches into instance mode using `with(p)`.
 */

function isInstanceMode(code: string): boolean {
  const trimmed = code.trim();
  if (/^\s*new\s+p5\s*\(/.test(trimmed)) return true;
  if (/^\s*(\(?\s*\w+\s*\)?\s*=>|function\s*\(\s*\w+\s*\))/.test(trimmed)) return true;
  return false;
}

const lifecycleFunctions = [
  "preload", "setup", "draw",
  "mousePressed", "mouseReleased", "mouseMoved", "mouseDragged",
  "mouseClicked", "doubleClicked", "mouseWheel",
  "keyPressed", "keyReleased", "keyTyped", "windowResized",
];

export function wrapGlobalSketch(code: string): { wrapped: string; isGlobal: boolean } {
  if (isInstanceMode(code)) return { wrapped: code, isGlobal: false };

  // Function declarations in `with` bind to the enclosing scope, not the with-object.
  // So we explicitly assign detected lifecycle functions to p after running the code.
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
