function setup() {
  createCanvas(400, 400);
  background(10);

  let a = 3;
  let b = 4;
  let delta = PI / 4;
  let numPoints = 2000;

  stroke(100, 200, 255, 150);
  strokeWeight(1.5);
  noFill();

  beginShape();
  for (let i = 0; i <= numPoints; i++) {
    let t = map(i, 0, numPoints, 0, TWO_PI);
    let x = width / 2 + sin(a * t + delta) * (width / 2 - 30);
    let y = height / 2 + sin(b * t) * (height / 2 - 30);
    vertex(x, y);
  }
  endShape();

  noLoop();
}

function draw() {}
