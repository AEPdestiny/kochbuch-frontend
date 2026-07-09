/// <reference types="cypress" />

// sessionStorage keys used by the app - kept in sync with
// src/shared/api/apiClient.ts (AUTH_TOKEN_STORAGE_KEY / AUTH_USER_STORAGE_KEY).
const AUTH_TOKEN_STORAGE_KEY = 'dishly.auth.token'
const AUTH_USER_STORAGE_KEY = 'dishly.auth.user'

const CURRENT_USER = {
  id: 1,
  username: 'e2euser',
  email: 'e2e@dishly.test',
  role: 'USER',
  createdAt: '2026-01-01T00:00:00Z',
}

/**
 * Logs a user in by writing directly to sessionStorage (via the fixture named
 * `fixtureName`, default 'user'), instead of driving the login form. Used by every
 * spec that needs an authenticated session but isn't itself testing the login flow -
 * keeps those specs fast and independent of the login UI.
 */
Cypress.Commands.add('login', (fixtureName = 'user') => {
  cy.visit('/')
  cy.fixture(fixtureName).then(auth => {
    cy.window().then(win => {
      win.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, auth.accessToken)
      win.sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(auth.user))
    })
  })
})

/**
 * Registers the standard set of backend GET intercepts with neutral/empty responses
 * so that any authenticated page can mount without unhandled network calls. Individual
 * tests can still override a specific route afterwards for the behavior they're testing.
 */
Cypress.Commands.add('interceptBackend', () => {
  cy.intercept('GET', '**/auth/me', { statusCode: 200, body: CURRENT_USER }).as('me')
  cy.intercept('GET', '**/meal-plan/week*', { fixture: 'mealPlanWeek.json' }).as('getWeek')
  cy.intercept('GET', '**/pantry/items', { fixture: 'pantryItems.json' }).as('getPantryItems')
  cy.intercept('GET', '**/shopping-list/items', { fixture: 'shoppingListItems.json' }).as(
    'getShoppingListItems',
  )
  cy.intercept('GET', '**/recipes/published*', { fixture: 'recipes.json' }).as('getPublishedRecipes')
  cy.intercept('GET', '**/recipes/external*', { statusCode: 200, body: [] }).as('getExternalRecipes')
  cy.intercept('GET', '**/recipes/mine', { fixture: 'recipes.json' }).as('getMyRecipes')
  cy.intercept('GET', '**/favorites/external', { fixture: 'favorites.json' }).as('getFavorites')
  cy.intercept('GET', '**/profile/preferences', { fixture: 'preferences.json' }).as('getPreferences')
})

declare global {
  // Cypress custom commands are extended through declaration merging on this namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Authenticates by writing a fixture-backed token/user directly into sessionStorage. */
      login(fixtureName?: string): Chainable<void>
      /** Registers neutral GET intercepts for every backend resource a logged-in page may load. */
      interceptBackend(): Chainable<void>
    }
  }
}

export {}
