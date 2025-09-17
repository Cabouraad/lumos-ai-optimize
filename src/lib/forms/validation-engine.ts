/**
 * Reusable form validation utilities with real-time feedback
 */

export interface ValidationRule {
  name: string;
  message: string;
  validate: (value: any, formData?: Record<string, any>, options?: any) => boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FieldValidationConfig {
  rules: ValidationRule[];
  debounceMs?: number;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export class ValidationEngine {
  private static instance: ValidationEngine;
  private validators = new Map<string, ValidationRule>();

  constructor() {
    this.setupDefaultValidators();
  }

  public static getInstance(): ValidationEngine {
    if (!ValidationEngine.instance) {
      ValidationEngine.instance = new ValidationEngine();
    }
    return ValidationEngine.instance;
  }

  private setupDefaultValidators(): void {
    // Required field validator
    this.addValidator({
      name: 'required',
      message: 'This field is required',
      validate: (value) => {
        return value !== null && value !== undefined && value !== '' && 
               (typeof value !== 'string' || value.trim().length > 0);
      }
    });

    // Email validator
    this.addValidator({
      name: 'email',
      message: 'Please enter a valid email address',
      validate: (value) => {
        if (!value) return true; // Allow empty unless required
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
      }
    });

    // Minimum length validator
    this.addValidator({
      name: 'minLength',
      message: 'Too short',
      validate: (value, _, options) => {
        if (!value) return true;
        const min = options?.min || 1;
        return value.length >= min;
      }
    });

    // Maximum length validator
    this.addValidator({
      name: 'maxLength',
      message: 'Too long',
      validate: (value, _, options) => {
        if (!value) return true;
        const max = options?.max || 100;
        return value.length <= max;
      }
    });

    // URL validator
    this.addValidator({
      name: 'url',
      message: 'Please enter a valid URL',
      validate: (value) => {
        if (!value) return true;
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      }
    });

    // Password strength validator
    this.addValidator({
      name: 'passwordStrength',
      message: 'Password must be at least 8 characters with uppercase, lowercase, and number',
      validate: (value) => {
        if (!value) return true;
        const hasUpper = /[A-Z]/.test(value);
        const hasLower = /[a-z]/.test(value);
        const hasNumber = /\d/.test(value);
        const isLongEnough = value.length >= 8;
        return hasUpper && hasLower && hasNumber && isLongEnough;
      }
    });

    // Numeric validator
    this.addValidator({
      name: 'numeric',
      message: 'Please enter a valid number',
      validate: (value) => {
        if (!value) return true;
        return !isNaN(Number(value));
      }
    });

    // Phone number validator (basic)
    this.addValidator({
      name: 'phone',
      message: 'Please enter a valid phone number',
      validate: (value) => {
        if (!value) return true;
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''));
      }
    });
  }

  public addValidator(rule: ValidationRule): void {
    this.validators.set(rule.name, rule);
  }

  public validateField(
    value: any, 
    rules: string[], 
    formData?: Record<string, any>,
    options?: Record<string, any>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const ruleName of rules) {
      const validator = this.validators.get(ruleName);
      if (!validator) {
        console.warn(`Unknown validation rule: ${ruleName}`);
        continue;
      }

      try {
        const isValid = validator.validate(value, formData, options);
        if (!isValid) {
          errors.push(validator.message);
        }
      } catch (error) {
        console.error(`Validation error for rule ${ruleName}:`, error);
        errors.push('Validation failed');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  public validateForm(
    formData: Record<string, any>,
    schema: Record<string, string[]>
  ): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};

    for (const [fieldName, rules] of Object.entries(schema)) {
      results[fieldName] = this.validateField(formData[fieldName], rules, formData);
    }

    return results;
  }

  public isFormValid(validationResults: Record<string, ValidationResult>): boolean {
    return Object.values(validationResults).every(result => result.isValid);
  }

  public getFormErrors(validationResults: Record<string, ValidationResult>): string[] {
    return Object.values(validationResults)
      .flatMap(result => result.errors)
      .filter(Boolean);
  }
}

// Debounced validation helper
export class DebouncedValidator {
  private timers = new Map<string, NodeJS.Timeout>();
  private engine = ValidationEngine.getInstance();

  public validateField(
    fieldName: string,
    value: any,
    rules: string[],
    callback: (result: ValidationResult) => void,
    debounceMs: number = 300,
    formData?: Record<string, any>
  ): void {
    // Clear existing timer
    const existingTimer = this.timers.get(fieldName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      const result = this.engine.validateField(value, rules, formData);
      callback(result);
      this.timers.delete(fieldName);
    }, debounceMs);

    this.timers.set(fieldName, timer);
  }

  public clearTimer(fieldName: string): void {
    const timer = this.timers.get(fieldName);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(fieldName);
    }
  }

  public clearAllTimers(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

// Global instances
export const validationEngine = ValidationEngine.getInstance();
export const debouncedValidator = new DebouncedValidator();