import type { PermitType } from "@cofhe/sdk/permits";

export enum PortalModal {
  ExampleSelection = 'exampleSelection',
  ExampleInfo = 'exampleInfo',
  PermitDetails = 'permitDetails',
  PermitTypeExplanation = 'permitTypeExplanation',
}

export type PortalModalPropsMap = {
  [PortalModal.ExampleSelection]: { onSelect: (selectedItem: string) => void };
  [PortalModal.ExampleInfo]: void;
  [PortalModal.PermitDetails]: { hash: string };
  [PortalModal.PermitTypeExplanation]: { type: PermitType}
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
