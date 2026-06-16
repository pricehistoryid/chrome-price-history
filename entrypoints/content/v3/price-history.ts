interface ProductData {
  url: string;
  name: string;
  price: number | string;
}

interface PriceData {
  time: string;
  price: number;
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

  /**
   * Migrates old PriceData objects from using 'value' to 'price'
   */
  private migratePriceData(data: any): PriceData {
    if (data && data.value !== undefined && data.price === undefined) {
      return {
        time: data.time,
        price: Number(data.value)
      };
    }
    return data as PriceData;
  }

  save(productData: ProductData, chart: { print: (data: any) => void }): void {
    const url = productData.url;
    const date = new Date(Date.now() - this.tzOffset)
      .toISOString()
      .split('T')[0];

    const newData: PriceData = {
      time: date,
      price: Number(productData.price),
    };

    chrome.storage.local.get(['price_history']).then((result: any) => {
      const ph: any = result.price_history || {};

      let currentProduct = ph[url];
      
      if (currentProduct) {
        // Migrate existing data if needed
        currentProduct.prevPrice = (currentProduct.prevPrice || []).map((p: any) => this.migratePriceData(p));
        currentProduct.lowestPrice = this.migratePriceData(currentProduct.lowestPrice);
      }

      this.ph = currentProduct || { prevPrice: [], lowestPrice: newData };

      // Update lowest price if needed
      if (newData.price < this.ph!.lowestPrice.price) {
        this.ph!.lowestPrice = newData;
      }

      const latestPrice = this.ph!.prevPrice[0] || { price: 0, time: '' };

      // Add new data if it's different from the latest
      if (latestPrice.price !== newData.price || latestPrice.time !== newData.time) {
        if (latestPrice.time === newData.time && latestPrice.price > newData.price) {
          this.ph!.prevPrice[0].price = newData.price;
        } else if (latestPrice.time !== newData.time) {
          this.ph!.prevPrice.unshift(newData);
        }

        ph[url] = {
          prevPrice: this.ph!.prevPrice,
          lowestPrice: this.ph!.lowestPrice,
        };

        chrome.storage.local.set({ price_history: ph });
      }

      this.ph = ph[url];
      chart.print(this.ph);
    });
  }

  render(chart: { print: (data: any) => void }): void {
    if (this.ph) {
      chart.print(this.ph);
    }
  }
}
