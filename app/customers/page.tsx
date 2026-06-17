'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [customer, setCustomer] = useState<any>(null)
  const [equipment, setEquipment] = useState<any[]>([])
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})

  useEffect(() => {
    fetch(`/api/customers/${id}`).then(r => r.json()).then(d => { setCustomer(d); setForm(d) })
    fetch(`/api/equipment?customerId=${id}`).then(r => r.json()).then(setEquipment)
    fetch(`/api/work-orders?customerId=${id}`).then(r => r.json()).then(setWorkOrders)
  }, [id])

  async function save() {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const updated = await res.json()
    setCustomer(updated); setForm(updated); setEditing(false)
  }

  async function deleteCustomer() {
    if (!confirm('Delete this customer and all their records?')) return
    await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    router.push('/customers')
  }

  if (!customer) return <div className="p-8 text-gray-500">Loading…</div>

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/customers" className="text-sm text-orange-500 hover:underline">← Customers</Link>
          <h1 className="text-2xl font-bold mt-1">{customer.name}</h1>
        </div>
        {customer.source === 'referral' && (
          <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full">
            Referral: {customer.referralShop}
          </span>
        )}
      </div>

      {/* Customer Info */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-gray-700">Contact Info</h2>
          {editing
            ? <div className="flex gap-2">
                <button onClick={() => { setEditing(false); setForm(customer) }} className="text-sm text-gray-500">Cancel</button>
                <button onClick={save} className="text-sm bg-orange-500 text-white px-3 py-1 rounded-lg">Save</button>
              </div>
            : <button onClick={() => setEditing(true)} className="text-sm text-orange-500 hover:underline">Edit</button>
          }
        </div>
        {['name','phone','email','notes'].map(field => (
          <div key={field}>
            <label className="block text-xs text-gray-500 capitalize">{field}</label>
            {editing
              ? <input value={form[field] || ''} onChange={e => setForm((f: any) => ({ ...f, [field]: e.target.value }))}
                  className="w-full border rounded px-2 py-1 text-sm" />
              : <p className="text-sm">{customer[field] || '—'}</p>
            }
          </div>
        ))}
        <div>
          <label className="block text-xs text-gray-500">Customer Type</label>
          {editing
            ? <select value={form.source || 'own'} onChange={e => setForm((f: any) => ({ ...f, source: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm">
                <option value="own">Our Customer</option>
                <option value="referral">Referral from another shop</option>
              </select>
            : <p className="text-sm capitalize">{customer.source === 'referral' ? `Referral from ${customer.referralShop}` : 'Our Customer'}</p>
          }
        </div>
        {editing && form.source === 'referral' && (
          <div>
            <label className="block text-xs text-gray-500">Referring Shop</label>
            <input value={form.referralShop || ''} onChange={e => setForm((f: any) => ({ ...f, referral_shop: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
        )}
      </div>

      {/* Equipment */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold text-gray-700 mb-3">Equipment ({equipment.length})</h2>
        {equipment.length === 0
          ? <p className="text-sm text-gray-400">No equipment on file</p>
          : <div className="space-y-2">
              {equipment.map(eq => (
                <div key={eq.id} className="border rounded-lg p-3 text-sm">
                  <p className="font-medium">{eq.make} {eq.model}</p>
                  <p className="text-gray-500">{eq.year} {eq.type} {eq.serialNumber ? `· S/N: ${eq.serialNumber}` : ''}</p>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Work Orders */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold text-gray-700 mb-3">Work Orders ({workOrders.length})</h2>
        {workOrders.length === 0
          ? <p className="text-sm text-gray-400">No work orders</p>
          : <div className="space-y-2">
              {workOrders.map(wo => (
                <Link key={wo.id} href={`/work-orders/${wo.id}`}
                  className="block border rounded-lg p-3 hover:bg-orange-50 transition">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">#{wo.orderNumber}</span>
                    <span className="capitalize text-gray-500">{wo.status}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{wo.complaint || 'No description'}</p>
                </Link>
              ))}
            </div>
        }
      </div>

      <div className="text-center pb-4">
        <button onClick={deleteCustomer} className="text-xs text-red-400 hover:text-red-600">Delete customer</button>
      </div>
    </div>
  )
}
