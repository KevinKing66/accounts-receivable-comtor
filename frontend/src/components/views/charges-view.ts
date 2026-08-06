import { LitElement, html } from 'lit'
import { Session, Privilege } from '../../session/session'
import '../layout/app-header'
import '../layout/app-sidebar'
import '../charges/charge-management'
import '../layout/app-footer'
import { Router } from '@vaadin/router'

export class ChargesView extends LitElement {
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
    document.title = 'Gestión de Cobros - Hello World'
    if (!Session.getInstance().isAuthenticated()) {
      Router.go('/login');
    }
  }

  render() {
    return html`
      <div class="flex flex-col min-h-screen">
        <app-header
          .identity=${this.identity}
          pageTitle="Gestión de Cobros"
          pageSubtitle="Administra las cuentas por cobrar, estados de envío y fechas de vencimiento."
        ></app-header>
        <div class="flex flex-1">
          <app-sidebar .privileges=${this.privileges}></app-sidebar>
          <charge-management></charge-management>
        </div>
        <app-footer></app-footer>
      </div>
    `
  }
}

customElements.define('charges-view', ChargesView)
