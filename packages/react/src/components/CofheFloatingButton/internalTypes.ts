import type { CofheStatus, CofheStatusAction } from './types';

/**
 * Internal-only action shape used inside the React widget implementation.
 *
 * The callback form must not cross the public API boundary. Any status exposed
 * to consumers should be represented as {@link CofheStatus} with an intent.
 */
export type CofheFloatingButtonInternalAction = CofheStatusAction | { label: string; onClick: () => void };

/**
 * Internal widget status shape stored and rendered by the floating button.
 *
 * Use {@link CofheStatus} for any consumer-facing API.
 */
export type CofheFloatingButtonInternalStatus = Omit<CofheStatus, 'action'> & {
  action?: CofheFloatingButtonInternalAction;
};
