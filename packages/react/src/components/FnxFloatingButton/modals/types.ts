export enum PortalModal {
  ExampleSelection = 'exampleSelection',
  ExampleInfo = 'exampleInfo',
}

export type PortalModalPropsMap = {
  [PortalModal.ExampleSelection]: { onSelect: (selectedItem: string) => void };
  [PortalModal.ExampleInfo]: void;
};
export type PortalModalPropsMapWithOnClose = {
  [M in PortalModal]: PortalModalPropsMap[M] extends void
    ? { onClose: () => void }
    : { onClose: () => void } & PortalModalPropsMap[M];
};

export type PortalModalsWithProps = {
  [M in PortalModal]: PortalModalPropsMap[M] extends void ? never : M;
}[PortalModal];

export type PortalModalsWithoutProps = {
  [M in PortalModal]: PortalModalPropsMap[M] extends void ? M : never;
}[PortalModal];

export type PortalModalState<T extends keyof PortalModalPropsMap = PortalModal> = {
  modal: T;
  props?: PortalModalPropsMap[T];
};

export type OpenPortalModalFn = <M extends PortalModal>(
  ...args: PortalModalPropsMap[M] extends void ? [modal: M] : [modal: M, props: PortalModalPropsMap[M]]
) => void;
