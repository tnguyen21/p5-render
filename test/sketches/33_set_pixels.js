function setup() {
  createCanvas(400, 400);
  noLoop();
}

function draw() {
  background(0);

  // Use set(x, y, color) to manually draw a gradient from black to white left-to-right
  for (let x = 0; x < width; x++) {
    let bright = map(x, 0, width - 1, 0, 255);
    let c = color(bright);
    for (let y = 0; y < height; y++) {
      set(x, y, c);
    }
  }
  updatePixels();
}
