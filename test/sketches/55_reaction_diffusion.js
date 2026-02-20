function setup() {
  createCanvas(400, 400);

  let gridW = 100;
  let gridH = 100;
  let dA = 1.0;
  let dB = 0.5;
  let feed = 0.055;
  let kill = 0.062;
  let dt = 1.0;

  // Initialize grids
  let gridA = [];
  let gridB = [];
  let nextA = [];
  let nextB = [];

  for (let i = 0; i < gridW * gridH; i++) {
    gridA[i] = 1.0;
    gridB[i] = 0.0;
    nextA[i] = 1.0;
    nextB[i] = 0.0;
  }

  // Seed a few spots with chemical B
  for (let sy = 40; sy < 60; sy++) {
    for (let sx = 40; sx < 60; sx++) {
      gridB[sy * gridW + sx] = 1.0;
    }
  }
  for (let sy = 20; sy < 30; sy++) {
    for (let sx = 70; sx < 80; sx++) {
      gridB[sy * gridW + sx] = 1.0;
    }
  }

  // Run iterations
  let iterations = 50;
  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 1; y < gridH - 1; y++) {
      for (let x = 1; x < gridW - 1; x++) {
        let idx = y * gridW + x;
        let a = gridA[idx];
        let b = gridB[idx];

        // Laplacian for A
        let lapA =
          gridA[(y - 1) * gridW + x] +
          gridA[(y + 1) * gridW + x] +
          gridA[y * gridW + (x - 1)] +
          gridA[y * gridW + (x + 1)] -
          4 * a;

        // Laplacian for B
        let lapB =
          gridB[(y - 1) * gridW + x] +
          gridB[(y + 1) * gridW + x] +
          gridB[y * gridW + (x - 1)] +
          gridB[y * gridW + (x + 1)] -
          4 * b;

        let abb = a * b * b;
        nextA[idx] = a + (dA * lapA - abb + feed * (1 - a)) * dt;
        nextB[idx] = b + (dB * lapB + abb - (kill + feed) * b) * dt;

        nextA[idx] = constrain(nextA[idx], 0, 1);
        nextB[idx] = constrain(nextB[idx], 0, 1);
      }
    }

    // Swap grids
    let tmpA = gridA;
    let tmpB = gridB;
    gridA = nextA;
    gridB = nextB;
    nextA = tmpA;
    nextB = tmpB;
  }

  // Render to canvas (map 100x100 grid to 400x400)
  loadPixels();
  let scale = width / gridW;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let gx = floor(x / scale);
      let gy = floor(y / scale);
      gx = constrain(gx, 0, gridW - 1);
      gy = constrain(gy, 0, gridH - 1);

      let a = gridA[gy * gridW + gx];
      let b = gridB[gy * gridW + gx];
      let val = floor((a - b) * 255);
      val = constrain(val, 0, 255);

      let idx = (y * width + x) * 4;
      pixels[idx] = val;
      pixels[idx + 1] = val;
      pixels[idx + 2] = floor(val * 0.8 + 50);
      pixels[idx + 3] = 255;
    }
  }
  updatePixels();

  noLoop();
}

function draw() {}
