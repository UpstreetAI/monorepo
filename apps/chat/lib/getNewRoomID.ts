import type { RoomID } from '@/types'

export function getNewRoomID(): RoomID {
  return crypto.randomUUID()
}
