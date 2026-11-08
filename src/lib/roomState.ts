import type { RoomStatus } from '../api/types'

/** Original records are editable only before weaving starts. */
export const canEditRoomRecords = (status: RoomStatus | undefined) =>
  status === 'COLLECTING' || status === 'CIRCULATING'
