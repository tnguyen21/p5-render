function setup() {
  createCanvas(400, 400);
  background(240);
  randomSeed(42);

  stroke(60, 40, 20);
  translate(width / 2, height);
  branch(100, 0);

  noLoop();
}

function branch(len, depth) {
  if (len < 4 || depth > 12) return;

  strokeWeight(map(len, 4, 100, 1, 6));

  // Draw the branch
  line(0, 0, 0, -len);
  translate(0, -len);

  // Branch right
  let angleR = random(PI / 8, PI / 4);
  push();
  rotate(angleR);
  branch(len * random(0.6, 0.8), depth + 1);
  pop();

  // Branch left
  let angleL = random(PI / 8, PI / 4);
  push();
  rotate(-angleL);
  branch(len * random(0.6, 0.8), depth + 1);
  pop();

  // Occasional extra branch
  if (random() < 0.3 && depth < 8) {
    let angleE = random(-PI / 6, PI / 6);
    push();
    rotate(angleE);
    branch(len * random(0.5, 0.7), depth + 1);
    pop();
  }
}

function draw() {}
