import { ProductData } from '../result';
import { cleanImageUrl, cleanPrice, cleanSold } from './clean';

export function scrapeWishlist(): ProductData[] | null {
  let result: ProductData[] = []

  const wishlistResult = document.querySelector('#zeus-root > div > div.css-sficwn > div > div.content > div > div.content__grid > div > div.css-157iyvz');
  
  if (wishlistResult) {
    Array.from(wishlistResult.children).forEach((product) => {
      const urlEl = product.querySelector('.pcv3__container > div > a');
      const nameEl = product.querySelector('.prd_link-product-name');
      const priceEl = product.querySelector('.prd_link-product-price');
      const imageUrlEl = product.querySelector('.pcv3_img_container > img');
      // const ratingEl = product.querySelector('');
      const soldEl = product.querySelector('.prd_label-integrity');

      const url = (urlEl as HTMLAnchorElement)?.href ?? '';
      const name = nameEl?.textContent?.trim() ?? '';
      const price = cleanPrice(priceEl?.textContent?.trim() ?? '');
      const imageUrl = cleanImageUrl((imageUrlEl as HTMLImageElement)?.src ?? '');
      const sold = cleanSold(soldEl?.textContent?.trim() ?? '');

      result.push({url, name, value: price, imageUrl, rating: null, sold});
    });
  }

  console.log(result);

  if (result) {
    return result;
  }
    
  return []
}