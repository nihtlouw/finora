import { Badge, Card, money } from '@/components/finora-ui'
import type { ProjectProfitability } from '@/lib/project-profitability'

function pct(value: number) {
  return `${value.toFixed(1)}%`
}

const categoryLabel: Record<string, string> = {
  MATERIAL: 'Material',
  CONSUMABLE: 'Consumable',
  BBM: 'BBM / Fuel',
  TRANSPORT: 'Transport / Tol / Parkir',
  JASA_SUBKON: 'Jasa / Subkon',
  SEWA_PERALATAN: 'Sewa Peralatan',
  KONSUMSI: 'Konsumsi',
  AKOMODASI: 'Akomodasi',
  LOGISTIK: 'Logistik / Pengiriman',
  OPERASIONAL_UMUM: 'Operasional Umum',
  LAINNYA: 'Lainnya',
}

export default function ProjectProfitabilityCard({ data }: { data: ProjectProfitability }) {
  const marginTone = data.grossMarginPct == null ? 'neutral' : data.grossMarginPct >= 0 ? 'green' : 'red'
  const basisLabel = data.basis === 'PO_GRAND_TOTAL' ? 'Grand Total PO' : 'Nilai kontrak project'

  return (
    <div id="profitability-project"><Card className="f-section-gap">
      <div className="f-card-head">
        <div>
          <h3>Profitability project</h3>
          <p>Profitability memakai PO/contract value sebagai revenue basis dan hanya expense <strong>APPROVED</strong> sebagai actual cost. Invoice dan cash adalah konteks aktual finance, bukan sumber gross profit.</p>
        </div>
        <Badge tone={marginTone}>{data.grossMarginPct == null ? 'Belum ada revenue basis' : `${pct(data.grossMarginPct)} current margin`}</Badge>
      </div>

      <div className="f-grid-4 f-detail-kpis">
        <div className="f-stat"><div className="f-stat-icon">Rp</div><div className="f-stat-body"><span>Revenue basis</span><strong>{money(data.contractValue)}</strong><small>{basisLabel}</small></div></div>
        <div className="f-stat"><div className="f-stat-icon">−</div><div className="f-stat-body"><span>Actual cost to date</span><strong>{money(data.actualCost)}</strong><small>{data.approvedExpenseCount} approved expense • recorded cost to date</small></div></div>
        <div className="f-stat"><div className="f-stat-icon">↗</div><div className="f-stat-body"><span>Gross profit</span><strong>{money(data.grossProfit)}</strong><small>{data.grossProfit >= 0 ? 'Surplus against current cost' : 'Cost sudah melebihi revenue basis'}</small></div></div>
        <div className="f-stat"><div className="f-stat-icon">%</div><div className="f-stat-body"><span>Gross margin</span><strong>{data.grossMarginPct == null ? '—' : pct(data.grossMarginPct)}</strong><small>Gross profit ÷ revenue basis • based on recorded approved cost</small></div></div>
      </div>

      <div className="f-detail-main-grid f-section-gap">
        <div className="f-subpanel">
          <div className="f-card-head"><div><h4>Actual cost by category</h4><p>Hanya allocation dari expense <strong>APPROVED</strong> yang masuk ke gross margin. Nilai ini adalah biaya tercatat sampai saat ini.</p></div></div>
          {data.costByCategory.length ? <div className="f-list">{data.costByCategory.map((row) => <div className="f-list-item" key={row.category}><span>{categoryLabel[row.category] || row.category}</span><strong>{money(row.amount)} <em className="f-muted">({pct(row.pctOfCost)})</em></strong></div>)}</div> : <div className="f-empty"><strong>Belum ada actual cost</strong>Approval expense project akan mulai membentuk breakdown biaya di sini.</div>}
        </div>

        <div className="f-subpanel">
          <div className="f-card-head"><div><h4>Billing & cash actual</h4><p>Ini adalah angka aktual invoice/payment. Schedule billing & payment di bagian bawah hanyalah rencana.</p></div></div>
          <div className="f-list">
            <div className="f-list-item"><span>Invoiced (actual)</span><strong>{money(data.billedAmount)} <em className="f-muted">({pct(data.billedPct)})</em></strong></div>
            <div className="f-list-item"><span>Collected (actual)</span><strong>{money(data.collectedAmount)} <em className="f-muted">({pct(data.collectedPct)})</em></strong></div>
            <div className="f-list-item"><span>Outstanding (actual)</span><strong>{money(data.outstandingAmount)}</strong></div>
            {data.pendingCost > 0 && <div className="f-list-item"><span>Pending cost</span><strong>{money(data.pendingCost)} <em className="f-muted">(belum masuk margin)</em></strong></div>}
          </div>
        </div>
      </div>

      <div className="f-inline-alert info">
        <strong>Rule:</strong> Revenue basis menggunakan {basisLabel.toLowerCase()}. Actual cost menggunakan allocation expense berstatus <strong>APPROVED</strong>. Expense <strong>PENDING</strong> tetap ditampilkan sebagai pending cost dan belum mengurangi gross profit. Gross margin ini <strong>bukan final project P&amp;L</strong> apabila masih ada biaya yang belum tercatat/approved.
      </div>
      {data.pendingCost > 0 && <div className="f-inline-alert warning">
        <strong>Pending cost belum masuk margin:</strong> {money(data.pendingCost)} dari {data.pendingExpenseCount} expense pending.
      </div>}
    </Card></div>
  )
}
