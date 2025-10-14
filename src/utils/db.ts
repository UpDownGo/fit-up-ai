import { HistoryItem } from "../types";

const DB_NAME = 'FitUpDB';
const SESSION_STORE_NAME = 'session';
const HISTORY_STORE_NAME = 'history';
const DB_VERSION = 2; // Version incremented to trigger schema upgrade

let dbInstance: IDBDatabase | null = null;

const getDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject("IndexedDB error");
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // Create session store if it doesn't exist
      if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
        db.createObjectStore(SESSION_STORE_NAME, { keyPath: 'id' });
      }
      // Create history store if it doesn't exist
      if (!db.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        db.createObjectStore(HISTORY_STORE_NAME, { keyPath: 'id' });
      }
      // Clean up old store from version 1
      if (db.objectStoreNames.contains('images')) {
          db.deleteObjectStore('images');
      }
    };
  });
};

const makeRequest = <T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest | IDBRequest<IDBValidKey[]>): Promise<T> => {
    return new Promise(async (resolve, reject) => {
        const db = await getDb();
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = action(store);

        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => {
            console.error(`Error performing action on ${storeName}:`, request.error);
            reject(request.error);
        }
    });
}

// Session Management
export const saveSession = (data: any): Promise<any> => makeRequest(SESSION_STORE_NAME, 'readwrite', store => store.put({ id: 'currentSession', data }));
export const loadSession = async (): Promise<any | undefined> => {
    const result = await makeRequest<any>(SESSION_STORE_NAME, 'readonly', store => store.get('currentSession'));
    return result ? result.data : undefined;
};
export const clearSession = (): Promise<any> => makeRequest(SESSION_STORE_NAME, 'readwrite', store => store.clear());

// History Management
export const saveHistoryItem = (item: HistoryItem): Promise<any> => makeRequest(HISTORY_STORE_NAME, 'readwrite', store => store.put(item));
export const loadAllHistoryItems = (): Promise<HistoryItem[]> => makeRequest<HistoryItem[]>(HISTORY_STORE_NAME, 'readonly', store => store.getAll()).then(items => items.sort((a, b) => b.id.localeCompare(a.id)));
export const clearHistory = (): Promise<any> => makeRequest(HISTORY_STORE_NAME, 'readwrite', store => store.clear());