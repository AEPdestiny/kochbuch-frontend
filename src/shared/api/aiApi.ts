import { apiClient } from './apiClient'
import type { AiChatRequest, AiChatResponse } from '@/types/ai'

export const aiApi = {
  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const response = await apiClient.post<AiChatResponse>('/ai/chat', request)
    return response.data
  },
}
