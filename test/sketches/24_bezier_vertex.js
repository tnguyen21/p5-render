function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  stroke(0);
  strokeWeight(2);
  fill(255, 200, 100, 180);

  // S-curve shape using bezierVertex
  beginShape();
  vertex(50, 200);
  bezierVertex(50, 50, 200, 50, 200, 200);
  bezierVertex(200, 350, 350, 350, 350, 200);
  endShape();

  // Draw the anchor and control points for reference
  strokeWeight(6);
  stroke(255, 0, 0);
  point(50, 200);
  point(200, 200);
  point(350, 200);

  stroke(0, 0, 255);
  strokeWeight(4);
  point(50, 50);
  point(200, 50);
  point(200, 350);
  point(350, 350);
}
