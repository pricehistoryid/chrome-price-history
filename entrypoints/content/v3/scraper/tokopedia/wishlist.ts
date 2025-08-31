import { sleep, waitForElement } from '../../utils';
import { ProductData } from '../result';
import { cleanImageUrl, cleanPrice, cleanSold } from './clean';

const wishlistPath = 'div.content > div > div.content__grid > div > div:nth-child(1)'
const urlPath = '.pcv3__container > div > a'
const namePath = '.prd_link-product-name'
const pricePath = '.prd_link-product-price'
const imagePath = '.pcv3_img_container > img'
const ratingPath = ''
const soldPath = '.prd_label-integrity'

export async function scrapeWishlist(): Promise<ProductData[] | null> {
  let result: ProductData[] = []

  await waitForElement<HTMLDivElement>(wishlistPath);
  await sleep(2000);

  const wishlistResult = document.querySelector(wishlistPath);
  if (!wishlistResult) return result;
  
  const promises: Promise<ProductData>[] = Array.from(wishlistResult.children).map(async (product) => {
    await waitForElement<HTMLDivElement>(urlPath);

    const urlEl = product.querySelector(urlPath);
    const nameEl = product.querySelector(namePath);
    const priceEl = product.querySelector(pricePath);
    const imageUrlEl = product.querySelector(imagePath);
    const soldEl = product.querySelector(soldPath);

    const url = (urlEl as HTMLAnchorElement)?.href ?? '';
    const name = nameEl?.textContent?.trim() ?? '';
    const price = cleanPrice(priceEl?.textContent?.trim() ?? '');
    const imageUrl = cleanImageUrl((imageUrlEl as HTMLImageElement)?.src ?? '');
    const sold = cleanSold(soldEl?.textContent?.trim() ?? '');

    return { url, name, value: price, imageUrl, rating: null, sold };
  });

  result = await Promise.all(promises);
  return result;
}