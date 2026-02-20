function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  // Default rectMode is CORNER, default ellipseMode is CENTER
  rectMode(CORNER);
  ellipseMode(CENTER);

  // Blue rect at top-left area
  fill(0, 100, 200);
  stroke(0);
  strokeWeight(2);
  rect(50, 50, 150, 100);

  // Green ellipse at bottom-right area
  fill(0, 200, 100);
  ellipse(300, 300, 120, 80);
}
