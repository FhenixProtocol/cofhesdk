import type { PermitType } from '@cofhe/sdk/permits';
import type { TokenListModalProps } from './TokenListModal';

export enum PortalModal {
  ExampleSelection = 'exampleSelection',
  ExampleInfo = 'exampleInfo',
  PermitDetails = 'permitDetails',
  PermitTypeInfo = 'permitTypeInfo',
  PermitInfo = 'permitInfo',
  TokenList = 'tokenList',
}

export type PortalModalPropsMap = {
  [PortalModal.ExampleSelection]: { onSelect: (selectedItem: string) => void };
  [PortalModal.ExampleInfo]: void;
  [PortalModal.PermitDetails]: { hash: string };
  [PortalModal.PermitTypeInfo]: { type: PermitType };
  [PortalModal.PermitInfo]: void;
  [PortalModal.TokenList]: TokenListModalProps;
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
