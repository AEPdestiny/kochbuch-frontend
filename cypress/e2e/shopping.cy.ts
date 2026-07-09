describe('Shopping list (guest)', () => {
  it('redirects unauthenticated visitors to the login page', () => {
    cy.visit('/shopping-list')
    cy.location('pathname').should('eq', '/login')
  })
})

describe('Shopping list', () => {
  beforeEach(() => {
    cy.interceptBackend()
    cy.login()
  })

  it('lists existing shopping list items after loading', () => {
    cy.visit('/shopping-list')
    cy.wait('@getShoppingListItems')

    cy.get('.shopping-item').should('have.length', 1)
    cy.get('.shopping-item').first().should('contain.text', 'Tomaten')
  })

  it('adds a new item to the shopping list', () => {
    cy.intercept('POST', '**/shopping-list/items', req => {
      req.reply({
        statusCode: 201,
        body: {
          id: 202,
          name: req.body.name,
          quantity: req.body.quantity,
          unit: req.body.unit,
          category: null,
          checked: false,
          recipeId: null,
          recipeTitle: null,
          createdAt: '2026-07-01T09:00:00Z',
          updatedAt: '2026-07-01T09:00:00Z',
        },
      })
    }).as('createItem')

    cy.visit('/shopping-list')
    cy.wait('@getShoppingListItems')

    cy.get('.shopping-list-form input[type="text"]').first().type('Zwiebeln')
    cy.get('.shopping-list-form input[type="number"]').type('2')
    cy.get('.shopping-list-form .submit-btn').click()

    cy.wait('@createItem')
    cy.get('.shopping-item').should('have.length', 2)
    cy.get('.shopping-item').should('contain.text', 'Zwiebeln')
  })

  it('toggles an item as checked', () => {
    cy.intercept('PUT', '**/shopping-list/items/*', req => {
      req.reply({
        statusCode: 200,
        body: { ...req.body, id: 201, createdAt: '2026-07-01T08:00:00Z', updatedAt: '2026-07-01T09:00:00Z' },
      })
    }).as('updateItem')

    cy.visit('/shopping-list')
    cy.wait('@getShoppingListItems')

    cy.get('.shopping-item').first().find('.item-check input').check({ force: true })
    cy.wait('@updateItem')
    cy.get('.shopping-item').first().should('have.class', 'checked')
  })

  it('edits an existing item', () => {
    cy.intercept('PUT', '**/shopping-list/items/*', req => {
      req.reply({
        statusCode: 200,
        body: { ...req.body, id: 201, createdAt: '2026-07-01T08:00:00Z', updatedAt: '2026-07-01T09:00:00Z' },
      })
    }).as('updateItem')

    cy.visit('/shopping-list')
    cy.wait('@getShoppingListItems')

    cy.get('.shopping-item').first().contains('button', 'Bearbeiten').click()
    cy.get('.edit-form input[type="text"]').first().clear()
    cy.get('.edit-form input[type="text"]').first().type('Kirschtomaten')
    cy.get('.edit-form').contains('button', 'Speichern').click()

    cy.wait('@updateItem')
    cy.get('.shopping-item').first().should('contain.text', 'Kirschtomaten')
  })

  it('deletes an item from the list', () => {
    cy.intercept('DELETE', '**/shopping-list/items/*', { statusCode: 204 }).as('deleteItem')

    cy.visit('/shopping-list')
    cy.wait('@getShoppingListItems')

    cy.get('.shopping-item').first().contains('button', 'Löschen').click()
    cy.wait('@deleteItem')
    cy.get('.shopping-item').should('not.exist')
  })
})
