"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ArrowLeft, Phone, Mail, Wrench, ChevronRight, Edit, Save, X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Customer, Equipment, WorkOrderStatus } from "@/types"

interface WOSummary {
  id: string; orderNumber: string; status: WorkOrderStatus; technician: string
  complaint: string; dateIn: string
  equipment?: { type: string; make: string; model: string }
}
interface CustomerDetail {
  customer: Customer
  equipment: Equipment[]
  workOrders: WOSummary[]
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  'pending':       { label: 'Pending',         cls: 'bg-gray-100 text-gray-600' },
  'in-progress':   { label: 'In Progress',      cls: 'bg-blue-100 text-blue-700' },
  'waiting-parts': { label: 'Waiting Parts',    cls: 'bg-amber-100 text-amber-700' },
  'complete':      { label: 'Ready for Pickup', cls: 'bg-green-100 text-green-700' },
  'at-shop':       { label: 'At Referral Shop', cls: 'bg-purple-100 text-purple-700' },
  'picked-up':     { label: 'Picked Up',        cls: 'bg-slate-100 text-slate-500' },
  'donated':       { label: 'Donated to WW',     cls: 'bg-purple-100 text-purple-700' },
  'abandoned':     { label: 'WW Property',        cls: 'bg-red-100 text-red-700' },
}

const EQUIPMENT_TYPES = ['Mower','Riding Mower','Zero-Turn','Weed Eater','Trimmer','Line Trimmer','Chainsaw','Blower','Tiller','Generator','Pressure Washer','Concrete Saw','Other']

export default function CustomerDetail() {
  const params = useParams()
  const id = params.id as string

  const [data, setData] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState<'own' | 'referral'>('own')
  const [referralShop, setReferralShop] = useState('')
  const [referralShops, setReferralShops] = useState<{id:string;name:string;is_default:boolean}[]>([])
  const [notes, setNotes] = useState('')

  const [addingEquip, setAddingEquip] = useState(false)
  const [newType, setNewType] = useState('Mower')
  const [newTypeOther, setNewTypeOther] = useState('')
  const [newMake, setNewMake] = useState('')
  const [newModel, setNewModel] = useState('')
  const [newSerial, setNewSerial] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/customers/' + id)
      const d = await res.json()
      setData(d)
      setName(d.customer.name)
      setPhone(d.customer.phone)
      setEmail(d.customer.email)
      setSource(d.customer.source)
      setReferralShop(d.customer.referralShop)
      setNotes(d.customer.notes)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
    fetch('/api/settings/referral-shops').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setReferralShops(data)
    })
  }, [load])


  function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 10)
    if (digits.length < 4) return digits
    if (digits.length < 7) return '(' + digits.slice(0,3) + ') ' + digits.slice(3)
    return '(' + digits.slice(0,3) + ') ' + digits.slice(3,6) + '-' + digits.slice(6)
  }

  async function saveCustomer() {
    setSaving(true)
    await fetch('/api/customers/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, source, referralShop, notes })
    })
    setEditing(false)
    setSaving(false)
    await load()
  }

  async function addEquipment() {
    if (!newMake.trim()) return
    setSaving(true)
    await fetch('/api/equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: id, type: newType === 'Other' ? (newTypeOther.trim() || 'Other') : newType, make: newMake, model: newModel, serialNumber: newSerial })
    })
    setAddingEquip(false)
    setNewMake(''); setNewModel(''); setNewSerial(''); setNewType('Mower')
    setSaving(false)
    await load()
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto px-3 pt-4 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  )

  if (!data) return (
    <div className="max-w-2xl mx-auto px-3 pt-4 text-center py-12">
      <p className="text-slate-500">Customer not found.</p>
      <Link href="/customers" className="text-orange-600 underline mt-2 inline-block">Back to Customers</Link>
    </div>
  )

  const { customer: c, equipment, workOrders } = data
  const activeJobs = workOrders.filter(wo => wo.status !== 'picked-up' && (wo.status as string) !== 'donated' && (wo.status as string) !== 'abandoned')

  return (
    <div className="max-w-2xl mx-auto px-3 pt-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Link href="/customers" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">{c.name}</h1>
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
            c.source === 'own' ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"
          )}>
            {c.source === 'own' ? 'Our Customer' : (c.referralShop ? 'Referral via ' + c.referralShop : 'Referral')}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Contact Info</CardTitle>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Edit className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button size="sm" onClick={saveCustomer} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
                <Save className="h-3.5 w-3.5 mr-1" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {editing ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input value={phone} onChange={e => setPhone(formatPhone(e.target.value))} type="tel" className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} type="email" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Source</Label>
                <div className="flex gap-2 mt-1">
                  {(['own', 'referral'] as const).map(s => (
                    <button key={s} onClick={() => setSource(s)}
                      className={cn("flex-1 py-1.5 rounded text-sm font-medium border",
                        source === s ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-600 border-slate-200"
                      )}>
                      {s === 'own' ? ' Our Customer' : ' Referral'}
                    </button>
                  ))}
                </div>
              </div>
              {source === 'referral' && (
                <div>
                  <Label className="text-xs">Referring Shop</Label>
                  <select value={referralShop} onChange={e => setReferralShop(e.target.value)}
                    className="w-full border rounded-md px-2 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <option value="">Select shop...</option>
                    {referralShops.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <Label className="text-xs">Notes</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" className="mt-1" />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {c.phone ? (
                <a href={'tel:' + c.phone} className="flex items-center gap-2 text-sm text-slate-700 hover:text-orange-600">
                  <Phone className="h-4 w-4 text-slate-400" />
                  {c.phone}
                </a>
              ) : <p className="text-sm text-slate-400 italic">No phone</p>}
              {c.email && (
                <a href={'mailto:' + c.email} className="flex items-center gap-2 text-sm text-slate-700 hover:text-orange-600">
                  <Mail className="h-4 w-4 text-slate-400" />
                  {c.email}
                </a>
              )}
              {c.notes && <p className="text-sm text-slate-500">{c.notes}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4 text-orange-500" />
            Equipment ({equipment.length})
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setAddingEquip(!addingEquip)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {addingEquip && (
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 space-y-2">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={newType} onValueChange={v => { setNewType(v); if (v !== 'Other') setNewTypeOther('') }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EQUIPMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                {newType === 'Other' && (
                  <Input value={newTypeOther} onChange={e => setNewTypeOther(e.target.value)}
                    placeholder="Describe equipment type" className="mt-1" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Make *</Label>
                  <Input value={newMake} onChange={e => setNewMake(e.target.value)} placeholder="Husqvarna" />
                </div>
                <div>
                  <Label className="text-xs">Model</Label>
                  <Input value={newModel} onChange={e => setNewModel(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Serial Number</Label>
                <Input value={newSerial} onChange={e => setNewSerial(e.target.value)} placeholder="Optional" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addEquipment} disabled={!newMake.trim() || saving} className="flex-1 bg-orange-600 hover:bg-orange-700">Save</Button>
                <Button size="sm" variant="outline" onClick={() => setAddingEquip(false)} className="flex-1">Cancel</Button>
              </div>
            </div>
          )}
          {equipment.length === 0 && !addingEquip ? (
            <p className="text-sm text-slate-400 italic">No equipment on file.</p>
          ) : (
            equipment.map(e => (
              <div key={e.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border">
                <Wrench className="h-4 w-4 text-orange-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700">{e.type}  {e.make} {e.model}</div>
                  {e.serialNumber && <div className="text-xs text-slate-400">S/N: {e.serialNumber}</div>}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-base">
            Work Orders
            {activeJobs.length > 0 && (
              <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                {activeJobs.length} active
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {workOrders.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No work orders yet.</p>
          ) : (
            workOrders.map(wo => {
              const scfg = STATUS_CFG[wo.status]
              return (
                <Link key={wo.id} href={'/work-orders/' + wo.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border hover:bg-slate-100 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-slate-700">{wo.orderNumber}</span>
                      {scfg && <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", scfg.cls)}>{scfg.label}</span>}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {wo.equipment ? wo.equipment.type + '  ' + wo.equipment.make + ' ' + wo.equipment.model : ''}  {wo.technician}
                    </div>
                    {wo.complaint && <p className="text-xs text-slate-400 truncate italic">"{wo.complaint}"</p>}
                  </div>
                  <div className="text-xs text-slate-400 flex-shrink-0">
                    {wo.dateIn ? format(parseISO(wo.dateIn + 'T12:00:00'), 'MMM d') : ''}
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
                </Link>
              )
            })
          )}
          <div className="pt-1">
            <Link href="/work-orders/new">
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-1" /> New Job for this Customer
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
