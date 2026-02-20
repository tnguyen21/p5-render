function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  stroke(0);
  strokeWeight(2);
  fill(220, 180, 255, 200);

  beginShape();
  // Start with a straight vertex
  vertex(50, 200);

  // Bezier curve segment
  bezierVertex(80, 50, 180, 50, 200, 150);

  // Straight segment
  vertex(220, 150);

  // Another bezier curve
  bezierVertex(280, 150, 350, 80, 350, 200);

  // Straight segment going down
  vertex(350, 300);

  // Straight segment back
  vertex(200, 350);

  // One more bezier back to start area
  bezierVertex(100, 350, 50, 300, 50, 200);

  endShape(CLOSE);
}
