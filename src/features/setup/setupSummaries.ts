import { REFERENCE_DATA } from '../../data/reference';
import { ITEM_DEFS } from '../../domain/items/fieldSpecs';
import type { BomRequest, ItemType, RequestItem } from '../../domain/types';
import { isReadyForReview } from '../../domain/validation/engine';

/*
 * Presentation helpers for Request Setup. They count and word what the domain already derives (issues,
 * completeness) and never repeat validation. Validation is shown progressively: an untouched item is just
 * "Not started" and its blank required fields aren't presented as mistakes. The domain still holds every issue,
 * and Review & Submit surfaces all of them.
 */

export const itemCardId = (itemId: string) => `item-card-${itemId}`;

/** Items are listed in a stable type order, so re-adding an item puts it back where the user expects it. */
export const ITEM_ORDER = Object.keys(ITEM_DEFS) as ItemType[];

export const orderedItems = (request: BomRequest): RequestItem[] =>
  [...request.items].sort((a, b) => ITEM_ORDER.indexOf(a.type) - ITEM_ORDER.indexOf(b.type));

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export interface IssueCounts {
  blocking: number;
  warnings: number;
}

const isStarted = (item: RequestItem) => item.completeness !== 'notStarted';

/** The item's issues as the user should see them now: none until the item has been worked on. */
export const itemIssueCounts = (item: RequestItem): IssueCounts => {
  if (!isStarted(item)) return { blocking: 0, warnings: 0 };
  const blocking = item.issues.filter((issue) => issue.blocking).length;
  return { blocking, warnings: item.issues.length - blocking };
};

/** Issues across the request that the user should see now: started items, plus any not tied to an item. */
export const requestIssueCounts = (request: BomRequest): IssueCounts => {
  const own = request.validation.issues.filter((issue) => !issue.itemId);
  const totals = request.items.map(itemIssueCounts);
  const blocking = own.filter((issue) => issue.blocking).length + totals.reduce((sum, t) => sum + t.blocking, 0);
  const warnings = own.length - own.filter((issue) => issue.blocking).length + totals.reduce((sum, t) => sum + t.warnings, 0);
  return { blocking, warnings };
};

/** "3 to resolve · 2 warnings", or null when there is nothing to report. */
export function issueCountText({ blocking, warnings }: IssueCounts): string | null {
  const parts = [blocking > 0 && `${blocking} to resolve`, warnings > 0 && plural(warnings, 'warning')].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export const untouched = (request: BomRequest): boolean => request.items.every((item) => !isStarted(item));

/** "0 of 3 Request Items ready", plus how many need attention once there is something to attend to. */
export function itemProgressText(request: BomRequest): { ready: string; attention: string | null } {
  // Once nothing blocks submission, the request is ready as a whole; a per-item count would only contradict that.
  if (isReadyForReview(request, REFERENCE_DATA)) return { ready: 'Ready to submit', attention: null };
  const ready = request.items.filter((item) => item.completeness === 'complete').length;
  const attention = request.items.filter((item) => item.completeness === 'hasIssues').length;
  return {
    ready: `${ready} of ${plural(request.items.length, 'Request Item')} ready`,
    attention: attention > 0 ? `${attention} ${attention === 1 ? 'needs' : 'need'} attention` : null,
  };
}
