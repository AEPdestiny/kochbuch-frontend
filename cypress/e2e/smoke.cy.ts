// Basic smoke tests for the app's core routes and its auth guard.
//
// `npm run test:e2e` serves the production build (vite preview) against the real
// configured backend (see .env.production), so these deliberately assert only on
// static markup and client-side routing — never on data that requires a live backend
// call to succeed — so the suite stays stable regardless of backend availability/latency.
describe('App smoke tests', () => {
  it('loads the home page with its search UI', () => {
    cy.visit('/')
    cy.get('.search-input').should('be.visible')
    cy.get('.filter-panel').should('exist')
  })

  it('loads the login page with its form fields', () => {
    cy.visit('/login')
    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('be.visible')
  })

  it('redirects an unauthenticated visitor from the dashboard to the login page', () => {
    cy.visit('/dashboard')
    cy.location('pathname').should('eq', '/login')
  })

  it('redirects an unauthenticated visitor from pantry/shopping-list/meal-plan to the login page', () => {
    for (const path of ['/pantry', '/shopping-list', '/meal-plan']) {
      cy.visit(path)
      cy.location('pathname').should('eq', '/login')
    }
  })
})
