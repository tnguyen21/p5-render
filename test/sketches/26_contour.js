function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  stroke(0);
  strokeWeight(2);
  fill(100, 150, 200);

  // Outer rectangle with a rectangular hole cut via contour
  beginShape();
  // Outer boundary (clockwise)
  vertex(50, 50);
  vertex(350, 50);
  vertex(350, 350);
  vertex(50, 350);

  // Inner contour / hole (counter-clockwise)
  beginContour();
  vertex(150, 150);
  vertex(150, 250);
  vertex(250, 250);
  vertex(250, 150);
  endContour();

  endShape(CLOSE);
}
