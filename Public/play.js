const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

function $make(tagName, parent, props) {
  const elt = document.createElement(tagName);
  if (parent != null) parent.appendChild(elt);
  for (const key in props) elt[key] = props[key];
  return elt;
}

const show = (elt) => elt.hidden = false;
const hide = (elt) => elt.hidden = true;
const setVisible = (elt, visible) => elt.hidden = !visible;

function removeFromList(list, item) {
  list.splice(list.indexOf(item), 1);
}

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
      hide($(".join"));
      show($(".viewer"));
      $(".gameUrl").textContent = window.location.host + "/play/" + roomCode;
      $(".gameUrl").href = window.location.protocol + "//" + window.location.host + "/play/" + roomCode;

      gameData = json.data;
      applyViewerState();
      break;

    case "helloPlayer":
      window.localStorage.setItem("colocGuid", json.guid);
      hide($(".loading"));
      hide($(".join"));
      show($(".player"));
      $(".player .waiting .username").textContent = json.username;

      gameData = json.data;
      applyPlayerState();
      break;

    case "plzJoin":
      hide($(".loading"));
      show($(".join"));

      $(".join .username").focus();
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
  hide($(".join"));
  hide($(".viewer"));
  hide($(".player"));
  hide($(".loading"));
  show($(".disconnected"));
  $(".disconnected .reason").textContent = event.reason;
}

// Touch
function touch(elt, callback) {
  let touchId = null;
  let isMouseDown = false;

  elt.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    isMouseDown = true;

    callback({ started: true, x: event.clientX, y: event.clientY });
  });

  document.body.addEventListener("mouseup", (event) => {
    if (event.button !== 0 || !isMouseDown) return;

    isMouseDown = false;
    callback({ ended: true, x: event.clientX, y: event.clientY });
  });

  elt.addEventListener("mousemove", (event) => {
    if (event.button !== 0 || !isMouseDown) return;

    callback({ x: event.clientX, y: event.clientY });
  });

  elt.addEventListener("touchstart", (event) => {
    if (touchId != null) return;
    touchId = event.changedTouches[0].identifier;

    callback({ started: true, x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY });
  });

  elt.addEventListener("touchmove", (event) => {
    for (const changedTouch of event.changedTouches) {
      if (changedTouch.identifier === touchId) {
        callback({ x: changedTouch.clientX, y: changedTouch.clientY });
        return;
      }
    }
  });

  elt.addEventListener("touchend", (event) => {
    for (const changedTouch of event.changedTouches) {
      if (changedTouch.identifier == touchId) {
        callback({ ended: true, x: changedTouch.clientX, y: changedTouch.clientY });
        touchId = null;
        return;
      }
    }
  });
}

// Animate
let previousTimestamp = 0;

function animate(timestamp) {
  requestAnimationFrame(animate);

  const ms = timestamp - previousTimestamp;
  previousTimestamp = timestamp;

  if (!$(".join").hidden) animateCharacterSelector(ms);
  if (!$(".viewer .inGame").hidden) animateViewerInGame(ms);
  if (!$(".player .inGame").hidden) animatePlayerInGame(ms);
}

animate(0);

function lerp(a, b, v) {
  return a + (b - a) * v;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(v, max));
}

// Join
const joinForm = $(".join");
joinForm.addEventListener("submit", (event) => {
  if (!joinForm.checkValidity()) return;
  event.preventDefault();

  hide($(".join"));
  show($(".loading"));
  send({ "type": "joinAsPlayer", "username": $(".join .username").value });
});

const charSelectorCanvas = $(".join .characterSelector");
const charSelectorContext = charSelectorCanvas.getContext("2d");

const charSize = 256;

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

const charSelector = {
  sprites: [],
  offset: 0,
  dragStart: null,
};

function setupCharacterSelector() {
  for (let i = 0; i < characterCount; i++) {
    const image = images[`/Assets/Characters/${i}-Idle.png`];
    charSelector.sprites.push(makeSprite(image, charSize, charSize, 12, 12));
  }
}

function animateCharacterSelector(ms) {
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

touch(charSelectorCanvas, (touch) => {
  if (touch.started) {
    charSelector.dragStart = touch.x + charSelector.offset;
  } else if (touch.ended) {
    charSelector.dragStart = null;
  } else {
    charSelector.offset = charSelector.dragStart - touch.x;
  }
});

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
const startForm = $(".player .waiting");
startForm.addEventListener("submit", (event) => {
  if (!startForm.checkValidity()) return;
  event.preventDefault();

  send({ type: "start" });
});

function applyPlayerState() {
  setVisible($(".player .waiting"), gameData.state.name === "waiting");
  setVisible($(".player .inGame"), gameData.state.name === "inGame");
}

function animatePlayerInGame() {

}
