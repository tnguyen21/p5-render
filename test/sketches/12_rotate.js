function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  stroke(0);
  strokeWeight(2);
  fill(255, 180, 50);

  // Translate to center, rotate 45 degrees, draw centered rect
  rectMode(CENTER);
  translate(200, 200);
  rotate(PI / 4);
  rect(0, 0, 150, 100);
}
