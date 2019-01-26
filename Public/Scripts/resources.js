const backgroundColor = "#00223e";

const images = {};

const characterSize = 256;
const characterCount = 4;
const characterSprites = [];

const imageUrls = [];

const cardTypeSettings = {
  "Event": { color: "#ffc15f" },
  "Hygiene": { color: "#44dab0" },
  "Interaction": { color: "#c373e5" },
  "Job": { color: "#0e9eda" },
  "Malus": { color: "#f21259" },
  "Mood": { color: "#ffd45e" },
};

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
    characterSprites.push(makeSprite(image, characterSize, characterSize, 12, 12));
  }
}