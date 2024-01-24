// Get the current users primary locale
const currentLocale = window.navigator.languages[0];
// Timezone
const tzoffset = (new Date()).getTimezoneOffset() * 60000;
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

function printChart(ph) {
  var prev_price = JSON.parse(JSON.stringify(ph.prev_price));

  // price line
  const lineSeries = chart.addLineSeries(
    {
      // title: 'price',
      lastValueVisible: false,
      priceLineVisible: false,
    }
  );
  lineSeries.setData(prev_price.reverse());

  // lowest price
  var lowestPrice = ph.lowestPrice;
  const lowestPriceLine = {
    title: 'lowest',
    price: lowestPrice.value,
    color: 'red',
    lineStyle: 2, // LineStyle.Dashed
    lineWidth: 1,
    axisLabelVisible: true,
  };
  lineSeries.createPriceLine(lowestPriceLine);

  // average price
  const averagePrice = prev_price.reduce((total, next) => total + next.value, 0) / prev_price.length;
  const averagePriceLine = {
    title: 'average',
    price: averagePrice,
    color: 'green',
    lineStyle: 2, // LineStyle.Dashed
    lineWidth: 1,
    axisLabelVisible: true,
  };
  lineSeries.createPriceLine(averagePriceLine);

  // trend line
  if (prev_price.length > 2) {
    var trendline = createTrendLine(prev_price);
    const lineSeries2 = chart.addLineSeries({
      title: 'trend',
      lastValueVisible: false,
      priceLineVisible: false,
      color: '#EE5A24',
      crosshairMarkerVisible: false,
      lineStyle: 2, // LineStyle.Dashed
      lineWidth: 0.9,
      // visible: false,
    });
    var trendLineData = [];
    trendLineData.push({
      time: prev_price[0].time,
      value: trendline['first_point']
    });
    trendLineData.push({
      time: prev_price[prev_price.length - 1].time,
      value: trendline['last_point']
    });
    lineSeries2.setData(trendLineData);
  }

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
    crosshair: {
      horzLine: {
        visible: false,
        // labelVisible: false
      }
    },
    grid: {
      vertLines: {
        visible: false
      },
      horzLines: {
        visible: false
      }
    }
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

function createTrendLine(prev_price) {
  var n = prev_price.length;

  const x_mean = (n + 1) / 2;
  const y_mean = prev_price.reduce((total, next) => total + next.value, 0) / prev_price.length;
  var nom = 0;
  var denom = 0;
  var m = 0;
  var b = 0;
  for (let i = 0; i < n; i++) {
    const price = prev_price[i];
    nom += ((i+1) - x_mean) * (price.value - y_mean);
    denom += ((i+1) - x_mean) ** 2;
  }

  m = nom / denom;
  b = y_mean - (m * x_mean);

  var first_point = (m * 1) + b;
  var last_point = (m * n) + b;
  return {
    first_point,
    last_point
  };
}

function savePriceHistory(result) {
  var url = result.url;
  // var title = result.title;
  const date = `${(new Date(Date.now() - tzoffset)).toISOString().split('T')[0]}`;
  var value = {
    time: date,
    value: Number(result.value)
  };
  // console.log(value);

  chrome.storage.local.get(["price_history"]).then((result) => {
    var ph = result.price_history;
    if (!ph) {
      // first time using extension
      ph = {}
      chrome.storage.local.set({ price_history: ph });
    }
    // console.log(JSON.stringify(ph));

    // case not first time scrapped
    if (ph[url]) {
      var this_ph = ph[url];
      var lowestPrice = this_ph.lowestPrice || value;
      lowestPrice = lowestPrice.value > value.value ? value : lowestPrice;

      // value changed or date changed
      if (
        this_ph.prev_price[0].value != value.value ||
        this_ph.prev_price[0].time != value.time
      ) {
        // value changed on the same day
        if (this_ph.prev_price[0].time == value.time) {
          ph[url]['prev_price'][0].value = value.value
        // value changed on the different day
        } else {
          this_ph = insertNewPrice(this_ph, value);
          ph[url] = {
            prev_price: this_ph.prev_price,
            lowestPrice: lowestPrice
          };
        }
        chrome.storage.local.set({ price_history: ph });
      }
    // first time scrapped
    } else {
      ph[url] = {
        prev_price: [value],
        lowestPrice: value
      };
      chrome.storage.local.set({ price_history: ph });
    }
    printChart(ph[url]);
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
