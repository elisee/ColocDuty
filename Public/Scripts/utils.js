window.engine = {};

const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

function $make(tagName, parent, props) {
  const elt = document.createElement(tagName);
  if (parent != null) parent.appendChild(elt);
  for (const key in props) elt[key] = props[key];
  return elt;
}

function show(elt) { elt.hidden = false }
function hide(elt) { elt.hidden = true }
function setVisible(elt, visible) { elt.hidden = !visible }

function removeFromList(list, item) {
  list.splice(list.indexOf(item), 1);
}

// Text
function writeWrappedText(context, text, x, y, maxWidth, lineHeight) {
  var words = text.split(' ');
  var line = '';

  for(var n = 0; n < words.length; n++) {
    var testLine = line + words[n] + ' ';
    var metrics = context.measureText(testLine);
    var testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    }
    else {
      line = testLine;
    }
  }
  context.fillText(line, x, y);
}

// Touch
function touch(elt, callback) {
  let touchId = null;
  let isMouseDown = false;

  elt.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    isMouseDown = true;

    callback({ started: true, x: event.clientX, y: event.clientY });
  });

  document.body.addEventListener("mouseup", (event) => {
    if (event.button !== 0 || !isMouseDown) return;

    isMouseDown = false;
    callback({ ended: true, x: event.clientX, y: event.clientY });
  });

  elt.addEventListener("mousemove", (event) => {
    if (event.button !== 0 || !isMouseDown) return;

    callback({ x: event.clientX, y: event.clientY });
  });

  elt.addEventListener("touchstart", (event) => {
    if (touchId != null) return;
    touchId = event.changedTouches[0].identifier;

    callback({ started: true, x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY });
  });

  elt.addEventListener("touchmove", (event) => {
    for (const changedTouch of event.changedTouches) {
      if (changedTouch.identifier === touchId) {
        callback({ x: changedTouch.clientX, y: changedTouch.clientY });
        return;
      }
    }
  });

  elt.addEventListener("touchend", (event) => {
    for (const changedTouch of event.changedTouches) {
      if (changedTouch.identifier == touchId) {
        callback({ ended: true, x: changedTouch.clientX, y: changedTouch.clientY });
        touchId = null;
        return;
      }
    }
  });
}
