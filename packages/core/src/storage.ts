// Storage interface
/* eslint-disable no-unused-vars */
export interface IStorage {
  getItem: (name: string) => Promise<any>;
  setItem: (name: string, value: any) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
}
/* eslint-enable no-unused-vars */
