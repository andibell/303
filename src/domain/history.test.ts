import { describeEvent } from './history';
import { RETURN_REASONS } from './returnReasons';
import type { HistoryEvent, HistoryEventType } from './types';
import { REQUESTOR } from '../test/fixtures';

const event = (type: HistoryEventType, extras: Partial<HistoryEvent> = {}): HistoryEvent => ({
  id: 'e1',
  type,
  at: '2026-10-01T10:00:00.000Z',
  actor: REQUESTOR,
  ...extras,
});

const ALL: HistoryEventType[] = [
  'draftCreated', 'draftSaved', 'intakeCompleted', 'itemAdded', 'itemRemoved', 'validationFailed', 'validationPassed',
  'requestSubmitted', 'readyForExecution', 'executionStarted', 'actionRequired', 'correctionMade', 'requestResubmitted',
  'itemCompleted', 'executionIdentifierRecorded', 'requestCompleted',
];

describe('event labels', () => {
  it('describes every event type in plain language, never with its technical name', () => {
    for (const type of ALL) {
      const label = describeEvent(event(type, { metadata: { itemType: 'extend' } }));
      expect(label.length).toBeGreaterThan(3);
      expect(label).not.toBe(type);
      expect(label).not.toMatch(/^[a-z]+[A-Z]/);
    }
  });

  it('names the item and reason where it matters', () => {
    expect(describeEvent(event('itemAdded', { metadata: { itemType: 'finishedGoodsBom' } }))).toBe('Product Bill of Materials added');
    expect(describeEvent(event('actionRequired', { metadata: { itemType: 'extend', category: 'plantOrExtension', scope: 'item' } }))).toBe(
      'Returned for action on Finished Product Extend: Plant or extension issue',
    );
    expect(describeEvent(event('executionIdentifierRecorded', { metadata: { itemType: 'finishedGoodsCreate', executionIdentifier: '4000123' } }))).toBe(
      'Execution Identifier 4000123 recorded for Finished Product Create',
    );
  });
});

describe('return reason taxonomy', () => {
  it('is configuration data holding the eight provisional categories', () => {
    expect(RETURN_REASONS.map((reason) => reason.label)).toEqual([
      'Missing information',
      'Invalid material or reference value',
      'Plant or extension issue',
      'Conflicting data',
      'Unsupported request combination',
      'Business approval needed',
      'Execution constraint',
      'Other',
    ]);
  });
});
