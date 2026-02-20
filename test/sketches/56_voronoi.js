function setup() {
  createCanvas(400, 400);
  randomSeed(42);

  let numSeeds = 20;
  let seeds = [];
  let seedColors = [];

  // Generate seed points and colors
  colorMode(HSB, 360, 100, 100);
  for (let i = 0; i < numSeeds; i++) {
    seeds.push(createVector(random(width), random(height)));
    seedColors.push(color((i / numSeeds) * 360, 70, 90));
  }

  // For each pixel, find nearest seed and color accordingly
  loadPixels();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minDist = Infinity;
      let closest = 0;

      for (let i = 0; i < numSeeds; i++) {
        let d = dist(x, y, seeds[i].x, seeds[i].y);
        if (d < minDist) {
          minDist = d;
          closest = i;
        }
      }

      let c = seedColors[closest];
      let idx = (y * width + x) * 4;
      pixels[idx] = red(c);
      pixels[idx + 1] = green(c);
      pixels[idx + 2] = blue(c);
      pixels[idx + 3] = 255;
    }
  }
  updatePixels();

  // Draw seed points
  colorMode(RGB, 255);
  fill(0);
  noStroke();
  for (let s of seeds) {
    ellipse(s.x, s.y, 6, 6);
  }

  noLoop();
}

function draw() {}
