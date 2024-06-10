class PriceHistory {
  tzOffset = (new Date()).getTimezoneOffset() * 60000;
  ph;

  constructor() {

  }

  save(productData, chart) {
    const url = productData.url;
    const name = productData.name;
    const date = `${(new Date(Date.now() - this.tzOffset)).toISOString().split('T')[0]}`;
    const newData = {
      time: date,
      value: Number(productData.value)
    };

    chrome.storage.local.get(["price_history"]).then((result) => {
      const ph = result.price_history || {};
      this.ph = ph[url] || { prevPrice: [], lowestPrice: newData };

      this.ph.lowestPrice = this.ph.lowestPrice.value > newData.value ? newData : this.ph.lowestPrice;
      const latestPrice = this.ph.prevPrice[0] || { value: 0, time: '' };

      if (latestPrice.value !== newData.value || latestPrice.time !== newData.time) {
        if (latestPrice.time === newData.time && latestPrice.value > newData.value) {
          this.ph.prevPrice[0].value = newData.value;
        } else if (latestPrice.time !== newData.time) {
          this.ph.prevPrice.unshift(newData);
        }

        ph[url] = { prevPrice: this.ph.prevPrice, lowestPrice: this.ph.lowestPrice };
        chrome.storage.local.set({ price_history: ph });
      }
      chart.print(this.ph);
    });
  }
}