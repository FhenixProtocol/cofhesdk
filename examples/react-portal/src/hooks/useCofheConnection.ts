import { useSyncExternalStore } from 'react';
import { cofheSdkClient } from '../utils/cofhe.config';

// sync core store
const subscribeToConnection = (onStoreChange: () => void) => {
  return cofheSdkClient.subscribe(() => {
    onStoreChange();
  });
};
const getConnectionSnapshot = () => cofheSdkClient.getSnapshot();

export const useCofheConnection = () =>
  useSyncExternalStore(subscribeToConnection, getConnectionSnapshot, getConnectionSnapshot);
