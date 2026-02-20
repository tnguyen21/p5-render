function setup() {
  createCanvas(400, 400);
  background(10);

  // Hypotrochoid parameters
  let R = 150; // outer circle radius
  let r = 47;  // inner circle radius
  let d = 80;  // distance from center of inner circle

  let numPoints = 5000;

  stroke(255, 100, 150, 180);
  strokeWeight(1);
  noFill();

  beginShape();
  for (let i = 0; i <= numPoints; i++) {
    let t = map(i, 0, numPoints, 0, TWO_PI * 47); // enough rotations for the pattern to close
    let x = (R - r) * cos(t) + d * cos(((R - r) / r) * t);
    let y = (R - r) * sin(t) - d * sin(((R - r) / r) * t);
    vertex(width / 2 + x, height / 2 + y);
  }
  endShape();

  noLoop();
}

function draw() {}
