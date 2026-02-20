function setup() {
  createCanvas(400, 400);
  background(255);
  randomSeed(42);

  noStroke();
  for (let i = 0; i < 10000; i++) {
    fill(random(255), random(255), random(255), random(50, 200));
    let x = random(width);
    let y = random(height);
    let r = random(1, 8);
    ellipse(x, y, r * 2, r * 2);
  }

  noLoop();
}

function draw() {}
