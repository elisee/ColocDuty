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
    tickSprites(allCharacterSprites, ms);

    if (charSelector.dragStart == null) {
      charSelector.selectedIndex = clamp(Math.round(charSelector.offset / characterSize), 0, characterCount - 1);
      const closest = charSelector.selectedIndex * characterSize;
      charSelector.offset = lerp(charSelector.offset, closest, 0.15);
    }

    const canvas = charSelectorCanvas;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const ctx = charSelectorContext;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2 - characterSize / 2, 0);

    if (isReady) {
      drawSprite(ctx, emotionSpritesByCharacter[charSelector.selectedIndex]["Happy"], 0, 0);
    } else {
      for (let i = 0; i < characterCount; i++) {
        ctx.fillStyle = i % 2 == 0 ? "#1f394a" : "#214458";
        ctx.fillRect(i * characterSize - charSelector.offset, 0, characterSize, characterSize);
        drawSprite(ctx, emotionSpritesByCharacter[i]["Idle"], i * characterSize - charSelector.offset, 0);
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

  const pileAreaHeight = 320;
  const handAreaTop = refHeight - pileAreaHeight;
  const dragConfirmOffset = 100;

  const confirmAreaHeight = 240;
  const confirmAreaTop = handAreaTop - confirmAreaHeight;

  let drag = { target: null };

  function animatePlayerInGame(ms) {
    function handlePile(pile, top, dragging, dragOffset) {
      ctx.fillStyle = "#003058";
      ctx.fillRect(0, top, scaledWidth, pileAreaHeight);

      const cardStripDesiredWidth = (pile.length * cardThumbWidth + (pile.length + 1) * cardThumbSpace);
      const cardStripMaxWidth = scaledWidth - cardThumbSpace * 2;

      cardStripWidth = Math.min(cardStripDesiredWidth, cardStripMaxWidth);
      const cardOffset = (cardStripWidth - cardThumbSpace * 2) / pile.length;

      if (dragging) {
        if (!drag.willActivate) {
          const hoveredCardIndex = clamp(Math.floor((drag.x - (centerX - cardStripWidth / 2)) / cardOffset), 0, pile.length - 1);
          drag.hoveredCard = pile[hoveredCardIndex];
        }
      }

      for (let i = pile.length - 1; i >= 0; i--) {
        const card = pile[i];
        const x = centerX - cardStripWidth / 2 + i * cardOffset;

        const mode = card == drag.hoveredCard ? (drag.willActivate ? "play" : "hover") : "none";
        drawThumbCard(card, x, top + pileAreaHeight / 2 - cardThumbHeight / 2, mode, dragOffset);
      }
    }

    function drawThumbCard(card, x, y, mode, dragOffset) {
      if (mode === "play") y += dragOffset;

      if (mode !== "none") {
        ctx.fillStyle = mode === "play" ? "#fff" : "rgba(255,255,255,0.5)";
        ctx.fillRect(x, y, cardThumbWidth, cardThumbHeight);
      }

      const cardArt = images[`/Assets/Cards/${card.type}/${card.imageName}.png`];
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

    function drawBigCard(card, x, y, drawCost) {
      const cardArt = images[`/Assets/Cards/${card.type}/${card.imageName}.png`];
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

      // Cost
      if (drawCost) {
        const badgePrice = images[`/Assets/Cards/Badge_Price.png`];
        const badgePriceIconScale = 0.5;
        ctx.drawImage(
          badgePrice, 0, 0, badgePrice.width, badgePrice.height,
          x + (bigCardWidth - badgePrice.width * badgePriceIconScale) * 0.5, y - bigCardHeight * 0.05, badgePrice.width * badgePriceIconScale, badgePrice.height * badgePriceIconScale);

        ctx.fillStyle = "#ffffff";
        ctx.font = "900 90px Montserrat";
        ctx.fillText(card.cost, x + bigCardWidth * 0.48, y + bigCardHeight * 0.07);
      }

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

    tickSprites(allCharacterSprites, ms);

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    scale = canvas.height / refHeight;
    scaledWidth = canvas.width / scale;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(scale, scale);

    const centerX = scaledWidth / 2;
    const centerY = refHeight / 2;

    const { phase } = networkData.game;
    const { hand, rentPile } = networkData.selfGame;

    let phaseGlobalIcon;
    switch (phase.name) {
      case "PayRentFadeIn":
      case "PayRent":
        phaseGlobalIcon = images[`/Assets/LetterIcon.png`];
        break;
      case "MarketFadeIn":
      case "Market":
        phaseGlobalIcon = images[`/Assets/StoreIcon.png`];
        break;
    }

    if (phaseGlobalIcon != null) {
      ctx.globalAlpha = 0.2;
      ctx.drawImage(phaseGlobalIcon, centerX - phaseGlobalIcon.width / 2, centerY);
      ctx.globalAlpha = 1.0;
    }

    ctx.fillStyle = "#f0f";


    const isAlive = networkData.game.playerStates[networkData.selfPlayer.username].isAlive;

    const isPending = networkData.game.pendingUsernames.indexOf(networkData.selfPlayer.username) !== -1;
    const willConfirm = drag.target === "confirm" && drag.willActivate;
    const canPay = isAlive && (phase.name != "PayRent" || networkData.selfGame.balanceMoney >= phase.amountDue);

    // Top pile and hand
    let topPile = null;
    if (isPending) {
      switch (phase.name) {
        case "PayRent": topPile = rentPile; break;
        case "Market": topPile = networkData.game.phase.marketPile; break;
      }
    }

    if (topPile != null) handlePile(topPile, 0, drag.target === "topPile", dragConfirmOffset);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    let phaseTitle = "";
    let flavorText = [];

    let selfEmotion = "Idle";

    if (isAlive) {
      switch (phase.name) {
        case "PayRentFadeIn":
          phaseTitle = "A new week begins!";
          flavorText = ["Wonderful!"]; break;
        case "PayRent":
          phaseTitle = "Pay Rent";
          if (drag.target === "hand" && drag.willActivate) {
            if (drag.hoveredCard.moneyModifier !== 0) flavorText = ["Drop to add ¢ " + drag.hoveredCard.moneyModifier + "!"];
            else flavorText = ["This card is worth ¢ 0"];
          } else if (canPay) {
            flavorText = ["You gathered enough!"];
            selfEmotion = "Happy";
          } else {
            const deck = networkData.selfGame.deck;
            const discardPile = networkData.game.playerStates[networkData.selfPlayer.username].discardPile;
            flavorText = ["Drag a card up to", "increase your balance.", `${deck.length} cards in deck`, `${discardPile.length} in discard pile`];
            selfEmotion = "Mixed";
          }
          break;
        case "MarketFadeIn":
          phaseTitle = "Market";
          flavorText = ["Time to go shopping!"];
          break;
        case "Market":
          phaseTitle = "Market";

          if (drag.target === "topPile" && drag.willActivate) {
            if (drag.hoveredCard.cost <= networkData.selfGame.balanceMoney) flavorText = [`Drop to buy for ¢ ${drag.hoveredCard.cost}!`];
            else flavorText = [`Need ¢ ${drag.hoveredCard.cost} in balance to buy!`];
          }
          else if (drag.target === "hand" && drag.willActivate) {
            if (drag.hoveredCard.moneyModifier !== 0) flavorText = ["Drop to add ¢ " + drag.hoveredCard.moneyModifier + "!"];
            else flavorText = ["Drop to use!"];
          } else {
            const deck = networkData.selfGame.deck;
            const discardPile = networkData.game.playerStates[networkData.selfPlayer.username].discardPile;
            flavorText = ["Buy cards at the top", "using cards from your hand", "", `${deck.length} cards in deck`, `${discardPile.length} in discard pile`];
          }
          break;
        case "FadeOut": flavorText = ["The week is over!"]; break;
      }
    } else {
      phaseTitle = "Game Over";
      flavorText = ["You lost :("];
      selfEmotion = "Sad";
    }

    if (drag.hoveredCard == null || drag.willActivate) {
      ctx.font = "bold 72px Montserrat";
      ctx.fillText(phaseTitle.toUpperCase(), scaledWidth / 2, refHeight / 2 - pileAreaHeight / 2 - 270);

      ctx.font = "64px Montserrat";
      for (let i = 0; i < flavorText.length; i++) {
        const text = flavorText[i];
        ctx.fillText(text, scaledWidth / 2, refHeight / 2 - pileAreaHeight / 2 - 150 + i * 90);
      }
    }

    if (phase.name !== "FadeOut") handlePile(hand, handAreaTop, drag.target === "hand", -dragConfirmOffset);

    if (drag.hoveredCard != null) {
      // Hovered card
      if (!drag.willActivate) {
        const drawCost = drag.target == "topPile" && networkData.game.phase.name == "Market";
        drawBigCard(drag.hoveredCard, centerX - bigCardWidth / 2, centerY - bigCardHeight / 2, drawCost);
      }
    } else {
      // Confirm area
      const defaultColor = "#004279";
      const cantPayColor = "#bc2e57";
      const canPayColor = "#006e43";
      const confirmColor = "#596c8e";
      const deadColor = "#e82e3e";

      ctx.fillStyle = !isAlive ? deadColor : (isPending ? (willConfirm ? confirmColor : (canPay ? canPayColor : cantPayColor)) : defaultColor);
      ctx.fillRect(0, confirmAreaTop, scaledWidth, confirmAreaHeight);

      // Draw character
      const emotionSprite = emotionSpritesByCharacter[networkData.selfPlayer.characterIndex][selfEmotion];
      drawSprite(ctx, emotionSprite, scaledWidth - emotionSprite.width, confirmAreaTop);

      // Draw phase icon
      const phaseIcons = images[`/Assets/PhaseIcons.png`];
      if (phase.name === "PayRent" || phase.name === "Market") {
        const offset = phase.name === "PayRent" ? 0 : 2;
        drawFrame(ctx, phaseIcons, offset + (isPending || !isAlive ? 0 : 1), 64, confirmAreaTop + 64);
      }

      ctx.font = "50px Open Sans";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      let confirmText = null;

      switch (phase.name) {
        case "PayRent":
          confirmText = !isAlive ? `Rent — ¢ ${phase.amountDue}` : (isPending ? `TAP to pay rent — ¢ ${phase.amountDue}` : `Waiting for others... — ¢ ${phase.amountDue}`);
          break;
        case "Market":
          confirmText = isPending ? "TAP when you're done" : "Waiting for turn to end";
          break;
      }

      if (confirmText != null) {
        ctx.fillText(confirmText, scaledWidth / 2, confirmAreaTop + confirmAreaHeight * 0.35);
      }

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      let balanceText = !isAlive ? "Can't afford it." : ((isPending) ? `Current balance: ¢ ${networkData.selfGame.balanceMoney}` : "");
      ctx.fillText(balanceText, scaledWidth / 2, confirmAreaTop + confirmAreaHeight * 0.7);
    }
  }

  touch(canvas, (touch) => {
    if (touch.ended) {
      if (drag.target == null) return;

      switch (drag.target) {
        case "topPile":
          if (drag.willActivate && drag.hoveredCard != null) {
            if (networkData.game.phase.name == "PayRent") {
              send({ type: "recoverCard", cardId: drag.hoveredCard.id });
            } else if (networkData.game.phase.name == "Market") {
              send({ type: "buyCard", cardId: drag.hoveredCard.id });
            }
          }
          break;
        case "hand":
          if (drag.willActivate && drag.hoveredCard != null) {
            send({ type: "useCard", cardId: drag.hoveredCard.id });
          }
          break;
        case "confirm":
          if (drag.willActivate) {
            send({ type: "confirm" });
          }
          break;
      }

      drag = { target: null };
      return;
    }

    const x = touch.x / scale;
    const y = touch.y / scale;

    if (touch.started) {
      if (y <= pileAreaHeight) drag = { target: "topPile", willActivate: false };
      else if (y >= handAreaTop) drag = { target: "hand", willActivate: false };
      else if (y >= confirmAreaTop) drag = { target: "confirm", willActivate: true };
    }

    if (drag == null) return;
    drag.x = x;
    drag.y = y;

    const threshold = 50;

    if (drag.target === "topPile") drag.willActivate = y > pileAreaHeight + threshold;
    else if (drag.target === "hand") drag.willActivate = y < handAreaTop - threshold;
    else if (drag.target === "confirm") drag.willActivate = y > confirmAreaTop && y < handAreaTop;
  });
}
