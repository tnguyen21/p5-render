function setup() {
  createCanvas(400, 400);
  background(255);
  randomSeed(42);

  let words = ["hello", "p5", "render", "test", "bench", "draw", "pixel", "noise", "art", "code"];

  for (let i = 0; i < 200; i++) {
    let x = random(width);
    let y = random(height);
    let s = random(8, 32);
    let word = words[floor(random(words.length))];

    fill(random(255), random(255), random(255));
    noStroke();
    textSize(s);
    text(word, x, y);
  }

  noLoop();
}

function draw() {}
