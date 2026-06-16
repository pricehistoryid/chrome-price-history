export interface ProductData {
  url: string;
  name: string;
  imageUrl: string;
  price: string | number;
  rating?: string | number | null;
  sold?: string | number | null;
  promos?: string[];
}