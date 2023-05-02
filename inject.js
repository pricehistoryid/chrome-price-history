const elFactory = (type, attributes, ...children) => {
  const el = document.createElement(type)

  for (key in attributes) {
    el.setAttribute(key, attributes[key])
  }

  children.forEach(child => {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child))
    } else {
      el.appendChild(child)
    }
  })

  return el
}

var modalContainer = elFactory(
  'div',
  {'class': 'modal-container'},
  elFactory(
    'span',
    {'class': 'close'},
    '×'
  ),
  elFactory(
    'div',
    {'class': 'modal-header'},
    'Price History Scrapper'
  ),
  elFactory(
    'div',
    {'class': 'modal-body'},
    ''
  )
)

var modal = elFactory(
  'div',
  {'class': 'modal'},
  modalContainer
)

var base = elFactory(
  "div",
  {"class": "ph-item ph-title"},
  'PRICES'
)

var ph = elFactory(
  'a',
  {
    'href': '#',
    'class': 'ph-ext'
  },
  base,
  modal
)
document.body.appendChild(ph);
const addCustomStyle = css => ph.appendChild(document.createElement("style")).innerHTML = css;

addCustomStyle(`
.ph-ext {
  position: fixed;
  width: 60px;
  height: 60px;
  bottom: 40px;
  right: 40px;
  background-color: #00AA5B;
  border-radius: 50px;
  box-shadow: 2px 2px 3px #999;
}

.ph-item {
  margin-top:22px;
}

.ph-title {
  color: #ffffff;
  text-align: center;
  font-weight: 800;
  font-family: 'Open Sauce One', sans-serif;
}

/* The Modal (background) */
.modal {
  display: none; /* Hidden by default */
  position: fixed; /* Stay in place */
  z-index: 1; /* Sit on top */
  padding: 30vh 0px; /* Location of the box */
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto; /* Enable scroll if needed */
  background-color: rgb(0,0,0); /* Fallback color */
  background-color: rgba(0,0,0,0.4); /* Black w/ opacity */
}

/* Modal Container */
.modal-container {
  background-color: #fefefe;
  color: #000000;
  margin: auto;
  padding: 20px;
  width: 50%;
  max-height: 40vh;
  overflow: auto;
  cursor: default;
}

.modal-header {
  padding: 12px 0px;
}

.modal-body {
  padding-top: 10px;
}

.close {
  color: #aaaaaa;
  float: right;
  font-size: 32px;
  font-weight: bold;
}

.close:hover,
.close:focus {
  color: #000;
  text-decoration: none;
  cursor: pointer;
}
`);