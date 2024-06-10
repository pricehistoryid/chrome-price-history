class ChartManager {
  currentLocale = window.navigator.languages[0];
  myPriceFormatter = Intl.NumberFormat(
    this.currentLocale,
    {
      style: 'currency',
      currency: 'IDR',
    }
  ).format;
  chartOptions = {
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
  lineSeriesOptions = {
    // title: 'price',
    lastValueVisible: false,
    priceLineVisible: false,
    color: '#2C7BB6',
  };
  lowestPriceLine = {
    title: 'lowest',
    color: '#D7191C',
    lineStyle: 2,
    lineWidth: 1.5,
    axisLabelVisible: true,
  };
  averagePriceLine = {
    title: 'average',
    color: '#FDAE61',
    lineStyle: 2,
    lineWidth: 1.5,
    axisLabelVisible: true,
  };
  trendLineSeriesOptions = {
    title: 'trend',
    lastValueVisible: false,
    priceLineVisible: false,
    color: '#008837',
    crosshairMarkerVisible: false,
    lineStyle: 3,
    lineWidth: 1,
  }
  endSeriesOptions = {
    autoScale: false,
    scaleMargins: {
      top: 0.1,
      bottom: 0.1,
    }
  };
  endChartOptions = {
    localization: {
      priceFormatter: this.myPriceFormatter,
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
  };

  constructor(containerId) {
    this.containerId = containerId;
    this.chart = null;
  }

  // Initialize the chart
  init() {
    this.chart = new LightweightCharts.createChart(
      document.getElementById(this.containerId),
      this.chartOptions
    );
  }

  addData(data) {
    this.series = this.chart.addLineSeries(this.lineSeriesOptions);
    this.series.setData(data.reverse());
  }

  addLowestPrice(data) {
    this.lowestPriceLine["price"] = data.value;
    this.series.createPriceLine(this.lowestPriceLine);
  }

  addAveragePrice(data) {
    this.averagePriceLine["price"] = data.reduce((total, next) => total + next.value, 0) / data.length;
    this.series.createPriceLine(this.averagePriceLine);
  }

  trackingtooltip() {
    const container = document.getElementById(this.containerId);

    let cursorX = 0;
    let cursorY = 0;

    const tooltip = document.createElement('div');
    tooltip.style = `width: 0px; height: 60px; position: absolute; display: none; padding: 8px; box-sizing: border-box; font-size: 12px; text-align: left; z-index: 1000; top: 12px; left: 12px; pointer-events: none; border: 1px solid; border-radius: 2px;font-family: -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;`;
    tooltip.style.background = 'white';
    tooltip.style.color = 'black';
    tooltip.style.borderColor = 'black';
    container.appendChild(tooltip);

    this.chart.subscribeCrosshairMove(param => {
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
        
        const dateStr = param.time;
        const data = param.seriesData.get(this.series);
        const price = data.value !== undefined ? data.value : data.close;
        const priceCurrency = this.myPriceFormatter(price);
        let priceLength = price.toString().length
        priceLength = priceLength > 3 ? priceLength - 3 : priceLength;
        tooltip.style.width = `${105 + (10 * priceLength)}px`;
        tooltip.innerHTML = `
          <div style="font-size: 16px; margin: 4px 0px;">${priceCurrency}</div>
          <div>${dateStr}</div>`;

        const tooltipMargin = 30;
        tooltip.style.display = 'block';
        let left = cursorX + tooltipMargin;
        let top = cursorY + tooltipMargin;

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      }
    });
  }

  finalization() {
    this.series.priceScale().applyOptions(this.endSeriesOptions);
    this.chart.applyOptions(this.endChartOptions);
    this.chart.timeScale().fitContent();
  }

  // Clear the chart
  clear() {
    if (this.chart) {
      this.chart.removeSeries(this.series);
      this.chart.remove();
      this.chart = null;
    }
  }

  print(ph) {
    try {
      const prevPrice = ph.prevPrice;
      const lowestPrice = ph.lowestPrice;
      this.addData(prevPrice);
      this.addLowestPrice(lowestPrice);
      this.addAveragePrice(prevPrice);
      this.trackingtooltip();
      this.finalization();
    } catch (error) { }
  }
}
