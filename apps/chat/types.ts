export type UUID = ReturnType<typeof crypto.randomUUID>
export type RoomID = UUID


export type Component = {
  id: UUID
  components?: Component[]
  enabled: boolean
  name: string
}

export type Message<T = any> = {
  args: {[key in string]: any }
  method: string
  name: string
  timestamp: number
  userId: UUID
} & T
