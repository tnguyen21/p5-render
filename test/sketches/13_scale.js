function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  stroke(0);
  strokeWeight(1);
  fill(50, 200, 100);

  // Translate to center, scale up 2x, draw a small circle that appears large
  translate(200, 200);
  scale(2);
  circle(0, 0, 80); // appears as 160px diameter
}
