/* eslint-disable no-redeclare */
import { type EncryptableItem, isEncryptableItem, type EncryptedItemInput, type EncryptedItemInputs } from '../types.js';

export function encryptExtract<T>(item: T): EncryptableItem[];
export function encryptExtract<T extends any[]>(item: [...T]): EncryptableItem[];
export function encryptExtract<T>(item: T) {
  if (isEncryptableItem(item)) {
    return item;
  }

  // Object | Array
  if (typeof item === 'object' && item !== null) {
    if (Array.isArray(item)) {
      // Array - recurse
      return item.flatMap((nestedItem) => encryptExtract(nestedItem));
    } else {
      // Object - recurse
      return Object.values(item).flatMap((value) => encryptExtract(value));
    }
  }

  return [];
}

export function encryptReplace<T>(
  item: T,
  encryptedItems: EncryptedItemInput[]
): [EncryptedItemInputs<T>, EncryptedItemInput[]];
export function encryptReplace<T extends any[]>(
  item: [...T],
  encryptedItems: EncryptedItemInput[]
): [...EncryptedItemInputs<T>, EncryptedItemInput[]];
export function encryptReplace<T>(item: T, encryptedItems: EncryptedItemInput[]) {
  if (isEncryptableItem(item)) {
    return [encryptedItems[0], encryptedItems.slice(1)];
  }

  // Object | Array
  if (typeof item === 'object' && item !== null) {
    if (Array.isArray(item)) {
      // Array - recurse
      return item.reduce<[any[], EncryptedItemInput[]]>(
        ([acc, remaining], item) => {
          const [newItem, newRemaining] = encryptReplace(item, remaining);
          return [[...acc, newItem], newRemaining];
        },
        [[], encryptedItems]
      );
    } else {
      // Object - recurse
      return Object.entries(item).reduce<[Record<string, any>, EncryptedItemInput[]]>(
        ([acc, remaining], [key, value]) => {
          const [newValue, newRemaining] = encryptReplace(value, remaining);
          return [{ ...acc, [key]: newValue }, newRemaining];
        },
        [{}, encryptedItems]
      );
    }
  }

  return [item, encryptedItems];
}
