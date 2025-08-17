import { waitForElement } from '../../utils';
import { ProductData } from '../result';
import { cleanImageUrl, cleanPrice, cleanSold } from './clean';

const wishlistPath = '#zeus-root > div > div.css-sficwn > div > div.content > div > div.content__grid > div > div.css-157iyvz'
const urlPath = '.pcv3__container > div > a'
const namePath = '.prd_link-product-name'
const pricePath = '.prd_link-product-price'
const imagePath = '.pcv3_img_container > img'
const ratingPath = ''
const soldPath = '.prd_label-integrity'

export async function scrapeWishlist(): Promise<ProductData[] | null> {
  let result: ProductData[] = []
  
  await waitForElement<HTMLDivElement>(wishlistPath);

  const wishlistResult = document.querySelector(wishlistPath);
  if (!wishlistResult) return result;
  
  Array.from(wishlistResult.children).forEach((product) => {
    const urlEl = product.querySelector(urlPath);
    const nameEl = product.querySelector(namePath);
    const priceEl = product.querySelector(pricePath);
    const imageUrlEl = product.querySelector(imagePath);
    // const ratingEl = product.querySelector(ratingPath);
    const soldEl = product.querySelector(soldPath);

    const url = (urlEl as HTMLAnchorElement)?.href ?? '';
    const name = nameEl?.textContent?.trim() ?? '';
    const price = cleanPrice(priceEl?.textContent?.trim() ?? '');
    const imageUrl = cleanImageUrl((imageUrlEl as HTMLImageElement)?.src ?? '');
    const sold = cleanSold(soldEl?.textContent?.trim() ?? '');

    result.push({url, name, value: price, imageUrl, rating: null, sold});
  });

  return result;
}