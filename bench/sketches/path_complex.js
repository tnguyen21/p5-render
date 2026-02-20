function setup() {
  createCanvas(400, 400);
  background(255);

  stroke(0, 100);
  strokeWeight(1);
  noFill();

  beginShape();
  for (let i = 0; i < 1000; i++) {
    let t = map(i, 0, 1000, 0, TWO_PI * 10);
    let r = map(i, 0, 1000, 5, 190);
    let x = width / 2 + r * cos(t);
    let y = height / 2 + r * sin(t);
    vertex(x, y);
  }
  endShape();

  noLoop();
}

function draw() {}
