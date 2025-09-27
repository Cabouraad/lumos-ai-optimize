/**
 * Utility for handling chunk loading with retry logic
 */

import { lazy } from 'react';

export async function loadChunkWithRetry<T>(
  importFn: () => Promise<T>, 
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await importFn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry if it's not a chunk loading error
      if (!isChunkLoadError(error as Error)) {
        throw error;
      }
      
      console.warn(`Chunk load attempt ${attempt + 1} failed:`, error);
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
      }
    }
  }
  
  // If we get here, all retries failed
  console.error(`Failed to load chunk after ${maxRetries} attempts`);
  throw lastError;
}

function isChunkLoadError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return message.includes('loading chunk') ||
         message.includes('dynamically imported module') ||
         message.includes('failed to fetch') ||
         message.includes('networkerror');
}

/**
 * Enhanced lazy loading with retry logic
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  maxRetries: number = 3
): React.LazyExoticComponent<T> {
  return lazy(() => loadChunkWithRetry(importFn, maxRetries));
}