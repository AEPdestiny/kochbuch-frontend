import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AiChatView from '@/views/AiChatView.vue'
import { aiApi } from '@/shared/api/aiApi'

vi.mock('@/shared/api/aiApi', () => ({
  aiApi: {
    chat: vi.fn(),
  },
}))

describe('AiChatView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends user message and renders assistant answer', async () => {
    vi.mocked(aiApi.chat).mockResolvedValue({ message: 'Plane mehr Gemüse ein.', configured: true })
    const wrapper = mount(AiChatView)

    await wrapper.find('textarea').setValue('Wie sieht mein Wochenplan aus?')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(aiApi.chat).toHaveBeenCalledWith({ message: 'Wie sieht mein Wochenplan aus?' })
    expect(wrapper.text()).toContain('Wie sieht mein Wochenplan aus?')
    expect(wrapper.text()).toContain('Plane mehr Gemüse ein.')
  })

  it('shows validation message for empty input', async () => {
    const wrapper = mount(AiChatView)

    await wrapper.find('form').trigger('submit.prevent')

    expect(aiApi.chat).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte gib eine Frage ein.')
  })
})
