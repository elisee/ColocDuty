window.setup = {
  isViewer: window.location.pathname.startsWith("/view/"),
  roomCode: window.location.pathname.substring("/play/".length)
};

for (let i = 0; i < characterCount; i++) imageUrls.push(`/Assets/Characters/${i}-Idle.png`);

var cardTypes = Object.keys(cardTypeSettings);
for (let i = 0; i < cardTypes.length; i++) {
  imageUrls.push(`/Assets/Cards/${cardTypes[i]}.png`);
}

// TODO: Preload all cards, based on input from the server
imageUrls.push(`/Assets/Cards/Job/Cobaye Bebop.png`);

if (setup.isViewer) {
  imageUrls.push(`/Assets/Viewer/Background.jpg`);
  imageUrls.push(`/Assets/Viewer/CharacterFrame.png`);
  imageUrls.push(`/Assets/Viewer/BillIcon.png`);
  imageUrls.push(`/Assets/Viewer/CardIcons.png`);
  imageUrls.push("/Assets/Viewer/HygieneBarEmpty.png");
  imageUrls.push("/Assets/Viewer/HygieneBarFull.png");
  imageUrls.push("/Assets/Viewer/MoodBarEmpty.png");
  imageUrls.push("/Assets/Viewer/MoodBarFull.png");
  imageUrls.push("/Assets/Viewer/HomeIcon.png");

  // Temporary debug button for quick testing
  $(".viewer .debug button").addEventListener("click", (event) => {
    window.open(window.location.protocol + "//" + window.location.host + "/play/" + setup.roomCode, '_blank');
  });
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
