const DB_NAME = 'FitUpDB';
const STORE_NAME = 'images';
const DB_VERSION = 1;

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
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveData = async <T>(id: string, data: T): Promise<void> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id, data });

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error("Error saving data to IndexedDB:", request.error);
      reject(request.error);
    };
  });
};

export const loadData = async <T>(id: string): Promise<T | undefined> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result ? request.result.data : undefined);
    };
    request.onerror = () => {
      console.error("Error loading data from IndexedDB:", request.error);
      reject(request.error);
    };
  });
};
    
export const clearDB = async (): Promise<void> => {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error("Error clearing IndexedDB:", request.error);
            reject(request.error);
        };
    });
}
