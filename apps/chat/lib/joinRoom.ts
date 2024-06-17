import { getNewRoomID } from '@/lib/getNewRoomID'
import { routes } from '@/routes'


export function joinRoom(roomID = getNewRoomID()) {
  location.href = `/${routes.rooms}/${crypto.randomUUID()}`;
}
