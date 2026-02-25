// components/chat/types.ts
export type ChatInputMode = 'go' | 'show' | 'general' | 'info' | 'translate' | 'free'

export type ChipPick = { id?: string; label?: string } | null

export type ChatInputPayload = {
  mode: ChatInputMode
  text: string
  from?: string
  to?: string
  fromPick?: ChipPick
  toPick?: ChipPick
  files?: File[]
}
