'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SavedPart {
  id: string
  name: string
  partNumber: string
  supplier: string
  cost: number
  price: number
  quantityOnHand: number
  notes: string
}

export default function PartsInventoryPage() {
  const [parts, setParts] = useState<SavedPart[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [receiving, setReceiving] = useState(false)
  const [receiveForm, setReceiveForm] = useState({
    name: '', partNumber: '', supplier: '', cost: '', price: '', quantityOnHand: '1',
  })
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<SavedPart>>({})

  async function load() {
    setLoading(true)
    const res = await fetch('/api/saved-parts')
    const data = await res.json()
    setParts(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveReceive() {
    if (!receiveForm.name.trim()) return
    setSaving(true)
    await fetch('/api/saved-parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: receiveForm.name,
        partNumber: receiveForm.partNumber,
        supplier: receiveForm.supplier,
        cost: parseFloat(receiveForm.cost) || 0,
        price: parseFloat(receiveForm.price) || 0,
        quantityOnHand: parseInt(receiveForm.quantityOnHand, 10) || 0,
      }),
    })
    setReceiveForm({ name: '', partNumber: '', supplier: '', cost: '', price: '', quantityOnHand: '1' })
    setReceiving(false)
    setSaving(false)
    load()
  }

  async function saveEdit(id: string) {
    setSaving(true)
    await fetch('/api/saved-parts/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setEditId(null)
    setEditForm({})
    setSaving(false)
    load()
  }

  async function deletePart(id: string) {
    if (!confirm('Remove this part from inventory entirely?')) return
    await fetch('/api/saved-parts/' + id, { method: 'DELETE' })
    load()
  }

  const filtered = parts.filter(p =>
    !search.trim() ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.partNumber || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalValue = parts.reduce((s, p) => s + (Number(p.cost) || 0) * (Number(p.quantityOnHand) || 0), 0)
  const lowStock = parts.filter(p => Number(p.quantityOnHand) > 0 && Number(p.quantityOnHand) <= 2).length
  const outOfStock = parts.filter(p => Number(p.quantityOnHand) === 0).length

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parts Inventory</h1>
          <p className="text-sm text-gray-500">Parts purchased to keep in stock - pull them into a work order with cost/price already filled in</p>
        </div>
        <Button onClick={() => setReceiving(true)} className="bg-orange-500 hover:bg-orange-600">
          + Receive Stock
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Parts Tracked</p>
          <p className="text-2xl font-bold text-gray-900">{parts.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Inventory Value (Cost)</p>
          <p className="text-2xl font-bold text-orange-600">${totalValue.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Low Stock (1-2 left)</p>
          <p className="text-2xl font-bold text-yellow-600">{lowStock}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Out of Stock</p>
          <p className="text-2xl font-bold text-red-600">{outOfStock}</p>
        </div>
      </div>

      {receiving && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-gray-800 mb-3">Receive Stock</h3>
          <p className="text-xs text-gray-500 mb-3">If a part with this same name and part number already exists, this adds to its current quantity instead of creating a duplicate.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-500">Part Name</label>
              <Input value={receiveForm.name} onChange={e => setReceiveForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Air Filter" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Part Number</label>
              <Input value={receiveForm.partNumber} onChange={e => setReceiveForm(f => ({ ...f, partNumber: e.target.value }))} placeholder="optional" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Supplier</label>
              <Input value={receiveForm.supplier} onChange={e => setReceiveForm(f => ({ ...f, supplier: e.target.value }))} placeholder="optional" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Quantity Received</label>
              <Input type="number" min="1" value={receiveForm.quantityOnHand} onChange={e => setReceiveForm(f => ({ ...f, quantityOnHand: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Our Cost ($ each)</label>
              <Input type="number" step="0.01" value={receiveForm.cost} onChange={e => setReceiveForm(f => ({ ...f, cost: e.target.value }))} placeholder="0.00" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Charge Customer ($ each)</label>
              <Input type="number" step="0.01" value={receiveForm.price} onChange={e => setReceiveForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" className="mt-1" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={saveReceive} disabled={!receiveForm.name.trim() || saving} className="bg-orange-500 hover:bg-orange-600">
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline" onClick={() => setReceiving(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parts..." className="mb-3 max-w-sm" />

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">No parts in inventory yet.</p>
          <p className="text-sm mt-1">Click + Receive Stock to log parts you've purchased to keep on hand.</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(part => {
          const isEditing = editId === part.id
          const qty = Number(part.quantityOnHand) || 0
          return (
            <div key={part.id} className="bg-white border rounded-lg p-3">
              {isEditing ? (
                <div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-gray-500">Part Name</label>
                      <Input value={editForm.name ?? part.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Part Number</label>
                      <Input value={editForm.partNumber ?? part.partNumber ?? ''} onChange={e => setEditForm(f => ({ ...f, partNumber: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Supplier</label>
                      <Input value={editForm.supplier ?? part.supplier ?? ''} onChange={e => setEditForm(f => ({ ...f, supplier: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Quantity On Hand</label>
                      <Input type="number" value={editForm.quantityOnHand ?? part.quantityOnHand} onChange={e => setEditForm(f => ({ ...f, quantityOnHand: parseInt(e.target.value, 10) || 0 }))} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Our Cost ($)</label>
                      <Input type="number" step="0.01" value={editForm.cost ?? part.cost} onChange={e => setEditForm(f => ({ ...f, cost: parseFloat(e.target.value) || 0 }))} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Charge Customer ($)</label>
                      <Input type="number" step="0.01" value={editForm.price ?? part.price} onChange={e => setEditForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} className="mt-1" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => saveEdit(part.id)} disabled={saving} className="bg-orange-500 hover:bg-orange-600">Save</Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditId(null); setEditForm({}) }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{part.name}</p>
                      {part.partNumber && <span className="text-xs text-gray-400 font-mono">{part.partNumber}</span>}
                      <span className={
                        'text-xs px-2 py-0.5 rounded-full font-medium ' +
                        (qty === 0 ? 'bg-red-100 text-red-700' : qty <= 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700')
                      }>
                        {qty} in stock
                      </span>
                    </div>
                    <div className="flex gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                      {part.supplier && <span>Supplier: {part.supplier}</span>}
                      <span>Cost: ${Number(part.cost).toFixed(2)}</span>
                      <span>Charge: ${Number(part.price).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => { setEditId(part.id); setEditForm({}) }}>Edit</Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => deletePart(part.id)}>Remove</Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
