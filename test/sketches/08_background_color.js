function setup() {
  createCanvas(400, 400);
  colorMode(HSB, 360, 100, 100);
  background(160, 80, 80);
  noLoop();
}

function draw() {
  stroke(0, 0, 100);
  strokeWeight(2);

  // Circle with HSB yellow
  fill(60, 90, 100);
  circle(100, 150, 80);

  // Rect with HSB magenta
  fill(300, 80, 90);
  rect(200, 110, 120, 80);

  // Triangle with HSB orange
  fill(30, 100, 100);
  triangle(200, 300, 140, 380, 260, 380);
}
