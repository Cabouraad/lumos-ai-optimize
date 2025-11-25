/**
 * Safe localStorage wrapper with encryption for sensitive data
 * Prevents errors from quota exceeded or unavailable storage
 */

import { getErrorMessage } from '@/lib/utils';

const STORAGE_PREFIX = 'llumos_';
const ENCRYPTION_KEY = 'llumos_encrypt_v1'; // Simple obfuscation key

/**
 * Simple XOR encryption for localStorage data
 * Note: This is NOT cryptographically secure, only prevents casual inspection
 */
function simpleEncrypt(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result); // Base64 encode
}

function simpleDecrypt(encoded: string, key: string): string {
  try {
    const text = atob(encoded); // Base64 decode
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return '';
  }
}

export const safeStorage = {
  /**
   * Get item from localStorage with optional decryption
   */
  getItem<T = string>(key: string, encrypted = false): T | null {
    try {
      const fullKey = STORAGE_PREFIX + key;
      const value = localStorage.getItem(fullKey);
      
      if (!value) return null;
      
      if (encrypted) {
        const decrypted = simpleDecrypt(value, ENCRYPTION_KEY);
        if (!decrypted) return null;
        try {
          return JSON.parse(decrypted) as T;
        } catch {
          return decrypted as T;
        }
      }
      
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.warn(`[SafeStorage] Failed to get item "${key}":`, getErrorMessage(error));
      return null;
    }
  },

  /**
   * Set item in localStorage with optional encryption
   */
  setItem(key: string, value: any, encrypted = false): boolean {
    try {
      const fullKey = STORAGE_PREFIX + key;
      let stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (encrypted) {
        stringValue = simpleEncrypt(stringValue, ENCRYPTION_KEY);
      }
      
      localStorage.setItem(fullKey, stringValue);
      return true;
    } catch (error) {
      console.warn(`[SafeStorage] Failed to set item "${key}":`, getErrorMessage(error));
      
      // Handle quota exceeded
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.error('[SafeStorage] Storage quota exceeded, attempting cleanup...');
        // Could implement cleanup strategy here
      }
      
      return false;
    }
  },

  /**
   * Remove item from localStorage
   */
  removeItem(key: string): boolean {
    try {
      const fullKey = STORAGE_PREFIX + key;
      localStorage.removeItem(fullKey);
      return true;
    } catch (error) {
      console.warn(`[SafeStorage] Failed to remove item "${key}":`, getErrorMessage(error));
      return false;
    }
  },

  /**
   * Clear all Llumos items from localStorage
   */
  clear(): boolean {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
      keys.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error) {
      console.warn('[SafeStorage] Failed to clear storage:', getErrorMessage(error));
      return false;
    }
  },

  /**
   * Check if storage is available
   */
  isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Hook-friendly version for React components
 */
export function useLocalStorage<T>(key: string, initialValue: T, encrypted = false) {
  const getValue = (): T => {
    const stored = safeStorage.getItem<T>(key, encrypted);
    return stored ?? initialValue;
  };

  const setValue = (value: T | ((prev: T) => T)): boolean => {
    try {
      const valueToStore = value instanceof Function ? value(getValue()) : value;
      return safeStorage.setItem(key, valueToStore, encrypted);
    } catch (error) {
      console.warn('[useLocalStorage] Failed to set value:', getErrorMessage(error));
      return false;
    }
  };

  return [getValue, setValue] as const;
}
