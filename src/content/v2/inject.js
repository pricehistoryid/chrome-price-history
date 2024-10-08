function addCustomStyle(css) {
  return parentPH.appendChild(document.createElement('style')).innerHTML = css;
}

function elFactory(type, attributes, ...children) {
  const el = document.createElement(type);

  for (key in attributes) {
    el.setAttribute(key, attributes[key]);
  }

  children.forEach(child => {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else {
      el.appendChild(child);
    }
  });

  return el;
}

var parentPH = elFactory(
  'button',
  {
    'class': 'ph-ext'
  }
)
document.body.appendChild(parentPH);

var modalContainer = elFactory(
  'div',
  { 'class': 'modal-container' },
  elFactory(
    'div',
    { 'class': 'modal-body' },
    elFactory(
      'div',
      {
        'class': 'chart',
        'id': 'chart-container'
      },
      ''
    )
  )
)

var modal = elFactory(
  'div',
  { 'class': 'modal' },
  modalContainer
)
document.body.appendChild(modal);

addCustomStyle(`
.ph-checkbox {
  margin: 0.4rem;
}

.ph-ext {
  position: fixed;
  width: 60px;
  height: 60px;
  bottom: 40px;
  right: 40px;
  background-size: contain;
  background-image: url('https://raw.githubusercontent.com/wikankun/chrome-price-history/master/assets/price-history.png');
  border-radius: 50px;
  box-shadow: 2px 2px 3px #999;
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
  width: 640px;
  min-width: 640px;
  height: 340px;
  min-height: 340px;
  overflow: auto;
  cursor: default;
  box-sizing: border-box;
}

.modal-header {
  padding: 12px 0px;
}

.modal-body {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;  
  justify-content: space-between;
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

// background-color: #00AA5B;