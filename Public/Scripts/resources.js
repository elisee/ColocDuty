const backgroundColor = "#00223e";

const images = {};

const characterSize = 256;
const characterCount = 6;
const allCharacterSprites = [];
const emotionSpritesByCharacter = [];
const emotions = [ "Idle", "Happy", "Sad", "Bad", "Mixed" ];

const cardTypeSettings = {
  "Event": { color: "#ffc15f" },
  "Hygiene": { color: "#44dab0" },
  "Interaction": { color: "#c373e5" },
  "Job": { color: "#0e9eda" },
  "Malus": { color: "#f21259" },
  "Mood": { color: "#ffd45e" },
};

function loadImages(imageUrls, callback) {
  const total = imageUrls.length;
  let imageQueue = imageUrls.length;

  for (const url of imageUrls) {
    const image = new Image();
    image.src = url;
    image.addEventListener("load", () => {
      images[url] = image;
      imageQueue--;

      $(".loading .progress").textContent = `${total - imageQueue} / ${total}`;

      if (imageQueue === 0) {
        $(".loading .progress").textContent = "";
        callback();
      }
    });

    image.addEventListener("error", (event) => {
      imageQueue--;

      $(".loading .progress").textContent = `${total - imageQueue} / ${total}`;

      if (imageQueue === 0) {
        $(".loading .progress").textContent = "";
        callback();
      }
    })
  }
}

function setupCharacterSprites() {
  for (let i = 0; i < characterCount; i++) {
    const emotionSprites = emotionSpritesByCharacter[i] = {};
    for (const emotion of emotions) {
      const sprite = makeSprite(images[`/Assets/Characters/${i}-${emotion}.png`], characterSize, characterSize, 12, 12);
      allCharacterSprites.push(sprite);
      emotionSprites[emotion] = sprite;
    }
  }
}
