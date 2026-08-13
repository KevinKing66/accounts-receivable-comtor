import { LitElement, html } from 'lit'
import { Session, Privilege } from '../../session/session'
import '../layout/app-header'
import '../layout/app-sidebar'
import '../payments/payment-management'
import '../layout/app-footer'
import { Router } from '@vaadin/router'

export class PaymentsView extends LitElement {
  static properties = {
    identity: { type: String },
    privileges: { type: Array },
  }

  declare identity: string
  declare privileges: Privilege[]

  constructor() {
    super()
    const session = Session.getInstance()
    this.identity = session.identity ?? ''
    this.privileges = session.privileges
  }

  createRenderRoot() {
    return this
  }

  connectedCallback() {
    super.connectedCallback()
    document.title = 'Gestión de Pagos - Hello World'
    if (!Session.getInstance().isAuthenticated()) {
      Router.go('/login')
    }
  }

  render() {
    return html`
      <div class="flex flex-col min-h-screen w-full">
        <app-header
          .identity=${this.identity}
          pageTitle="Gestión de Pagos"
          pageSubtitle="Valida, aprueba o rechaza los pagos y comprobantes recibidos de tus clientes."
        ></app-header>
        <div class="flex flex-1 w-full min-h-0">
          <app-sidebar .privileges=${this.privileges}></app-sidebar>
          <payment-management class="flex-1 min-w-0 w-full flex flex-col"></payment-management>
        </div>
        <app-footer></app-footer>
      </div>
    `
  }
}

customElements.define('payments-view', PaymentsView)
