export interface ProductData {
  url: string;
  name: string;
  imageUrl: string;
  value: string | number;
  rating?: string | number | null;
  sold?: string | number | null;
}