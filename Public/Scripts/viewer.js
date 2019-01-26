{
  const playerColors = ["#0ca0e6", "#9662e0", "#f32972", "#92e8f9", "#f5922a", "#69ce4a"];

  window.engine.applyViewerState = () => {
    setVisible($(".viewer .debug"), networkData.game == null);
  };

  let scale;
  const refHeight = 1080;
  let scaledWidth;

  const canvas = $(".viewer canvas");
  const ctx = canvas.getContext("2d");

  window.engine.animateViewer = (ms) => {
    tickSprites(characterSprites, ms);

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    scale = canvas.height / refHeight;
    scaledWidth = canvas.width / scale;

    ctx.save();
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.scale(scale, scale);

    const bg = images[`/Assets/Background.jpg`];
    ctx.drawImage(bg, (scaledWidth - bg.width) / 2, 0);

    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, scaledWidth, refHeight);
    ctx.globalAlpha = 1.0;

    drawState();
    drawPlayers();

    ctx.restore();
  };

  function drawState() {
    if (networkData.game == null) {
      // ctx.fillStyle = "#444";
      // ctx.fillRect(scaledWidth / 2 - 400, refHeight / 2 - 100, 800, 200);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillStyle = "#e7ad64";
      ctx.font = "lighter 40px Open Sans";
      ctx.fillText(`YOUR ROOM CODE IS`, scaledWidth / 2, refHeight / 2 - 40);

      ctx.fillStyle = "#fff";
      ctx.font = "900 96px Montserrat";
      ctx.fillText(setup.roomCode, scaledWidth / 2, refHeight / 2 + 40);
    } else {
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";

      ctx.font = "40px Montserrat";
      ctx.fillText(networkData.game.phase.name, scaledWidth / 2, refHeight / 2);
    }
  }

  function drawPlayers() {
    const horizontalMargin = 40;
    const topMargin = 60;
    const entryHeight = characterSize + horizontalMargin;
    const entryWidth = characterSize;

    const cartridgeSize = characterSize * 0.9;
    const cartridgeOffset = (characterSize - cartridgeSize) / 2;

    const frameImage = images[`/Assets/CharacterFrame.png`];
    const billIcon = images[`/Assets/BillIcon.png`];

    for (let i = 0; i < networkData.players.length; i++) {
      const player = networkData.players[i];

      const flipped = i % 2 != 0;
      const flipMultiplier = flipped ? -1 : 1;
      const playerX = !flipped ? horizontalMargin : (scaledWidth - entryWidth - horizontalMargin);
      const playerY = topMargin + Math.floor(i / 2) * entryHeight;

      // Draw enveloppe
      if (networkData.game != null) {
        const { phase } = networkData.game;

        if (phase.name === "PayRent") {
          const hasPaid = phase.rentPendingPlayers.indexOf(player.username) === -1;
          ctx.save();
          ctx.translate(playerX + cartridgeOffset + (flipped ? 0 : cartridgeSize), playerY + topMargin);
          ctx.scale(flipped ? -1 : 1, 1);
          drawFrame(ctx, billIcon, hasPaid ? 1 : 0, 0, 0);
          ctx.restore();
        }
      }

      // Draw cartridge
      ctx.drawImage(frameImage, 0, 0, frameImage.width, frameImage.height, playerX + cartridgeOffset, playerY + cartridgeOffset, cartridgeSize, cartridgeSize);

      drawSprite(ctx, characterSprites[player.characterIndex], playerX, playerY, characterSize, characterSize);

      ctx.font = "bold 36px Montserrat";
      ctx.fillStyle = playerColors[i];
      ctx.textAlign = "center";
      ctx.fillText(player.username, playerX + 0.5 * characterSize, playerY - 15);

      if (networkData.game != null) {
        // Draw player's hidden hand
        const cardBackImage = images[`/Assets/Cards/Back.jpg`];
        const cardBackScale = 40;

        const { handCardCount } = networkData.game.playerStates[player.username];
        for (let j = 0; j < handCardCount; j++) {
          const x = characterSize / 2 + (j - handCardCount / 2) * cardBackImage.width / cardBackScale;
          const y = playerY + characterSize * 0.8;

          ctx.drawImage(
            cardBackImage, 0, 0, cardBackImage.width, cardBackImage.height,
            x, y, cardBackImage.width / cardBackScale, cardBackImage.height / cardBackScale);
        }
      }
    }
  }
}

