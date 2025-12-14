import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Shield Page Variants (A/B Testing)
// ============================================================================

export enum ShieldPageVariant {
  Option1 = 'option1',
  Option2 = 'option2',
}

export const SHIELD_PAGE_VARIANT_LABELS: Record<ShieldPageVariant, string> = {
  [ShieldPageVariant.Option1]: 'Modern UI',
  [ShieldPageVariant.Option2]: 'Classic UI',
};

// ============================================================================
// Settings Store
// ============================================================================

interface SettingsState {
  /** Selected shield page variant for A/B testing */
  shieldPageVariant: ShieldPageVariant;

  /** Set the shield page variant */
  setShieldPageVariant: (variant: ShieldPageVariant) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      shieldPageVariant: ShieldPageVariant.Option1,

      setShieldPageVariant: (variant) => set({ shieldPageVariant: variant }),
    }),
    {
      name: 'cofhe-settings',
    }
  )
);
