function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  stroke(0);
  strokeWeight(2);
  fill(100, 150, 255);

  // Translate to center, draw rect at origin so it appears centered
  rectMode(CENTER);
  translate(200, 200);
  rect(0, 0, 120, 80);
}
