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
let cursorX = 0;
let cursorY = 0;

function printChart(ph) {
  var prevPrice = JSON.parse(JSON.stringify(ph.prevPrice));

  // price line
  const lineSeries = chart.addLineSeries(
    {
      // title: 'price',
      lastValueVisible: false,
      priceLineVisible: false,
      color: '#2C7BB6',
    }
  );
  lineSeries.setData(prevPrice.reverse());

  // lowest price
  var lowestPrice = ph.lowestPrice;
  const lowestPriceLine = {
    title: 'lowest',
    price: lowestPrice.value,
    color: '#D7191C',
    lineStyle: 2, // LineStyle.Dashed
    lineWidth: 1.5,
    axisLabelVisible: true,
  };
  lineSeries.createPriceLine(lowestPriceLine);

  // average price
  const averagePrice = prevPrice.reduce((total, next) => total + next.value, 0) / prevPrice.length;
  const averagePriceLine = {
    title: 'average',
    price: averagePrice,
    color: '#FDAE61',
    lineStyle: 2, // LineStyle.Dashed
    lineWidth: 1.5,
    axisLabelVisible: true,
  };
  lineSeries.createPriceLine(averagePriceLine);

  // trend line
  if (prevPrice.length > 2) {
    var trendline = createTrendLine(prevPrice);
    const lineSeries2 = chart.addLineSeries({
      title: 'trend',
      lastValueVisible: false,
      priceLineVisible: false,
      color: '#008837',
      crosshairMarkerVisible: false,
      lineStyle: 3, // LineStyle.Dashed
      lineWidth: 1,
      // visible: false,
    });
    var trendLineData = [];
    trendLineData.push({
      time: prevPrice[0].time,
      value: trendline['firstPoint']
    });
    trendLineData.push({
      time: prevPrice[prevPrice.length - 1].time,
      value: trendline['lastPoint']
    });
    lineSeries2.setData(trendLineData);
  }

  trackingTooltip(lineSeries);

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
        labelVisible: false
      },
      vertLine: {
        labelVisible: false
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

function trackingTooltip(series) {
  const container = document.getElementById('chart-container');
  
  const tooltipMargin = 30;

  const tooltip = document.createElement('div');
  tooltip.style = `width: 0px; height: 60px; position: absolute; display: none; padding: 8px; box-sizing: border-box; font-size: 12px; text-align: left; z-index: 1000; top: 12px; left: 12px; pointer-events: none; border: 1px solid; border-radius: 2px;font-family: -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;`;
  tooltip.style.background = 'white';
  tooltip.style.color = 'black';
  tooltip.style.borderColor = 'black';
  container.appendChild(tooltip);

  chart.subscribeCrosshairMove(param => {
    if (
      param.point === undefined ||
      !param.time ||
      param.point.x < 0 ||
      param.point.x > container.clientWidth ||
      param.point.y < 0 ||
      param.point.y > container.clientHeight
    ) {
      tooltip.style.display = 'none';
    } else {
      document.onmousemove = function(event) {
        cursorX = event.pageX;
        cursorY = event.pageY;
      }
      
      tooltip.style.display = 'block';
      const dateStr = param.time;
      const data = param.seriesData.get(series);
      const price = data.value !== undefined ? data.value : data.close;
      const priceCurrency = myPriceFormatter(price);
      let priceLength = price.toString().length
      priceLength = priceLength > 3 ? priceLength - 3 : priceLength;
      tooltip.style.width = (105 + (10 * priceLength)) + 'px';
      tooltip.innerHTML = `<div style="font-size: 16px; margin: 4px 0px; color: ${'black'}">
        ${priceCurrency}
        </div><div style="color: ${'black'}">
        ${dateStr}
        </div>`;

      let left = cursorX + tooltipMargin;
      let top = cursorY + tooltipMargin;

      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    }
  });
}

function insertNewPrice(ph, value) {
  var newPrevPrice = [];
  newPrevPrice.push(value);
  for (let i = 0; i < ph.prevPrice.length; i++) {
    newPrevPrice.push(ph.prevPrice[i]);
  }
  ph.prevPrice = newPrevPrice;
  // console.log(JSON.stringify(ph));
  return ph;
}

function createTrendLine(prevPrice) {
  var n = prevPrice.length;

  const xMean = (n + 1) / 2;
  const yMean = prevPrice.reduce((total, next) => total + next.value, 0) / prevPrice.length;
  var nom = 0;
  var denom = 0;
  var m = 0;
  var b = 0;
  for (let i = 0; i < n; i++) {
    const price = prevPrice[i];
    nom += ((i+1) - xMean) * (price.value - yMean);
    denom += ((i+1) - xMean) ** 2;
  }

  m = nom / denom;
  b = yMean - (m * xMean);

  var firstPoint = (m * 1) + b;
  var lastPoint = (m * n) + b;
  return {
    firstPoint,
    lastPoint
  };
}

function savePriceHistory(result) {
  var url = result.url;
  // var name = result.name;
  const date = `${(new Date(Date.now() - tzoffset)).toISOString().split('T')[0]}`;
  var value = {
    time: date,
    value: Number(result.value)
  };

  chrome.storage.local.get(["price_history"]).then((result) => {
    var ph = result.price_history;
    // first time using extension
    if (!ph) {
      ph = {};
    }
    // console.log(JSON.stringify(ph));

    // have been scraped
    if (ph[url]) {
      var thisPh = ph[url];
      var lowestPrice = thisPh.lowestPrice || value;
      lowestPrice = lowestPrice.value > value.value ? value : lowestPrice;

      // value changed or date changed
      if (
        thisPh.prevPrice[0].value != value.value ||
        thisPh.prevPrice[0].time != value.time
      ) {
        // different value on the same day
        if (
          thisPh.prevPrice[0].time == value.time &&
          thisPh.prevPrice[0].value > value.value
        ) {
          ph[url]['prevPrice'][0].value = value.value;
        }
        // different day
        if (
          thisPh.prevPrice[0].time != value.time
        ) {
          thisPh = insertNewPrice(thisPh, value);
          ph[url] = {
            prevPrice: thisPh.prevPrice,
            lowestPrice: lowestPrice
          };
        }
        chrome.storage.local.set({ price_history: ph });
      }
    // first time scraped
    } else {
      ph[url] = {
        prevPrice: [value],
        lowestPrice: value
      };
      chrome.storage.local.set({ price_history: ph });
    }
    printChart(ph[url]);
  });
}