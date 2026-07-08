'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', source: 'own', referralShop: '', notes: '' })
  const [referralShops, setReferralShops] = useState<{id:string;name:string;is_default:boolean}[]>([])
  const router = useRouter()

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(data => { setCustomers(data); setLoading(false) })
    fetch('/api/settings/referral-shops').then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setReferralShops(data)
        const def = data.find((s: {is_default:boolean;name:string}) => s.is_default)
          || data.find((s: {name:string}) => s.name === 'Seguin Small Engine')
          || data[0]
        if (def) setForm(f => ({ ...f, referralShop: def.name }))
      }
    })
  }, [])


  function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 10)
    if (digits.length < 4) return digits
    if (digits.length < 7) return '(' + digits.slice(0,3) + ') ' + digits.slice(3)
    return '(' + digits.slice(0,3) + ') ' + digits.slice(3,6) + '-' + digits.slice(6)
  }

  async function addCustomer() {
    if (!form.name.trim()) return alert('Name is required')
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const newC = await res.json()
    router.push('/customers/' + newC.id)
  }

  if (loading) return <div className="p-8 text-gray-500">Loadingâ€¦</div>

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <button onClick={() => setShowAdd(v => !v)}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600">
          + Add Customer
        </button>
      </div>

      {showAdd && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
          <p className="font-semibold text-gray-700">New Customer</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm" placeholder="Full name" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
                className="w-full border rounded px-2 py-1 text-sm" placeholder="555-1234" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Email</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm" placeholder="optional" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Customer Type</label>
              <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm">
                <option value="own">Our Customer</option>
                <option value="referral">Referral from another shop</option>
              </select>
            </div>
            {form.source === 'referral' && (
              <div className="col-span-2">
                <label className="text-xs text-gray-500">Referring Shop Name</label>
                <select value={form.referralShop} onChange={e => setForm(f => ({ ...f, referralShop: e.target.value }))}
                  className="w-full border rounded px-2 py-1 text-sm">
                  <option value="">Select shop...</option>
                  {referralShops.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className="text-xs text-gray-500">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm" placeholder="optional" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addCustomer}
              className="bg-orange-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-orange-600">
              Save Customer
            </button>
            <button onClick={() => setShowAdd(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {customers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No customers yet</p>
          <p className="text-sm mt-1">Click + Add Customer to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map(c => (
            <Link key={c.id} href={'/customers/' + c.id}
              className="block bg-white rounded-xl shadow px-4 py-3 hover:bg-orange-50 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-gray-500">{c.phone || 'No phone'}</p>
                </div>
                {c.source === 'referral' && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    Referral
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
