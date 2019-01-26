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
