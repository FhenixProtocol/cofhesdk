export const hasDOM =
  typeof (globalThis as any)?.document !== 'undefined' && typeof (globalThis as any)?.window !== 'undefined';
