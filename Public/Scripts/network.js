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
    const guid = window.localStorage.getItem("selfGuid");
    send({ type: "hello", guid });
  }
}

const networkData = {
  players: null,
  game: null,
  selfPlayer: null,
  selfGame: null
};

function onSocketMessage(event) {
  const json = JSON.parse(event.data);

  switch (json.type) {
    case "hello":
      hide($(".loading"));
      setVisible($(".viewer"), setup.isViewer);
      setVisible($(".player"), !setup.isViewer);

      networkData.players = json.players;
      networkData.game = json.game;
      networkData.selfPlayer = json.selfPlayer;
      networkData.selfGame = json.selfGame;

      if (setup.isViewer) {
        engine.applyViewerState();
      } else {
        window.localStorage.setItem("selfGuid", networkData.selfPlayer.guid);
        engine.applyPlayerState();
      }
      break;

    case "whoDis":
      hide($(".loading"));
      show($(".player"));
      show($(".player .waiting"));
      $(".player .waiting .username").focus();
      break;

    case "addPlayer":
      networkData.players.push(json.player);
      break;

    case "removePlayer":
      for (const player of networkData.players) {
        if (player.username === json.username) {
          removeFromList(networkData.players, player);
          break;
        }
      }
      break;

    case "goInGame":
      networkData.game = json.game;
      networkData.selfGame = json.selfGame;
      if (setup.isViewer) engine.applyViewerState();
      else engine.applyPlayerState();
      break;

    case "setTurnPhase":
      networkData.game.phase = json.phase;
      if (setup.isViewer) engine.applyViewerState();
      else engine.applyPlayerState();
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