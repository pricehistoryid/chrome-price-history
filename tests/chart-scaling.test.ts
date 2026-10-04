import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChartManager } from '../entrypoints/content/v3/chart';
import { createChart, LineSeries } from 'lightweight-charts';

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
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
    vi.clearAllMocks();
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
