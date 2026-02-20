function setup() {
  createCanvas(400, 400);
  background(20);
  noiseSeed(42);

  let numParticles = 5000;
  let steps = 20;
  let noiseScale = 0.005;
  let stepLen = 2;

  stroke(255, 255, 255, 15);
  strokeWeight(0.5);

  for (let p = 0; p < numParticles; p++) {
    // Distribute particles evenly using a simple hash
    let x = (p * 7919) % width;
    let y = (p * 104729) % height;

    for (let s = 0; s < steps; s++) {
      let angle = noise(x * noiseScale, y * noiseScale) * TWO_PI * 2;
      let nx = x + cos(angle) * stepLen;
      let ny = y + sin(angle) * stepLen;

      line(x, y, nx, ny);

      x = nx;
      y = ny;

      // Wrap around
      if (x < 0) x += width;
      if (x > width) x -= width;
      if (y < 0) y += height;
      if (y > height) y -= height;
    }
  }

  noLoop();
}

function draw() {}
