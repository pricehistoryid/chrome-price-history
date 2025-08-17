import { waitForElement } from '../../utils';
import { ProductData } from '../result'
import { cleanImageUrl, cleanPrice, cleanSold } from './clean';

const namePath = "#pdp_comp-product_content"
const pricePath = ".price"
const magnifierPath = "#pdp_comp-product_media > div > div > button > div > div.magnifier"
const ratingPath = "#pdp_comp-product_content > div > div:nth-child(2) > div > p:nth-child(3) > span:nth-child(1) > span.main"
const soldPath = "#pdp_comp-product_content > div > div:nth-child(2) > div > div > div > p"

export async function scrapePDP(url: string): Promise<ProductData | null> {
  await waitForElement<HTMLDivElement>(namePath);
  await waitForElement<HTMLDivElement>(ratingPath);
  await waitForElement<HTMLDivElement>(soldPath);

  const nameEl = document.querySelector(namePath);
  const priceEl = document.querySelector(pricePath);
  const magnifierEl = document.querySelector<HTMLElement>(magnifierPath);
  const ratingEl = document.querySelector(ratingPath);
  const soldNode = document.querySelector(soldPath)?.childNodes[2];

  const name = nameEl?.firstElementChild?.firstElementChild?.textContent?.trim() ?? "";
  const price = priceEl ? cleanPrice(priceEl.textContent ?? "") : "0";
  const imageUrl = cleanImageUrl(magnifierEl?.style.backgroundImage ?? "");
  const rating = ratingEl?.textContent?.trim() ?? null;
  const sold = cleanSold(soldNode?.textContent ?? "");

  return { url, name, value: price, imageUrl, rating, sold }
}
