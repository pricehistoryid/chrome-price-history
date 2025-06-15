import { ProductData } from '../result'
import { cleanImageUrl, cleanPrice, cleanSold } from './clean';

export function scrapePDP(url: string): ProductData | null {
  const nameEl = document.querySelector("#pdp_comp-product_content");

  if (nameEl?.firstElementChild?.firstElementChild) {
    const name = nameEl.firstElementChild.firstElementChild.textContent?.trim() ?? "";
    const priceEl = document.querySelector(".price");
    const magnifierEl = document.querySelector<HTMLElement>(
      "#pdp_comp-product_media > div > div > button > div > div.magnifier"
    );
    const ratingEl = document.querySelector(
      "#pdp_comp-product_content > div > div:nth-child(2) > div > p:nth-child(3) > span:nth-child(1) > span.main"
    );
    const soldNode = document.querySelector(
      "#pdp_comp-product_content > div > div:nth-child(2) > div > div > div > p"
    )?.childNodes[2];

    const price = priceEl ? cleanPrice(priceEl.textContent ?? "") : "0";
    const imageUrl = cleanImageUrl(magnifierEl?.style.backgroundImage ?? "");

    let rating: string | null = null;
    try {
      rating = ratingEl?.textContent?.trim() ?? null;
    } catch {
      rating = null;
    }

    let sold: string | null = null;
    try {
      sold = cleanSold(soldNode?.textContent ?? "");
    } catch {
      sold = null;
    }

    return { url, name, value: price, imageUrl, rating, sold }
  }

  return null;
}
