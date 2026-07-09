describe('Pantry (guest)', () => {
  it('redirects unauthenticated visitors to the login page', () => {
    cy.visit('/pantry')
    cy.location('pathname').should('eq', '/login')
  })
})

describe('Pantry', () => {
  beforeEach(() => {
    cy.interceptBackend()
    cy.login()
  })

  it('lists existing pantry items after loading', () => {
    cy.visit('/pantry')
    cy.wait('@getPantryItems')

    cy.get('.pantry-item').should('have.length', 1)
    cy.get('.pantry-item').first().should('contain.text', 'Reis')
  })

  it('adds a new pantry item', () => {
    cy.intercept('POST', '**/pantry/items', req => {
      req.reply({
        statusCode: 201,
        body: {
          id: 302,
          name: req.body.name,
          quantity: req.body.quantity,
          unit: req.body.unit,
          category: null,
          createdAt: '2026-07-01T09:00:00Z',
          updatedAt: '2026-07-01T09:00:00Z',
        },
      })
    }).as('createPantryItem')

    cy.visit('/pantry')
    cy.wait('@getPantryItems')

    cy.get('.pantry-form input[type="text"]').first().type('Haferflocken')
    cy.get('.pantry-form input[type="number"]').type('500')
    cy.get('.pantry-form .submit-btn').click()

    cy.wait('@createPantryItem')
    cy.get('.pantry-item').should('have.length', 2)
    cy.get('.pantry-item').should('contain.text', 'Haferflocken')
  })

  it('edits an existing pantry item', () => {
    cy.intercept('PUT', '**/pantry/items/*', req => {
      req.reply({
        statusCode: 200,
        body: { ...req.body, id: 301, createdAt: '2026-07-01T08:00:00Z', updatedAt: '2026-07-01T09:00:00Z' },
      })
    }).as('updatePantryItem')

    cy.visit('/pantry')
    cy.wait('@getPantryItems')

    cy.get('.pantry-item').first().contains('button', 'Bearbeiten').click()
    cy.get('.edit-form input[type="text"]').first().clear()
    cy.get('.edit-form input[type="text"]').first().type('Basmatireis')
    cy.get('.edit-form').contains('button', 'Speichern').click()

    cy.wait('@updatePantryItem')
    cy.get('.pantry-item').first().should('contain.text', 'Basmatireis')
  })

  it('deletes a pantry item', () => {
    cy.intercept('DELETE', '**/pantry/items/*', { statusCode: 204 }).as('deletePantryItem')

    cy.visit('/pantry')
    cy.wait('@getPantryItems')

    cy.get('.pantry-item').first().contains('button', 'Löschen').click()
    cy.wait('@deletePantryItem')
    cy.get('.pantry-item').should('not.exist')
  })

  // The camera path (navigator.mediaDevices / ZXing) is not simulated here — Cypress
  // in headless Chrome has no real camera, and PantryView already shows a friendly
  // error in that case. Only the documented manual-barcode fallback is covered.
  it('looks up a product via the manual barcode fallback and adds it to the pantry', () => {
    cy.intercept('GET', 'https://world.openfoodfacts.org/api/v0/product/*.json', {
      statusCode: 200,
      body: {
        product: {
          product_name: 'Bio Vollkornreis',
          brands: 'Naturkost',
          image_front_url: '',
          categories_tags: ['en:rice'],
        },
      },
    }).as('lookupBarcode')

    cy.intercept('POST', '**/pantry/items', req => {
      req.reply({
        statusCode: 201,
        body: {
          id: 303,
          name: req.body.name,
          quantity: req.body.quantity,
          unit: req.body.unit,
          category: req.body.category,
          createdAt: '2026-07-01T09:00:00Z',
          updatedAt: '2026-07-01T09:00:00Z',
        },
      })
    }).as('addScannedProduct')

    cy.visit('/pantry')
    cy.wait('@getPantryItems')

    cy.get('.barcode-row input[type="text"]').type('4000417025005')
    cy.get('.barcode-row .submit-btn').click()

    cy.wait('@lookupBarcode')
    cy.get('.scanned-product').should('contain.text', 'Bio Vollkornreis')

    cy.get('.scanned-product').contains('button', 'Zum Vorrat hinzufügen').click()
    cy.wait('@addScannedProduct')
    cy.get('.pantry-item').should('contain.text', 'Bio Vollkornreis')
  })

  it('shows a friendly error when the barcode is not found', () => {
    cy.intercept('GET', 'https://world.openfoodfacts.org/api/v0/product/*.json', {
      statusCode: 200,
      body: { product: {} },
    }).as('lookupBarcodeNotFound')

    cy.visit('/pantry')
    cy.wait('@getPantryItems')

    cy.get('.barcode-row input[type="text"]').type('0000000000000')
    cy.get('.barcode-row .submit-btn').click()

    cy.wait('@lookupBarcodeNotFound')
    cy.get('.form-error').should('be.visible')
    cy.get('.scanned-product').should('not.exist')
  })
})
