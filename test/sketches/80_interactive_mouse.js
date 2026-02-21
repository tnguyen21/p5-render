// Draws a circle at the mouse position each frame.
// Without interaction simulation, nothing appears (mouse stays at center, no draw calls build up).
// With warmup + simulateInteraction, circles accumulate across the canvas.
function setup() {
  createCanvas(400, 400);
  background(255);
}

function draw() {
  fill(0, 50);
  noStroke();
  ellipse(mouseX, mouseY, 20, 20);
}
