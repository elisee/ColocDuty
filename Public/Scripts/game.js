window.setup = {
  isViewer: window.location.pathname.startsWith("/view/"),
  roomCode: window.location.pathname.substring("/play/".length)
};

const baseImageUrls = [];

for (let i = 0; i < characterCount; i++) {
  baseImageUrls.push(`/Assets/Characters/${i}-Idle.png`);
  baseImageUrls.push(`/Assets/Characters/${i}-Mixed.png`);
  baseImageUrls.push(`/Assets/Characters/${i}-Sad.png`);
  baseImageUrls.push(`/Assets/Characters/${i}-Happy.png`);
  baseImageUrls.push(`/Assets/Characters/${i}-Bad.png`);
}

var cardTypes = Object.keys(cardTypeSettings);
for (let i = 0; i < cardTypes.length; i++) {
  baseImageUrls.push(`/Assets/Cards/Card_${cardTypes[i]}.png`);
}

baseImageUrls.push("/Assets/Cards/Badge_Price.png");
baseImageUrls.push("/Assets/Cards/Money.png");
baseImageUrls.push(`/Assets/PhaseIcons.png`);

baseImageUrls.push(`/Assets/StoreIcon.png`);
baseImageUrls.push(`/Assets/LetterIcon.png`);

if (setup.isViewer) {
  try {
  $("audio").play();
  } catch {}
  
  baseImageUrls.push(`/Assets/Viewer/Background.jpg`);
  baseImageUrls.push(`/Assets/Viewer/CharacterFrame.png`);
  baseImageUrls.push(`/Assets/Viewer/CardIcons.png`);
  baseImageUrls.push("/Assets/Viewer/HygieneBarEmpty.png");
  baseImageUrls.push("/Assets/Viewer/HygieneBarFull.png");
  baseImageUrls.push("/Assets/Viewer/HygieneBarProgress.png");
  baseImageUrls.push("/Assets/Viewer/MoodBarEmpty.png");
  baseImageUrls.push("/Assets/Viewer/MoodBarFull.png");
  baseImageUrls.push("/Assets/Viewer/MoodBarProgress.png");
  baseImageUrls.push("/Assets/Viewer/HomeIcon.png");

  // Temporary debug button for quick testing
  $(".viewer .debug button").addEventListener("click", (event) => {
    window.open(window.location.protocol + "//" + window.location.host + "/play/" + setup.roomCode, '_blank');
  });
}

loadImages(baseImageUrls, () => {
  setupCharacterSprites();

  connect();
})


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
