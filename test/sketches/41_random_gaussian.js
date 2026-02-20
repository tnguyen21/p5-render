function setup() {
  createCanvas(400, 400);
  background(20);

  randomSeed(42);

  noStroke();
  fill(255, 255, 255, 30);

  for (let i = 0; i < 500; i++) {
    let x = width / 2 + randomGaussian() * 60;
    let y = height / 2 + randomGaussian() * 60;
    ellipse(x, y, 6, 6);
  }

  noLoop();
}

function draw() {}
