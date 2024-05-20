function main(event) {
  // get url
  const urlPieces = [location.host, location.pathname];
  let url = urlPieces.join('');

  // continously scrape page every 1000ms until data gathered
  const timer = setInterval(afterLoad, 1000);

  async function afterLoad() {
    // const userInfo = await getProfileUserInfo().then( result => result );

    // tokopedia
    if (url.includes('tokopedia')) {
      const result = scrapeTokopedia(url);
      if (result) {
        clearInterval(timer);
        savePriceHistory(result);
      }
    }

    // shopee
    if (url.includes('shopee')) {
      const result = scrapeShopee(url);
      if (result) {
        clearInterval(timer);
        savePriceHistory(result);
      }
    }
  }

  // check favorites
  checkFavorite(url);

  // event listener for favorite checkbox
  var checkbox = document.querySelector("input[name=favorite-checkbox]");
  eventListenerFavorite(checkbox, url);
}
