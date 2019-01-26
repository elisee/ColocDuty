window.setup = {
  isViewer: window.location.pathname.startsWith("/view/"),
  roomCode: window.location.pathname.substring("/play/".length)
};

// Temporary debug button for quick testing
if (setup.isViewer) {
  $(".viewer .debug button").addEventListener("click", (event) => {
    window.open(window.location.protocol + "//" + window.location.host + "/play/" + setup.roomCode, '_blank');
  })
}

loadImages(() => {
  setupCharacterSprites();

  connect();
});

// Socket
let socket = null;

function connect() {
  socket = new WebSocket("ws://" + window.location.host + "/room/" + setup.roomCode);
  socket.addEventListener("open", onSocketOpen);
  socket.addEventListener("message", onSocketMessage);
  socket.addEventListener("close", onSocketClose);
}

function send(json) { socket.send(JSON.stringify(json)); }

function onSocketOpen(event) {
  if (setup.isViewer) send({ type: "hello", viewerMode: true });
  else {
    const guid = window.localStorage.getItem("colocGuid");
    send({ type: "hello", guid });
  }
}

let gameData = null;
let selfData = null;
let selfState = null;

function onSocketMessage(event) {
  const json = JSON.parse(event.data);

  switch (json.type) {
    case "helloViewer":
      hide($(".loading"));
      show($(".viewer"));

      gameData = json.gameData;
      engine.applyViewerState();
      break;

    case "helloPlayer":
      window.localStorage.setItem("colocGuid", json.selfData.guid);
      hide($(".loading"));
      show($(".player"));

      gameData = json.gameData;
      selfData = json.selfData;
      selfState = json.selfState;
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
      window.selfState = json.selfState;
      if (setup.isViewer) engine.applyViewerState();
      else applyPlayerState();
      break;

    case "setTurnPhase":
      gameData.state.phase = json.phase;
      if (setup.isViewer) engine.applyViewerState();
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

  if (!$(".viewer").hidden) engine.animateViewer(ms);
  if (!$(".player .waiting").hidden) animatePlayerWaiting(ms);
  if (!$(".player .inGame").hidden) animatePlayerInGame(ms);
}

animate(0);

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
}

const playerCanvas = $(".player .inGame canvas");
const playerContext = playerCanvas.getContext("2d");

function animatePlayerInGame() {
  const canvas = playerCanvas;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  const ctx = playerContext;

  ctx.fillStyle = "#00f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);

  ctx.fillStyle = "#f0f";

  for (let i = 0; i < selfState.hand.length; i++) {
    const card = selfState.hand[i];
    ctx.fillRect(i * 200, 0, 100, 100);
  }

  ctx.restore();
}
