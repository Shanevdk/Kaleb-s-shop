export type ScreenSaverImage = {
    id: string;
    name: string;
    addedAt: number;
};

type StoredImage = ScreenSaverImage & { blob: Blob };

const databaseName = 'screen-saver';
const storeName = 'images';
const databaseVersion = 1;
const listeners = new Set<() => void>();

let database: Promise<IDBDatabase> | null = null;

/**
 * Open (and lazily create) the device's local store of screen-saver photos.
 * Images never leave the device, so they live in IndexedDB, not the server.
 */
function open(): Promise<IDBDatabase> {
    database ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, databaseVersion);

        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(storeName)) {
                request.result.createObjectStore(storeName, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error as Error);
    });

    return database;
}

function notify(): void {
    listeners.forEach((listener) => listener());
}

export function subscribeScreenSaverImages(callback: () => void): () => void {
    listeners.add(callback);

    return () => listeners.delete(callback);
}

export async function listScreenSaverImages(): Promise<ScreenSaverImage[]> {
    const db = await open();

    return new Promise((resolve, reject) => {
        const request = db
            .transaction(storeName, 'readonly')
            .objectStore(storeName)
            .getAll();

        request.onsuccess = () => {
            const rows = request.result as StoredImage[];

            resolve(
                rows
                    .map(({ id, name, addedAt }) => ({ id, name, addedAt }))
                    .sort((a, b) => a.addedAt - b.addedAt),
            );
        };
        request.onerror = () => reject(request.error as Error);
    });
}

export async function getScreenSaverImageBlob(
    id: string,
): Promise<Blob | null> {
    const db = await open();

    return new Promise((resolve, reject) => {
        const request = db
            .transaction(storeName, 'readonly')
            .objectStore(storeName)
            .get(id);

        request.onsuccess = () => {
            const row = request.result as StoredImage | undefined;
            resolve(row?.blob ?? null);
        };
        request.onerror = () => reject(request.error as Error);
    });
}

export async function addScreenSaverImage(file: File): Promise<void> {
    const db = await open();
    const image: StoredImage = {
        id: crypto.randomUUID(),
        name: file.name,
        addedAt: Date.now(),
        blob: file,
    };

    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(image);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as Error);
    });

    notify();
}

export async function removeScreenSaverImage(id: string): Promise<void> {
    const db = await open();

    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as Error);
    });

    notify();
}
