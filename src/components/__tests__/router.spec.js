import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { describe, it, expect } from 'vitest'

// Views, die über Routen erreichbar sind
import HomeView from '@/views/HomeView.vue'
import MyRecipesView from '@/views/MyRecipesView.vue'
import AboutView from '@/views/AboutView.vue'
import ContactView from '@/views/ContactView.vue'

// Test-Router mit denselben Routen wie in der App
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/my-recipes', component: MyRecipesView },
    { path: '/about', component: AboutView },
    { path: '/contact', component: ContactView },
  ],
})

describe('App routing', () => {
  it('renders Home with ApiRecipeList on /', async () => {
    // Zielroute setzen und warten, bis der Router bereit ist
    router.push('/')
    await router.isReady()
    // HomeView mit Router mounten
    const wrapper = mount(HomeView, {
      global: { plugins: [router] },
    })
    // Erwartung: Text aus der Home-Seite vorhanden
    expect(wrapper.html()).toContain('Discover dishes')
  })

  it('renders MyRecipesView on /my-recipes', async () => {
    router.push('/my-recipes')
    await router.isReady()
    const wrapper = mount(MyRecipesView, {
      global: { plugins: [router] },
    })
    // Erwartung: Text für My-Recipes-Seite sichtbar
    expect(wrapper.text()).toContain('Your personal Dishly cookbook')
  })

  it('renders AboutView on /about', async () => {
    router.push('/about')
    await router.isReady()
    const wrapper = mount(AboutView, {
      global: { plugins: [router] },
    })
    // Erwartung: Headline der About-Seite
    expect(wrapper.text()).toContain('The person behind Dishly')
  })

  it('renders ContactView on /contact', async () => {
    router.push('/contact')
    await router.isReady()
    const wrapper = mount(ContactView, {
      global: { plugins: [router] },
    })
    // Erwartung: E-Mail-Adresse aus der Contact-Seite
    expect(wrapper.text()).toContain('Dishly.Rezepte@gmx.de')
  })
})
