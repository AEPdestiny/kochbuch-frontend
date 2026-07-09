describe('Home / recipe discovery', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/recipes/published*', { fixture: 'recipes.json' }).as('getPublishedRecipes')
    cy.intercept('GET', '**/recipes/external*', { statusCode: 200, body: [] }).as('getExternalRecipes')
  })

  it('loads the home page with search and filter controls', () => {
    cy.visit('/')
    cy.wait('@getPublishedRecipes')

    cy.get('.search-input').should('be.visible')
    cy.get('.filter-trigger').should('be.visible')
    cy.get('.filter-panel').should('not.exist')
    cy.get('.recipe-card').should('have.length', 2)
  })

  it('shows recipe cards from the published recipes response', () => {
    cy.visit('/')
    cy.wait('@getPublishedRecipes')

    cy.get('.card-title').should('contain.text', 'Spaghetti Carbonara')
    cy.get('.card-title').should('contain.text', 'Veganes Curry')
  })

  it('opens the filter drawer and filters recipes by the vegan checkbox', () => {
    cy.visit('/')
    cy.wait('@getPublishedRecipes')

    cy.get('.filter-trigger').click()
    cy.get('.filter-panel').should('be.visible')

    // Checkbox order in the drawer: vegan, vegetarian, glutenFree, lactoseFree, calorieConscious, highProtein.
    cy.get('.filter-panel input[type="checkbox"]').eq(0).check({ force: true })

    cy.get('.card-title').should('have.length', 1)
    cy.get('.card-title').should('contain.text', 'Veganes Curry')
  })

  it('filters recipes by the search input', () => {
    cy.visit('/')
    cy.wait('@getPublishedRecipes')

    cy.get('.search-input').type('Curry')
    cy.wait('@getPublishedRecipes')
    cy.get('.card-title').should('have.length', 1)
    cy.get('.card-title').should('contain.text', 'Veganes Curry')
  })

  it('shows an empty result state when no recipes are returned', () => {
    cy.intercept('GET', '**/recipes/published*', { statusCode: 200, body: [] }).as('getPublishedRecipesEmpty')

    cy.visit('/')
    cy.wait('@getPublishedRecipesEmpty')

    cy.get('.card-title').should('not.exist')
    cy.get('.status-text').should('be.visible').and('not.be.empty')
  })
})
