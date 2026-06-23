'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ShopItem {
  id: string
  work_order_id: string | null
  wo_number: string | null
  equipment_description: string
  acquisition_type: string
  acquired_date: string | null
  date_in: string | null
  condition_notes: string | null
  status: string
  asking_price: number | null
  sale_price: number | null
  sale_date: string | null
}

const STATUS_OPTIONS = ['available', 'being-repaired', 'sold', 'parts-only']
const STATUS_COLORS: Record<string, string> = {
  'available': 'bg-green-100 text-green-700',
  'being-repaired': 'bg-blue-100 text-blue-700',
  'sold': 'bg-gray-100 text-gray-500',
  'parts-only': 'bg-yellow-100 text-yellow-700'
}
const ACQ_COLORS: Record<string, string> = {
  'abandoned': 'bg-red-100 text-red-700',
  'donated': 'bg-purple-100 text-purple-700'
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return '-'
  return String(dateStr).slice(0, 10)
}

export default function ShopEquipmentPage() {
  const [items, setItems] = useState<ShopItem[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<ShopItem>>({})
  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState({
    equipment_description: '',
    acquisition_type: 'donated',
    acquired_date: '',
    condition_notes: '',
    status: 'available',
    asking_price: '',
    sale_price: '',
    sale_date: ''
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/shop-equipment')
    setItems(await res.json())
  }

  useEffect(() => { load() }, [])

  async function saveEdit(id: string) {
    setSaving(true)
    await fetch('/api/shop-equipment/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm)
    })
    setEditId(null)
    setEditForm({})
    setSaving(false)
    load()
  }

  async function deleteItem(id: string) {
    if (!confirm('Remove this item from the shop equipment list?')) return
    await fetch('/api/shop-equipment/' + id, { method: 'DELETE' })
    load()
  }

  async function saveNew() {
    setSaving(true)
    await fetch('/api/shop-equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newForm,
        asking_price: newForm.asking_price ? parseFloat(newForm.asking_price) : null,
        sale_price: newForm.sale_price ? parseFloat(newForm.sale_price) : null,
        acquired_date: newForm.acquired_date || null,
        sale_date: newForm.sale_date || null
      })
    })
    setAdding(false)
    setNewForm({ equipment_description: '', acquisition_type: 'donated', acquired_date: '', condition_notes: '', status: 'available', asking_price: '', sale_price: '', sale_date: '' })
    setSaving(false)
    load()
  }

  const totalSold = items.filter(i => i.status === 'sold').reduce((s, i) => s + (i.sale_price || 0), 0)
  const available = items.filter(i => i.status === 'available' || i.status === 'being-repaired').length

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shop Equipment</h1>
          <p className="text-sm text-gray-500">Abandoned and donated equipment acquired by WW</p>
        </div>
        <Button onClick={() => setAdding(true)} className="bg-orange-500 hover:bg-orange-600">
          + Add Equipment
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Units</p>
          <p className="text-2xl font-bold text-gray-900">{items.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Available / In Repair</p>
          <p className="text-2xl font-bold text-green-600">{available}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Revenue from Sales</p>
          <p className="text-2xl font-bold text-orange-600">${totalSold.toFixed(2)}</p>
        </div>
      </div>

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-gray-800 mb-3">Add Equipment Manually</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-500">Equipment Description</label>
              <Input value={newForm.equipment_description} onChange={e => setNewForm(f => ({ ...f, equipment_description: e.target.value }))} placeholder="e.g. Husqvarna 21in Push Mower" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">How Acquired</label>
              <select value={newForm.acquisition_type} onChange={e => setNewForm(f => ({ ...f, acquisition_type: e.target.value }))} className="mt-1 w-full border rounded-md px-3 py-2 text-sm">
                <option value="donated">Donated</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Date Acquired</label>
              <Input type="date" value={newForm.acquired_date} onChange={e => setNewForm(f => ({ ...f, acquired_date: e.target.value }))} className="mt-1" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-500">Condition Notes</label>
              <Input value={newForm.condition_notes} onChange={e => setNewForm(f => ({ ...f, condition_notes: e.target.value }))} placeholder="Brief description of condition" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Status</label>
              <select value={newForm.status} onChange={e => setNewForm(f => ({ ...f, status: e.target.value }))} className="mt-1 w-full border rounded-md px-3 py-2 text-sm">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Asking Price ($)</label>
              <Input type="number" value={newForm.asking_price} onChange={e => setNewForm(f => ({ ...f, asking_price: e.target.value }))} placeholder="0.00" className="mt-1" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={saveNew} disabled={!newForm.equipment_description.trim() || saving} className="bg-orange-500 hover:bg-orange-600">Save</Button>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {items.length === 0 && !adding && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">No shop equipment recorded yet.</p>
          <p className="text-sm mt-1">Equipment marked as abandoned or donated on work orders will appear here.</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map(item => {
          const isEditing = editId === item.id
          const days = daysSince(item.acquired_date || item.date_in)
          return (
            <div key={item.id} className="bg-white border rounded-lg p-4">
              {isEditing ? (
                <div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-gray-500">Equipment Description</label>
                      <Input value={editForm.equipment_description ?? item.equipment_description} onChange={e => setEditForm(f => ({ ...f, equipment_description: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">How Acquired</label>
                      <select value={editForm.acquisition_type ?? item.acquisition_type} onChange={e => setEditForm(f => ({ ...f, acquisition_type: e.target.value }))} className="mt-1 w-full border rounded-md px-3 py-2 text-sm">
                        <option value="donated">Donated</option>
                        <option value="abandoned">Abandoned</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Date Acquired</label>
                      <Input type="date" value={(editForm.acquired_date ?? item.acquired_date ?? '').toString().slice(0,10)} onChange={e => setEditForm(f => ({ ...f, acquired_date: e.target.value }))} className="mt-1" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-gray-500">Condition Notes</label>
                      <Input value={editForm.condition_notes ?? item.condition_notes ?? ''} onChange={e => setEditForm(f => ({ ...f, condition_notes: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Status</label>
                      <select value={editForm.status ?? item.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="mt-1 w-full border rounded-md px-3 py-2 text-sm">
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Asking Price ($)</label>
                      <Input type="number" value={editForm.asking_price ?? item.asking_price ?? ''} onChange={e => setEditForm(f => ({ ...f, asking_price: parseFloat(e.target.value) || null }))} className="mt-1" />
                    </div>
                    {(editForm.status === 'sold' || item.status === 'sold') && (
                      <>
                        <div>
                          <label className="text-xs font-medium text-gray-500">Sale Price ($)</label>
                          <Input type="number" value={editForm.sale_price ?? item.sale_price ?? ''} onChange={e => setEditForm(f => ({ ...f, sale_price: parseFloat(e.target.value) || null }))} className="mt-1" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">Sale Date</label>
                          <Input type="date" value={(editForm.sale_date ?? item.sale_date ?? '').toString().slice(0,10)} onChange={e => setEditForm(f => ({ ...f, sale_date: e.target.value }))} className="mt-1" />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button onClick={() => saveEdit(item.id)} disabled={saving} className="bg-orange-500 hover:bg-orange-600">Save</Button>
                    <Button variant="outline" onClick={() => { setEditId(null); setEditForm({}) }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{item.equipment_description}</p>
                      <span className={'text-xs px-2 py-0.5 rounded-full font-medium capitalize ' + (ACQ_COLORS[item.acquisition_type] || 'bg-gray-100 text-gray-600')}>
                        {item.acquisition_type}
                      </span>
                      <span className={'text-xs px-2 py-0.5 rounded-full font-medium capitalize ' + (STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-600')}>
                        {item.status}
                      </span>
                      {item.work_order_id && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">from WO</span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                      <span>Acquired: {fmt(item.acquired_date)}</span>
                      {days !== null && item.status !== 'sold' && (
                        <span className={days > 60 ? 'text-red-600 font-medium' : days > 30 ? 'text-yellow-600' : ''}>
                          {days} days in shop
                        </span>
                      )}
                      {item.condition_notes && <span>Condition: {item.condition_notes}</span>}
                      {item.asking_price != null && item.status !== 'sold' && (
                        <span className="text-green-700 font-medium">Asking: ${Number(item.asking_price).toFixed(2)}</span>
                      )}
                      {item.status === 'sold' && item.sale_price != null && (
                        <span className="text-gray-700 font-medium">Sold: ${Number(item.sale_price).toFixed(2)} on {fmt(item.sale_date)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => { setEditId(item.id); setEditForm({}) }}>Edit</Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => deleteItem(item.id)}>Remove</Button>
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
