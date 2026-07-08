import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { routeLocationKey } from 'vue-router'
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

  function mountAiChatView(path = '/ai') {
    const route = reactive({ path })
    const wrapper = mount(AiChatView, {
      global: {
        provide: {
          [routeLocationKey as symbol]: route,
        },
      },
    })
    return { wrapper, route }
  }

  it('sends user message and renders assistant answer', async () => {
    vi.mocked(aiApi.chat).mockResolvedValue({ message: 'Plane mehr Gemuese ein.', configured: true })
    const { wrapper } = mountAiChatView()

    await wrapper.find('textarea').setValue('Wie sieht mein Wochenplan aus?')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(aiApi.chat).toHaveBeenCalledWith({ message: 'Wie sieht mein Wochenplan aus?' })
    expect(wrapper.text()).toContain('Wie sieht mein Wochenplan aus?')
    expect(wrapper.text()).toContain('Plane mehr Gemuese ein.')
  })

  it('shows validation message for empty input', async () => {
    const { wrapper } = mountAiChatView()

    await wrapper.find('form').trigger('submit.prevent')

    expect(aiApi.chat).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte gib eine Frage ein.')
  })

  it('resets the chat when the reset button is clicked', async () => {
    vi.mocked(aiApi.chat).mockResolvedValue({ message: 'Plane mehr Gemuese ein.', configured: true })
    const { wrapper } = mountAiChatView()

    await wrapper.find('textarea').setValue('Wie sieht mein Wochenplan aus?')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    await wrapper.find('.chat-reset-btn').trigger('click')

    expect(wrapper.text()).not.toContain('Wie sieht mein Wochenplan aus?')
    expect(wrapper.text()).not.toContain('Plane mehr Gemuese ein.')
    expect(wrapper.text()).toContain('Frag Dishly AI')
  })

  it('resets the chat when the route path changes', async () => {
    vi.mocked(aiApi.chat).mockResolvedValue({ message: 'Plane mehr Gemuese ein.', configured: true })
    const { wrapper, route } = mountAiChatView('/ai')

    await wrapper.find('textarea').setValue('Wie sieht mein Wochenplan aus?')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    route.path = '/meal-plan'
    await nextTick()

    expect(wrapper.text()).not.toContain('Wie sieht mein Wochenplan aus?')
    expect(wrapper.text()).not.toContain('Plane mehr Gemuese ein.')
    expect(wrapper.text()).toContain('Frag Dishly AI')
  })
})
