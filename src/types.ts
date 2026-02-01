export type Side = 'pro' | 'con'

export type DebateMessage = {
  id: string
  side: Side
  round: number
  content: string
  reasoning?: string
  createdAt: number
}

export type DebateSession = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: DebateMessage[]
}
