export type UUID = ReturnType<typeof crypto.randomUUID>
export type RoomID = UUID


export type Component = {
  components?: Component[]
  enabled: boolean
  name: string
}

export type Message<T> = {
  args: {[key in string]: any }
  method: string
  name: string
  timestamp: number
  userId: string
} & T
