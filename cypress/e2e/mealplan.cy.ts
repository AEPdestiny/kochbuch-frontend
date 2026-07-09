describe('Meal plan', () => {
  beforeEach(() => {
    cy.interceptBackend()
    cy.login()
  })

  it('shows all 7 days with their meal slots after loading the week', () => {
    cy.visit('/meal-plan')
    cy.wait('@getWeek')

    cy.get('.day-card').should('have.length', 7)
    cy.get('.day-card').first().within(() => {
      cy.get('.slot-block').should('have.length', 4)
    })
  })

  it('plans a recipe as free text into an empty slot', () => {
    cy.intercept('PUT', '**/meal-plan/days/*/slots/*', req => {
      req.reply({
        statusCode: 200,
        body: {
          id: 999,
          plannedDate: '2026-07-06',
          mealSlot: 'breakfast',
          recipe: null,
          customTitle: req.body.customTitle,
          calories: null,
        },
      })
    }).as('saveSlot')

    cy.visit('/meal-plan')
    cy.wait('@getWeek')

    cy.get('.day-card').first().within(() => {
      cy.get('.slot-block').first().find('.slot-empty-trigger').click()
    })

    cy.get('.slot-modal').should('be.visible')
    cy.get('.slot-modal .recipe-select input[type="text"]').first().type('Porridge')
    cy.get('.slot-modal').contains('button', /^(Rezept planen|Speichern)$/).click()

    cy.wait('@saveSlot')
    cy.get('.slot-modal').should('not.exist')
    cy.get('.day-card').first().within(() => {
      cy.get('.slot-block').first().find('.planned-recipe').should('contain.text', 'Porridge')
    })
  })

  it('removes a planned recipe from a slot', () => {
    cy.intercept('GET', '**/meal-plan/week*', {
      statusCode: 200,
      body: {
        weekStart: '2026-07-06',
        weekEnd: '2026-07-12',
        entries: [
          {
            id: 555,
            plannedDate: '2026-07-06',
            mealSlot: 'breakfast',
            recipe: null,
            customTitle: 'Müsli',
            calories: 300,
          },
        ],
      },
    }).as('getWeekWithEntry')
    cy.intercept('DELETE', '**/meal-plan/days/*/slots/*', { statusCode: 204 }).as('deleteSlot')

    cy.visit('/meal-plan')
    cy.wait('@getWeekWithEntry')

    cy.get('.day-card').first().within(() => {
      cy.get('.planned-recipe').should('contain.text', 'Müsli')
      cy.contains('button', 'Entfernen').click()
    })

    cy.wait('@deleteSlot')
    cy.get('.day-card').first().within(() => {
      cy.get('.planned-recipe').should('not.exist')
      cy.get('.slot-empty-trigger').should('be.visible')
    })
  })

  it('switches between manual and swipe planning modes', () => {
    cy.visit('/meal-plan')
    cy.wait('@getWeek')

    cy.get('.week-days-row').should('be.visible')
    cy.get('.mode-switch').contains('button', /Swipe/i).click()
    cy.get('.week-days-row').should('not.exist')

    cy.get('.mode-switch').contains('button', /Manuell/i).click()
    cy.get('.week-days-row').should('be.visible')
  })
})
