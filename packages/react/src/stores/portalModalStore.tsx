import type {
  OpenPortalModalFn,
  PortalModal,
  PortalModalPropsMap,
  PortalModalState,
} from '@/components/FnxFloatingButton/modals/types';
import { create } from 'zustand';

type PortalModalStore = {
  modalStack: PortalModalState[];
};

type PortalModalActions = {
  openModal: OpenPortalModalFn;
  closeModal: (modal: PortalModal) => void;
};

export const usePortalModals = create<PortalModalStore & PortalModalActions>()((set, get) => ({
  modalStack: [],

  openModal: <M extends PortalModal>(
    ...args: PortalModalPropsMap[M] extends void ? [modal: M] : [modal: M, props: PortalModalPropsMap[M]]
  ) => {
    const [modal, props] = args;
    const onClose = () => get().closeModal(modal);
    const state: PortalModalState<M> & { onClose: () => void } = props ? { modal, props, onClose } : { modal, onClose };
    set({ modalStack: [...get().modalStack, state] });
  },
  closeModal: (modal) => {
    set({ modalStack: get().modalStack.filter((m) => m.modal !== modal) });
  },
}));
