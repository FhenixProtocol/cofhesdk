import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

type SnapshotSelector<Snapshot, Selection> = (snapshot: Snapshot) => Selection;
type SnapshotEquality<Selection> = (a: Selection, b: Selection) => boolean;

export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: undefined | null | (() => Snapshot),
  selector: SnapshotSelector<Snapshot, Selection>,
  isEqual: SnapshotEquality<Selection> = Object.is
): Selection {
  const instanceRef = useRef<{
    hasValue: boolean;
    value: Selection | null;
  }>({ hasValue: false, value: null });

  const [getSelection, getServerSelection] = useMemo(() => {
    let hasMemo = false;
    let memoizedSnapshot: Snapshot;
    let memoizedSelection: Selection;

    const memoizedSelector = (nextSnapshot: Snapshot) => {
      if (!hasMemo) {
        hasMemo = true;
        memoizedSnapshot = nextSnapshot;
        const nextSelection = selector(nextSnapshot);

        if (instanceRef.current.hasValue && isEqual(instanceRef.current.value as Selection, nextSelection)) {
          memoizedSelection = instanceRef.current.value as Selection;
          return memoizedSelection;
        }

        memoizedSelection = nextSelection;
        return nextSelection;
      }

      if (Object.is(memoizedSnapshot, nextSnapshot)) {
        return memoizedSelection;
      }

      const nextSelection = selector(nextSnapshot);
      if (isEqual(memoizedSelection, nextSelection)) {
        memoizedSnapshot = nextSnapshot;
        return memoizedSelection;
      }

      memoizedSnapshot = nextSnapshot;
      memoizedSelection = nextSelection;
      return nextSelection;
    };

    const getSnapshotWithSelector = () => memoizedSelector(getSnapshot());
    const getServerSnapshotWithSelector =
      getServerSnapshot == null ? undefined : () => memoizedSelector(getServerSnapshot());

    return [getSnapshotWithSelector, getServerSnapshotWithSelector] as const;
  }, [getSnapshot, getServerSnapshot, selector, isEqual]);

  const value = useSyncExternalStore(subscribe, getSelection, getServerSelection);

  useEffect(() => {
    instanceRef.current.hasValue = true;
    instanceRef.current.value = value;
  }, [value]);

  return value;
}
