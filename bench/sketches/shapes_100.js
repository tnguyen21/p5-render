function setup() {
  createCanvas(400, 400);
  background(255);
  randomSeed(42);

  noStroke();
  for (let i = 0; i < 100; i++) {
    fill(random(255), random(255), random(255), random(100, 255));
    let x = random(width);
    let y = random(height);
    let r = random(10, 60);
    ellipse(x, y, r * 2, r * 2);
  }

  noLoop();
}

function draw() {}
