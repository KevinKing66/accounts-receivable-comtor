import { LitElement, html, nothing } from 'lit'
import { apiClient, ApiError } from '../../lib/api-client'
import '../common/lucide-icon'

export interface ChargeRecord {
  uuid: string
  document_type?: string | null
  document_number?: string | null
  customer_document_type?: string | null
  customer_document_number?: string | null
  customer_name?: string | null
  charge_details?: string | null
  sent_date?: string | null
  status?: string | null
  delivery_status?: string | null
  scheduled_date?: string | null
  due_date?: string | null
  discount_date?: string | null
  late_fee_date?: string | null
  amount?: number | null
  discounted_amount?: number | null
  tax?: number | null
  is_read?: number | null
  attachment_base64?: string | null
  recipient?: string | null
}

const PAGE_SIZE = 10
const DOCUMENT_TYPES = ['Factura', 'Comprobante'] as const
const CUSTOMER_DOCUMENT_TYPES = [
  'CC - Cedula de ciudadania',
  'CE - Cedula de extranjeria',
  'NIT - Empresa',
  'Pasaporte',
] as const

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat('es-CO', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

interface ChargePageResponse {
  items: ChargeRecord[]
  total: number
  page: number
  page_size: number
}

interface ChargeBalance {
  charge_uuid: string
  charge_amount: number
  paid_amount: number
  pending_amount: number
  payments?: Array<{
    uuid: string
    amount: number
    payment_date: string
    method?: string
    reference?: string
    status?: string
  }>
}

type Modal = 'none' | 'create' | 'edit' | 'delete' | 'details'

export class ChargeManagement extends LitElement {
  static properties = {
    charges: { type: Array },
    filter: { type: String },
    page: { type: Number },
    total: { type: Number },
    loading: { type: Boolean },
    error: { type: String },
    modal: { type: String },
    target: { type: Object },
    submitting: { type: Boolean },
    formError: { type: String },
    balance: { type: Object },
    balanceLoading: { type: Boolean },
    balanceError: { type: String },

    // Form fields
    document_type: { type: String },
    document_number: { type: String },
    customer_document_type: { type: String },
    customer_document_number: { type: String },
    customer_name: { type: String },
    charge_details: { type: String },
    sent_date: { type: String },
    status: { type: String },
    delivery_status: { type: String },
    scheduled_date: { type: String },
    due_date: { type: String },
    discount_date: { type: String },
    late_fee_date: { type: String },
    amount: { type: Number },
    discounted_amount: { type: Number },
    tax: { type: Number },
    is_read: { type: Number },
    attachment_base64: { type: String },
    recipient: { type: String },
  }

  declare charges: ChargeRecord[]
  declare filter: string
  declare page: number
  declare total: number
  declare loading: boolean
  declare error: string
  declare modal: Modal
  declare target: ChargeRecord | null
  declare submitting: boolean
  declare formError: string
  declare balance: ChargeBalance | null
  declare balanceLoading: boolean
  declare balanceError: string

  declare document_type: string
  declare document_number: string
  declare customer_document_type: string
  declare customer_document_number: string
  declare customer_name: string
  declare charge_details: string
  declare sent_date: string
  declare status: string
  declare delivery_status: string
  declare scheduled_date: string
  declare due_date: string
  declare discount_date: string
  declare late_fee_date: string
  declare amount: number | ''
  declare discounted_amount: number | ''
  declare tax: number | ''
  declare is_read: number
  declare attachment_base64: string
  declare recipient: string

  private filterDebounce?: ReturnType<typeof setTimeout>

  constructor() {
    super()
    this.charges = []
    this.filter = ''
    this.page = 1
    this.total = 0
    this.loading = false
    this.error = ''
    this.modal = 'none'
    this.target = null
    this.submitting = false
    this.formError = ''
    this.balance = null
    this.balanceLoading = false
    this.balanceError = ''

    this.resetForm()
  }

  createRenderRoot() {
    return this
  }

  connectedCallback() {
    super.connectedCallback()
    this.loadCharges()
  }

  private resetForm() {
    this.document_type = 'Factura'
    this.document_number = ''
    this.customer_document_type = 'NIT - Empresa'
    this.customer_document_number = ''
    this.customer_name = ''
    this.charge_details = ''
    this.sent_date = ''
    this.status = 'pendiente'
    this.delivery_status = 'pendiente de enviar'
    this.scheduled_date = ''
    this.due_date = ''
    this.discount_date = ''
    this.late_fee_date = ''
    this.amount = ''
    this.discounted_amount = ''
    this.tax = ''
    this.is_read = 0
    this.attachment_base64 = ''
    this.recipient = ''
    this.formError = ''
  }

  private get pageCount(): number {
    return Math.max(1, Math.ceil(this.total / PAGE_SIZE))
  }

  private formatCurrency(value?: number | null): string {
    return currencyFormatter.format(Number(value ?? 0))
  }

  private formatPercent(value?: number | null): string {
    return percentFormatter.format(Number(value ?? 0) / 100)
  }

  private formatDate(value?: string | null): string {
    if (!value) return '—'
    const [year, month, day] = value.split('-').map(Number)
    if (!year || !month || !day) return value
    return dateFormatter.format(new Date(year, month - 1, day))
  }

  private async loadCharges() {
    this.loading = true
    this.error = ''
    try {
      const params = new URLSearchParams({
        page: String(this.page),
        page_size: String(PAGE_SIZE),
      })
      if (this.filter.trim()) params.set('search', this.filter.trim())

      const data = (await apiClient.get(`/charges?${params}`)) as ChargePageResponse
      this.charges = data.items
      this.total = data.total
    } catch (err) {
      this.error = 'No se pudo cargar la lista de cobros.'
    } finally {
      this.loading = false
    }
  }

  private onFilterInput(e: Event) {
    this.filter = (e.target as HTMLInputElement).value
    this.page = 1
    clearTimeout(this.filterDebounce)
    this.filterDebounce = setTimeout(() => this.loadCharges(), 300)
  }

  private goToPage(page: number) {
    if (page < 1 || page > this.pageCount) return
    this.page = page
    this.loadCharges()
  }

  private openCreate() {
    this.resetForm()
    this.modal = 'create'
  }

  private openEdit(charge: ChargeRecord) {
    this.target = charge
    this.document_type = charge.document_type || 'Factura'
    this.document_number = charge.document_number || ''
    this.customer_document_type = charge.customer_document_type || 'NIT - Empresa'
    this.customer_document_number = charge.customer_document_number || ''
    this.customer_name = charge.customer_name || ''
    this.charge_details = charge.charge_details || ''
    this.sent_date = charge.sent_date || ''
    this.status = charge.status || 'pendiente'
    this.delivery_status = charge.delivery_status || 'pendiente de enviar'
    this.scheduled_date = charge.scheduled_date || ''
    this.due_date = charge.due_date || ''
    this.discount_date = charge.discount_date || ''
    this.late_fee_date = charge.late_fee_date || ''
    this.amount = charge.amount ?? ''
    this.discounted_amount = charge.discounted_amount ?? ''
    this.tax = charge.tax ?? ''
    this.is_read = charge.is_read ?? 0
    this.attachment_base64 = charge.attachment_base64 || ''
    this.recipient = charge.recipient || ''
    this.formError = ''
    this.modal = 'edit'
  }

  private async openDetails(charge: ChargeRecord) {
    this.target = charge
    this.balance = null
    this.balanceError = ''
    this.modal = 'details'
    await this.loadChargeBalance(charge.uuid)
  }

  private openDelete(charge: ChargeRecord) {
    this.target = charge
    this.modal = 'delete'
  }

  private closeModal() {
    this.modal = 'none'
    this.target = null
    this.balance = null
    this.balanceError = ''
  }

  private async loadChargeBalance(chargeUuid: string) {
    this.balanceLoading = true
    try {
      this.balance = (await apiClient.get(
        `/payments/balance/charge/${encodeURIComponent(chargeUuid)}`
      )) as ChargeBalance
    } catch (err) {
      this.balanceError = 'No se pudo cargar el balance de la factura.'
    } finally {
      this.balanceLoading = false
    }
  }

  private handleFileUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      this.formError = 'El archivo adjunto no debe superar 5MB.'
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      this.attachment_base64 = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  private validateForm(): boolean {
    if (this.amount !== '' && (Number(this.amount) < 0 || isNaN(Number(this.amount)))) {
      this.formError = 'El monto principal debe ser un número mayor o igual a 0.'
      return false
    }
    if (this.discounted_amount !== '' && (Number(this.discounted_amount) < 0 || isNaN(Number(this.discounted_amount)))) {
      this.formError = 'El monto con descuento debe ser un número mayor o igual a 0.'
      return false
    }
    if (
      this.tax !== '' &&
      (Number(this.tax) < 0 || Number(this.tax) > 100 || !Number.isInteger(Number(this.tax)) || isNaN(Number(this.tax)))
    ) {
      this.formError = 'El impuesto debe ser un porcentaje entero entre 0 y 100.'
      return false
    }
    return true
  }

  private async submitForm(e: Event) {
    e.preventDefault()
    this.formError = ''

    if (!this.validateForm()) return

    this.submitting = true
    try {
      const payload = {
        document_type: this.document_type || undefined,
        document_number: this.document_number || undefined,
        customer_document_type: this.customer_document_type || undefined,
        customer_document_number: this.customer_document_number || undefined,
        customer_name: this.customer_name || undefined,
        charge_details: this.charge_details || undefined,
        sent_date: this.sent_date || undefined,
        delivery_status: this.delivery_status || undefined,
        scheduled_date: this.scheduled_date || undefined,
        due_date: this.due_date || undefined,
        discount_date: this.discount_date || undefined,
        late_fee_date: this.late_fee_date || undefined,
        amount: this.amount !== '' ? Number(this.amount) : undefined,
        discounted_amount: this.discounted_amount !== '' ? Number(this.discounted_amount) : undefined,
        tax: this.tax !== '' ? Number(this.tax) : undefined,
        is_read: Number(this.is_read),
        attachment_base64: this.attachment_base64 || undefined,
        recipient: this.recipient || undefined,
      }

      if (this.modal === 'create') {
        await apiClient.post('/charges', payload)
      } else if (this.modal === 'edit' && this.target) {
        await apiClient.put(`/charges/${encodeURIComponent(this.target.uuid)}`, payload)
      }

      this.closeModal()
      await this.loadCharges()
    } catch (err) {
      this.formError = 'Ocurrió un error al guardar el registro de cobro.'
    } finally {
      this.submitting = false
    }
  }

  private async confirmDelete() {
    if (!this.target) return
    this.submitting = true
    try {
      await apiClient.delete(`/charges/${encodeURIComponent(this.target.uuid)}`)
      this.closeModal()
      if (this.charges.length === 1 && this.page > 1) this.page -= 1
      await this.loadCharges()
    } catch (err) {
      this.error = 'No se pudo eliminar el registro de cobro.'
      this.closeModal()
    } finally {
      this.submitting = false
    }
  }

  private renderFormModal() {
    const isEdit = this.modal === 'edit'
    return html`
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <form
          class="card bg-white p-6 rounded-2xl shadow-xl w-full max-w-2xl my-8 max-h-[90vh] flex flex-col"
          @submit=${this.submitForm}
        >
          <div class="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <h2 class="text-xl font-bold text-[#0F172A]">
              ${isEdit ? 'Editar Cobro' : 'Nuevo Registro de Cobro'}
            </h2>
            <button
              type="button"
              class="text-slate-400 hover:text-slate-600 transition-colors"
              @click=${this.closeModal}
            >
              <lucide-icon name="x"></lucide-icon>
            </button>
          </div>

          <div class="overflow-y-auto flex-1 pr-2 space-y-4">
            ${this.formError ? html`<div class="p-3 rounded-lg bg-red-50 text-red-600 text-sm">${this.formError}</div>` : ''}

            <!-- Document Details -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Tipo de Documento</label>
                <select
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.document_type}
                  @change=${(e: Event) => (this.document_type = (e.target as HTMLSelectElement).value)}
                >
                  ${DOCUMENT_TYPES.map((type) => html`<option value=${type}>${type}</option>`)}
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Nº Documento</label>
                <input
                  type="text"
                  placeholder="F001-000123"
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.document_number}
                  @input=${(e: Event) => (this.document_number = (e.target as HTMLInputElement).value)}
                />
              </div>
            </div>

            <!-- Customer Details -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Tipo Doc. Cliente</label>
                <select
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.customer_document_type}
                  @change=${(e: Event) => (this.customer_document_type = (e.target as HTMLSelectElement).value)}
                >
                  ${CUSTOMER_DOCUMENT_TYPES.map((type) => html`<option value=${type}>${type}</option>`)}
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Nº Doc. Cliente</label>
                <input
                  type="text"
                  placeholder="20123456789"
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.customer_document_number}
                  @input=${(e: Event) => (this.customer_document_number = (e.target as HTMLInputElement).value)}
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Nombre / Razón Social</label>
                <input
                  type="text"
                  placeholder="Empresa S.A.C."
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.customer_name}
                  @input=${(e: Event) => (this.customer_name = (e.target as HTMLInputElement).value)}
                />
              </div>
            </div>

            <!-- Financial Values (Validated Numbers) -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Monto</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.amount}
                  @input=${(e: Event) => (this.amount = (e.target as HTMLInputElement).value ? Number((e.target as HTMLInputElement).value) : '')}
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Valor Con Descuento</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.discounted_amount}
                  @input=${(e: Event) => (this.discounted_amount = (e.target as HTMLInputElement).value ? Number((e.target as HTMLInputElement).value) : '')}
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Impuestos (%)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  placeholder="19"
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.tax}
                  @input=${(e: Event) => (this.tax = (e.target as HTMLInputElement).value ? Number((e.target as HTMLInputElement).value) : '')}
                />
              </div>
            </div>

            <!-- Date Pickers (Calendars) -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Fecha de Envío</label>
                <input
                  type="date"
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.sent_date}
                  @input=${(e: Event) => (this.sent_date = (e.target as HTMLInputElement).value)}
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Fecha de Vencimiento</label>
                <input
                  type="date"
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.due_date}
                  @input=${(e: Event) => (this.due_date = (e.target as HTMLInputElement).value)}
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Fecha Límite Descuento</label>
                <input
                  type="date"
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.discount_date}
                  @input=${(e: Event) => (this.discount_date = (e.target as HTMLInputElement).value)}
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Fecha Recargo / Mora</label>
                <input
                  type="date"
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.late_fee_date}
                  @input=${(e: Event) => (this.late_fee_date = (e.target as HTMLInputElement).value)}
                />
              </div>
            </div>

            <!-- Status & Delivery Status Fields -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Estado de Factura</label>
                <input
                  type="text"
                  disabled
                  title="El estado de la factura no se modifica manualmente (se calcula automáticamente como pendiente, pago parcial o paga)"
                  class="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-medium text-slate-600 cursor-not-allowed"
                  .value=${this.status || 'pendiente'}
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Estado de Entrega</label>
                <select
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none bg-white"
                  .value=${this.delivery_status}
                  @change=${(e: Event) => (this.delivery_status = (e.target as HTMLSelectElement).value)}
                >
                  <option value="pendiente de enviar">pendiente de enviar</option>
                  <option value="enviado">enviado</option>
                  <option value="cliente manda evidencia del pago">cliente manda evidencia del pago</option>
                  <option value="El administrador valida">El administrador valida</option>
                  <option value="El administrador rechaza evidencia">El administrador rechaza evidencia</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Destinatario (Whatsapp)</label>
                <input
                  type="text"
                  placeholder="+57 3106112991"
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.recipient}
                  @input=${(e: Event) => (this.recipient = (e.target as HTMLInputElement).value)}
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Detalles / Observaciones del Cobro</label>
              <textarea
                rows="2"
                placeholder="Notas adicionales relativas al documento..."
                class="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                .value=${this.charge_details}
                @input=${(e: Event) => (this.charge_details = (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>

            <div class="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label class="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  class="rounded text-[#0B3B78]"
                  .checked=${this.is_read === 1}
                  @change=${(e: Event) => (this.is_read = (e.target as HTMLInputElement).checked ? 1 : 0)}
                />
                Marcar como Leído
              </label>
              
              <div class="flex items-center gap-2">
                <label class="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <lucide-icon name="paperclip" class="w-4 h-4"></lucide-icon>
                  ${this.attachment_base64 ? 'Cambiar Adjunto' : 'Adjuntar archivo'}
                  <input type="file" class="hidden" accept="image/*,.pdf" @change=${this.handleFileUpload} />
                </label>
                ${this.attachment_base64 ? html`<span class="text-xs text-green-600 font-medium">Adjunto guardado</span>` : ''}
              </div>
            </div>
          </div>

          <div class="flex gap-3 justify-end pt-4 border-t border-slate-100 mt-4">
            <button
              type="button"
              class="h-10 px-5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              @click=${this.closeModal}
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="h-10 px-5 rounded-xl bg-[#0B3B78] text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              ?disabled=${this.submitting}
            >
              ${this.submitting ? 'Guardando...' : 'Guardar Cobro'}
            </button>
          </div>
        </form>
      </div>
    `
  }

  private renderDeleteModal() {
    return html`
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div class="card bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm">
          <h2 class="text-lg font-bold text-[#0F172A] mb-2">Eliminar Registro</h2>
          <p class="text-sm text-slate-600 mb-4">
            ¿Seguro que deseas eliminar el cobro <strong>${this.target?.document_number || this.target?.uuid}</strong>? Esta acción no se puede deshacer.
          </p>
          <div class="flex gap-3 justify-end">
            <button
              class="h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              @click=${this.closeModal}
            >
              Cancelar
            </button>
            <button
              class="h-10 px-4 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              ?disabled=${this.submitting}
              @click=${this.confirmDelete}
            >
              ${this.submitting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    `
  }

  private renderDetailsModal() {
    if (!this.target) return nothing
    const t = this.target
    const paidAmount = this.balance?.paid_amount ?? 0
    const pendingAmount = this.balance?.pending_amount ?? Number(t.amount ?? 0)
    return html`
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div class="card bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 class="text-lg font-bold text-[#0F172A]">Detalles del Cobro</h2>
            <button @click=${this.closeModal} class="text-slate-400 hover:text-slate-600">
              <lucide-icon name="x"></lucide-icon>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-1 text-xs">
            <div><span class="font-semibold text-slate-500">UUID:</span> <p class="text-slate-800 font-mono select-all truncate">${t.uuid}</p></div>
            <div><span class="font-semibold text-slate-500">Documento:</span> <p class="text-slate-800 font-medium">${t.document_type} ${t.document_number}</p></div>
            <div><span class="font-semibold text-slate-500">Cliente:</span> <p class="text-slate-800 font-medium">${t.customer_name || '—'}</p></div>
            <div><span class="font-semibold text-slate-500">Doc Cliente:</span> <p class="text-slate-800">${t.customer_document_type} ${t.customer_document_number}</p></div>
            <div><span class="font-semibold text-slate-500">Monto Principal:</span> <p class="text-slate-800 font-bold">${this.formatCurrency(t.amount)}</p></div>
            <div><span class="font-semibold text-slate-500">Valor Con Descuento:</span> <p class="text-slate-800">${this.formatCurrency(t.discounted_amount)}</p></div>
            <div><span class="font-semibold text-slate-500">Impuesto:</span> <p class="text-slate-800">${this.formatPercent(t.tax)}</p></div>
            <div><span class="font-semibold text-slate-500">Estado Factura:</span> <p class="text-slate-800 font-medium capitalize">${t.status || 'pendiente'}</p></div>
            <div><span class="font-semibold text-slate-500">Estado Entrega:</span> <p class="text-slate-800 font-medium">${t.delivery_status || 'pendiente de enviar'}</p></div>
            <div><span class="font-semibold text-slate-500">F. Vencimiento:</span> <p class="text-slate-800">${this.formatDate(t.due_date)}</p></div>
            <div><span class="font-semibold text-slate-500">F. Envío:</span> <p class="text-slate-800">${this.formatDate(t.sent_date)}</p></div>
          </div>

          <div class="border-t border-slate-100 pt-3">
            <span class="font-semibold text-xs text-slate-500 block mb-2">Balance y Pagos Registrados:</span>
            ${this.balanceLoading
        ? html`<p class="text-xs text-slate-500">Cargando balance...</p>`
        : this.balanceError
          ? html`<p class="text-xs text-red-600">${this.balanceError}</p>`
          : html`
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <span class="block text-[11px] font-semibold text-slate-500">Total factura</span>
                      <p class="text-sm font-bold text-slate-900">${this.formatCurrency(this.balance?.charge_amount ?? t.amount)}</p>
                    </div>
                    <div class="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                      <span class="block text-[11px] font-semibold text-emerald-700">Pagado</span>
                      <p class="text-sm font-bold text-emerald-700">${this.formatCurrency(paidAmount)}</p>
                    </div>
                    <div class="rounded-xl border border-amber-100 bg-amber-50 p-3">
                      <span class="block text-[11px] font-semibold text-amber-700">Pendiente</span>
                      <p class="text-sm font-bold text-amber-700">${this.formatCurrency(pendingAmount)}</p>
                    </div>
                  </div>

                  ${this.balance?.payments && this.balance.payments.length > 0
              ? html`
                        <div class="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs space-y-2">
                          <span class="font-semibold text-slate-700 block">Historial de Pagos y Validación:</span>
                          <div class="space-y-1.5">
                            ${this.balance.payments.map(
                (p: any) => html`
                                <div class="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200/80">
                                  <div>
                                    <span class="font-bold text-emerald-700">${this.formatCurrency(p.amount)}</span>
                                    <span class="text-[11px] text-slate-500 ml-2">(${this.formatDate(p.payment_date)})</span>
                                    ${p.reference ? html`<span class="text-[11px] text-slate-400 font-mono ml-1">Ref: ${p.reference}</span>` : ''}
                                  </div>
                                  <div>
                                    ${(p.status || 'pendiente') === 'aprobado'
                    ? html`<span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">Pago Aprobado</span>`
                    : (p.status || 'pendiente') === 'rechazado'
                      ? html`<span class="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">Pago Rechazado</span>`
                      : html`<span class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">Pago Pendiente</span>`}
                                  </div>
                                </div>
                              `
              )}
                          </div>
                        </div>
                      `
              : html`<p class="text-xs text-slate-400">No hay pagos registrados para esta factura.</p>`}
                `}
          </div>

          ${t.charge_details ? html`
            <div class="border-t border-slate-100 pt-3 text-xs">
              <span class="font-semibold text-slate-500 block mb-1">Observaciones:</span>
              <p class="text-slate-700 bg-slate-50 p-2.5 rounded-lg">${t.charge_details}</p>
            </div>
          ` : ''}

          ${t.attachment_base64 ? html`
            <div class="border-t border-slate-100 pt-3">
              <span class="font-semibold text-xs text-slate-500 block mb-2">Adjunto:</span>
              ${t.attachment_base64.startsWith('data:image')
          ? html`<img src=${t.attachment_base64} class="max-h-48 rounded-lg border border-slate-200 object-contain mx-auto" />`
          : html`<a href=${t.attachment_base64} download="adjunto" class="text-xs text-blue-600 underline">Descargar archivo adjunto</a>`}
            </div>
          ` : ''}

          <div class="flex justify-end border-t border-slate-100 pt-3">
            <button class="h-9 px-4 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200" @click=${this.closeModal}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    `
  }

  render() {
    return html`
      <main class="flex-1 min-h-full w-full bg-[#F8FAFC] p-8">
        <div class="flex flex-col gap-6">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="relative w-full max-w-[420px]">
              <lucide-icon
                name="search"
                class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]"
              ></lucide-icon>
              <input
                type="text"
                placeholder="Buscar por doc, cliente, RUC o destinatario..."
                class="h-12 w-full rounded-xl border border-[#E2E8F0] bg-white pl-11 pr-4 text-sm font-medium text-[#0F172A] outline-none transition-colors duration-150 ease-out placeholder:font-normal placeholder:text-[#94A3B8] focus:border-[#0B3B78] focus:ring-4 focus:ring-[#0B3B78]/10"
                .value=${this.filter}
                @input=${this.onFilterInput}
              />
            </div>
            <div class="flex items-center gap-3">
              <button
                class="flex h-12 items-center gap-1 rounded-xl border border-[#E2E8F0] bg-white px-5 text-sm font-semibold text-[#0F172A] transition-colors duration-150 ease-out hover:bg-[#EFF6FF]"
                @click=${this.loadCharges}
              >
                <lucide-icon name="refresh-cw"></lucide-icon>
                Actualizar
              </button>
              <button
                class="flex h-12 items-center gap-2 rounded-xl bg-[#0B3B78] px-5 text-sm font-semibold text-white transition-opacity duration-150 ease-out hover:opacity-90"
                @click=${this.openCreate}
              >
                <lucide-icon name="plus"></lucide-icon>
                Nuevo Cobro
              </button>
            </div>
          </div>

          ${this.error ? html`<p class="text-sm text-red-600">${this.error}</p>` : ''}

          ${this.loading
        ? html`<p class="text-sm text-[#64748B]">Cargando cobros...</p>`
        : html`
                <div class="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
                  <div class="overflow-x-auto">
                    <table class="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr class="bg-slate-50 border-b border-[#E2E8F0]">
                          <th class="px-6 py-4 font-semibold text-[#334155]">Documento</th>
                          <th class="px-6 py-4 font-semibold text-[#334155]">Cliente</th>
                          <th class="px-6 py-4 font-semibold text-[#334155]">Monto</th>
                          <th class="px-6 py-4 font-semibold text-[#334155]">Vencimiento</th>
                          <th class="px-6 py-4 font-semibold text-[#334155]">Estado Factura</th>
                          <th class="px-6 py-4 font-semibold text-[#334155]">Estado Entrega</th>
                          <th class="px-6 py-4 font-semibold text-[#334155] text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${this.charges.map(
          (c) => html`
                            <tr
                              class="border-t border-[#F1F5F9] transition-colors duration-150 ease-out hover:bg-[#EFF6FF]"
                            >
                              <td class="h-[60px] px-6">
                                <div class="flex flex-col">
                                  <span class="font-semibold text-[#0F172A]">${c.document_type || 'Doc'} ${c.document_number || ''}</span>
                                  <span class="text-xs text-slate-400 font-mono truncate max-w-[120px]">${c.uuid}</span>
                                </div>
                              </td>
                              <td class="h-[60px] px-6">
                                <div class="flex flex-col">
                                  <span class="font-medium text-[#0F172A]">${c.customer_name || '—'}</span>
                                  <span class="text-xs text-[#64748B]">${c.customer_document_type ? c.customer_document_type + ': ' : ''}${c.customer_document_number || ''}</span>
                                </div>
                              </td>
                              <td class="h-[60px] px-6">
                                <span class="font-bold text-[#0F172A]">${this.formatCurrency(c.amount)}</span>
                              </td>
                              <td class="h-[60px] px-6 text-[#64748B]">
                                ${this.formatDate(c.due_date)}
                              </td>
                              <td class="h-[60px] px-6">
                                <span
                                  class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${c.status === 'paga'
              ? 'bg-[#ECFDF5] text-[#059669]'
              : c.status === 'pago parcial'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-[#FFFBEB] text-[#D97706]'
            }"
                                >
                                  ${c.status || 'pendiente'}
                                </span>
                              </td>
                              <td class="h-[60px] px-6">
                                <span
                                  class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                                >
                                  ${c.delivery_status || 'pendiente de enviar'}
                                </span>
                              </td>
                              <td class="h-[60px] px-6 text-right">
                                <div class="flex items-center justify-end gap-2">
                                  <button
                                    class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                    title="Ver Detalles"
                                    @click=${() => this.openDetails(c)}
                                  >
                                    <lucide-icon name="eye" class="w-4 h-4"></lucide-icon>
                                  </button>
                                  <button
                                    class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#0B3B78] transition-colors"
                                    title="Editar"
                                    @click=${() => this.openEdit(c)}
                                  >
                                    <lucide-icon name="pencil" class="w-4 h-4"></lucide-icon>
                                  </button>
                                  <button
                                    class="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                    title="Eliminar"
                                    @click=${() => this.openDelete(c)}
                                  >
                                    <lucide-icon name="trash-2" class="w-4 h-4"></lucide-icon>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          `
        )}
                        ${this.charges.length === 0
            ? html`<tr>
                              <td class="px-6 py-12 text-center text-sm text-[#64748B]" colspan="6">
                                No se encontraron cobros registrados.
                              </td>
                            </tr>`
            : ''}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="flex items-center justify-between">
                  <span class="text-sm text-[#64748B]"
                    >${this.total} cobro${this.total === 1 ? '' : 's'} en total</span
                  >
                  <div class="flex items-center gap-3">
                    <button
                      class="flex h-10 items-center rounded-full border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-[#0F172A] transition-colors duration-150 ease-out hover:bg-[#EFF6FF] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white"
                      ?disabled=${this.page <= 1}
                      @click=${() => this.goToPage(this.page - 1)}
                    >
                      Anterior
                    </button>
                    <span class="flex items-center gap-1.5 text-sm text-[#64748B]">
                      Página
                      <span
                        class="flex h-7 min-w-7 items-center justify-center rounded-full bg-[#0B3B78] px-2 text-xs font-semibold text-white"
                        >${this.page}</span
                      >
                      de ${this.pageCount}
                    </span>
                    <button
                      class="flex h-10 items-center rounded-full border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-[#0F172A] transition-colors duration-150 ease-out hover:bg-[#EFF6FF] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white"
                      ?disabled=${this.page >= this.pageCount}
                      @click=${() => this.goToPage(this.page + 1)}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              `}
        </div>
        ${this.modal === 'create' || this.modal === 'edit' ? this.renderFormModal() : ''}
        ${this.modal === 'delete' ? this.renderDeleteModal() : ''}
        ${this.modal === 'details' ? this.renderDetailsModal() : ''}
      </main>
    `
  }
}

customElements.define('charge-management', ChargeManagement)
