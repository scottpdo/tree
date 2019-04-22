const { Agent, Vector, utils } = require("flocc");
const fs = require("fs");
const { createCanvas } = require("canvas");

function random(min = 0, max = 1, float = false) {
  let r = Math.random() * (max - min);
  if (!float) r = Math.round(r);
  return min + r;
}

let TIME = 0;
const STOP_TIME = 10000;

let width = 200;
let height = 200;
let canvas = createCanvas(width, height);
let context = canvas.getContext("2d");

const N = new Vector(0, -1);
const S = new Vector(0, 1);
const E = new Vector(1, 0);
const W = new Vector(-1, 0);
const dirs = [N, S, E, W];

const bb = {
  minX: width / 2,
  minY: height / 2 - 2,
  maxX: width / 2,
  maxY: height / 2
};

const agent = new Agent();
const WHITE = { r: 0, g: 0, b: 0, a: 0 };
const BLACK = { r: 0, g: 0, b: 0, a: 255 };

function weightedRandom(arr, probs) {
  const r = Math.random();
  const s = utils.sum(probs);
  const normalizedProbs = probs.map(p => p / s);

  let prob = 0;
  for (let i = 0; i < arr.length; i++) {
    prob += normalizedProbs[i];
    if (r <= prob) return arr[i];
  }
}

function getPixel(x, y) {
  const [r, g, b, a] = context.getImageData(x, y, 1, 1).data;
  return {
    r,
    g,
    b,
    a
  };
}

function setPixel(px, x, y) {
  context.fillStyle = `rgba(${px.r}, ${px.g}, ${px.b}, ${px.a})`;
  context.fillRect(x, y, 1, 1);
}

function pixelEquals(px1, px2) {
  return ["r", "g", "b", "a"].every(k => {
    return px1[k] === px2[k];
  });
}

function neighboringPixels() {
  const { x, y } = agent.get("location");
  return [N, S, E, W].map(dir => {
    return getPixel(x + dir.x, y + dir.y);
  });
}

function neighboringPixelsEqualTo(color) {
  const { x, y } = agent.get("location");
  return [N, S, E, W].filter(dir => {
    return pixelEquals(getPixel(x + dir.x, y + dir.y), color);
  });
}

function onPeninsula() {
  const { x, y } = agent.get("location");
  const whiteNeighboringPixels = neighboringPixels().filter(p =>
    pixelEquals(p, WHITE)
  );
  return whiteNeighboringPixels === 3;
}

function move() {
  const { x, y } = agent.get("location");
  const currentPixel = getPixel(x, y);
  let probs = [
    50 / (agent.get("age") + 1) + 1,
    Math.sqrt(Math.abs(x - (bb.minX + bb.maxX) / 2)),
    2,
    2
  ];

  const i = dirs.indexOf(agent.get("last"));
  if (i >= 0) {
    probs[i] += 100;
  }

  const history = agent.get("history");

  history.forEach(h => {
    const i = dirs.indexOf(h);
    probs[i] = Math.sqrt(probs[i]);
  });

  let n = weightedRandom(dirs, probs);
  agent.get("location").add(n);
  agent.increment("age");

  // if on a black pixel, keep on moving
  if (pixelEquals(getPixel(x + n.x, y + n.y), BLACK)) {
    history.push(n);
    if (history.length > 3) {
      agent.set("history", history.slice(1, history.length));
    }
    agent.set("last", n);
    move();
  } else {
    const { x, y } = agent.get("location");
    if (x < bb.minX) bb.minX = x;
    if (y < bb.minY) bb.minY = y;
    if (x > bb.maxX) bb.maxX = x;
    if (y > bb.maxY) bb.maxY = y;
    return;
  }
}

function reset() {
  agent.set("last", null);
  agent.set("age", 0);
  agent.set("history", []);
  let r;
  do {
    r = new Vector(random(bb.minX, bb.maxX), random(bb.minY, bb.maxY));
  } while (pixelEquals(getPixel(r.x, r.y), WHITE));
  agent.set("location", r);
}

function seek() {
  move();
  const { x, y } = agent.get("location");
  setPixel(BLACK, x, y);
  reset();
  if (TIME < STOP_TIME) {
    if (TIME % 1000 === 0) console.log("time: ", TIME);
    TIME++;
    process.nextTick(seek);
  } else {
    fs.writeFileSync("./tree.png", canvas.toBuffer());
    console.log("done!");
  }
}

function init() {
  setPixel(BLACK, bb.maxX, bb.maxY);
  setPixel(BLACK, bb.maxX, bb.maxY - 1);
  setPixel(BLACK, bb.maxX, bb.maxY - 2);
  reset();
  seek();
}

init();
