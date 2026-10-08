import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCofheClient } from '@cofhe/sdk/web';
import { createCofheConfig } from '../config';
import type { CofheProviderProps } from '../types/index';
import { CofheProvider } from './CofheProvider';

const clientConfig = createCofheConfig({ supportedChains: [] });
const explicitConfig = createCofheConfig({
  supportedChains: [],
  react: { initialTheme: 'dark' },
});
const client = createCofheClient(clientConfig);

function typeOnly() {
  const defaults: CofheProviderProps = { children: null };
  const withConfig: CofheProviderProps = { children: null, config: explicitConfig };
  const withClient: CofheProviderProps = { children: null, cofheClient: client };

  // @ts-expect-error config and cofheClient are alternative configuration sources
  const withBoth: CofheProviderProps = {
    children: null,
    config: explicitConfig,
    cofheClient: client,
  };

  return { defaults, withConfig, withClient, withBoth };
}

describe('CofheProvider', () => {
  it('keeps config and cofheClient mutually exclusive at the type level', () => {
    expect(typeOnly).toBeTypeOf('function');
  });

  it('rejects config and cofheClient together at runtime', () => {
    const conflictingProps = {
      children: <div>content</div>,
      config: explicitConfig,
      cofheClient: client,
    } as unknown as CofheProviderProps;

    expect(() => renderToString(<CofheProvider {...conflictingProps} />)).toThrowError(
      'CofheProvider accepts either config or cofheClient, not both'
    );
  });
});
