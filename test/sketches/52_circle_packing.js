function setup() {
  createCanvas(400, 400);
  background(20);
  randomSeed(42);

  let circles = [];
  let maxAttempts = 1000;
  let maxGrowthSteps = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let x = random(width);
    let y = random(height);
    let r = 2;

    // Check if starting position overlaps any existing circle
    let valid = true;
    for (let c of circles) {
      let d = dist(x, y, c.x, c.y);
      if (d < c.r + r + 2) {
        valid = false;
        break;
      }
    }
    if (!valid) continue;

    // Grow the circle until it hits another or the edge
    for (let step = 0; step < maxGrowthSteps; step++) {
      r += 1;

      // Check edges
      if (x - r < 0 || x + r > width || y - r < 0 || y + r > height) {
        r -= 1;
        break;
      }

      // Check other circles
      let hitOther = false;
      for (let c of circles) {
        let d = dist(x, y, c.x, c.y);
        if (d < c.r + r + 2) {
          r -= 1;
          hitOther = true;
          break;
        }
      }
      if (hitOther) break;
    }

    if (r >= 2) {
      circles.push({ x: x, y: y, r: r });
    }
  }

  // Draw all circles
  noStroke();
  for (let c of circles) {
    let hue = map(c.r, 2, 60, 180, 360) % 360;
    colorMode(HSB, 360, 100, 100, 100);
    fill(hue, 70, 90, 80);
    ellipse(c.x, c.y, c.r * 2, c.r * 2);
  }

  noLoop();
}

function draw() {}
