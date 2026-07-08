import { describe, expect, it, vi } from 'vitest'
import { aiApi } from '@/shared/api/aiApi'
import { apiClient } from '@/shared/api/apiClient'

vi.mock('@/shared/api/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}))

describe('aiApi', () => {
  it('chat calls POST /ai/chat and returns the response', async () => {
    const request = {
      message: 'Was soll ich kochen?',
      history: [{ role: 'assistant' as const, text: 'Moechtest du (1) Details oder (2) Restaurant?' }],
    }
    const response = { message: 'Koche Pasta.', configured: true }
    vi.mocked(apiClient.post).mockResolvedValue({ data: response })

    const result = await aiApi.chat(request)

    expect(apiClient.post).toHaveBeenCalledWith('/ai/chat', request)
    expect(result).toEqual(response)
  })
})
