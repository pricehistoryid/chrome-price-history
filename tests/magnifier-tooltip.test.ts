import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChartManager } from '../entrypoints/content/v3/chart.ts';
import { createChart } from 'lightweight-charts';

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
        priceToCoordinate: vi.fn((price) => price / 10),
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

describe('Magnifier Tooltip Implementation', () => {
  let container: HTMLElement;
  const containerId = 'chart-container';

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = containerId;
    // Set dimensions for JSDOM
    Object.defineProperty(container, 'clientWidth', { value: 600 });
    Object.defineProperty(container, 'clientHeight', { value: 300 });
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('Phase 1: Setup and Crosshair Configuration', () => {
    it('should disable horizontal crosshair line and enable vertical crosshair line', () => {
      const chartManager = new ChartManager(containerId);
      const mockData = [
        { time: 1642425322 as any, value: 6000 }
      ];
      const mockLowestPrice = { time: 1642425322 as any, value: 6000 };

      chartManager.print({
        prevPrice: mockData,
        lowestPrice: mockLowestPrice,
      });

      const mockChartInstance = (createChart as any).mock.results[0].value;
      const applyOptionsMock = mockChartInstance.applyOptions;

      // Find the crosshair configuration call
      const crosshairCall = applyOptionsMock.mock.calls.find((call: any) => call[0].crosshair);
      expect(crosshairCall).toBeDefined();

      const crosshairOptions = crosshairCall[0].crosshair;
      expect(crosshairOptions.horzLine.visible).toBe(false);
      expect(crosshairOptions.vertLine.visible).toBe(true);
    });
  });

  describe('Phase 2: Implement Magnifier Tooltip', () => {
    it('should create a tooltip DOM element with correct styles', () => {
      const chartManager = new ChartManager(containerId);
      const mockData = [
        { time: 1642425322 as any, value: 6000 }
      ];
      
      chartManager.print({
        prevPrice: mockData,
        lowestPrice: mockData[0],
      });

      const tooltip = document.body.querySelector('.price-history-tooltip');
      expect(tooltip).toBeTruthy();
      expect((tooltip as HTMLElement).style.position).toBe('absolute');
      expect((tooltip as HTMLElement).style.display).toBe('none');
    });

    it('should snap tooltip to the data point coordinates', () => {
      const chartManager = new ChartManager(containerId);
      const mockData = [
        { time: 1642425322 as any, value: 6000 }
      ];
      
      chartManager.print({
        prevPrice: mockData,
        lowestPrice: mockData[0],
      });

      const mockChartInstance = (createChart as any).mock.results[0].value;
      const subscribeMock = mockChartInstance.subscribeCrosshairMove;
      const callback = subscribeMock.mock.calls[0][0];

      const tooltip = document.body.querySelector('.price-history-tooltip') as HTMLElement;
      
      // Mock crosshair move parameter
      const param = {
        point: { x: 100, y: 200 },
        time: 1642425322,
        seriesData: new Map([
          [mockChartInstance.addSeries.mock.results[0].value, { value: 6000 }]
        ])
      };

      callback(param);

      // Expected Y: priceToCoordinate(6000) = 6000 / 10 = 600
      // Expected X: param.point.x = 100
      
      expect(tooltip.style.display).toBe('block');
      expect(tooltip.style.left).toBe('100px');
      expect(tooltip.style.top).toBe('600px');
    });

    it('should bind and format price and date data correctly', () => {
      const chartManager = new ChartManager(containerId);
      const mockData = [
        { time: 1642425322 as any, value: 6543210 }
      ];
      
      chartManager.print({
        prevPrice: mockData,
        lowestPrice: mockData[0],
      });

      const mockChartInstance = (createChart as any).mock.results[0].value;
      const subscribeMock = mockChartInstance.subscribeCrosshairMove;
      const callback = subscribeMock.mock.calls[0][0];

      const tooltip = document.body.querySelector('.price-history-tooltip') as HTMLElement;
      
      const param = {
        point: { x: 100, y: 200 },
        time: 1642425322,
        seriesData: new Map([
          [mockChartInstance.addSeries.mock.results[0].value, { value: 6543210 }]
        ])
      };

      callback(param);

      // Check for Indonesian currency formatting. JSDOM/Node might use different separators depending on locale.
      // We expect the value to be formatted.
      expect(tooltip.innerHTML).toContain('6');
      expect(tooltip.innerHTML).toContain('543');
      expect(tooltip.innerHTML).toContain('210');
      // Date: check for year 2022
      expect(tooltip.innerHTML).toContain('2022');
    });
  });
});
