function setup() {
  createCanvas(400, 400);
  background(0);

  noiseSeed(42);

  let cols = 20;
  let rows = 20;
  let cellW = width / cols;
  let cellH = height / rows;

  noStroke();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let n = noise(x * 0.1, y * 0.1);
      fill(n * 255);
      rect(x * cellW, y * cellH, cellW, cellH);
    }
  }

  noLoop();
}

function draw() {}
