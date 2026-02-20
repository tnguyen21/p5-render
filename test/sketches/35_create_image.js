function setup() {
  createCanvas(400, 400);
  background(200);

  // Create a 100x100 image with a checkerboard pattern
  let img = createImage(100, 100);
  img.loadPixels();

  let tileSize = 10;
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) {
      let idx = (y * 100 + x) * 4;
      let isWhite = ((floor(x / tileSize) + floor(y / tileSize)) % 2 === 0);
      let val = isWhite ? 255 : 0;
      img.pixels[idx] = val;
      img.pixels[idx + 1] = val;
      img.pixels[idx + 2] = val;
      img.pixels[idx + 3] = 255;
    }
  }
  img.updatePixels();

  // Draw the checkerboard image at several positions
  image(img, 20, 20);
  image(img, 150, 150);
  image(img, 280, 20, 100, 100);
  image(img, 50, 280, 200, 100);

  noLoop();
}

function draw() {}
