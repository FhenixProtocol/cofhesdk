import type { ACPType } from '@cofhe/sdk/acps';
import type { ConfidentialToken } from '@/types/token';
import type { BalanceType } from '../components/CofheTokenConfidentialBalance';

export enum PortalModal {
  ExampleSelection = 'exampleSelection',
  ExampleInfo = 'exampleInfo',
  ACPDetails = 'acpDetails',
  ACPTypeInfo = 'acpTypeInfo',
  ACPInfo = 'acpInfo',
  TokenList = 'tokenList',
  ImportCustomToken = 'importCustomToken',
}

export type PortalModalPropsMap = {
  [PortalModal.ExampleSelection]: { onSelect: (selectedItem: string) => void };
  [PortalModal.ExampleInfo]: void;
  [PortalModal.ACPDetails]: { hash: string };
  [PortalModal.ACPTypeInfo]: { type: ACPType };
  [PortalModal.ACPInfo]: void;
  [PortalModal.TokenList]: {
    balanceType: BalanceType;
    title: string;
    tokens: ConfidentialToken[];
    onSelectToken: (token: ConfidentialToken) => void;
  };
  [PortalModal.ImportCustomToken]: {
    balanceType: BalanceType;
    title: string;
    tokens: ConfidentialToken[];
    onSelectToken: (token: ConfidentialToken) => void;
  };
};

export type PortalModalsWithProps = {
  [M in PortalModal]: PortalModalPropsMap[M] extends void ? never : M;
}[PortalModal];

export type PortalModalsWithoutProps = {
  [M in PortalModal]: PortalModalPropsMap[M] extends void ? M : never;
}[PortalModal];

export type PortalModalStateMap = {
  [M in PortalModal]: (PortalModalPropsMap[M] extends void ? {} : PortalModalPropsMap[M]) & {
    modal: M;
    onClose: () => void;
  };
};

export type PortalModalState = PortalModalStateMap[PortalModal];

export type OpenPortalModalFn = <M extends PortalModal>(
  ...args: PortalModalPropsMap[M] extends void ? [modal: M] : [modal: M, props: PortalModalPropsMap[M]]
) => void;
