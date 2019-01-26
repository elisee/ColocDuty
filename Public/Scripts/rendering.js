function lerp(a, b, v) {
  return a + (b - a) * v;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(v, max));
}

function makeSprite(image, width, height, frameCount, fps) {
  return { image, width, height, framesPerRow: image.width / width, frameCount, frameDuration: 1000 / fps, time: 0 };
}

function tickSprites(sprites, ms) {
  for (const sprite of sprites) sprite.time = (sprite.time + ms) % (sprite.frameCount * sprite.frameDuration);
}

function drawSprite(ctx, sprite, x, y, destWidth, destHeight) {
  const index = Math.floor(sprite.time / sprite.frameDuration);
  const column = index % sprite.framesPerRow;
  const row = Math.floor(index / sprite.framesPerRow);

  if (destWidth == null) destWidth = sprite.width;
  if (destHeight == null) destHeight = sprite.height;

  ctx.drawImage(sprite.image, column * sprite.width, row * sprite.height, sprite.width, sprite.height, x, y, destWidth, destHeight);
}

function drawFrame(ctx, image, index, x, y, destSize) {
  if (destSize == null) destSize = image.height;
  ctx.drawImage(image, index * image.height, 0, image.height, image.height, x, y, destSize, destSize);
}

function drawImageHalf(ctx, image, x, y) {
  ctx.drawImage(image, 0, 0, image.width, image.height, x, y, image.width / 2, image.height / 2);
}