"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, User, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Customer, Equipment } from "@/types"

const EQUIPMENT_TYPES = ['Mower','Riding Mower','Zero-Turn','Weed Eater','Trimmer','Line Trimmer','Chainsaw','Blower','Tiller','Generator','Pressure Washer','Other']

export default function NewWorkOrder() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('')
  const [technician, setTechnician] = useState<'Wade' | 'Wayne'>('Wade')
  const [complaint, setComplaint] = useState('')
  const [dateIn, setDateIn] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  // New customer inline form
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [newCustEmail, setNewCustEmail] = useState('')
  const [newCustSource, setNewCustSource] = useState<'own' | 'referral'>('own')
  const [newCustShop, setNewCustShop] = useState('')

  // New equipment inline form
  const [addingEquip, setAddingEquip] = useState(false)
  const [newEquipType, setNewEquipType] = useState('Mower')
  const [newEquipMake, setNewEquipMake] = useState('')
  const [newEquipModel, setNewEquipModel] = useState('')
  const [newEquipSerial, setNewEquipSerial] = useState('')

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(setCustomers)
  }, [])

  const loadEquipment = useCallback((custId: string) => {
    if (!custId) { setEquipment([]); return }
    fetch(`/api/equipment?customerId=${custId}`).then(r => r.json()).then(setEquipment)
  }, [])

  useEffect(() => {
    loadEquipment(selectedCustomerId)
    setSelectedEquipmentId('')
    setAddingEquip(false)
  }, [selectedCustomerId, loadEquipment])

  async function handleSaveCustomer() {
    if (!newCustName.trim()) return
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCustName, phone: newCustPhone, email: newCustEmail, source: newCustSource, referralShop: newCustShop })
    })
    const c = await res.json()
    setCustomers(prev => [...prev, c].sort((a,b) => a.name.localeCompare(b.name)))
    setSelectedCustomerId(c.id)
    setAddingCustomer(false)
    setNewCustName(''); setNewCustPhone(''); setNewCustEmail(''); setNewCustSource('own'); setNewCustShop('')
  }

  async function handleSaveEquipment() {
    if (!newEquipMake.trim() || !selectedCustomerId) return
    const res = await fetch('/api/equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: selectedCustomerId, type: newEquipType, make: newEquipMake, model: newEquipModel, serialNumber: newEquipSerial })
    })
    const e = await res.json()
    setEquipment(prev => [...prev, e])
    setSelectedEquipmentId(e.id)
    setAddingEquip(false)
    setNewEquipMake(''); setNewEquipModel(''); setNewEquipSerial(''); setNewEquipType('Mower')
  }

  async function handleSubmit() {
    if (!selectedCustomerId || !selectedEquipmentId || !complaint.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selectedCustomerId, equipmentId: selectedEquipmentId, technician, complaint, dateIn, notes })
      })
      const wo = await res.json()
      router.push(`/work-orders/${wo.id}`)
    } catch {
      setSaving(false)
    }
  }

  const canSubmit = selectedCustomerId && selectedEquipmentId && complaint.trim()

  return (
    <div className="max-w-2xl mx-auto px-3 pt-4">
      <div className="flex items-center gap-2 mb-4">
        <Link href="/" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-slate-800">New Work Order</h1>
      </div>

      <div className="space-y-4">
        {/* CUSTOMER */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-orange-500" />
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {!addingCustomer ? (
              <>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.phone ? ' - ' + c.phone : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setAddingCustomer(true)} className="w-full">
                  <Plus className="h-4 w-4 mr-1" /> Add New Customer
                </Button>
              </>
            ) : (
              <div className="space-y-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm font-semibold text-orange-700">New Customer</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Name *</Label>
                    <Input value={newCustName} onChange={e => setNewCustName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div>
                    <Label className="text-xs">Phone</Label>
                    <Input value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} placeholder="(361) 555-0000" type="tel" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} placeholder="Optional" type="email" />
                </div>
                <div>
                  <Label className="text-xs">Customer Source</Label>
                  <div className="flex gap-2 mt-1">
                    {(['own', 'referral'] as const).map(s => (
                      <button key={s} onClick={() => setNewCustSource(s)}
                        className={cn("flex-1 py-1.5 rounded text-sm font-medium border transition-colors",
                          newCustSource === s ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        )}>
                        {s === 'own' ? 'Our Customer' : 'Referral'}
                      </button>
                    ))}
                  </div>
                </div>
                {newCustSource === 'referral' && (
                  <div>
                    <Label className="text-xs">Referring Shop</Label>
                    <Input value={newCustShop} onChange={e => setNewCustShop(e.target.value)} placeholder="Shop name" />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveCustomer} disabled={!newCustName.trim()} className="flex-1 bg-orange-600 hover:bg-orange-700">
                    Save Customer
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAddingCustomer(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* EQUIPMENT */}
        {(selectedCustomerId || addingCustomer) && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4 text-orange-500" />
                Equipment
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {!addingEquip ? (
                <>
                  {equipment.length > 0 ? (
                    <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select equipment..." />
                      </SelectTrigger>
                      <SelectContent>
                        {equipment.map(e => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.type} - {e.make} {e.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No equipment on file for this customer.</p>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setAddingEquip(true)} className="w-full" disabled={!selectedCustomerId}>
                    <Plus className="h-4 w-4 mr-1" /> Add New Equipment
                  </Button>
                </>
              ) : (
                <div className="space-y-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-sm font-semibold text-orange-700">New Equipment</p>
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select value={newEquipType} onValueChange={setNewEquipType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EQUIPMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Make *</Label>
                      <Input value={newEquipMake} onChange={e => setNewEquipMake(e.target.value)} placeholder="Husqvarna, STIHL..." />
                    </div>
                    <div>
                      <Label className="text-xs">Model</Label>
                      <Input value={newEquipModel} onChange={e => setNewEquipModel(e.target.value)} placeholder="YTH24V48..." />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Serial Number</Label>
                    <Input value={newEquipSerial} onChange={e => setNewEquipSerial(e.target.value)} placeholder="Optional" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEquipment} disabled={!newEquipMake.trim()} className="flex-1 bg-orange-600 hover:bg-orange-700">
                      Save Equipment
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAddingEquip(false)} className="flex-1">Cancel</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* JOB DETAILS */}
        {selectedEquipmentId && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-base">Job Details</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <Label className="text-xs font-semibold">Assigned To *</Label>
                <div className="flex gap-2 mt-1">
                  {(['Wade', 'Wayne'] as const).map(t => (
                    <button key={t} onClick={() => setTechnician(t)}
                      className={cn("flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors",
                        technician === t
                          ? t === 'Wade' ? "bg-orange-600 text-white border-orange-600"
                            : t === 'Wayne' ? "bg-blue-600 text-white border-blue-600"
                            : "bg-purple-600 text-white border-purple-600"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Date Brought In</Label>
                <Input type="date" value={dateIn} onChange={e => setDateIn(e.target.value)} className="mt-1" />
              </div>

              <div>
                <Label className="text-xs font-semibold">Problem / Complaint *</Label>
                <Textarea
                  value={complaint}
                  onChange={e => setComplaint(e.target.value)}
                  placeholder="What is the customer saying is wrong with it?"
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any other notes..."
                  rows={2}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        {selectedEquipmentId && (
          <Button
            size="lg"
            className="w-full bg-orange-600 hover:bg-orange-700 text-base font-semibold h-12"
            disabled={!canSubmit || saving}
            onClick={handleSubmit}
          >
            {saving ? 'Creating...' : 'Create Work Order'}
          </Button>
        )}
      </div>
    </div>
  )
}
