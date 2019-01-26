{
  window.engine.applyViewerState = () => {
    setVisible($(".viewer .debug"), gameData.state.name == "waiting");
  };

  const targetWidth = 1920;
  const targetHeight = 1080;

  const canvas = $(".viewer canvas");
  const ctx = canvas.getContext("2d");

  window.engine.animateViewer = (ms) => {
    tickSprites(characterSprites, ms);

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    ctx.save();

    const backgroundImage = images[`/Assets/Background.jpg`];
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

    drawStateInformations();
    drawPlayers();

    ctx.restore();
  };

  function drawStateInformations() {
    if (gameData.state.name == "waiting") {
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";

      ctx.font = "40px Montserrat";
      ctx.fillText(`Join the game with the code:`, canvas.width / 2, canvas.height / 2);

      ctx.font = "50px Montserrat";
      ctx.fillText(setup.roomCode, canvas.width / 2, canvas.height / 2 + 60);
    } else {
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";

      ctx.font = "40px Montserrat";
      ctx.fillText(gameData.state.phase, canvas.width / 2, canvas.height / 2);
    }
  }

  function drawPlayers() {
    const screenCharSize = charSize * 0.8;
    const screenCharPadding = screenCharSize + 30;

    for (let i = 0; i < gameData.players.length; i++) {
      const player = gameData.players[i];
      drawSprite(ctx, characterSprites[player.characterIndex], 0, i * screenCharPadding, screenCharSize, screenCharSize);

      ctx.font = "30px Montserrat";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(player.username, 0.5 * screenCharSize, i * screenCharPadding + 35);

      // Draw player's hidden hand
      if (gameData.state.name !== "waiting") {
        const cardBackImage = images[`/Assets/Cards/Back.jpg`];
        const cardBackScale = 40;

        const { handCardCount } = gameData.state.playerStates[player.username];
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

