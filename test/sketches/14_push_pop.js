function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  stroke(0);
  strokeWeight(2);

  // Inside push/pop: red fill
  push();
  fill(255, 0, 0);
  circle(130, 200, 120);
  pop();

  // Outside push/pop: default white fill should be restored
  circle(270, 200, 120);
}
