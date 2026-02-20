function setup() {
  createCanvas(400, 400);
  noiseSeed(42);

  let gridSize = 100;
  let cellW = width / gridSize;
  let cellH = height / gridSize;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      let n = noise(x * 0.05, y * 0.05);
      let c = color(n * 255);
      set(x * cellW, y * cellH, c);
    }
  }
  updatePixels();

  noLoop();
}

function draw() {}
