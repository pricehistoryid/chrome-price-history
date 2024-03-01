function mergeSyncLocal(sync, local) {
  var merged = {};

  // lowestPrice
  merged.lowestPrice = sync.lowestPrice.value < local.lowestPrice.value ? sync.lowestPrice : local.lowestPrice;

  // prevPrice
  let mergedArray = sync.prevPrice.concat(local.prevPrice);

  // Remove duplicates based on time
  let uniqueArray = mergedArray.reduce((acc, current) => {
    const x = acc.find(item => item.time === current.time);
    if (!x) {
      return acc.concat([current]);
    } else {
      // If duplicate found, keep the one with the lowest value
      if (current.value < x.value) {
        return acc.map(item => (item.time === current.time ? current : item));
      } else {
        return acc;
      }
    }
  }, []);

  merged.prevPrice = uniqueArray.sort((a, b) => (a.time < b.time ? 1 : -1));
  return merged;
}

function injectFavorite(favorites) {
  Object.keys(favorites).forEach(function (key) {
    const item = elFactory(
      'div',
      { 'class': 'favorite-item' },
      elFactory(
        'a',
        { 'href': key },
        key.split('/').pop()
      )
    );
    document.getElementById('favorite-list').appendChild(item);
  });
}

function checkFavorite(url) {
  chrome.storage.sync.get('price_history_favorites').then((syncres) => {
    chrome.storage.local.get(["price_history"]).then((localres) => {
      var favorites = syncres.price_history_favorites;
      var locals = localres.price_history;
      if (!favorites) {
        favorites = {};
      } else if (favorites.hasOwnProperty(url)) {
        document.getElementById('favorite-checkbox').checked = true;
        if (locals.hasOwnProperty(url)) {
          var sync = favorites[url];
          var local = locals[url];
          favorites[url] = mergeSyncLocal(sync, local);
        }
        locals[url] = favorites[url];
        chrome.storage.local.set({ price_history: locals });
      }
      injectFavorite(favorites);
      chrome.storage.sync.set({ price_history_favorites: favorites });
    });
  });
}

function eventListenerFavorite(checkbox, url) {
  checkbox.addEventListener('change', function () {
    chrome.storage.sync.get('price_history_favorites').then((syncres) => {
      chrome.storage.local.get(["price_history"]).then((localres) => {
        var favorites = syncres.price_history_favorites;
        var locals = localres.price_history;
        if (this.checked) {
          if (!favorites.hasOwnProperty(url)) {
            favorites[url] = locals[url];
          }
        } else {
          if (favorites.hasOwnProperty(url)) {
            delete favorites[url];
          }
        }
        chrome.storage.sync.set({ price_history_favorites: favorites });
      });
    });
  });
}