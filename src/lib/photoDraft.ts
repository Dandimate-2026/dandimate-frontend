import { getMe } from './auth'

export interface LocalPhotoDraft { id: string; file: File; recording?: { blob: Blob; durationMs: number } }

const memory = new Map<string, LocalPhotoDraft[]>()
let database: Promise<IDBDatabase> | undefined
function open() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('duruduru-photo-drafts', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('rooms')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return database
}
export async function readPhotoDraft(roomId: string): Promise<LocalPhotoDraft[]> {
  const user = await getMe().catch(() => null)
  if (!user) return []
  const storageKey = `${user.id}:${roomId}`
  if (memory.has(storageKey)) return memory.get(storageKey)!
  try {
    const db = await open()
    const items = await new Promise<LocalPhotoDraft[]>((resolve, reject) => {
      const request = db.transaction('rooms').objectStore('rooms').get(storageKey)
      request.onsuccess = () => resolve(request.result ?? [])
      request.onerror = () => reject(request.error)
    })
    if (!memory.has(storageKey)) memory.set(storageKey, items)
    return memory.get(storageKey)!
  } catch { return memory.get(storageKey) ?? [] }
}
export async function savePhotoDraft(roomId: string, items: LocalPhotoDraft[]) {
  const user = await getMe().catch(() => null)
  if (!user) return
  const storageKey = `${user.id}:${roomId}`
  const previous = memory.get(storageKey) ?? []
  items = items.map(item => ({ ...previous.find(old => old.id === item.id), ...item }))
  memory.set(storageKey, items)
  try {
    const db = await open()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('rooms', 'readwrite')
      transaction.objectStore('rooms').put(items, storageKey)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } catch { /* Memory still preserves the draft while this app remains open. */ }
}
export async function removePhotoDraft(roomId: string, id: string) {
  const items = await readPhotoDraft(roomId)
  await savePhotoDraft(roomId, items.filter(item => item.id !== id))
}

export async function saveRecordingDraft(roomId: string, id: string, recording?: { blob: Blob; durationMs: number }) {
  const items = await readPhotoDraft(roomId)
  await savePhotoDraft(roomId, items.map(item => item.id === id ? { ...item, recording } : item))
}

/** Remove only this account's cached files after account deletion succeeds. */
export async function clearAccountPhotoDrafts(userId: string) {
  const prefix = `${userId}:`
  for (const key of memory.keys()) if (key.startsWith(prefix)) memory.delete(key)
  try {
    const db = await open()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('rooms', 'readwrite')
      const cursor = transaction.objectStore('rooms').openCursor()
      cursor.onsuccess = () => { const item = cursor.result; if (!item) return; if (String(item.key).startsWith(prefix)) item.delete(); item.continue() }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } catch { /* A blocked local database must not prevent logout after successful deletion. */ }
}
