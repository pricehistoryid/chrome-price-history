function scrapeTokopedia() {
  var url = window.location.href.split('?')[0];
  var titleEl = document.querySelector('#pdp_comp-product_content');
  if (titleEl) {
    var title = titleEl.firstElementChild.firstElementChild.textContent;
    var price = document.querySelector('.price').textContent;
    console.log(url, title, price);

    return { url, title, price };
  }
  
  return null;
}

function scrapeShopee() {
  var url = window.location.href.split('?')[0];
  var titleEl = document.querySelector('._44qnta');
  var priceEl = document.querySelector('.pqTWkA');
  if (titleEl && priceEl) {
    var title = titleEl.querySelector('span').textContent;
    var price = priceEl.textContent;
    console.log(url, title, price);

    return { url, title, price };
  }
  
  return null;
}