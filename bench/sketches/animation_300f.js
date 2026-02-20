let particles = [];

function setup() {
  createCanvas(400, 400);
  background(10);
}

function draw() {
  // Add new particles each frame
  for (let i = 0; i < 3; i++) {
    particles.push({
      x: width / 2 + random(-20, 20),
      y: height / 2 + random(-20, 20),
      vx: random(-2, 2),
      vy: random(-2, 2),
      life: 255,
      r: random(2, 6),
      hue: (frameCount * 2 + i * 30) % 360
    });
  }

  // Semi-transparent background for trail effect
  noStroke();
  fill(10, 10, 10, 15);
  rect(0, 0, width, height);

  // Update and draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.02; // gravity
    p.life -= 0.5;

    if (p.life <= 0 || p.x < 0 || p.x > width || p.y > height) {
      particles.splice(i, 1);
      continue;
    }

    colorMode(HSB, 360, 100, 100, 255);
    fill(p.hue, 80, 90, p.life);
    noStroke();
    ellipse(p.x, p.y, p.r * 2, p.r * 2);
  }

  colorMode(RGB, 255);
  fill(255);
  noStroke();
  textSize(12);
  text("Frame: " + frameCount + " Particles: " + particles.length, 10, 20);
}
