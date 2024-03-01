function scrapeTokopedia(url) {
  var titleEl = document.querySelector('#pdp_comp-product_content');
  if (titleEl) {
    var title = titleEl.firstElementChild.firstElementChild.textContent;
    var value = document.querySelector('.price').textContent;
    value = value.replaceAll('.','').replace(/[^0-9.-]+/g,"");
    // console.log(url, title, value);

    return { url, title, value };
  }
  
  return null;
}

function scrapeShopee(url) {
  var titleEl = document.querySelector('.WBVL_7');
  var priceEl = document.querySelector('.G27FPf');
  if ((titleEl && priceEl) && priceEl.textContent) {
    var title = titleEl.querySelector('span').textContent;
    var value = priceEl.textContent;
    value = value.replaceAll('.','').replace(/[^0-9.-]+/g,"");
    // console.log(url, title, value);

    return { url, title, value };
  }
  
  return null;
}