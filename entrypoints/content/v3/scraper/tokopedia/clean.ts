export function cleanPrice(value: string): string {
  return value
    .replaceAll('.', '')
    .replace(/[^0-9.-]+/g, '');
}

export function cleanImageUrl(imageUrl: string): string {
  return imageUrl
    .replace('url(', '')
    .replace(')', '')
    .replaceAll('"', '')
    .replace('100-square', '700');
}

export function cleanSold(sold: string): string {
  const text = sold.replace(/Terjual|\+|\s/g, '');

  if (text.includes('rb')) {
    return Math.round(parseFloat(text.replace('rb', '').replace(',', '.')) * 1000).toString();
  }

  return text.replace(',', '.');
}