var modal = document.querySelector(".modal");
var modalBtn = document.querySelector(".ph-ext");

modalBtn.onclick = function () {
  modal.style.display = "block";
}

window.onclick = function (event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}

function main(event) {
  const urlPieces = [location.host, location.pathname];
  let url = urlPieces.join('');

  const ph = new PriceHistory();
  const chart = event.currentTarget.priceHistoryParam.chart;

  const timer = setInterval(afterLoad, 2000);

  function afterLoad() {

    if (url.includes('tokopedia')) {
      const result = scrapeTokopedia(url);
      if (result) {
        updateProductPrice(result);
        try {
          chart.clear();
        } catch (error) { console.log(error) }
        chart.init();
        ph.save(result, chart);
        // ph.print(url, chart);
        clearInterval(timer);
      }
    }
  }

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.type === 'urlChanged') {
      let url = request.url;
      
      const timer = setInterval(afterLoad, 2000);

      function afterLoad() {

        if (url.includes('tokopedia')) {
          const result = scrapeTokopedia(url);
          if (result) {
            // updateProductPrice(result);
            try {
              chart.clear();
            } catch (error) { console.log(error) }
            chart.init();
            ph.save(result, chart);
            // ph.print(url, chart);
            clearInterval(timer);
          }
        }
      }
    }
  });
}

// create chart object and favorite object here
// pass objects to main function
// if receive url changes event from background.js update chart via main function too

const chart = new ChartManager('chart-container');

window.addEventListener("load", main, false);
window.priceHistoryParam = {
  chart: chart,
}
