{
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
      charSelector.selectedIndex = clamp(Math.round(charSelector.offset / characterSize), 0, characterCount - 1);
      const closest = charSelector.selectedIndex * characterSize;
      charSelector.offset = lerp(charSelector.offset, closest, 0.15);
    }

    const canvas = charSelectorCanvas;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const ctx = charSelectorContext;

    ctx.fillStyle = "#c55";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2 - characterSize / 2, 0);

    if (isReady) {
      drawSprite(ctx, characterSprites[charSelector.selectedIndex], 0, 0);
    } else {
      for (let i = 0; i < characterCount; i++) {
        ctx.fillStyle = i % 2 == 0 ? "#aaa" : "#bbb";
        ctx.fillRect(i * characterSize - charSelector.offset, 0, characterSize, characterSize);
        drawSprite(ctx, characterSprites[i], i * characterSize - charSelector.offset, 0);
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

  const canvas = $(".player .inGame canvas");
  const ctx = canvas.getContext("2d");

  const cardThumbWidth = 192;
  const cardThumbHeight = 243;
  const cardThumbSpace = 16;

  let scale;
  const refHeight = 1920;
  let scaledWidth;

  const bigCardWidth = 963;
  const bigCardHeight = 1267;

  const playAreaBottom = 1500;

  const handAreaTop = 1600;
  const handAreaHeight = refHeight - handAreaTop;

  let drag = { target: null };

  function animatePlayerInGame() {
    function drawThumbCard(card, x, y, mode) {
      if (mode === "play") y -= 20;

      if (mode !== "none") {
        ctx.fillStyle = mode === "play" ? "#fff" : "#f00";
        ctx.fillRect(x, y, cardThumbWidth, cardThumbHeight);
      }

      const cardArt = images[`/Assets/Cards/Job/${card.name}.png`];
      const cardOverlay = images[`/Assets/Cards/Card_${card.type}.png`];

      const scale = cardOverlay.height / cardThumbHeight;

      if (cardArt != null) {
        ctx.drawImage(
          cardArt, 0, 0, cardArt.width, cardArt.height,
          x + 125 / scale, y + 95 / scale, cardArt.width / cardOverlay.width * cardThumbWidth, cardArt.height / cardOverlay.height * cardThumbHeight);
      }

      ctx.drawImage(
        cardOverlay, 0, 0, cardOverlay.width, cardOverlay.height,
        x, y, cardThumbWidth, cardThumbHeight);
    }

    function drawBigCard(card, x, y) {
      const cardArt = images[`/Assets/Cards/Job/${card.name}.png`];
      const cardOverlay = images[`/Assets/Cards/Card_${card.type}.png`];

      const scale = cardOverlay.height / bigCardHeight;

      if (cardArt != null) {
        ctx.drawImage(
          cardArt, 0, 0, cardArt.width, cardArt.height,
          x + 125 / scale, y + 95 / scale, cardArt.width / cardOverlay.width * bigCardWidth, cardArt.height / cardOverlay.height * bigCardHeight);
      }

      ctx.drawImage(
        cardOverlay, 0, 0, cardOverlay.width, cardOverlay.height,
        x, y, bigCardWidth, bigCardHeight);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Money
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 80px Montserrat";
      ctx.fillText(card.moneyModifier, x + bigCardWidth * 0.14, y + bigCardHeight * 0.17);

      const money = images[`/Assets/Cards/Money.png`];
      const moneyIconScale = 0.25;
      ctx.drawImage(
        money, 0, 0, money.width, money.height,
        x + bigCardWidth * 0.16, y + bigCardHeight * 0.105, money.width * moneyIconScale, money.height * moneyIconScale);

      // Hygiene
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 60px Montserrat";
      ctx.fillText(card.hygieneModifier, x + bigCardWidth * 0.86, y + bigCardHeight * 0.15);

      // Mood
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 60px Montserrat";
      ctx.fillText(card.moodModifier, x + bigCardWidth * 0.9, y + bigCardHeight * 0.09);

      // Name
      ctx.fillStyle = "#fff";
      ctx.font = "700 50px Montserrat";
      let textLength = ctx.measureText(card.name).width;
      if (textLength > bigCardWidth * 0.7) {
        ctx.font = "700 42px Montserrat";
      }

      textLength = ctx.measureText(card.name).width;
      if (textLength > bigCardWidth * 0.7) {
        ctx.font = "700 36px Montserrat";
      }

      ctx.save();
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.fillText(card.name, x + bigCardWidth / 2, y + bigCardHeight * 0.58);
      ctx.restore();

      // Description
      ctx.fillStyle = "#a3b2b5";
      ctx.font = "400 32px Montserrat";
      writeWrappedText(ctx, card.description, x + bigCardWidth / 2, y + bigCardHeight * 0.74, bigCardWidth * 0.75, 28);

      // Action
      ctx.fillStyle = "#fddd6e";
      ctx.font = "700 40px Montserrat";
      writeWrappedText(ctx, card.action, x + bigCardWidth / 2, y + bigCardHeight * 0.87, bigCardWidth * 0.65, 40);

      // Type
      ctx.fillStyle = cardTypeSettings[card.type].color;
      ctx.font = "900 46px Montserrat";

      ctx.save();
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.fillText(card.type, x + bigCardWidth / 2, y + bigCardHeight * 0.937);
      ctx.restore();
    }

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    scale = canvas.height / refHeight;
    scaledWidth = canvas.width / scale;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(scale, scale);

    ctx.fillStyle = "#f0f";

    const centerX = scaledWidth / 2;
    const centerY = refHeight / 2;

    // Hand
    ctx.fillStyle = drag.target === "hand" ? "#005" : "#66c";
    ctx.fillRect(0, handAreaTop, scaledWidth, handAreaHeight);

    const hand = networkData.selfGame.hand;

    const cardStripDesiredWidth = (hand.length * cardThumbWidth + (hand.length + 1) * cardThumbSpace);
    const cardStripMaxWidth = scaledWidth - cardThumbSpace * 2;

    cardStripWidth = Math.min(cardStripDesiredWidth, cardStripMaxWidth);
    const cardOffset = (cardStripWidth - cardThumbSpace * 2) / hand.length;

    if (drag.target === "hand") {
      const hoveredHandCardIndex = clamp(Math.floor((drag.x - (centerX - cardStripWidth / 2)) / cardOffset), 0, hand.length - 1);
      drag.hoveredCard = hand[hoveredHandCardIndex];
    } else {
      drag.hoveredCard = null;
    }

    for (let i = hand.length - 1; i >= 0; i--) {
      const card = hand[i];
      const x = centerX - cardStripWidth / 2 + i * cardOffset;

      const mode = card == drag.hoveredCard ? (drag.willPlayCard ? "play" : "hover") : "none";
      drawThumbCard(card, x, handAreaTop + handAreaHeight / 2 - cardThumbHeight / 2, mode);
    }

    if (drag.hoveredCard != null) drawBigCard(drag.hoveredCard, centerX - bigCardWidth / 2, centerY - bigCardHeight / 2);
  }

  touch(canvas, (touch) => {
    if (touch.ended) {
      if (drag.target == null) return;

      switch (drag.target) {
        case "hand":
          if(drag.willPlayCard && drag.hoveredCard != null) {
            send({ type: "useCard", cardId: drag.hoveredCard.id });
          }
      }

      drag = { target: null };
      return;
    }

    const x = touch.x / scale;
    const y = touch.y / scale;

    if (touch.started) {
      // if (y < marketAreaHeight)
      if (y > handAreaTop) drag = { target: "hand", willPlayCard: false };
    }

    if (drag == null) return;
    drag.x = x;
    drag.y = y;

    if (drag.target === "hand") {
      drag.willPlayCard = y < playAreaBottom;
    }
  });
}
