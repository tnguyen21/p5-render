function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  noStroke();

  // Red circle with alpha
  fill(255, 0, 0, 128);
  circle(160, 180, 180);

  // Blue circle with alpha, overlapping
  fill(0, 0, 255, 128);
  circle(240, 180, 180);

  // Green circle with alpha, overlapping both
  fill(0, 255, 0, 128);
  circle(200, 260, 180);
}
