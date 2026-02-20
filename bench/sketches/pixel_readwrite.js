function setup() {
  createCanvas(400, 400);
  background(128);

  loadPixels();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let idx = (y * width + x) * 4;
      // Apply a diagonal gradient
      let val = floor(((x + y) / (width + height)) * 255);
      pixels[idx] = val;           // R
      pixels[idx + 1] = 255 - val; // G
      pixels[idx + 2] = 128;       // B
      pixels[idx + 3] = 255;       // A
    }
  }
  updatePixels();

  noLoop();
}

function draw() {}
