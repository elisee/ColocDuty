const images = {};

const charSize = 256;
const characterCount = 7;
const characterSprites = [];

const imageUrls = [];

imageUrls.push(`/Assets/Background.jpg`);
imageUrls.push(`/Assets/Cards/Back.jpg`);

for (let i = 0; i < characterCount; i++) {
  imageUrls.push(`/Assets/Characters/${i}-Idle.png`);
}

function loadImages(callback) {
  let imageQueue = imageUrls.length;

  for (const url of imageUrls) {
    const image = new Image();
    image.src = url;
    image.addEventListener("load", () => {
      images[url] = image;
      imageQueue--;
      if (imageQueue === 0) callback();
    });
  }
}

function setupCharacterSprites() {
  for (let i = 0; i < characterCount; i++) {
    const image = images[`/Assets/Characters/${i}-Idle.png`];
    characterSprites.push(makeSprite(image, charSize, charSize, 12, 12));
  }
}