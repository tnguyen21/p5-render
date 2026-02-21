// Accumulative random walker — draws a trail over many frames.
// Frame 1 shows just the starting dot. After warmup, there's a visible trail.
var x, y;

function setup() {
  createCanvas(400, 400);
  background(255);
  x = width / 2;
  y = height / 2;
}

function draw() {
  x += random(-3, 3);
  y += random(-3, 3);
  x = constrain(x, 0, width);
  y = constrain(y, 0, height);
  stroke(0, 80);
  strokeWeight(2);
  point(x, y);
}
