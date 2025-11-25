/**
 * Central export file for common utilities
 * Makes it easy to import utilities from a single location
 */

// Core utilities
export * from './utils';

// Performance monitoring
export { markStart, markEnd, measure, observeWebVitals } from './performance/monitor';

// Validation schemas
export * from './validation/api-schemas';

// Safe storage utilities
export { safeStorage, useLocalStorage } from './utils/safe-storage';

// Accessibility utilities
export * from './accessibility/aria-utils';
