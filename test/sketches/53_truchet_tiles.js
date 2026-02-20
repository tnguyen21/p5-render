function setup() {
  createCanvas(400, 400);
  background(255);
  randomSeed(42);

  let tileSize = 40;
  let cols = width / tileSize;
  let rows = height / tileSize;

  stroke(0);
  strokeWeight(3);
  noFill();

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let px = x * tileSize;
      let py = y * tileSize;

      if (random() < 0.5) {
        // Orientation A: arcs from top-left to bottom-right
        arc(px, py, tileSize, tileSize, 0, HALF_PI);
        arc(px + tileSize, py + tileSize, tileSize, tileSize, PI, PI + HALF_PI);
      } else {
        // Orientation B: arcs from top-right to bottom-left
        arc(px + tileSize, py, tileSize, tileSize, HALF_PI, PI);
        arc(px, py + tileSize, tileSize, tileSize, PI + HALF_PI, TWO_PI);
      }
    }
  }

  noLoop();
}

function draw() {}
