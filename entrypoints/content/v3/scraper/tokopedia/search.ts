import { ProductData } from '../result';

export function scrapeSearch(url: string): ProductData[] | null {
  const searchResult = document.querySelector('#zeus-root > div > div.css-jau1bt > div > div.css-rjanld > div:nth-child(3)');
  
  return []
}