export type AiChatTurn = {
  role: 'user' | 'assistant'
  text: string
}

export type AiChatRequest = {
  message: string
  history?: AiChatTurn[]
}

export type AiChatResponse = {
  message: string
  configured: boolean
}
