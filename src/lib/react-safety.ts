import * as React from 'react';

// React availability and safety utilities

export interface ReactAvailability {
  isReady: boolean;
  missing: string[];
}

export function checkReactAvailability() {
  return { isReady: true, missing: [] as string[] };
}

export function waitForReact() {
  return Promise.resolve();
}

export function withReactSafety<P extends object>(Component: React.ComponentType<P>): React.ComponentType<P> {
  return (props: P) => React.createElement(Component, props);
}
