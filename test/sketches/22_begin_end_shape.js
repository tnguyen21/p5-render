function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  stroke(0);
  strokeWeight(2);
  fill(100, 200, 150);

  // Pentagon using beginShape/endShape(CLOSE)
  let cx = 200;
  let cy = 200;
  let r = 120;

  beginShape();
  for (let i = 0; i < 5; i++) {
    let angle = TWO_PI * i / 5 - HALF_PI;
    vertex(cx + cos(angle) * r, cy + sin(angle) * r);
  }
  endShape(CLOSE);
}
