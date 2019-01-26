let isReady = false;

const charSelectorCanvas = $(".player .waiting .characterSelector");
const charSelectorContext = charSelectorCanvas.getContext("2d");

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

window.engine.applyPlayerState = () => {
  setVisible($(".player .waiting"), networkData.game == null);
  setVisible($(".player .inGame"), networkData.game != null);
};

const playerCanvas = $(".player .inGame canvas");
const playerContext = playerCanvas.getContext("2d");

function animatePlayerInGame() {
  const canvas = playerCanvas;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  const ctx = playerContext;

  ctx.fillStyle = "#00f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const refWidth = 1080;
  const refHeight = 1920;
  const scale = canvas.height / refHeight;

  ctx.save();
  ctx.translate(canvas.width / 2, 0);
  ctx.scale(scale, scale);
  ctx.translate(0, refHeight / 2);

  ctx.fillStyle = "#f0f";

  // Hovered card
  ctx.save();
  ctx.translate(-640 / 2, -810 / 2);
  ctx.fillRect(0, 0, 640, 810);
  ctx.restore();

  // Hand
  const cardThumbWidth = 192;
  const cardThumbHeight = 243;
  const cardThumbSpace = 16;
  const cardCount = networkData.selfGame.hand.length;

  ctx.save();
  ctx.fillStyle = "#f0c";
  ctx.translate(-(cardCount * cardThumbWidth + (cardCount - 1) * cardThumbSpace) / 2, 600);

  for (let i = 0; i < networkData.selfGame.hand.length; i++) {
    const card = networkData.selfGame.hand[i];
    ctx.fillRect(i * (cardThumbWidth + cardThumbSpace), 0, cardThumbWidth, cardThumbHeight);
  }

  ctx.restore();

  ctx.restore();
}
