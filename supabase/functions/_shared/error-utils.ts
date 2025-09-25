/**
 * Safe error handling utilities for edge functions
 */

export type ErrorLike = { message?: string; stack?: string } | string;

export function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message ?? 'Unknown error';
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export function toErrorStack(e: unknown): string | undefined {
  return e instanceof Error ? e.stack : undefined;
}

export function formatError(e: unknown, prefix = 'Error'): string {
  const msg = toErrorMessage(e);
  const stack = toErrorStack(e);
  return stack ? `${prefix}: ${msg}\n${stack}` : `${prefix}: ${msg}`;
}