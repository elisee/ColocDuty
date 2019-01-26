window.lerp = (a, b, v) => {
  return a + (b - a) * v;
}

window.clamp = (v, min, max) => {
  return Math.max(min, Math.min(v, max));
}

window.makeSprite = (image, width, height, frameCount, fps) => {
  return { image, width, height, framesPerRow: image.width / width, frameCount, frameDuration: 1000 / fps, time: 0 };
}

window.tickSprites = (sprites, ms) => {
  for (const sprite of sprites) sprite.time = (sprite.time + ms) % (sprite.frameCount * sprite.frameDuration);
}

window.drawSprite = (ctx, sprite, x, y, destWidth, destHeight) => {
  const index = Math.floor(sprite.time / sprite.frameDuration);
  const column = index % sprite.framesPerRow;
  const row = Math.floor(index / sprite.framesPerRow);

  if (destWidth == null) destWidth = sprite.width;
  if (destHeight == null) destHeight = sprite.height;

  ctx.drawImage(sprite.image, column * sprite.width, row * sprite.height, sprite.width, sprite.height, x, y, destWidth, destHeight);
}