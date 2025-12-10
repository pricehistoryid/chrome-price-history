interface ProductData {
  url: string;
  name: string;
  value: number | string;
  image_url?: string;
  rating?: number;
  sold?: number;
}

export function updateProductPrice(productData: ProductData): Promise<void> {
  const apiUrl = import.meta.env.VITE_API_URL || 'https://pricehistory.id/api/v1/price';
  const jwtToken = import.meta.env.VITE_API_JWT_TOKEN;

  if (!jwtToken) {
    console.error('API JWT token is missing. Please check your environment variables.');
    return Promise.reject(new Error('API JWT token is missing'));
  }

  const headers = new Headers();
  headers.append('Authorization', `Bearer ${jwtToken}`);
  headers.append('Content-Type', 'application/json');

  const body = JSON.stringify({
    url: productData.url,
    name: productData.name,
    image_url: productData.image_url || '',
    price: parseInt(productData.value.toString()),
    rating: parseFloat(productData.rating?.toString() || '0'),
    sold: parseInt(productData.sold?.toString() || '0')
  }, null, 2);

  const requestOptions: RequestInit = {
    method: 'POST',
    headers: headers,
    body: body,
    redirect: 'follow'
  };

  return fetch(apiUrl, requestOptions)
    .then(response => response.text())
    .then(result => {
      console.log('Price updated successfully:', result);
    })
    .catch(error => {
      console.error('Error updating price:', error);
    });
}