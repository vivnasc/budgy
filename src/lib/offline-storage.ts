/**
 * IndexedDB-based offline storage for BUDGY.
 * Stores transactions, accounts, and other data locally for offline access.
 * Syncs with Supabase when back online.
 */

const DB_NAME = "budgy-offline";
const DB_VERSION = 1;

const STORES = {
  transactions: "transactions",
  accounts: "accounts",
  pendingSync: "pending_sync",
} as const;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORES.transactions)) {
        const txStore = db.createObjectStore(STORES.transactions, { keyPath: "id" });
        txStore.createIndex("date", "date", { unique: false });
        txStore.createIndex("type", "type", { unique: false });
        txStore.createIndex("user_id", "user_id", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.accounts)) {
        db.createObjectStore(STORES.accounts, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORES.pendingSync)) {
        const syncStore = db.createObjectStore(STORES.pendingSync, { keyPath: "id", autoIncrement: true });
        syncStore.createIndex("created_at", "created_at", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Generic CRUD ───────────────────────────────────────────────────────────

async function putAll<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);

  for (const item of items) {
    store.put(item);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  store.clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const offlineStorage = {
  // Cache transactions from Supabase for offline reading
  async cacheTransactions(transactions: Array<{ id: string; [key: string]: unknown }>) {
    await putAll(STORES.transactions, transactions as Array<{ id: string }>);
  },

  async getCachedTransactions() {
    return getAll(STORES.transactions);
  },

  // Cache accounts
  async cacheAccounts(accounts: Array<{ id: string; [key: string]: unknown }>) {
    await putAll(STORES.accounts, accounts as Array<{ id: string }>);
  },

  async getCachedAccounts() {
    return getAll(STORES.accounts);
  },

  // Queue a transaction for syncing when back online
  async queueForSync(action: "create" | "update" | "delete", table: string, data: unknown) {
    const db = await openDB();
    const tx = db.transaction(STORES.pendingSync, "readwrite");
    const store = tx.objectStore(STORES.pendingSync);
    store.add({
      action,
      table,
      data,
      created_at: new Date().toISOString(),
    });

    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getPendingSyncItems(): Promise<Array<{ id: number; action: string; table: string; data: unknown; created_at: string }>> {
    return getAll(STORES.pendingSync);
  },

  async clearPendingSync() {
    await clearStore(STORES.pendingSync);
  },

  async removePendingSyncItem(id: number) {
    const db = await openDB();
    const tx = db.transaction(STORES.pendingSync, "readwrite");
    const store = tx.objectStore(STORES.pendingSync);
    store.delete(id);

    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

// ─── Sync Manager ───────────────────────────────────────────────────────────

export async function syncPendingItems(): Promise<{ synced: number; failed: number }> {
  const items = await offlineStorage.getPendingSyncItems();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    try {
      if (item.action === "create" && item.table === "transactions") {
        const response = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transaction: item.data }),
        });

        if (response.ok) {
          await offlineStorage.removePendingSyncItem(item.id);
          synced++;
        } else {
          failed++;
        }
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}
