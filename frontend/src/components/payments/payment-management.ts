import { LitElement, html, nothing } from 'lit'
import { apiClient } from '../../lib/api-client'
import '../common/lucide-icon'

export interface PaymentRecord {
  uuid: string
  charge_uuid: string
  amount: number
  payment_date: string
  method?: string | null
  reference?: string | null
  notes?: string | null
  attachment_base64?: string | null
  status: string
  document_number?: string | null
  document_type?: string | null
  customer_name?: string | null
  customer_document_number?: string | null
  charge_amount?: number | null
  charge_status?: string | null
}

interface PaymentPageResponse {
  items: PaymentRecord[]
  total: number
  page: number
  page_size: number
}

const PAGE_SIZE = 10

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export class PaymentManagement extends LitElement {
  static properties = {
    payments: { type: Array },
    filter: { type: String },
    sortBy: { type: String },
    sortOrder: { type: String },
    statusFilter: { type: String },
    page: { type: Number },
    total: { type: Number },
    loading: { type: Boolean },
    error: { type: String },
    actionLoading: { type: String },
    modal: { type: String },
    target: { type: Object },
    submitting: { type: Boolean },
    formError: { type: String },

    // Process payment form
    charge_uuid: { type: String },
    customer_search: { type: String },
    amount: { type: Number },
    payment_date: { type: String },
    method: { type: String },
    reference: { type: String },
    notes: { type: String },
    attachment_base64: { type: String },
  }

  declare payments: PaymentRecord[]
  declare filter: string
  declare sortBy: string
  declare sortOrder: string
  declare statusFilter: string
  declare page: number
  declare total: number
  declare loading: boolean
  declare error: string
  declare actionLoading: string
  declare modal: 'none' | 'create' | 'details'
  declare target: PaymentRecord | null
  declare submitting: boolean
  declare formError: string

  declare charge_uuid: string
  declare customer_search: string
  declare amount: number | ''
  declare payment_date: string
  declare method: string
  declare reference: string
  declare notes: string
  declare attachment_base64: string

  private filterDebounce?: ReturnType<typeof setTimeout>

  constructor() {
    super()
    this.payments = []
    this.filter = ''
    this.sortBy = 'fecha' // Default sort by date
    this.sortOrder = 'desc'
    this.statusFilter = ''
    this.page = 1
    this.total = 0
    this.loading = false
    this.error = ''
    this.actionLoading = ''
    this.modal = 'none'
    this.target = null
    this.submitting = false
    this.formError = ''

    this.resetForm()
  }

  createRenderRoot() {
    return this
  }

  connectedCallback() {
    super.connectedCallback()
    this.loadPayments()
  }

  private resetForm() {
    this.charge_uuid = ''
    this.customer_search = ''
    this.amount = ''
    this.payment_date = new Date().toISOString().split('T')[0]
    this.method = 'Transferencia'
    this.reference = ''
    this.notes = ''
    this.attachment_base64 = ''
    this.formError = ''
  }

  private get pageCount(): number {
    return Math.max(1, Math.ceil(this.total / PAGE_SIZE))
  }

  private formatCurrency(value?: number | null): string {
    return currencyFormatter.format(Number(value ?? 0))
  }

  private formatDate(value?: string | null): string {
    if (!value) return '—'
    const [year, month, day] = value.split('-').map(Number)
    if (!year || !month || !day) return value
    return dateFormatter.format(new Date(year, month - 1, day))
  }

  private async loadPayments() {
    this.loading = true
    this.error = ''
    try {
      const params = new URLSearchParams({
        page: String(this.page),
        page_size: String(PAGE_SIZE),
        sort_by: this.sortBy,
        sort_order: this.sortOrder,
      })
      if (this.filter.trim()) params.set('search', this.filter.trim())
      if (this.statusFilter) params.set('status', this.statusFilter)

      const data = (await apiClient.get(`/payments?${params}`)) as PaymentPageResponse
      this.payments = data.items
      this.total = data.total
    } catch (err) {
      this.error = 'No se pudo cargar la lista de pagos.'
    } finally {
      this.loading = false
    }
  }

  private onFilterInput(e: Event) {
    this.filter = (e.target as HTMLInputElement).value
    this.page = 1
    clearTimeout(this.filterDebounce)
    this.filterDebounce = setTimeout(() => this.loadPayments(), 300)
  }

  private onSortByChange(e: Event) {
    this.sortBy = (e.target as HTMLSelectElement).value
    this.page = 1
    this.loadPayments()
  }

  private toggleSortOrder() {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc'
    this.loadPayments()
  }

  private onStatusFilterChange(e: Event) {
    this.statusFilter = (e.target as HTMLSelectElement).value
    this.page = 1
    this.loadPayments()
  }

  private goToPage(page: number) {
    if (page < 1 || page > this.pageCount) return
    this.page = page
    this.loadPayments()
  }

  private async updatePaymentStatus(paymentUuid: string, newStatus: 'aprobado' | 'rechazado') {
    this.actionLoading = paymentUuid
    try {
      await apiClient.put(`/payments/${encodeURIComponent(paymentUuid)}/status`, {
        status: newStatus,
      })
      await this.loadPayments()
    } catch (err) {
      alert('Error al actualizar el estado del pago.')
    } finally {
      this.actionLoading = ''
    }
  }

  private openCreate() {
    this.resetForm()
    this.modal = 'create'
  }

  private openDetails(payment: PaymentRecord) {
    this.target = payment
    this.modal = 'details'
  }

  private closeModal() {
    this.modal = 'none'
    this.target = null
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

  private async submitProcessPayment(e: Event) {
    e.preventDefault()
    this.formError = ''

    if (!this.amount || Number(this.amount) <= 0) {
      this.formError = 'El monto del pago debe ser mayor a 0.'
      return
    }

    this.submitting = true
    try {
      const payload = {
        charge_uuid: this.charge_uuid || undefined,
        customer_search: this.customer_search || undefined,
        amount: Number(this.amount),
        payment_date: this.payment_date || undefined,
        method: this.method || undefined,
        reference: this.reference || undefined,
        notes: this.notes || undefined,
        attachment_base64: this.attachment_base64 || undefined,
      }

      await apiClient.post('/payments/process', payload)
      this.closeModal()
      await this.loadPayments()
    } catch (err: any) {
      this.formError = err?.detail || 'No se pudo procesar el pago.'
    } finally {
      this.submitting = false
    }
  }

  private renderStatusBadge(statusStr?: string) {
    const st = (statusStr || 'pendiente').toLowerCase()
    if (st === 'aprobado') {
      return html`
        <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          Aprobado
        </span>
      `
    }
    if (st === 'rechazado') {
      return html`
        <span class="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 border border-red-200/60">
          <span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>
          Rechazado
        </span>
      `
    }
    return html`
      <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200/60">
        <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
        Pendiente
      </span>
    `
  }

  private renderCreateModal() {
    return html`
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <form
          class="card bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg my-8 flex flex-col space-y-4"
          @submit=${this.submitProcessPayment}
        >
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 class="text-lg font-bold text-[#0F172A]">Registrar Nuevo Pago</h2>
            <button type="button" @click=${this.closeModal} class="text-slate-400 hover:text-slate-600">
              <lucide-icon name="x"></lucide-icon>
            </button>
          </div>

          ${this.formError ? html`<div class="p-3 rounded-lg bg-red-50 text-red-600 text-sm">${this.formError}</div>` : ''}

          <div class="space-y-3 text-xs">
            <div>
              <label class="block font-semibold text-slate-600 mb-1">Cliente (Nombre o RUC / Documento)</label>
              <input
                type="text"
                placeholder="Buscar cliente..."
                class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                .value=${this.customer_search}
                @input=${(e: Event) => (this.customer_search = (e.target as HTMLInputElement).value)}
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-600 mb-1">Monto del Pago (*)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.amount}
                  @input=${(e: Event) => (this.amount = (e.target as HTMLInputElement).value ? Number((e.target as HTMLInputElement).value) : '')}
                />
              </div>

              <div>
                <label class="block font-semibold text-slate-600 mb-1">Fecha de Pago</label>
                <input
                  type="date"
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.payment_date}
                  @input=${(e: Event) => (this.payment_date = (e.target as HTMLInputElement).value)}
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-600 mb-1">Método de Pago</label>
                <select
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.method}
                  @change=${(e: Event) => (this.method = (e.target as HTMLSelectElement).value)}
                >
                  <option value="Transferencia">Transferencia</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label class="block font-semibold text-slate-600 mb-1">Nº de Referencia / Comprobante</label>
                <input
                  type="text"
                  placeholder="REF-123456"
                  class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-[#0B3B78] focus:outline-none"
                  .value=${this.reference}
                  @input=${(e: Event) => (this.reference = (e.target as HTMLInputElement).value)}
                />
              </div>
            </div>

            <div>
              <label class="block font-semibold text-slate-600 mb-1">Notas / Observaciones</label>
              <textarea
                rows="2"
                placeholder="Observaciones sobre la transferencia..."
                class="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-[#0B3B78] focus:outline-none"
                .value=${this.notes}
                @input=${(e: Event) => (this.notes = (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>

            <div class="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span class="font-medium text-slate-700">Comprobante de Pago</span>
              <label class="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-50">
                <lucide-icon name="paperclip" class="w-4 h-4"></lucide-icon>
                ${this.attachment_base64 ? 'Cambiar Adjunto' : 'Adjuntar archivo'}
                <input type="file" class="hidden" accept="image/*,.pdf" @change=${this.handleFileUpload} />
              </label>
            </div>
          </div>

          <div class="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <button
              type="button"
              class="h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              @click=${this.closeModal}
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="h-10 px-5 rounded-xl bg-[#0B3B78] text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              ?disabled=${this.submitting}
            >
              ${this.submitting ? 'Procesando...' : 'Registrar Pago'}
            </button>
          </div>
        </form>
      </div>
    `
  }

  private renderDetailsModal() {
    if (!this.target) return nothing
    const p = this.target
    return html`
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div class="card bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 class="text-lg font-bold text-[#0F172A]">Detalles del Pago</h2>
            <button @click=${this.closeModal} class="text-slate-400 hover:text-slate-600">
              <lucide-icon name="x"></lucide-icon>
            </button>
          </div>

          <div class="grid grid-cols-2 gap-3 text-xs">
            <div><span class="font-semibold text-slate-500">ID Pago:</span> <p class="text-slate-800 font-mono select-all truncate">${p.uuid}</p></div>
            <div><span class="font-semibold text-slate-500">Estado Pago:</span> <div class="mt-0.5">${this.renderStatusBadge(p.status)}</div></div>
            <div><span class="font-semibold text-slate-500">Factura:</span> <p class="text-slate-800 font-medium">${p.document_type || 'Factura'} ${p.document_number || '—'}</p></div>
            <div><span class="font-semibold text-slate-500">Cliente:</span> <p class="text-slate-800 font-medium">${p.customer_name || '—'}</p></div>
            <div><span class="font-semibold text-slate-500">Monto Abonado:</span> <p class="text-emerald-700 font-bold text-sm">${this.formatCurrency(p.amount)}</p></div>
            <div><span class="font-semibold text-slate-500">Fecha Pago:</span> <p class="text-slate-800">${this.formatDate(p.payment_date)}</p></div>
            <div><span class="font-semibold text-slate-500">Método:</span> <p class="text-slate-800">${p.method || '—'}</p></div>
            <div><span class="font-semibold text-slate-500">Referencia:</span> <p class="text-slate-800 font-mono">${p.reference || '—'}</p></div>
          </div>

          ${p.notes ? html`
            <div class="border-t border-slate-100 pt-3 text-xs">
              <span class="font-semibold text-slate-500 block mb-1">Notas:</span>
              <p class="text-slate-700 bg-slate-50 p-2.5 rounded-lg">${p.notes}</p>
            </div>
          ` : ''}

          ${p.attachment_base64 ? html`
            <div class="border-t border-slate-100 pt-3 text-xs">
              <span class="font-semibold text-slate-500 block mb-2">Comprobante Adjunto:</span>
              ${p.attachment_base64.startsWith('data:image')
          ? html`<img src=${p.attachment_base64} class="max-h-56 rounded-xl border border-slate-200 object-contain mx-auto shadow-sm" />`
          : html`<a href=${p.attachment_base64} download="comprobante" class="inline-flex items-center gap-1.5 text-blue-600 font-semibold underline">
                    <lucide-icon name="paperclip" class="w-4 h-4"></lucide-icon> Descargar Comprobante
                  </a>`}
            </div>
          ` : ''}

          <div class="flex items-center justify-between border-t border-slate-100 pt-4">
            <div class="flex items-center gap-2">
              ${p.status !== 'aprobado' ? html`
                <button
                  class="h-9 px-3.5 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                  @click=${() => { this.closeModal(); this.updatePaymentStatus(p.uuid, 'aprobado') }}
                >
                  Aprobar Pago
                </button>
              ` : ''}
              ${p.status !== 'rechazado' ? html`
                <button
                  class="h-9 px-3.5 rounded-xl bg-red-600 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
                  @click=${() => { this.closeModal(); this.updatePaymentStatus(p.uuid, 'rechazado') }}
                >
                  Rechazar Pago
                </button>
              ` : ''}
            </div>
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
          <!-- Controls Header -->
          <div class="flex flex-wrap items-center justify-between gap-4">
            <!-- Search input -->
            <div class="relative w-full max-w-[360px]">
              <lucide-icon
                name="search"
                class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]"
              ></lucide-icon>
              <input
                type="text"
                placeholder="Buscar por cliente, comprobante o ref..."
                class="h-12 w-full rounded-xl border border-[#E2E8F0] bg-white pl-11 pr-4 text-sm font-medium text-[#0F172A] outline-none transition-colors duration-150 ease-out placeholder:font-normal placeholder:text-[#94A3B8] focus:border-[#0B3B78] focus:ring-4 focus:ring-[#0B3B78]/10"
                .value=${this.filter}
                @input=${this.onFilterInput}
              />
            </div>

            <!-- Ordering & Filtering controls -->
            <div class="flex flex-wrap items-center gap-3">
              <!-- Sort By Dropdown -->
              <div class="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#E2E8F0]">
                <span class="text-xs font-semibold text-[#64748B]">Ordenar por:</span>
                <select
                  class="bg-transparent text-xs font-bold text-[#0F172A] outline-none cursor-pointer"
                  .value=${this.sortBy}
                  @change=${this.onSortByChange}
                >
                  <option value="fecha">Fecha (por defecto)</option>
                  <option value="estado">Estado</option>
                  <option value="ambas">Estado y Fecha (Ambas)</option>
                </select>
                <button
                  type="button"
                  title="Cambiar dirección de orden (asc/desc)"
                  class="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                  @click=${this.toggleSortOrder}
                >
                  <lucide-icon name=${this.sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} class="w-4 h-4"></lucide-icon>
                </button>
              </div>

              <!-- Status Filter Dropdown -->
              <div class="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#E2E8F0]">
                <span class="text-xs font-semibold text-[#64748B]">Filtrar estado:</span>
                <select
                  class="bg-transparent text-xs font-bold text-[#0F172A] outline-none cursor-pointer"
                  .value=${this.statusFilter}
                  @change=${this.onStatusFilterChange}
                >
                  <option value="">Todos</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="aprobado">Aprobados</option>
                  <option value="rechazado">Rechazados</option>
                </select>
              </div>

              <!-- Refresh Button -->
              <button
                class="flex h-12 items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-[#0F172A] transition-colors duration-150 ease-out hover:bg-[#EFF6FF]"
                @click=${this.loadPayments}
              >
                <lucide-icon name="refresh-cw"></lucide-icon>
              </button>

              <!-- New Payment Button -->
              <button
                class="flex h-12 items-center gap-2 rounded-xl bg-[#0B3B78] px-5 text-sm font-semibold text-white transition-opacity duration-150 ease-out hover:opacity-90"
                @click=${this.openCreate}
              >
                <lucide-icon name="plus"></lucide-icon>
                Registrar Pago
              </button>
            </div>
          </div>

          <!-- Error Alert -->
          ${this.error
        ? html`
                <div class="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <lucide-icon name="alert-circle" class="shrink-0"></lucide-icon>
                  <p class="flex-1 font-medium">${this.error}</p>
                </div>
              `
        : nothing}

          <!-- Table Container -->
          <div class="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm text-[#0F172A]">
                <thead class="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  <tr>
                    <th class="px-6 py-4">Fecha Pago</th>
                    <th class="px-6 py-4">Cliente / Factura</th>
                    <th class="px-6 py-4">Monto Abonado</th>
                    <th class="px-6 py-4">Método / Ref</th>
                    <th class="px-6 py-4">Estado</th>
                    <th class="px-6 py-4">Comprobante</th>
                    <th class="px-6 py-4 text-right">Acciones de Validación</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#F1F5F9]">
                  ${this.loading
        ? html`
                        <tr>
                          <td colspan="7" class="px-6 py-12 text-center text-sm text-[#64748B]">
                            <div class="flex items-center justify-center gap-2">
                              <lucide-icon name="loader-2" class="animate-spin text-[#0B3B78]"></lucide-icon>
                              <span>Cargando lista de pagos...</span>
                            </div>
                          </td>
                        </tr>
                      `
        : this.payments.length === 0
          ? html`
                        <tr>
                          <td colspan="7" class="px-6 py-12 text-center text-sm text-[#64748B]">
                            No se encontraron registros de pagos.
                          </td>
                        </tr>
                      `
          : this.payments.map((p) => html`
                        <tr class="transition-colors hover:bg-slate-50/70">
                          <!-- Date -->
                          <td class="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">
                            ${this.formatDate(p.payment_date)}
                          </td>

                          <!-- Customer / Invoice -->
                          <td class="px-6 py-4">
                            <div class="flex flex-col">
                              <span class="font-bold text-[#0F172A]">${p.customer_name || 'Sin cliente asignado'}</span>
                              <span class="text-xs text-[#64748B] font-mono">
                                ${p.document_type || 'Factura'} ${p.document_number || '—'}
                              </span>
                            </div>
                          </td>

                          <!-- Amount -->
                          <td class="px-6 py-4 font-bold text-emerald-700 whitespace-nowrap">
                            ${this.formatCurrency(p.amount)}
                          </td>

                          <!-- Method / Ref -->
                          <td class="px-6 py-4">
                            <div class="flex flex-col text-xs">
                              <span class="font-semibold text-slate-800">${p.method || 'Transferencia'}</span>
                              <span class="text-slate-500 font-mono">${p.reference || 'Sin ref.'}</span>
                            </div>
                          </td>

                          <!-- Status -->
                          <td class="px-6 py-4 whitespace-nowrap">
                            ${this.renderStatusBadge(p.status)}
                          </td>

                          <!-- Attachment -->
                          <td class="px-6 py-4 whitespace-nowrap">
                            ${p.attachment_base64
              ? html`
                                  <button
                                    class="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                                    @click=${() => this.openDetails(p)}
                                  >
                                    <lucide-icon name="paperclip" class="w-3.5 h-3.5"></lucide-icon>
                                    Ver evidencia
                                  </button>
                                `
              : html`<span class="text-xs text-slate-400">Sin adjunto</span>`}
                          </td>

                          <!-- Approve / Reject Actions -->
                          <td class="px-6 py-4 text-right whitespace-nowrap">
                            <div class="flex items-center justify-end gap-2">
                              <button
                                class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 text-xs font-bold transition-all disabled:opacity-50"
                                ?disabled=${this.actionLoading === p.uuid}
                                @click=${() => this.updatePaymentStatus(p.uuid, 'aprobado')}
                              >
                                <lucide-icon name="check-circle" class="w-3.5 h-3.5"></lucide-icon>
                                Aprobar
                              </button>
                              <button
                                class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-600 hover:text-white border border-red-200 text-xs font-bold transition-all disabled:opacity-50"
                                ?disabled=${this.actionLoading === p.uuid}
                                @click=${() => this.updatePaymentStatus(p.uuid, 'rechazado')}
                              >
                                <lucide-icon name="x-circle" class="w-3.5 h-3.5"></lucide-icon>
                                Rechazar
                              </button>
                              <button
                                class="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                                title="Ver detalles completos"
                                @click=${() => this.openDetails(p)}
                              >
                                <lucide-icon name="eye" class="w-4 h-4"></lucide-icon>
                              </button>
                            </div>
                          </td>
                        </tr>
                      `)}
                </tbody>
              </table>
            </div>

            <!-- Pagination Footer -->
            <div class="flex items-center justify-between border-t border-[#E2E8F0] px-6 py-4">
              <span class="text-xs text-[#64748B]">
                Mostrando ${this.payments.length} de ${this.total} pagos
              </span>
              <div class="flex items-center gap-2">
                <button
                  class="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  ?disabled=${this.page <= 1}
                  @click=${() => this.goToPage(this.page - 1)}
                >
                  <lucide-icon name="chevron-left" class="w-4 h-4"></lucide-icon>
                </button>
                <span class="text-xs font-semibold text-[#0F172A] px-2">
                  Página ${this.page} de ${this.pageCount}
                </span>
                <button
                  class="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  ?disabled=${this.page >= this.pageCount}
                  @click=${() => this.goToPage(this.page + 1)}
                >
                  <lucide-icon name="chevron-right" class="w-4 h-4"></lucide-icon>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      ${this.modal === 'create' ? this.renderCreateModal() : nothing}
      ${this.modal === 'details' ? this.renderDetailsModal() : nothing}
    `
  }
}

customElements.define('payment-management', PaymentManagement)
