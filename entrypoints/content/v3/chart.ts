import {
  ColorType,
  createChart,
  IChartApi,
  ISeriesApi,
  LineSeries,
  LineStyle,
  LineWidth,
  UTCTimestamp
} from 'lightweight-charts';

type PriceData = {
  time: UTCTimestamp;
  price: number;
};

type PriceHistory = {
  prevPrice: PriceData[];
  lowestPrice: PriceData;
};

export class ChartManager {
  private chart: IChartApi | null = null;
  private series!: ISeriesApi<'Line'>;
  private containerId: string;

  private currentLocale = window.navigator.languages[0];
  private myPriceFormatter = new Intl.NumberFormat(this.currentLocale, {
    style: 'currency',
    currency: 'IDR',
  }).format;

  private myDateFormatter = (time: any) => {
    // Lightweight Charts time can be a number (UTCTimestamp) or a BusinessDay object
    const timestamp = typeof time === 'number' ? time : (time as any).timestamp;
    if (!timestamp) return time.toString();

    return new Date(timestamp * 1000).toLocaleDateString(this.currentLocale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  private chartOptions = {
    width: 600,
    height: 300,
    layout: {
      textColor: 'black',
      background: { type: ColorType.Solid, color: 'white' }
    }
  };

  private lineSeriesOptions = {
    lastValueVisible: false,
    priceLineVisible: false,
    color: '#2C7BB6',
  };

  private lowestPriceLine = {
    title: 'lowest',
    color: '#D7191C',
    lineStyle: LineStyle.Dashed,
    lineWidth: 1.5 as LineWidth,
    axisLabelVisible: true,
    price: 0, // placeholder
  };

  private averagePriceLine = {
    title: 'average',
    color: '#FDAE61',
    lineStyle: LineStyle.Dashed,
    lineWidth: 1.5 as LineWidth,
    axisLabelVisible: true,
    price: 0, // placeholder
  };

  private endSeriesOptions = {
    autoScale: false,
    scaleMargins: {
      top: 0.1,
      bottom: 0.1,
    },
  };

  private endChartOptions = {
    localization: {
      priceFormatter: this.myPriceFormatter,
      dateFormat: 'dd MMM yyyy',
    },
    crosshair: {
      horzLine: {
        visible: false,
        labelVisible: false,
      },
      vertLine: {
        visible: true,
        labelVisible: false,
      },
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { visible: false },
    },
  };

  constructor(containerId: string) {
    this.containerId = containerId;
  }

  init() {
    const container = document.getElementById(this.containerId);
    if (!container) throw new Error(`Element with ID ${this.containerId} not found.`);
    this.chart = createChart(container, this.chartOptions);
  }

  addData(data: PriceData[]) {
    if (!this.chart) return;

    const isFlatLine = data.length > 0 && data.every(d => d.price === data[0].price);
    const seriesOptions: any = { ...this.lineSeriesOptions };

    if (isFlatLine) {
      const flatValue = data[0].price;
      const padding = flatValue * 0.1; // 10% margin for better visibility
      seriesOptions.autoscaleInfoProvider = () => ({
        priceRange: {
          minValue: flatValue - padding,
          maxValue: flatValue + padding,
        }
      });
      seriesOptions.priceFormat = {
        type: 'price',
        precision: 0,
        minMove: 1,
      };
    }

    this.series = this.chart.addSeries(LineSeries, seriesOptions);
    
    // Map to library expected format (must use 'value' key)
    const libraryData = data.map(d => ({
      time: d.time,
      value: d.price
    }));
    
    this.series.setData([...libraryData].reverse());
  }

  addLowestPrice(data: PriceData) {
    if (!this.series) return;
    this.series.createPriceLine({ ...this.lowestPriceLine, price: data.price });
  }

  addAveragePrice(data: PriceData[]) {
    if (!this.series || data.length === 0) return;
    const avg = data.reduce((sum, d) => sum + d.price, 0) / data.length;
    this.series.createPriceLine({ ...this.averagePriceLine, price: avg });
  }

  trackingtooltip() {
    if (!this.chart) return;

    const container = document.getElementById(this.containerId);
    if (!container) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'price-history-tooltip';
    Object.assign(tooltip.style, {
      position: 'absolute',
      display: 'none',
      padding: '8px',
      boxSizing: 'border-box',
      fontSize: '12px',
      textAlign: 'left',
      zIndex: '1001',
      top: '12px',
      left: '12px',
      pointerEvents: 'none',
      border: '1px solid black',
      borderRadius: '2px',
      background: 'white',
      color: 'black',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
      webkitFontSmoothing: 'antialiased',
      mozOsxFontSmoothing: 'grayscale',
    });
    container.appendChild(tooltip);

    this.chart.subscribeCrosshairMove((param: any) => {
      if (
        !param.point ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > container.clientWidth ||
        param.point.y < 0 ||
        param.point.y > container.clientHeight
      ) {
        tooltip.style.display = 'none';
        return;
      }

      const data = param.seriesData.get(this.series);
      if (!data) {
        tooltip.style.display = 'none';
        return;
      }

      const price = 'value' in data ? data.value : (data as any).close;
      const priceCurrency = this.myPriceFormatter(price);

      const priceLength = price.toString().length;
      tooltip.style.width = `${105 + (10 * Math.max(priceLength - 3, 0))}px`;
      tooltip.innerHTML = `
        <div style="font-size: 16px; margin: 4px 0px;">${priceCurrency}</div>
        <div>${this.myDateFormatter(param.time)}</div>`;

      const coordinate = this.series.priceToCoordinate(price);
      if (coordinate === null) {
        tooltip.style.display = 'none';
        return;
      }

      tooltip.style.left = `${param.point.x}px`;
      tooltip.style.top = `${coordinate}px`;
      tooltip.style.display = 'block';
    });
  }

  finalization() {
    if (!this.chart || !this.series) return;
    this.series.priceScale().applyOptions(this.endSeriesOptions);
    this.chart.applyOptions(this.endChartOptions);
    this.chart.timeScale().fitContent();
  }

  clear() {
    try {
      // Remove tooltip if it exists
      const container = document.getElementById(this.containerId);
      if (container) {
        const tooltip = container.querySelector('.price-history-tooltip');
        if (tooltip) {
          tooltip.remove();
        }
      }

      // Remove series
      if (this.chart && this.series) {
        this.chart.removeSeries(this.series);
      }

      // Remove chart
      if (this.chart) {
        this.chart.remove();
      }

      // Clear references
      this.series = null as any;
      this.chart = null;

      // console.log('ChartManager: Cleanup completed successfully');
    } catch (error) {
      console.error('ChartManager: Error during cleanup:', error);
      // Force cleanup even if errors occur
      this.chart = null;
      this.series = null as any;
      document.onmousemove = null;
    }
  }

  /**
   * Destroys the chart instance and removes all references
   */
  destroy() {
    this.clear();
  }

  /**
   * Checks if chart is properly initialized
   */
  isInitialized(): boolean {
    return this.chart !== null;
  }

  /**
   * Gets chart container element
   */
  getContainer(): HTMLElement | null {
    return document.getElementById(this.containerId);
  }

  print(ph: PriceHistory) {
    try {
      // Validate input data
      if (!ph || !ph.prevPrice || !Array.isArray(ph.prevPrice)) {
        throw new Error('Invalid price history data');
      }

      if (ph.prevPrice.length === 0) {
        throw new Error('No price data to display');
      }

      // Ensure chart is initialized
      if (!this.chart) {
        this.init();
      }

      this.addData(ph.prevPrice);
      this.addLowestPrice(ph.lowestPrice);
      this.addAveragePrice(ph.prevPrice);
      this.trackingtooltip();
      this.finalization();

      // console.log('ChartManager: Chart rendered successfully');
    } catch (error) {
      console.error('ChartManager print error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        data: ph ? { hasPrevPrice: !!ph.prevPrice, dataLength: ph.prevPrice?.length } : 'No data',
        timestamp: new Date().toISOString()
      });

      // Try to cleanup on error
      this.clear();
    }
  }
}
