function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  let c = color(100, 180, 60, 200);

  // Draw a swatch of the color
  noStroke();
  fill(c);
  rect(50, 50, 120, 120);

  // Extract and display components
  let r = red(c);
  let g = green(c);
  let b = blue(c);
  let a = alpha(c);

  fill(0);
  textSize(18);
  textAlign(LEFT);
  text("R: " + nf(r, 1, 0), 50, 220);
  text("G: " + nf(g, 1, 0), 50, 245);
  text("B: " + nf(b, 1, 0), 50, 270);
  text("A: " + nf(a, 1, 0), 50, 295);

  // Show individual component swatches
  noStroke();
  fill(r, 0, 0);
  rect(230, 200, 40, 40);
  fill(0, g, 0);
  rect(280, 200, 40, 40);
  fill(0, 0, b);
  rect(330, 200, 40, 40);
}
