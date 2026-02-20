function setup() {
  createCanvas(400, 400);

  noiseSeed(42);

  loadPixels();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let n = noise(x * 0.01, y * 0.01);
      let bright = floor(n * 255);
      let idx = (y * width + x) * 4;
      pixels[idx] = bright;
      pixels[idx + 1] = bright;
      pixels[idx + 2] = bright;
      pixels[idx + 3] = 255;
    }
  }
  updatePixels();

  noLoop();
}

function draw() {}
