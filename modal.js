function printProduct(result) {
  var modalBody = document.querySelector(".modal-body");
  var title = elFactory(
    'div',
    {},
    result.title
  )
  modalBody.appendChild(title);

  var price = elFactory(
    'div',
    {},
    result.price
  )
  modalBody.appendChild(price);
}

function main(event) {
  var timer = setInterval(checkForFinish, 500);

  function checkForFinish() {
    var url = window.location.href;

    // tokopedia
    if (url.includes('tokopedia')) {
      if (scrapeTokopedia()) {
        clearInterval(timer);
        result = scrapeTokopedia()
        
        printProduct(result);
      }
    }

    // shopee
    if (url.includes('shopee')) {
      if (scrapeShopee()) {
        clearInterval(timer);
        result = scrapeShopee()
        
        printProduct(result);
      }
    }
  }
}

var modal = document.querySelector(".modal");
var modalBtn = document.querySelector(".ph-ext");
var closeBtn = document.getElementsByClassName("close")[0];

modalBtn.onclick = function () {
  modal.style.display = "block";
}

window.onclick = function (event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
  if (event.target == closeBtn) {
    modal.style.display = "none";
  }
}

window.addEventListener("load", main, false);
