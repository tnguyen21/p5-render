function setup() {
  createCanvas(400, 400);
  background(255);
  noiseSeed(42);

  let resolution = 10;
  let cols = floor(width / resolution);
  let rows = floor(height / resolution);

  stroke(0, 60);
  strokeWeight(1);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let angle = noise(x * 0.1, y * 0.1) * TWO_PI * 2;
      let cx = x * resolution + resolution / 2;
      let cy = y * resolution + resolution / 2;
      let len = resolution * 0.8;

      let x2 = cx + cos(angle) * len;
      let y2 = cy + sin(angle) * len;
      line(cx, cy, x2, y2);
    }
  }

  noLoop();
}

function draw() {}
