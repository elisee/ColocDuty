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

    drawBackground();
    drawState();
    drawPlayers();

    ctx.restore();
  };

  function drawBackground()
  {
    const bg = images[`/Assets/Viewer/Background.jpg`];
    ctx.drawImage(bg, (scaledWidth - bg.width) / 2, 0);

    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, scaledWidth, refHeight);
    ctx.globalAlpha = 1.0;
  }

  function drawState() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (networkData.game == null) {
      ctx.fillStyle = "#e7ad64";
      ctx.font = "lighter 40px Open Sans";
      ctx.fillText(`YOUR ROOM CODE IS`, scaledWidth / 2, refHeight / 2 - 40);

      ctx.fillStyle = "#fff";
      ctx.font = "900 96px Montserrat";
      ctx.fillText(setup.roomCode, scaledWidth / 2, refHeight / 2 + 40);
      return;
    }

    const { phase } = networkData.game;

    switch (phase.name) {
      case "PayRent":
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";

        ctx.fillStyle = "#e7ad64";
        ctx.font = "lighter 40px Open Sans";
        ctx.fillText(`TIME TO PAY THE RENT!`, scaledWidth / 2, refHeight / 2 - 40);

        ctx.fillStyle = "#fff";
        ctx.font = "900 96px Montserrat";
        ctx.fillText(phase.amountDue + " ¢looqs", scaledWidth / 2, refHeight / 2 + 40);
        break;
    }

    const homeIcon = images["/Assets/Viewer/HomeIcon.png"];
    drawImageHalf(ctx, homeIcon, scaledWidth / 2 - homeIcon.width / 4, refHeight - homeIcon.height / 2);

    const moodBarEmpty = images["/Assets/Viewer/MoodBarEmpty.png"];
    const moodBarFull = images["/Assets/Viewer/MoodBarFull.png"];
    drawImageHalf(ctx, moodBarEmpty, 0, refHeight - moodBarEmpty.height / 2);

    const moodValue = networkData.game.mood / networkData.game.maxMood;
    ctx.drawImage(moodBarFull,
      moodBarFull.width * (1 - moodValue), 0,
      moodBarFull.width * moodValue, moodBarFull.height,
      0, refHeight - moodBarFull.height / 2, moodBarFull.width / 2 * moodValue, moodBarFull.height / 2);

    const hygieneBarEmpty = images["/Assets/Viewer/HygieneBarEmpty.png"];
    const hygieneBarFull = images["/Assets/Viewer/HygieneBarFull.png"];
    drawImageHalf(ctx, hygieneBarEmpty, scaledWidth - hygieneBarEmpty.width / 2, refHeight - hygieneBarEmpty.height / 2);

    const hygieneValue = networkData.game.hygiene / networkData.game.maxHygiene;
    ctx.drawImage(hygieneBarFull,
      0, 0,
      hygieneBarFull.width * hygieneValue, hygieneBarFull.height,
      scaledWidth - hygieneBarEmpty.width / 2 * hygieneValue, refHeight - hygieneBarFull.height / 2,
      hygieneBarFull.width / 2 * hygieneValue, hygieneBarFull.height / 2);

      ctx.textBaseline = "bottom";
      ctx.fillStyle = "#111";
      ctx.font = "900 40px Montserrat";
      ctx.textAlign = "left";
      ctx.fillText("Mood", 20, refHeight - 10);
      ctx.textAlign = "right";
      ctx.fillText("Hygiene", scaledWidth - 20, refHeight - 10);
  }

  function drawPlayers() {
    const horizontalMargin = 40;
    const topMargin = 60;
    const entryHeight = characterSize + horizontalMargin;
    const entryWidth = characterSize;

    const cartridgeSize = characterSize * 0.9;
    const cartridgeOffset = (characterSize - cartridgeSize) / 2;

    const frameImage = images[`/Assets/Viewer/CharacterFrame.png`];
    const phaseIcons = images[`/Assets/Viewer/PhaseIcons.png`];
    const cardIcons = images[`/Assets/Viewer/CardIcons.png`];

    for (let i = 0; i < networkData.players.length; i++) {
      const player = networkData.players[i];

      const flipped = i % 2 != 0;
      const flipMultiplier = flipped ? -1 : 1;
      const playerX = !flipped ? horizontalMargin : (scaledWidth - entryWidth - horizontalMargin);
      const playerY = topMargin + Math.floor(i / 2) * entryHeight;

      // Draw enveloppe
      if (networkData.game != null) {
        const { phase } = networkData.game;

        if (phase.name === "PayRent" || phase.name === "Market") {
          const isDone = networkData.game.pendingUsernames.indexOf(player.username) === -1;
          ctx.save();
          ctx.translate(playerX + cartridgeOffset + (flipped ? -phaseIcons.height : cartridgeSize), playerY + 120);

          const offset = phase.name === "PayRent" ? 0 : 2;
          drawFrame(ctx, phaseIcons, offset + (isDone ? 1 : 0), 0, 0);
          ctx.restore();
        }
      }

      // Draw cartridge
      ctx.drawImage(frameImage, 0, 0, frameImage.width, frameImage.height, playerX + cartridgeOffset, playerY + cartridgeOffset, cartridgeSize, cartridgeSize);

      drawSprite(ctx, characterSprites[player.characterIndex], playerX, playerY, characterSize, characterSize);

      ctx.font = "bold 36px Montserrat";
      ctx.fillStyle = playerColors[i];
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(player.username, playerX + 0.5 * characterSize, playerY - 15);

      if (networkData.game != null) {
        // Draw player's card count
        const { handCardCount } = networkData.game.playerStates[player.username];
        if (handCardCount > 0) drawFrame(ctx, cardIcons, Math.min(handCardCount - 1, 8), playerX + 192, playerY - 8, 128);
      }
    }
  }
}

