function tokopediaCleanPrice(value) {
  return value.replaceAll(".", "").replace(/[^0-9.-]+/g, "");
}

function tokopediaCleanImageUrl(imageUrl) {
  return imageUrl.replace("url(", "").replace(")", "").replaceAll(`"`, "").replace("100-square", "700");
}

function tokopediaCleanSold(sold) {
  return sold.replace("+", "").replace("rb", "000").replaceAll(" ", "")
}

function scrapeTokopedia(url) {
  var nameEl = document.querySelector("#pdp_comp-product_content");
  if (nameEl) {
    var name = nameEl.firstElementChild.firstElementChild.textContent;

    var value = document.querySelector(".price").textContent;
    value = tokopediaCleanPrice(value);

    var imageUrl = document.querySelector("#pdp_comp-product_media > div > div.css-fpocxp > button > div > div.magnifier").style["background-image"];
    imageUrl = tokopediaCleanImageUrl(imageUrl);

    try {
      var rating = document.querySelector("#pdp_comp-product_content > div > div.css-bczdt6 > div > p:nth-child(3) > span:nth-child(1) > span.main").textContent;
    } catch (error) {
      var rating = null;
    }

    try {
      var sold = document.querySelector("#pdp_comp-product_content > div > div.css-bczdt6 > div > div > div > p").childNodes[2].textContent;
      sold = tokopediaCleanSold(sold);
    } catch (error) {
      var sold = null;
    }

    // console.log(url, name, value, imageUrl, rating, sold);

    return { url, name, value, imageUrl, rating, sold };
  }

  return null;
}
