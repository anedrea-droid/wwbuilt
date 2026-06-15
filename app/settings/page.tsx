'use client'
import { useEffect, useState } from 'react'

export default function SettingsPage() {
  const [laborRate, setLaborRate] = useState('80')
  const [shopName, setShopName] = useState('WW Small Engine')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.labor_rate) setLaborRate(data.labor_rate)
        if (data.shop_name) setShopName(data.shop_name)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labor_rate: laborRate, shop_name: shopName }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div className="p-8 text-gray-500">Loading settings…</div>

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="bg-white rounded-xl shadow p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Shop Name
          </label>
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Hourly Labor Rate ($)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-lg">$</span>
            <input
              type="number"
              value={laborRate}
              onChange={(e) => setLaborRate(e.target.value)}
              className="w-32 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              min="0"
              step="5"
            />
            <span className="text-gray-500 text-sm">/ hour</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            This rate will pre-fill on all new work orders.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 rounded-lg transition"
        >
          {saved ? '✓ Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
