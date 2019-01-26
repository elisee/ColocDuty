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

const characterCount = 6;

for (let i = 0; i < characterCount; i++) {
  imageUrls.push(`/assets/characters/${characterCount}.png`);
}

loadImages(() => {
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

      for (let i = 0; i < characterCount; i++) {
        $make("img", characterSelectorElt, { src: `/assets/characters/${characterCount}.png` });
      }
      
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

// Animate
function animate() {
  requestAnimationFrame(animate);

  if (!$(".join").hidden) animateCharacterSelect();
  if (!$(".viewer .inGame").hidden) animateViewerInGame();
  if (!$(".player .inGame").hidden) animatePlayerInGame();
}

animate();

// Join
$(".join").addEventListener("submit", (event) => {
  event.preventDefault();

  hide($(".join"));
  show($(".loading"));
  send({ "type": "joinAsPlayer", "username": $(".join .username").value });
});

const charSelectorCanvas = $(".join .characterSelector");
const charSelectorCtx = charSelectorCanvas.getContext("2d");

function animateCharacterSelect() {
  charSelectorCtx.fillStyle = "#f00";
  charSelectorCtx.fillRect(0, 0, charSelectorCanvas.width, charSelectorCanvas.height);

  for (let i = 0; i < characterCount; i++) {
    const image = images[`/assets/characters/${characterCount}.png`];
    charSelectorCtx.drawImage(image, i * 256, 0);
  }
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
$(".player .waiting").addEventListener("submit", (event) => {
  event.preventDefault();

  send({ type: "start" });
});

function applyPlayerState() {
  setVisible($(".player .waiting"), gameData.state.name === "waiting");
  setVisible($(".player .inGame"), gameData.state.name === "inGame");
}

function animatePlayerInGame() {

}
