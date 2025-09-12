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
      return 'bg-primary/10 text-primary border-primary/20';
    case 'Competitor Monitoring':
      return 'bg-warning/10 text-warning border-warning/20';
    case 'Content Optimization':
      return 'bg-accent/10 text-accent-foreground border-accent/20';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};