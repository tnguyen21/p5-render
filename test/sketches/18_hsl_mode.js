function setup() {
  createCanvas(400, 400);
  background(0);
  colorMode(HSL, 360, 100, 100);
  noLoop();
}

function draw() {
  noStroke();
  let numRects = 36;
  let w = width / numRects;
  for (let i = 0; i < numRects; i++) {
    let hue = map(i, 0, numRects, 0, 360);
    fill(hue, 80, 50);
    rect(i * w, 50, w, 300);
  }
}
