{
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
    ctx.fillStyle = "#00223e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.scale(scale, scale);

    const bg = images[`/Assets/Background.jpg`];
    ctx.drawImage(bg, (scaledWidth - bg.width) / 2, 0);

    drawState();
    drawPlayers();

    ctx.restore();
  };

  function drawState() {
    if (networkData.game == null) {
      ctx.fillStyle = "#444";
      ctx.fillRect(scaledWidth / 2 - 400, refHeight / 2 - 100, 800, 200);

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.font = "40px Montserrat";
      ctx.fillText(`Join the game with the code:`, scaledWidth / 2, refHeight / 2 - 40);

      ctx.font = "50px Montserrat";
      ctx.fillText(setup.roomCode, scaledWidth / 2, refHeight / 2 + 40);
    } else {
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";

      ctx.font = "40px Montserrat";
      ctx.fillText(networkData.game.phase, scaledWidth / 2, refHeight / 2);
    }
  }

  function drawPlayers() {
    const screenCharSize = charSize * 0.8;
    const screenCharPadding = screenCharSize + 30;

    for (let i = 0; i < networkData.players.length; i++) {
      const player = networkData.players[i];
      drawSprite(ctx, characterSprites[player.characterIndex], 0, i * screenCharPadding, screenCharSize, screenCharSize);

      ctx.font = "30px Montserrat";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(player.username, 0.5 * screenCharSize, i * screenCharPadding + 35);

      // Draw player's hidden hand
      if (networkData.game != null) {
        const cardBackImage = images[`/Assets/Cards/Back.jpg`];
        const cardBackScale = 40;

        const { handCardCount } = networkData.game.playerStates[player.username];
        for (let j = 0; j < handCardCount; j++) {
          const x = screenCharSize / 2 + (j - handCardCount / 2) * cardBackImage.width / cardBackScale;
          const y = i * screenCharPadding + screenCharSize * 0.8;

          ctx.drawImage(
            cardBackImage, 0, 0, cardBackImage.width, cardBackImage.height,
            x, y, cardBackImage.width / cardBackScale, cardBackImage.height / cardBackScale);
          }
        }
    }
  }
}

