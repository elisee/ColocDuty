// Loading
const imageUrls = [];
const images = {};

function loadImages(callback) {
  let imageQueue = imageUrls.length;

  for (const url of imageUrls) {
    const image = new Image();
    image.src = url;
    image.addEventListener("load", () => {
      images[url] = image;
      imageQueue--;
      if (imageQueue === 0) callback();
    });
  }
}

const characterCount = 7;

for (let i = 0; i < characterCount; i++) {
  imageUrls.push(`/Assets/Characters/${i}-Idle.png`);
}

loadImages(() => {
  setupCharacterSelector();
  connect();
});

// Socket
const isViewer = window.location.pathname.startsWith("/view/");
const roomCode = window.location.pathname.substring("/play/".length);
let socket = null;

function connect() {
  socket = new WebSocket("ws://" + window.location.host + "/room/" + roomCode);
  socket.addEventListener("open", onSocketOpen);
  socket.addEventListener("message", onSocketMessage);
  socket.addEventListener("close", onSocketClose);
}

function send(json) { socket.send(JSON.stringify(json)); }

function onSocketOpen(event) {
  if (isViewer) send({ type: "hello", viewerMode: true });
  else {
    const guid = window.localStorage.getItem("colocGuid");
    send({ type: "hello", guid });
  }
}

let gameData = null;

function onSocketMessage(event) {
  const json = JSON.parse(event.data);

  switch (json.type) {
    case "helloViewer":
      hide($(".loading"));
      show($(".viewer"));
      $(".gameUrl").textContent = window.location.host + "/play/" + roomCode;
      $(".gameUrl").href = window.location.protocol + "//" + window.location.host + "/play/" + roomCode;

      gameData = json.data;
      applyViewerState();
      break;

    case "helloPlayer":
      window.localStorage.setItem("colocGuid", json.guid);
      hide($(".loading"));
      show($(".player"));

      gameData = json.data;
      applyPlayerState();
      break;

    case "plzJoin":
      hide($(".loading"));
      show($(".player"));
      show($(".player .waiting"));
      $(".player .waiting .username").focus();
      break;

    case "addPlayer":
      gameData.players.push(json.username);
      buildPlayerList();
      break;

    case "removePlayer":
      removeFromList(gameData.players, json.username);
      buildPlayerList();
      break;

    case "setState":
      gameData.state = json.state;
      if (isViewer) applyViewerState();
      else applyPlayerState();
      break;
  }
}

function onSocketClose(event) {
  hide($(".viewer"));
  hide($(".player"));
  hide($(".loading"));
  show($(".disconnected"));
  $(".disconnected .reason").textContent = event.reason;
}

// Animate
let previousTimestamp = 0;

function animate(timestamp) {
  requestAnimationFrame(animate);

  const ms = timestamp - previousTimestamp;
  previousTimestamp = timestamp;

  if (!$(".viewer .inGame").hidden) animateViewerInGame(ms);
  if (!$(".player .waiting").hidden) animatePlayerWaiting(ms);
  if (!$(".player .inGame").hidden) animatePlayerInGame(ms);
}

animate(0);

function lerp(a, b, v) {
  return a + (b - a) * v;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(v, max));
}

function makeSprite(image, width, height, frameCount, fps) {
  return { image, width, height, framesPerRow: image.width / width, frameCount, frameDuration: 1000 / fps, time: 0 };
}

function tickSprites(sprites, ms) {
  for (const sprite of sprites) sprite.time = (sprite.time + ms) % (sprite.frameCount * sprite.frameDuration);
}

function drawSprite(ctx, sprite, x, y) {
  const index = Math.floor(sprite.time / sprite.frameDuration);
  const column = index % sprite.framesPerRow;
  const row = Math.floor(index / sprite.framesPerRow);

  ctx.drawImage(sprite.image, column * sprite.width, row * sprite.height, sprite.width, sprite.height, x, y, sprite.width, sprite.height);
}

// Viewer
function buildPlayerList() {
  const listElt = $(".viewer .players ul");
  listElt.innerHTML = "";

  for (const player of gameData.players) {
    $make("li", listElt, { textContent: player });
  }
}

function applyViewerState() {
  setVisible($(".viewer .waiting"), gameData.state.name === "waiting");
  setVisible($(".viewer .inGame"), gameData.state.name === "inGame");

  switch (gameData.state.name) {
    case "waiting":
      buildPlayerList();
      break;

    case "inGame":
      break;
  }
}

function animateViewerInGame() {

}

// Player
let isReady = false;

const charSelectorCanvas = $(".player .waiting .characterSelector");
const charSelectorContext = charSelectorCanvas.getContext("2d");

const charSize = 256;

const charSelector = {
  sprites: [],
  offset: 0,
  dragStart: null,
};

touch(charSelectorCanvas, (touch) => {
  if (isReady) return;

  if (touch.started) {
    charSelector.dragStart = touch.x + charSelector.offset;
  } else if (touch.ended) {
    charSelector.dragStart = null;
  } else {
    charSelector.offset = charSelector.dragStart - touch.x;
  }
});

function setupCharacterSelector() {
  for (let i = 0; i < characterCount; i++) {
    const image = images[`/Assets/Characters/${i}-Idle.png`];
    charSelector.sprites.push(makeSprite(image, charSize, charSize, 12, 12));
  }
}

function animatePlayerWaiting(ms) {
  tickSprites(charSelector.sprites, ms);

  if (charSelector.dragStart == null) {
    const closest = clamp(Math.round(charSelector.offset / charSize), 0, characterCount - 1) * charSize;
    charSelector.offset = lerp(charSelector.offset, closest, 0.15);
  }

  const canvas = charSelectorCanvas;
  const ctx = charSelectorContext;

  ctx.fillStyle = "#c55";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2 - charSize / 2, 0);

  for (let i = 0; i < characterCount; i++) {
    drawSprite(ctx, charSelector.sprites[i], i * charSize - charSelector.offset, i);
  }

  ctx.restore();
}

const waitingButtonElt = $(".player .waiting button");

waitingButtonElt.addEventListener("click", (event) => {
  if (!isReady) {
    isReady = true;
    $(".player .waiting .username").disabled = true;
    waitingButtonElt.textContent = "Start!";
    send({ "type": "joinAsPlayer", "username": $(".player .waiting .username").value });
  } else {
    send({ type: "start" });
  }
});

function applyPlayerState() {
  setVisible($(".player .waiting"), gameData.state.name === "waiting");
  setVisible($(".player .inGame"), gameData.state.name === "inGame");
}

function animatePlayerInGame() {

}
