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

imageUrls.push(`/Assets/Background.jpg`);
imageUrls.push(`/Assets/Cards/Back.jpg`);

for (let i = 0; i < characterCount; i++) {
  imageUrls.push(`/Assets/Characters/${i}-Idle.png`);
}

const isViewer = window.location.pathname.startsWith("/view/");

loadImages(() => {
  setupCharacterSprites();

  connect();
});

// Socket
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
let selfData = null;

function onSocketMessage(event) {
  const json = JSON.parse(event.data);

  switch (json.type) {
    case "helloViewer":
      hide($(".loading"));
      show($(".viewer"));

      gameData = json.gameData;
      applyViewerState();
      break;

    case "helloPlayer":
      window.localStorage.setItem("colocGuid", json.selfData.guid);
      hide($(".loading"));
      show($(".player"));

      gameData = json.gameData;
      selfData = json.selfData;
      applyPlayerState();
      break;

    case "plzJoin":
      hide($(".loading"));
      show($(".player"));
      show($(".player .waiting"));
      $(".player .waiting .username").focus();
      break;

    case "addPlayer":
      gameData.players.push(json.data);
      break;

    case "removePlayer":
      for (const player of gameData.players) {
        if (player.username === json.username) {
          removeFromList(gameData.players, player);
          break;
        }
      }
      break;

    case "setState":
      gameData.state = json.state;
      if (isViewer) applyViewerState();
      else applyPlayerState();
      break;

    case "setTurnPhase":
      gameData.state.phase = json.phase;
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

  if (!$(".viewer").hidden) animateViewer(ms);
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

function drawSprite(ctx, sprite, x, y, destWidth, destHeight) {
  const index = Math.floor(sprite.time / sprite.frameDuration);
  const column = index % sprite.framesPerRow;
  const row = Math.floor(index / sprite.framesPerRow);

  if (destWidth == null) destWidth = sprite.width;
  if (destHeight == null) destHeight = sprite.height;

  ctx.drawImage(sprite.image, column * sprite.width, row * sprite.height, sprite.width, sprite.height, x, y, destWidth, destHeight);
}

const characterSprites = [];

function setupCharacterSprites() {
  for (let i = 0; i < characterCount; i++) {
    const image = images[`/Assets/Characters/${i}-Idle.png`];
    characterSprites.push(makeSprite(image, charSize, charSize, 12, 12));
  }
}

// Viewer
if (isViewer) {
  $(".viewer .debug button").addEventListener("click", (event) => {
    window.open(window.location.protocol + "//" + window.location.host + "/play/" + roomCode, '_blank');
  })
}

function applyViewerState() {
  setVisible($(".viewer .debug"), gameData.state.name == "waiting")
}

const viewerCanvas = $(".viewer canvas");
const viewerContext = viewerCanvas.getContext("2d");

function animateViewer(ms) {
  tickSprites(characterSprites, ms);

  const canvas = viewerCanvas;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  const ctx = viewerContext;

  ctx.fillStyle = "#c55";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();

  const backgroundImage = images[`/Assets/Background.jpg`];
  ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

  if (gameData.state.name == "waiting") {
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";

    ctx.font = "40px Montserrat";
    ctx.fillText(`Join the game with the code:`, canvas.width / 2, canvas.height / 2)

    ctx.font = "50px Montserrat";
    ctx.fillText(roomCode, canvas.width / 2, canvas.height / 2 + 60);
  }

  const screenCharSize = charSize * 0.8;
  const screenCharPadding = screenCharSize + 30;

  for (let i = 0; i < gameData.players.length; i++) {
    const player = gameData.players[i];
    drawSprite(ctx, characterSprites[player.characterIndex], 0, i * screenCharPadding, screenCharSize, screenCharSize);

    ctx.font = "30px Montserrat";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(player.username, 0.5 * screenCharSize, i * screenCharPadding + 35);

    const cardBackImage = images[`/Assets/Cards/Back.jpg`];
    const cardBackScale = 40;

    const { handCardCount } = gameData.state.playerStates[player.username];
    for (let j = 0; j < handCardCount; j++) {
      const x = screenCharSize / 2 + (j - handCardCount / 2) * cardBackImage.width / cardBackScale;
      const y = i * screenCharPadding + screenCharSize * 0.8;

      ctx.drawImage(
        cardBackImage, 0, 0, cardBackImage.width, cardBackImage.height,
        x, y, cardBackImage.width / cardBackScale, cardBackImage.height / cardBackScale);
    }
  }

  ctx.restore();
}

// Player
let isReady = false;

const charSelectorCanvas = $(".player .waiting .characterSelector");
const charSelectorContext = charSelectorCanvas.getContext("2d");

const charSize = 256;

const charSelector = {
  offset: 0,
  dragStart: null,
  selectedIndex: 0
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

function animatePlayerWaiting(ms) {
  tickSprites(characterSprites, ms);

  if (charSelector.dragStart == null) {
    charSelector.selectedIndex = clamp(Math.round(charSelector.offset / charSize), 0, characterCount - 1);
    const closest = charSelector.selectedIndex * charSize;
    charSelector.offset = lerp(charSelector.offset, closest, 0.15);
  }

  const canvas = charSelectorCanvas;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  const ctx = charSelectorContext;

  ctx.fillStyle = "#c55";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2 - charSize / 2, 0);

  if (isReady) {
    drawSprite(ctx, characterSprites[charSelector.selectedIndex], 0, 0);
  } else {
    for (let i = 0; i < characterCount; i++) {
      ctx.fillStyle = i % 2 == 0 ? "#aaa" : "#bbb";
      ctx.fillRect(i * charSize - charSelector.offset, 0, charSize, charSize);
      drawSprite(ctx, characterSprites[i], i * charSize - charSelector.offset, 0);
    }
  }

  ctx.restore();
}

const waitingButtonElt = $(".player .waiting button");

waitingButtonElt.addEventListener("click", (event) => {
  event.preventDefault();

  if (!isReady) {
    const username = $(".player .waiting .username").value;
    if (username.length < 2) return;

    isReady = true;
    $(".player .waiting .username").disabled = true;
    waitingButtonElt.textContent = "Start!";
    waitingButtonElt.classList.add("start");
    send({ "type": "joinAsPlayer", username, characterIndex: charSelector.selectedIndex });
  } else {
    send({ type: "start" });
  }
});

function applyPlayerState() {
  setVisible($(".player .waiting"), gameData.state.name === "waiting");
  setVisible($(".player .inGame"), gameData.state.name === "inGame");

  if (gameData.state.name === "inGame") {
    $(".player .inGame .phase").textContent = gameData.state.phase;
  }
}

function animatePlayerInGame() {
}
