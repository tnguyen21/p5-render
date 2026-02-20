function setup() {
  createCanvas(400, 400);
  background(240);

  randomSeed(42);

  noStroke();
  for (let i = 0; i < 100; i++) {
    let x = random(width);
    let y = random(height);
    let r = random(10, 40);
    let red = random(255);
    let grn = random(255);
    let blu = random(255);
    fill(red, grn, blu, 180);
    ellipse(x, y, r * 2, r * 2);
  }

  noLoop();
}

function draw() {}
