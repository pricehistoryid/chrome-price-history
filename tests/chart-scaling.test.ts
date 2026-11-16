import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChartManager } from '../entrypoints/content/v3/chart';
import { createChart, LineSeries, type UTCTimestamp } from 'lightweight-charts';

// Mock lightweight-charts
vi.mock('lightweight-charts', () => {
  return {
    createChart: vi.fn(() => ({
      addSeries: vi.fn(() => ({
        setData: vi.fn(),
        createPriceLine: vi.fn(),
        priceScale: vi.fn(() => ({
          applyOptions: vi.fn(),
        })),
      })),
      applyOptions: vi.fn(),
      timeScale: vi.fn(() => ({
        fitContent: vi.fn(),
      })),
      subscribeCrosshairMove: vi.fn(),
      unsubscribeCrosshairMove: vi.fn(),
      removeSeries: vi.fn(),
      remove: vi.fn(),
    })),
    LineSeries: 'Line',
    ColorType: { Solid: 'solid' },
    LineStyle: { Dashed: 'dashed' },
    LineWidth: { Thin: 1 },
  };
});

describe('ChartManager Scaling', () => {
  let container: HTMLElement;
  const containerId = 'chart-container';

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it('shows a recoverable empty state when no prices can be drawn', () => {
    const status = document.createElement('p');
    status.id = 'price-history-status';
    document.body.appendChild(status);
    new ChartManager(containerId).print({ prevPrice: [], lowestPrice: { time: 0 as UTCTimestamp, price: 0 } });
    expect(status.textContent).toMatch(/belum ada riwayat/i);
    expect(container.hidden).toBe(true);
    status.remove();
  });

  it('shows the latest and lowest observed prices without chart hover', () => {
    const status = document.createElement('p');
    status.id = 'price-history-status';
    const summary = document.createElement('dl');
    summary.id = 'price-history-summary';
    summary.innerHTML = '<div><dt>Harga terakhir</dt><dd id="price-current"></dd></div><div><dt>Harga terendah</dt><dd id="price-lowest"></dd></div>';
    document.body.append(status, summary);
    new ChartManager(containerId).print({
      prevPrice: [{ time: 2 as UTCTimestamp, price: 120000 }, { time: 1 as UTCTimestamp, price: 150000 }],
      lowestPrice: { time: 1 as UTCTimestamp, price: 100000 },
    });
    expect(summary.querySelector('#price-current')?.textContent).toMatch(/120[.,]000/);
    expect(summary.querySelector('#price-lowest')?.textContent).toMatch(/100[.,]000/);
    expect(container.hidden).toBe(false);
    status.remove();
    summary.remove();
  });

  it('explains a chart failure rather than leaving an empty plot', () => {
    const status = document.createElement('p');
    status.id = 'price-history-status';
    document.body.appendChild(status);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(createChart).mockImplementationOnce(() => { throw new Error('canvas unavailable'); });
    new ChartManager(containerId).print({
      prevPrice: [{ time: 1 as UTCTimestamp, price: 120000 }],
      lowestPrice: { time: 1 as UTCTimestamp, price: 120000 },
    });
    expect(status.textContent).toMatch(/tidak dapat ditampilkan/i);
    expect(container.hidden).toBe(true);
    log.mockRestore();
    status.remove();
  });

  it('waits to measure the chart until the modal is visible', () => {
    const modal = document.createElement('div');
    modal.id = 'price-history-modal';
    modal.style.display = 'none';
    modal.appendChild(container);
    document.body.appendChild(modal);
    const manager = new ChartManager(containerId);
    const history = {
      prevPrice: [{ time: 1 as UTCTimestamp, price: 120000 }],
      lowestPrice: { time: 1 as UTCTimestamp, price: 120000 },
    };
    manager.print(history);
    expect(createChart).not.toHaveBeenCalled();
    modal.style.display = 'block';
    manager.print(history);
    expect(createChart).toHaveBeenCalledTimes(1);
  });

  it('hides reference axis badges when they would collide on a narrow chart', () => {
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 210 });
    new ChartManager(containerId).print({
      prevPrice: [{ time: 2 as UTCTimestamp, price: 120000 }, { time: 1 as UTCTimestamp, price: 150000 }],
      lowestPrice: { time: 2 as UTCTimestamp, price: 120000 },
    });
    const chart = vi.mocked(createChart).mock.results[0].value;
    const series = chart.addSeries.mock.results[0].value;
    expect(series.createPriceLine).toHaveBeenCalledWith(expect.objectContaining({ title: 'Terendah', axisLabelVisible: false }));
    expect(series.createPriceLine).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rata-rata', axisLabelVisible: false }));
  });

  it('should apply autoscaleInfoProvider when only one price point is available', () => {
    const chartManager = new ChartManager(containerId);
    const mockData = [
      { time: 1642425322 as any, price: 6000 }
    ];
    const mockLowestPrice = { time: 1642425322 as any, price: 6000 };

    chartManager.print({
      prevPrice: mockData,
      lowestPrice: mockLowestPrice,
    });

    const mockChartInstance = (createChart as any).mock.results[0].value;
    const addSeriesMock = mockChartInstance.addSeries;

    expect(addSeriesMock).toHaveBeenCalledWith(LineSeries, expect.objectContaining({
      autoscaleInfoProvider: expect.any(Function)
    }));
  });

  it('should apply autoscaleInfoProvider when all data points have the same value', () => {
    const chartManager = new ChartManager(containerId);
    const mockData = [
      { time: 1642425322 as any, price: 6000 },
      { time: 1642511722 as any, price: 6000 },
      { time: 1642684522 as any, price: 6000 }
    ];
    const mockLowestPrice = { time: 1642425322 as any, price: 6000 };

    chartManager.print({
      prevPrice: mockData,
      lowestPrice: mockLowestPrice,
    });

    const mockChartInstance = (createChart as any).mock.results[0].value;
    const addSeriesMock = mockChartInstance.addSeries;

    expect(addSeriesMock).toHaveBeenCalledWith(LineSeries, expect.objectContaining({
      autoscaleInfoProvider: expect.any(Function)
    }));
  });

  it('should NOT apply autoscaleInfoProvider when data points have different values', () => {
    const chartManager = new ChartManager(containerId);
    const mockData = [
      { time: 1642425322 as any, price: 6000 },
      { time: 1642511722 as any, price: 7000 },
      { time: 1642684522 as any, price: 6500 }
    ];
    const mockLowestPrice = { time: 1642425322 as any, price: 6000 };

    chartManager.print({
      prevPrice: mockData,
      lowestPrice: mockLowestPrice,
    });

    const mockChartInstance = (createChart as any).mock.results[0].value;
    const addSeriesMock = mockChartInstance.addSeries;

    expect(addSeriesMock).toHaveBeenCalledWith(LineSeries, expect.not.objectContaining({
      autoscaleInfoProvider: expect.any(Function)
    }));
  });
});
