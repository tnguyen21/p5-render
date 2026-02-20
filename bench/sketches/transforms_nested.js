function setup() {
  createCanvas(400, 400);
  background(255);

  translate(width / 2, height / 2);
  let levels = 50;

  for (let i = 0; i < levels; i++) {
    push();
    rotate(i * 0.15);
    translate(3, 0);

    let c = map(i, 0, levels, 0, 255);
    fill(c, 100, 255 - c, 180);
    noStroke();
    rect(-5, -5, 10, 10);

    pop();
  }

  noLoop();
}

function draw() {}
