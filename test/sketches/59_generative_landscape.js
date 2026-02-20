function setup() {
  createCanvas(400, 400);
  noiseSeed(42);

  // Sky gradient
  for (let y = 0; y < height; y++) {
    let inter = map(y, 0, height, 0, 1);
    let c = lerpColor(color(135, 180, 255), color(255, 200, 150), inter);
    stroke(c);
    line(0, y, width, y);
  }

  noStroke();

  let numLayers = 5;

  for (let layer = 0; layer < numLayers; layer++) {
    // Each layer gets darker (more foreground) and lower on screen
    let baseY = map(layer, 0, numLayers - 1, 120, 300);
    let noiseScale = map(layer, 0, numLayers - 1, 0.005, 0.015);
    let noiseOffset = layer * 100;
    let brightness = map(layer, 0, numLayers - 1, 80, 20);

    // Color gets darker and more saturated for foreground layers
    let r = brightness + 20;
    let g = brightness + 40;
    let b = brightness;

    fill(r, g, b);

    beginShape();
    vertex(0, height);
    for (let x = 0; x <= width; x += 2) {
      let n = noise(x * noiseScale + noiseOffset, layer * 0.5);
      let hillHeight = n * 120;
      let y = baseY - hillHeight + 40;
      vertex(x, y);
    }
    vertex(width, height);
    endShape(CLOSE);
  }

  noLoop();
}

function draw() {}
