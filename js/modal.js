// Get the current users primary locale
const currentLocale = window.navigator.languages[0];
// Create a number format using Intl.NumberFormat
const myPriceFormatter = Intl.NumberFormat(currentLocale, {
  style: 'currency',
  currency: 'IDR',
}).format;
// Chart options
const chartOptions = {
  width: 600,
  height: 300,
  layout: {
    textColor: 'black',
    background: {
      type: 'solid',
      color: 'white'
    }
  }
};
const chart = LightweightCharts.createChart(
  document.getElementById('chart-container'),
  chartOptions
);
const lineSeries = chart.addLineSeries(
  {
    lastValueVisible: false,
    priceLineVisible: false,
  }
);

function printChart(ph) {
  var prev_price = JSON.parse(JSON.stringify(ph.prev_price));

  lineSeries.setData(prev_price.reverse());

  // lowest price
  var lowestPrice = ph.lowestPrice;
  const lowestPriceLine = {
    price: lowestPrice.value,
    color: 'red',
    lineStyle: 2, // LineStyle.Dashed
    axisLabelVisible: true,
    title: 'lowest',
  };
  lineSeries.createPriceLine(lowestPriceLine);

  // average price
  console.log(prev_price);
  const averagePrice = prev_price.reduce((total, next) => total + next.value, 0) / prev_price.length;
  const averagePriceLine = {
    price: averagePrice,
    color: 'green',
    lineStyle: 2, // LineStyle.Dashed
    axisLabelVisible: true,
    title: 'average',
  };
  lineSeries.createPriceLine(averagePriceLine);

  lineSeries.priceScale().applyOptions({
    autoScale: false,
    scaleMargins: {
      top: 0.1,
      bottom: 0.1,
    }
  });
  chart.applyOptions({
    localization: {
      priceFormatter: myPriceFormatter,
      dateFormat: "dd MMM yyyy"
    },
  });
  chart.timeScale().fitContent();
}

function insertNewPrice(ph, value) {
  var new_prev_price = [];
  new_prev_price.push(value);
  for (let i = 0; i < ph.prev_price.length; i++) {
    new_prev_price.push(ph.prev_price[i]);
  }
  ph.prev_price = new_prev_price;
  // console.log(JSON.stringify(ph));
  return ph;
}

function savePriceHistory(result) {
  var url = result.url;
  // var title = result.title;
  const date = `${new Date().toISOString().split('T')[0]}`;
  var value = {
    time: date,
    value: Number(result.value)
  };
  // console.log(value);

  chrome.storage.local.get(["price_history"]).then((result) => {
    var ph = result.price_history;
    // first time using extension
    if (!ph) {
      ph = {}
      chrome.storage.local.set({ price_history: ph });
    }
    // console.log(JSON.stringify(ph));

    // case not first time scrapped
    if (ph[url]) {
      var this_ph = ph[url];
      var lowestPrice = this_ph.lowestPrice || value;
      lowestPrice = lowestPrice.value > value.value ? value : lowestPrice;

      // value changed
      if (
        this_ph.prev_price[0].value != value.value ||
        this_ph.prev_price[0].time != value.time
      ) {
        this_ph = insertNewPrice(this_ph, value);
        ph[url] = {
          value: value,
          prev_price: this_ph.prev_price,
          lowestPrice: lowestPrice
        };
        printChart(ph[url]);
        chrome.storage.local.set({ price_history: ph });
        // value not changed
      } else {
        ph_unchanged = {
          value: value,
          prev_price: this_ph.prev_price,
          lowestPrice: lowestPrice
        };
        printChart(ph_unchanged);
      }
      // first time scrapped
    } else {
      var lowestPrice = value;
      ph[url] = {
        value: value,
        prev_price: [value],
        lowestPrice: lowestPrice
      };
      printChart(ph[url]);
      chrome.storage.local.set({ price_history: ph });
    }
  });
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
        savePriceHistory(result);
      }
    }

    // shopee
    if (url.includes('shopee')) {
      if (scrapeShopee()) {
        clearInterval(timer);
        result = scrapeShopee()
        savePriceHistory(result);
      }
    }
  }
}
