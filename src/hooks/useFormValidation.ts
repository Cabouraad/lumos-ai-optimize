/**
 * React hook for form validation with real-time feedback
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ValidationResult, validationEngine, debouncedValidator } from '@/lib/forms/validation-engine';

export interface UseFormValidationOptions {
  schema: Record<string, string[]>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
}

export interface FormValidationState {
  values: Record<string, any>;
  errors: Record<string, ValidationResult>;
  isValid: boolean;
  isValidating: boolean;
  touched: Record<string, boolean>;
}

export function useFormValidation(options: UseFormValidationOptions) {
  const { schema, validateOnChange = true, validateOnBlur = true, debounceMs = 300 } = options;
  
  const [state, setState] = useState<FormValidationState>({
    values: {},
    errors: {},
    isValid: false,
    isValidating: false,
    touched: {}
  });

  const validatingFieldsRef = useRef(new Set<string>());

  // Cleanup debounced validators on unmount
  useEffect(() => {
    return () => {
      debouncedValidator.clearAllTimers();
    };
  }, []);

  const validateField = useCallback((fieldName: string, value: any, immediate: boolean = false) => {
    const rules = schema[fieldName];
    if (!rules || rules.length === 0) return;

    if (immediate) {
      const result = validationEngine.validateField(value, rules, state.values);
      setState(prev => ({
        ...prev,
        errors: { ...prev.errors, [fieldName]: result },
        isValid: validationEngine.isFormValid({ ...prev.errors, [fieldName]: result })
      }));
    } else {
      // Mark as validating
      validatingFieldsRef.current.add(fieldName);
      setState(prev => ({ ...prev, isValidating: true }));

      debouncedValidator.validateField(
        fieldName,
        value,
        rules,
        (result) => {
          validatingFieldsRef.current.delete(fieldName);
          setState(prev => {
            const newErrors = { ...prev.errors, [fieldName]: result };
            return {
              ...prev,
              errors: newErrors,
              isValid: validationEngine.isFormValid(newErrors),
              isValidating: validatingFieldsRef.current.size > 0
            };
          });
        },
        debounceMs,
        state.values
      );
    }
  }, [schema, state.values, debounceMs]);

  const validateForm = useCallback(() => {
    const results = validationEngine.validateForm(state.values, schema);
    setState(prev => ({
      ...prev,
      errors: results,
      isValid: validationEngine.isFormValid(results)
    }));
    return results;
  }, [state.values, schema]);

  const setValue = useCallback((fieldName: string, value: any) => {
    setState(prev => ({
      ...prev,
      values: { ...prev.values, [fieldName]: value }
    }));

    if (validateOnChange) {
      validateField(fieldName, value);
    }
  }, [validateOnChange, validateField]);

  const setTouched = useCallback((fieldName: string, touched: boolean = true) => {
    setState(prev => ({
      ...prev,
      touched: { ...prev.touched, [fieldName]: touched }
    }));

    if (validateOnBlur && touched) {
      validateField(fieldName, state.values[fieldName], true);
    }
  }, [validateOnBlur, validateField, state.values]);

  const setValues = useCallback((values: Record<string, any>) => {
    setState(prev => ({
      ...prev,
      values: { ...prev.values, ...values }
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      values: {},
      errors: {},
      isValid: false,
      isValidating: false,
      touched: {}
    });
    debouncedValidator.clearAllTimers();
  }, []);

  const getFieldProps = useCallback((fieldName: string) => {
    const error = state.errors[fieldName];
    const isTouched = state.touched[fieldName];
    
    return {
      value: state.values[fieldName] || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setValue(fieldName, e.target.value);
      },
      onBlur: () => {
        setTouched(fieldName, true);
      },
      error: isTouched && error && !error.isValid ? error.errors[0] : undefined,
      isValid: isTouched && error ? error.isValid : undefined
    };
  }, [state, setValue, setTouched]);

  return {
    values: state.values,
    errors: state.errors,
    touched: state.touched,
    isValid: state.isValid,
    isValidating: state.isValidating,
    setValue,
    setValues,
    setTouched,
    validateField: (fieldName: string, value?: any) => 
      validateField(fieldName, value ?? state.values[fieldName], true),
    validateForm,
    reset,
    getFieldProps
  };
}