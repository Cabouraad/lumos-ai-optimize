export const getPromptCategory = (text: string) => {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('brand') || lowerText.includes('company')) return 'Brand Visibility';
  if (lowerText.includes('competitor') || lowerText.includes('vs') || lowerText.includes('alternative')) return 'Competitor Monitoring';
  if (lowerText.includes('content') || lowerText.includes('blog') || lowerText.includes('article')) return 'Content Optimization';
  return 'Brand Visibility'; // Default category
};

export const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Brand Visibility':
      return 'bg-primary text-primary-foreground border-primary shadow-sm';
    case 'Competitor Monitoring':
      return 'bg-warning text-warning-foreground border-warning shadow-sm';
    case 'Content Optimization':
      return 'bg-accent text-accent-foreground border-accent shadow-sm';
    default:
      return 'bg-secondary text-secondary-foreground border-secondary shadow-sm';
  }
};