export const PRODUCT_DEPARTMENTS = [
  { value: 'all', label: 'All' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'audio', label: 'Audio' },
  { value: 'cables', label: 'Cables' },
  { value: 'keyboards', label: 'Keyboards' },
  { value: 'accessories', label: 'Accessories' },
];

export const PRODUCT_SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
  { value: 'highest_rated', label: 'Highest Rated' },
];

export function getDepartmentLabel(value) {
  return PRODUCT_DEPARTMENTS.find((department) => department.value === value)?.label || 'All';
}
