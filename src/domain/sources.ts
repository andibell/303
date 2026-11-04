import type { SourceRef } from './types';

const OMITTED_SOURCE = 'Supporting source material is not included in this public demo';

export const fieldRequirements = (locator: string, note?: string): SourceRef => ({
  document: OMITTED_SOURCE,
  locator,
  note,
});
export const dataFlow = (locator: string, note?: string): SourceRef => ({ document: OMITTED_SOURCE, locator, note });
export const requestForm = (_name: string, locator: string, note?: string): SourceRef => ({
  document: OMITTED_SOURCE,
  locator,
  note,
});
export const brief = (locator: string, note?: string): SourceRef => ({ document: OMITTED_SOURCE, locator, note });
export const plan = (locator: string, note?: string): SourceRef => ({
  document: OMITTED_SOURCE,
  locator,
  note,
});
export const transcript = (_name: string, note: string): SourceRef => ({
  document: OMITTED_SOURCE,
  locator: 'supporting evidence',
  note,
});
