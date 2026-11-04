import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { createInitialState, useAppStore } from '../store/appStore';

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState(createInitialState());
});

afterEach(() => {
  cleanup();
});
