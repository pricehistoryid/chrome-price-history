// what to scrape:
// url
// name
// shop_id
// category
// condition
// image_url
// price
// sold
// rating

function scrapeTokopedia(url) {
  var nameEl = document.querySelector('#pdp_comp-product_content');
  if (nameEl) {
    var name = nameEl.firstElementChild.firstElementChild.textContent;
    var value = document.querySelector('.price').textContent;
    value = value.replaceAll('.','').replace(/[^0-9.-]+/g,"");
    // console.log(url, name, value);

    return { url, name, value };
  }
  
  return null;
}

function scrapeShopee(url) {
  var nameEl = document.querySelector('.WBVL_7');
  var priceEl = document.querySelector('.G27FPf');
  if ((nameEl && priceEl) && priceEl.textContent) {
    var name = nameEl.querySelector('span').textContent;
    var value = priceEl.textContent;
    value = value.replaceAll('.','').replace(/[^0-9.-]+/g,"");
    // console.log(url, name, value);

    return { url, name, value };
  }
  
  return null;
}