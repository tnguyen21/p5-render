function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  stroke(0, 0, 180);
  strokeWeight(3);
  noFill();

  // Smooth curve through points using curveVertex
  // First and last points are control points (not drawn through)
  beginShape();
  curveVertex(50, 300);   // control point
  curveVertex(50, 300);   // first drawn point
  curveVertex(100, 100);
  curveVertex(180, 280);
  curveVertex(260, 80);
  curveVertex(340, 250);
  curveVertex(340, 250);  // last drawn point
  curveVertex(340, 250);  // control point
  endShape();

  // Draw the control points as red dots for reference
  stroke(255, 0, 0);
  strokeWeight(8);
  point(50, 300);
  point(100, 100);
  point(180, 280);
  point(260, 80);
  point(340, 250);
}
