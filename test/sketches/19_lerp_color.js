function setup() {
  createCanvas(400, 400);
  background(220);
  noLoop();
}

function draw() {
  noStroke();
  let c1 = color(255, 0, 0);
  let c2 = color(0, 0, 255);
  let numRects = 40;
  let w = width / numRects;

  for (let i = 0; i < numRects; i++) {
    let amt = map(i, 0, numRects - 1, 0, 1);
    let c = lerpColor(c1, c2, amt);
    fill(c);
    rect(i * w, 80, w, 240);
  }
}
