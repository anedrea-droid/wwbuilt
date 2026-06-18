'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface WorkOrder {
  id: string; orderNumber: string; customerId: string; equipmentId: string
  status: string; technician: string; complaint: string; diagnosis: string
  workDone: string; laborHours: number; laborRate: number; dateIn: string
  dateComplete: string; datePickedUp: string; notes: string
  paymentMethod: string; amountCharged: number; amountPaid: number
}
interface Customer { id: string; name: string; phone: string; source: string; referralShop: string }
interface Equipment { id: string; type: string; make: string; model: string; year: string; serialNumber: string }
interface SavedPart { id: string; name: string; partNumber: string; supplier: string; cost: number; price: number }
interface Part {
  id: string; name: string; partNumber: string; supplier: string
  quantity: number; cost: number; price: number
  status: string; dateOrdered: string; dateReceived: string; notes: string
}

const STATUS_COLORS: Record<string, string> = {
  'pending':       'bg-yellow-100 text-yellow-800',
  'in-progress':   'bg-blue-100 text-blue-800',
  'waiting-parts': 'bg-orange-100 text-orange-800',
  'complete':      'bg-green-100 text-green-800',
  'picked-up':     'bg-gray-100 text-gray-800',
}

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [wo, setWo] = useState<WorkOrder | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<WorkOrder>>({})
  const [showAddPart, setShowAddPart] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)
  const [catalog, setCatalog] = useState<SavedPart[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [newPart, setNewPart] = useState({
    name: '', partNumber: '', supplier: '', quantity: 1,
    cost: '', price: '', dateOrdered: new Date().toISOString().split('T')[0],
  })
  const [saving, setSaving] = useState(false)
  const [editingPart, setEditingPart] = useState<string | null>(null)
  const [partForm, setPartForm] = useState<Partial<Part>>({})

  useEffect(() => {
    fetch('/api/work-orders/' + id)
      .then(r => r.json()).then(data => { setWo(data); setForm(data) })
    fetch('/api/parts?workOrderId=' + id)
      .then(r => r.json()).then(setParts)
    fetch('/api/saved-parts')
      .then(r => r.json()).then(setCatalog)
  }, [id])

  useEffect(() => {
    if (!wo) return
    fetch('/api/customers/' + wo.customerId).then(r => r.json()).then(data => setCustomer(data.customer ?? data))
    fetch('/api/equipment/' + wo.equipmentId).then(r => r.json()).then(setEquipment)
  }, [wo])

  async function saveWorkOrder() {
    setSaving(true)
    const res = await fetch('/api/work-orders/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const updated = await res.json()
    setWo(updated); setForm(updated); setEditing(false); setSaving(false)
  }

  async function addPart() {
    const res = await fetch('/api/parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newPart, workOrderId: id }),
    })
    const part = await res.json()
    setParts(p => [...p, part])
    setNewPart({ name: '', partNumber: '', supplier: '', quantity: 1, cost: '', price: '', dateOrdered: new Date().toISOString().split('T')[0] })
    setShowAddPart(false)
    setShowCatalog(false)
  }

  async function markReceived(partId: string) {
    const today = new Date().toISOString().split('T')[0]
    const res = await fetch('/api/parts/' + partId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'received', date_received: today }),
    })
    const updated = await res.json()
    setParts(p => p.map(x => x.id === partId ? updated : x))
    const woRes = await fetch('/api/work-orders/' + id)
    const woData = await woRes.json()
    setWo(woData)
    setForm(woData)
  }

  async function saveToCatalog(part: Part) {
    const res = await fetch('/api/saved-parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: part.name, partNumber: part.partNumber, supplier: part.supplier, cost: part.cost, price: part.price }),
    })
    const saved = await res.json()
    setCatalog(c => [...c, saved])
    alert(part.name + ' saved to catalog!')
  }

  function loadFromCatalog(saved: SavedPart) {
    setNewPart(p => ({ ...p, name: saved.name, partNumber: saved.partNumber, supplier: saved.supplier, cost: String(saved.cost), price: String(saved.price) }))
    setShowCatalog(false)
    setShowAddPart(true)
  }

  async function updatePart() {
    if (!editingPart) return
    const res = await fetch('/api/parts/' + editingPart, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: partForm.name,
        part_number: partForm.partNumber,
        supplier: partForm.supplier,
        quantity: partForm.quantity,
        cost: partForm.cost,
        price: partForm.price,
      }),
    })
    const updated = await res.json()
    setParts(p => p.map(x => x.id === editingPart ? updated : x))
    setEditingPart(null)
    setPartForm({})
  }

  async function deletePart(partId: string) {
    if (!confirm('Delete this part?')) return
    await fetch('/api/parts/' + partId, { method: 'DELETE' })
    setParts(p => p.filter(x => x.id !== partId))
  }

  async function deleteWorkOrder() {
    if (!confirm('Delete this work order? This cannot be undone.')) return
    await fetch('/api/work-orders/' + id, { method: 'DELETE' })
    router.push('/')
  }

  if (!wo) return <div className="p-8 text-gray-500">Loading...</div>

  const field = (label: string, key: keyof WorkOrder, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {editing ? (
        <input type={type} value={String(form[key] ?? '')}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full border rounded px-2 py-1 text-sm" />
      ) : (
        <p className="text-sm text-gray-800">{String(wo[key] || '-')}</p>
      )}
    </div>
  )

  const textarea = (label: string, key: keyof WorkOrder) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {editing ? (
        <textarea value={String(form[key] ?? '')}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          rows={3} className="w-full border rounded px-2 py-1 text-sm" />
      ) : (
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{String(wo[key] || '-')}</p>
      )}
    </div>
  )

  const partsTotal = parts.reduce((sum, p) => sum + (Number(p.price) * Number(p.quantity)), 0)
  const laborTotal = (wo.laborHours || 0) * (wo.laborRate || 80)

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-orange-500 hover:underline">Back to Work Orders</Link>
          <h1 className="text-2xl font-bold mt-1">Work Order #{wo.orderNumber}</h1>
        </div>
        <span className={'px-3 py-1 rounded-full text-xs font-semibold ' + (STATUS_COLORS[wo.status] || 'bg-gray-100 text-gray-700')}>
          {wo.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold text-gray-700 mb-2">Customer</h2>
          {customer ? (
            <>
              <p className="font-medium">{customer.name}</p>
              <p className="text-sm text-gray-500">{customer.phone}</p>
              {customer.source === 'referral' && (
                <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  Referral: {customer.referralShop}
                </span>
              )}
              <Link href={'/customers/' + customer.id} className="block text-xs text-orange-500 hover:underline mt-2">
                View customer
              </Link>
            </>
          ) : <p className="text-sm text-gray-400">Loading...</p>}
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold text-gray-700 mb-2">Equipment</h2>
          {equipment ? (
            <>
              <p className="font-medium">{equipment.make} {equipment.model}</p>
              <p className="text-sm text-gray-500">{equipment.year} {equipment.type}</p>
              {equipment.serialNumber && <p className="text-xs text-gray-400">S/N: {equipment.serialNumber}</p>}
            </>
          ) : <p className="text-sm text-gray-400">Loading...</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Work Details</h2>
          {editing ? (
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setForm(wo) }} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={saveWorkOrder} disabled={saving} className="text-sm bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="text-sm text-orange-500 hover:underline">Edit</button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            {editing ? (
              <select value={form.status || ''} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm">
                {['pending','in-progress','waiting-parts','complete','picked-up'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : <p className="text-sm text-gray-800 capitalize">{wo.status}</p>}
          </div>
          {field('Technician', 'technician')}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {field('Date In', 'dateIn', 'date')}
          {field('Date Complete', 'dateComplete', 'date')}
          {field('Date Picked Up', 'datePickedUp', 'date')}
        </div>
        {textarea('Complaint / Problem Reported', 'complaint')}
        {textarea('Diagnosis', 'diagnosis')}
        {textarea('Work Done', 'workDone')}
        {textarea('Notes', 'notes')}
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700">Parts</h2>
          <div className="flex gap-2">
            <button onClick={() => { setShowCatalog(v => !v); setShowAddPart(false) }}
              className="text-sm bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600">
              Pick from Catalog
            </button>
            <button onClick={() => { setShowAddPart(v => !v); setShowCatalog(false) }}
              className="text-sm bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600">
              + Add Part
            </button>
          </div>
        </div>

        {showCatalog && (
          <div className="border rounded-lg p-3 mb-4 bg-blue-50">
            <input
              autoFocus
              placeholder="Search catalog by name, part number or supplier..."
              value={catalogSearch}
              onChange={e => setCatalogSearch(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm mb-2"
            />
            {catalogSearch.length === 0 ? (
              <p className="text-xs text-gray-400">Start typing to search saved parts</p>
            ) : (() => {
              const q = catalogSearch.toLowerCase()
              const matches = catalog.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.partNumber.toLowerCase().includes(q) ||
                s.supplier.toLowerCase().includes(q)
              )
              return matches.length === 0 ? (
                <p className="text-xs text-gray-400">No matches found</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {matches.map(s => (
                    <button key={s.id} onClick={() => { loadFromCatalog(s); setCatalogSearch('') }}
                      className="w-full text-left px-3 py-2 bg-white rounded border hover:bg-blue-100 text-sm">
                      <span className="font-medium">{s.name}</span>
                      {s.partNumber && <span className="text-gray-400 ml-2">#{s.partNumber}</span>}
                      {s.supplier && <span className="text-gray-400 ml-2">- {s.supplier}</span>}
                      {Number(s.price) > 0 && <span className="text-gray-500 ml-2">${Number(s.price).toFixed(2)}</span>}
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>
        )}


        {showAddPart && (
          <div className="border rounded-lg p-3 mb-4 bg-orange-50 space-y-3">
            <p className="text-sm font-medium text-gray-700">New Part</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">Part Name *</label>
                <input value={newPart.name} onChange={e => setNewPart(p => ({ ...p, name: e.target.value }))}
                  className="w-full border rounded px-2 py-1 text-sm" placeholder="Air filter" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Part Number</label>
                <input value={newPart.partNumber} onChange={e => setNewPart(p => ({ ...p, partNumber: e.target.value }))}
                  className="w-full border rounded px-2 py-1 text-sm" placeholder="ABC-123" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Supplier</label>
                <input value={newPart.supplier} onChange={e => setNewPart(p => ({ ...p, supplier: e.target.value }))}
                  className="w-full border rounded px-2 py-1 text-sm" placeholder="NAPA, dealer..." />
              </div>
              <div>
                <label className="text-xs text-gray-500">Qty</label>
                <input type="number" value={newPart.quantity} onChange={e => setNewPart(p => ({ ...p, quantity: Number(e.target.value) }))}
                  className="w-full border rounded px-2 py-1 text-sm" min="1" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Our Cost ($)</label>
                <input type="number" value={newPart.cost} onChange={e => setNewPart(p => ({ ...p, cost: e.target.value }))}
                  className="w-full border rounded px-2 py-1 text-sm" placeholder="0.00" step="0.01" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Charge Customer ($)</label>
                <input type="number" value={newPart.price} onChange={e => setNewPart(p => ({ ...p, price: e.target.value }))}
                  className="w-full border rounded px-2 py-1 text-sm" placeholder="0.00" step="0.01" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Date Ordered</label>
                <input type="date" value={newPart.dateOrdered} onChange={e => setNewPart(p => ({ ...p, dateOrdered: e.target.value }))}
                  className="w-full border rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addPart} disabled={!newPart.name}
                className="bg-orange-500 text-white text-sm px-4 py-1 rounded-lg hover:bg-orange-600 disabled:opacity-50">
                Add Part
              </button>
              <button onClick={() => setShowAddPart(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          </div>
        )}

        {parts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No parts added yet</p>
        ) : (
          <div className="space-y-2">
            {parts.map(part => (
              <div key={part.id} className={'border rounded-lg p-3 ' + (part.status === 'received' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200')}>
                {editingPart === part.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Part Name</label>
                        <input value={partForm.name || ''} onChange={e => setPartForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full border rounded px-2 py-1 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Part Number</label>
                        <input value={partForm.partNumber || ''} onChange={e => setPartForm(f => ({ ...f, partNumber: e.target.value }))}
                          className="w-full border rounded px-2 py-1 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Supplier</label>
                        <input value={partForm.supplier || ''} onChange={e => setPartForm(f => ({ ...f, supplier: e.target.value }))}
                          className="w-full border rounded px-2 py-1 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Qty</label>
                        <input type="number" value={partForm.quantity || 1} onChange={e => setPartForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                          className="w-full border rounded px-2 py-1 text-sm" min="1" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Our Cost ($)</label>
                        <input type="number" value={partForm.cost || ''} onChange={e => setPartForm(f => ({ ...f, cost: Number(e.target.value) }))}
                          className="w-full border rounded px-2 py-1 text-sm" step="0.01" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Charge Customer ($)</label>
                        <input type="number" value={partForm.price || ''} onChange={e => setPartForm(f => ({ ...f, price: Number(e.target.value) }))}
                          className="w-full border rounded px-2 py-1 text-sm" step="0.01" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={updatePart}
                        className="text-xs bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600">
                        Save
                      </button>
                      <button onClick={() => { setEditingPart(null); setPartForm({}) }}
                        className="text-xs text-gray-500 hover:text-gray-700">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{part.name}</span>
                        {part.partNumber && <span className="text-xs text-gray-400">#{part.partNumber}</span>}
                        <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (part.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>
                          {part.status === 'received' ? 'Received' : 'Ordered'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-3">
                        {part.supplier && <span>Supplier: {part.supplier}</span>}
                        <span>Qty: {part.quantity}</span>
                        {Number(part.cost) > 0 && <span>Cost: ${Number(part.cost).toFixed(2)}</span>}
                        {Number(part.price) > 0 && <span className="font-medium text-gray-700">Charge: ${(Number(part.price) * Number(part.quantity)).toFixed(2)}</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-1 flex gap-3">
                        {part.dateOrdered && <span>Ordered: {part.dateOrdered}</span>}
                        {part.status === 'received' && part.dateReceived && <span>Received: {part.dateReceived}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 ml-2 shrink-0">
                      <button onClick={() => { setEditingPart(part.id); setPartForm(part) }}
                        className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200">
                        Edit
                      </button>
                      <button onClick={() => saveToCatalog(part)}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">
                        Save to Catalog
                      </button>
                      {part.status !== 'received' && (
                        <button onClick={() => markReceived(part.id)}
                          className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600">
                          Mark Received
                        </button>
                      )}
                      <button onClick={() => deletePart(part.id)}
                        className="text-xs text-red-400 hover:text-red-600 text-center">
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-4">
        <h2 className="font-semibold text-gray-700">Financials</h2>
        <div className="grid grid-cols-2 gap-4">
          {field('Labor Hours', 'laborHours', 'number')}
          {field('Labor Rate ($/hr)', 'laborRate', 'number')}
        </div>
        <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Labor ({wo.laborHours}h x ${wo.laborRate}/hr)</span>
            <span>${laborTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Parts ({parts.length} item{parts.length !== 1 ? 's' : ''})</span>
            <span>${partsTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-1 mt-1">
            <span>Estimated Total</span>
            <span>${(laborTotal + partsTotal).toFixed(2)}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Payment Method</label>
            {editing ? (
              <select value={form.paymentMethod || ''} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm">
                {['', 'cash', 'check', 'card', 'other'].map(m => (
                  <option key={m} value={m}>{m || '-'}</option>
                ))}
              </select>
            ) : <p className="text-sm text-gray-800 capitalize">{wo.paymentMethod || '-'}</p>}
          </div>
          {field('Amount Charged ($)', 'amountCharged', 'number')}
          {field('Amount Paid ($)', 'amountPaid', 'number')}
        </div>
        {editing && (
          <button onClick={saveWorkOrder} disabled={saving}
            className="w-full bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 font-medium">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      <div className="text-center pb-4">
        <button onClick={deleteWorkOrder} className="text-xs text-red-400 hover:text-red-600">
          Delete this work order
        </button>
      </div>
    </div>
  )
}
