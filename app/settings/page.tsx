'use client'
import { useEffect, useState } from 'react'

interface ReferralShop { id: string; name: string; is_default: boolean }

export default function SettingsPage() {
  const [laborRate, setLaborRate] = useState('80')
  const [shopName, setShopName] = useState('WW Small Engine')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const [shops, setShops] = useState<ReferralShop[]>([])
  const [newShopName, setNewShopName] = useState('')
  const [shopSaving, setShopSaving] = useState(false)
  const [shopError, setShopError] = useState('')

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.labor_rate) setLaborRate(data.labor_rate)
        if (data.shop_name) setShopName(data.shop_name)
        setLoading(false)
      })
      .catch(() => setLoading(false))
    loadShops()
  }, [])

  function loadShops() {
    fetch('/api/settings/referral-shops')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setShops(data) })
  }

  async function handleSave() {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labor_rate: laborRate, shop_name: shopName }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function addShop() {
    if (!newShopName.trim()) return
    setShopSaving(true)
    setShopError('')
    const res = await fetch('/api/settings/referral-shops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newShopName.trim() }),
    })
    const data = await res.json()
    if (data.error) { setShopError(data.error); setShopSaving(false); return }
    setNewShopName('')
    setShopSaving(false)
    loadShops()
  }

  async function deleteShop(id: string) {
    const res = await fetch('/api/settings/referral-shops/' + id, { method: 'DELETE' })
    const data = await res.json()
    if (data.error) { setShopError(data.error); return }
    loadShops()
  }

  async function setDefault(id: string) {
    await fetch('/api/settings/referral-shops/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_default: true }),
    })
    loadShops()
  }

  if (loading) return <div className="p-8 text-gray-500">Loading settings...</div>

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* General Settings */}
      <div className="bg-white rounded-xl shadow p-6 space-y-5">
        <h2 className="font-semibold text-gray-700">General</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
          <input type="text" value={shopName} onChange={e => setShopName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Hourly Labor Rate ($)</label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-lg">$</span>
            <input type="number" value={laborRate} onChange={e => setLaborRate(e.target.value)}
              className="w-32 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <span className="text-gray-500 text-sm">/ hour</span>
          </div>
        </div>
        <button onClick={handleSave}
          className="w-full bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 font-medium text-sm">
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* Referral Shops */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-700">Referral Shops</h2>
          <p className="text-xs text-gray-400 mt-1">These appear in the Referring Shop dropdown when adding a referral customer. The default shop is pre-selected automatically.</p>
        </div>

        {shopError && (
          <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded">{shopError}</p>
        )}

        <div className="space-y-2">
          {shops.map(shop => (
            <div key={shop.id} className="flex items-center justify-between py-2 px-3 rounded-lg border bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-800">{shop.name}</span>
                {shop.is_default && (
                  <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">Default</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!shop.is_default && (
                  <button onClick={() => setDefault(shop.id)}
                    className="text-xs text-blue-500 hover:underline">
                    Set Default
                  </button>
                )}
                {!shop.is_default && (
                  <button onClick={() => deleteShop(shop.id)}
                    className="text-xs text-red-400 hover:text-red-600 hover:underline">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <input type="text" value={newShopName} onChange={e => setNewShopName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addShop()}
            placeholder="New shop name..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <button onClick={addShop} disabled={shopSaving || !newShopName.trim()}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-40">
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
