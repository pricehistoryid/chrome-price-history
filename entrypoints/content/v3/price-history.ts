interface ProductData {
  url: string;
  name: string;
  value: number | string;
}

interface PriceData {
  time: string;
  value: number;
}

interface StoredData {
  [url: string]: {
    prevPrice: PriceData[];
    lowestPrice: PriceData;
  };
}

export class PriceHistory {
  private tzOffset: number;
  private ph: {
    prevPrice: PriceData[];
    lowestPrice: PriceData;
  } | undefined;

  constructor() {
    this.tzOffset = new Date().getTimezoneOffset() * 60000;
  }

  save(productData: ProductData, chart: { print: (data: any) => void }): void {
    const url = productData.url;
    const date = new Date(Date.now() - this.tzOffset)
      .toISOString()
      .split('T')[0];

    const newData: PriceData = {
      time: date,
      value: Number(productData.value),
    };

    chrome.storage.local.get(['price_history']).then((result: any) => {
      const ph: StoredData = result.price_history || {};

      this.ph = ph[url] || { prevPrice: [], lowestPrice: newData };

      // Update lowest price if needed
      if (newData.value < this.ph.lowestPrice.value) {
        this.ph.lowestPrice = newData;
      }

      const latestPrice = this.ph.prevPrice[0] || { value: 0, time: '' };

      // Add new data if it's different from the latest
      if (latestPrice.value !== newData.value || latestPrice.time !== newData.time) {
        if (latestPrice.time === newData.time && latestPrice.value > newData.value) {
          this.ph.prevPrice[0].value = newData.value;
        } else if (latestPrice.time !== newData.time) {
          this.ph.prevPrice.unshift(newData);
        }

        ph[url] = {
          prevPrice: this.ph.prevPrice,
          lowestPrice: this.ph.lowestPrice,
        };

        chrome.storage.local.set({ price_history: ph });
      }

      chart.print(this.ph);
    });
  }
}
