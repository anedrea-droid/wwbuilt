"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ArrowLeft, Edit, Save, X, Plus, Trash, Phone, Package, DollarSign, CheckCircle, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { WorkOrderStatus, TechName, PartStatus } from "@/types"

interface WO {
  id: string; orderNumber: string; status: WorkOrderStatus; technician: TechName
  complaint: string; diagnosis: string; workDone: string
  laborHours: number; laborRate: number
  dateIn: string; dateComplete: string; datePickedUp: string
  notes: string; paymentMethod: string; amountCharged: number; amountPaid: number
  customer?: { id: string; name: string; phone: string; source: string; referralShop: string }
  equipment?: { id: string; type: string; make: string; model: string; serialNumber: string }
  parts?: Part[]
}
interface Part {
  id: string; name: string; partNumber: string; supplier: string
  unitCost: number; quantity: number; status: PartStatus
  dateOrdered: string; dateReceived: string
}

const STATUS_FLOW: WorkOrderStatus[] = ['pending', 'in-progress', 'waiting-parts', 'complete', 'picked-up']
const STATUS_CFG: Record<WorkOrderStatus, { label: string; cls: string; dot: string }> = {
  'pending':       { label: 'Pending',         cls: 'bg-gray-100 text-gray-700',   dot: 'bg-gray-400' },
  'in-progress':   { label: 'In Progress',      cls: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  'waiting-parts': { label: 'Waiting Parts',    cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  'complete':      { label: 'Ready for Pickup', cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  'picked-up':     { label: 'Picked Up',        cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
}
const TECH_CFG: Record<string, string> = {
  'Wade': 'bg-orange-100 text-orange-700', 'Wayne': 'bg-blue-100 text-blue-700', 'Both': 'bg-purple-100 text-purple-700'
}

export default function WorkOrderDetail() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [wo, setWo] = useState<WO | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit states
  const [editJob, setEditJob] = useState(false)
  const [editPayment, setEditPayment] = useState(false)
  const [addingPart, setAddingPart] = useState(false)

  // Job edit fields
  const [diagnosis, setDiagnosis] = useState('')
  const [workDone, setWorkDone] = useState('')
  const [laborHours, setLaborHours] = useState('0')
  const [laborRate, setLaborRate] = useState('65')
  const [notes, setNotes] = useState('')
  const [technician, setTechnician] = useState<TechName>('Wade')

  // Payment fields
  const [amountCharged, setAmountCharged] = useState('0')
  const [amountPaid, setAmountPaid] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState('')

  // New part fields
  const [partName, setPartName] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [partSupplier, setPartSupplier] = useState('')
  const [partCost, setPartCost] = useState('0')
  const [partQty, setPartQty] = useState('1')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${id}`)
      const data = await res.json()
      setWo(data)
      setDiagnosis(data.diagnosis || '')
      setWorkDone(data.workDone || '')
      setLaborHours(String(data.laborHours || 0))
      setLaborRate(String(data.laborRate || 65))
      setNotes(data.notes || '')
      setTechnician(data.technician || 'Wade')
      setAmountCharged(String(data.amountCharged || 0))
      setAmountPaid(String(data.amountPaid || 0))
      setPaymentMethod(data.paymentMethod || '')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function updateWO(patch: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch(`/api/work-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      })
      const data = await res.json()
      setWo(data)
      setDiagnosis(data.diagnosis || '')
      setWorkDone(data.workDone || '')
      setLaborHours(String(data.laborHours || 0))
      setLaborRate(String(data.laborRate || 65))
      setNotes(data.notes || '')
      setTechnician(data.technician || 'Wade')
      setAmountCharged(String(data.amountCharged || 0))
      setAmountPaid(String(data.amountPaid || 0))
      setPaymentMethod(data.paymentMethod || '')
    } finally {
      setSaving(false)
      setEditJob(false)
      setEditPayment(false)
    }
  }

  async function updateStatus(status: WorkOrderStatus) {
    const patch: Record<string, unknown> = { status }
    if (status === 'complete') patch.dateComplete = new Date().toISOString().split('T')[0]
    if (status === 'picked-up') patch.datePickedUp = new Date().toISOString().split('T')[0]
    await updateWO(patch)
  }

  async function addPart() {
    if (!partName.trim()) return
    setSaving(true)
    await fetch('/api/parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workOrderId: id, name: partName, partNumber, supplier: partSupplier,
        unitCost: parseFloat(partCost) || 0, quantity: parseInt(partQty) || 1,
        status: 'ordered', dateOrdered: new Date().toISOString().split('T')[0]
      })
    })
    setPartName(''); setPartNumber(''); setPartSupplier(''); setPartCost('0'); setPartQty('1')
    setAddingPart(false)
    await load()
    setSaving(false)
  }

  async function togglePartStatus(part: Part) {
    const newStatus: PartStatus = part.status === 'ordered' ? 'received' : 'ordered'
    const patch: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'received') patch.dateReceived = new Date().toISOString().split('T')[0]
    await fetch(`/api/parts/${part.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
    })
    await load()
  }

  async function deletePart(partId: string) {
    await fetch(`/api/parts/${partId}`, { method: 'DELETE' })
    await load()
  }

  async function deleteWO() {
    if (!confirm('Delete this work order?')) return
    await fetch(`/api/work-orders/${id}`, { method: 'DELETE' })
    router.push('/')
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto px-3 pt-4 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  )

  if (!wo) return (
    <div className="max-w-2xl mx-auto px-3 pt-4 text-center py-12">
      <p className="text-slate-500">Work order not found.</p>
      <Link href="/" className="text-orange-600 underline mt-2 inline-block">Back to Jobs</Link>
    </div>
  )

  const cfg = STATUS_CFG[wo.status]
  const partsTotal = (wo.parts || []).reduce((sum, p) => sum + p.unitCost * p.quantity, 0)
  const laborTotal = (wo.laborHours || 0) * (wo.laborRate || 65)
  const suggestedTotal = laborTotal + partsTotal
  const orderedParts = (wo.parts || []).filter(p => p.status === 'ordered')

  return (
    <div className="max-w-2xl mx-auto px-3 pt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="font-mono font-bold text-lg text-slate-800">{wo.orderNumber}</span>
          <span className={cn("text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1", cfg.cls)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
            {cfg.label}
          </span>
        </div>
        <button onClick={deleteWO} className="p-2 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
          <Trash className="h-4 w-4" />
        </button>
      </div>

      {/* Status Buttons */}
      {wo.status !== 'picked-up' && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Update Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_FLOW.filter(s => s !== wo.status).map(s => {
                const c = STATUS_CFG[s]
                return (
                  <button key={s} onClick={() => updateStatus(s)} disabled={saving}
                    className={cn("px-3 py-1.5 rounded-lg text-sm font-medium border transition-all hover:opacity-80", c.cls, "border-current")}>
                    → {c.label}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer + Equipment */}
      <Card>
        <CardContent className="p-4 space-y-2">
          {wo.customer && (
            <Link href={`/customers/${wo.customer.id}`} className="flex items-start justify-between hover:bg-slate-50 -mx-1 px-1 py-1 rounded-lg">
              <div>
                <div className="font-semibold text-slate-800">{wo.customer.name}</div>
                {wo.customer.phone && (
                  <div className="flex items-center gap-1 text-sm text-slate-500">
                    <Phone className="h-3.5 w-3.5" />
                    <a href={`tel:${wo.customer.phone}`} className="hover:text-orange-600">{wo.customer.phone}</a>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={cn("text-xs px-2 py-0.5 rounded font-medium", TECH_CFG[wo.technician])}>
                  {wo.technician}
                </span>
                {wo.customer.source === 'referral' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                    via {wo.customer.referralShop || 'Other Shop'}
                  </span>
                )}
              </div>
            </Link>
          )}
          {wo.equipment && (
            <div className="flex items-center gap-2 pt-1 border-t">
              <Wrench className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-slate-700">
                  {wo.equipment.type} — {wo.equipment.make} {wo.equipment.model}
                </div>
                {wo.equipment.serialNumber && (
                  <div className="text-xs text-slate-400">S/N: {wo.equipment.serialNumber}</div>
                )}
              </div>
            </div>
          )}
          <div className="text-xs text-slate-400 pt-1">
            Date In: {wo.dateIn ? format(parseISO(wo.dateIn + 'T12:00:00'), 'MMMM d, yyyy') : '—'}
            {wo.dateComplete && ` · Completed: ${format(parseISO(wo.dateComplete + 'T12:00:00'), 'MMM d')}`}
            {wo.datePickedUp && ` · Picked Up: ${format(parseISO(wo.datePickedUp + 'T12:00:00'), 'MMM d')}`}
          </div>
        </CardContent>
      </Card>

      {/* Complaint */}
      {wo.complaint && (
        <div className="px-1">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Customer Complaint</p>
          <p className="text-slate-700 italic">"{wo.complaint}"</p>
        </div>
      )}

      {/* Job Work Section */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Diagnosis &amp; Work Done</CardTitle>
          {!editJob ? (
            <Button size="sm" variant="outline" onClick={() => setEditJob(true)}>
              <Edit className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button size="sm" onClick={() => updateWO({ diagnosis, workDone, laborHours: parseFloat(laborHours)||0, laborRate: parseFloat(laborRate)||65, notes, technician })} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
                <Save className="h-3.5 w-3.5 mr-1" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditJob(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {editJob ? (
            <>
              <div>
                <Label className="text-xs">Assigned To</Label>
                <div className="flex gap-2 mt-1">
                  {(['Wade', 'Wayne', 'Both'] as const).map(t => (
                    <button key={t} onClick={() => setTechnician(t)}
                      className={cn("flex-1 py-1.5 rounded text-sm font-medium border",
                        technician === t
                          ? t === 'Wade' ? "bg-orange-600 text-white border-orange-600"
                            : t === 'Wayne' ? "bg-blue-600 text-white border-blue-600"
                            : "bg-purple-600 text-white border-purple-600"
                          : "bg-white text-slate-600 border-slate-200"
                      )}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Diagnosis</Label>
                <Textarea value={diagnosis} onChange={e => setDiagnosis(e.target.value)} rows={2} className="mt-1" placeholder="What did you find?" />
              </div>
              <div>
                <Label className="text-xs">Work Done</Label>
                <Textarea value={workDone} onChange={e => setWorkDone(e.target.value)} rows={3} className="mt-1" placeholder="What was done to fix it?" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Labor Hours</Label>
                  <Input type="number" value={laborHours} onChange={e => setLaborHours(e.target.value)} step="0.25" min="0" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Labor Rate ($/hr)</Label>
                  <Input type="number" value={laborRate} onChange={e => setLaborRate(e.target.value)} min="0" className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="mt-1" placeholder="Internal notes…" />
              </div>
            </>
          ) : (
            <>
              <Field label="Diagnosis" value={wo.diagnosis} empty="Not yet noted" />
              <Field label="Work Done" value={wo.workDone} empty="Not yet noted" />
              {(wo.laborHours > 0 || wo.laborRate > 0) && (
                <div className="text-sm text-slate-600">
                  Labor: {wo.laborHours}h × ${wo.laborRate}/hr = <strong>${laborTotal.toFixed(2)}</strong>
                </div>
              )}
              {wo.notes && <Field label="Notes" value={wo.notes} />}
            </>
          )}
        </CardContent>
      </Card>

      {/* Parts */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-orange-500" />
            Parts
            {orderedParts.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                {orderedParts.length} on order
              </span>
            )}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setAddingPart(!addingPart)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Part
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {addingPart && (
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 space-y-2">
              <p className="text-sm font-semibold text-orange-700">Add Part</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Part Name *</Label>
                  <Input value={partName} onChange={e => setPartName(e.target.value)} placeholder="Air filter, belt…" />
                </div>
                <div>
                  <Label className="text-xs">Part Number</Label>
                  <Input value={partNumber} onChange={e => setPartNumber(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">Supplier</Label>
                  <Input value={partSupplier} onChange={e => setPartSupplier(e.target.value)} placeholder="Where to order" />
                </div>
                <div>
                  <Label className="text-xs">Qty</Label>
                  <Input type="number" value={partQty} onChange={e => setPartQty(e.target.value)} min="1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Unit Cost ($)</Label>
                <Input type="number" value={partCost} onChange={e => setPartCost(e.target.value)} step="0.01" min="0" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addPart} disabled={!partName.trim() || saving} className="flex-1 bg-orange-600 hover:bg-orange-700">
                  Add Part (Ordered)
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAddingPart(false)} className="flex-1">Cancel</Button>
              </div>
            </div>
          )}

          {!wo.parts?.length && !addingPart ? (
            <p className="text-sm text-slate-400 italic">No parts yet.</p>
          ) : (
            <div className="space-y-2">
              {wo.parts?.map(p => (
                <div key={p.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border">
                  <button onClick={() => togglePartStatus(p)} title={p.status === 'ordered' ? 'Mark received' : 'Mark ordered'}
                    className={cn("rounded-full p-1 transition-colors flex-shrink-0",
                      p.status === 'received' ? "bg-green-100 text-green-600 hover:bg-green-200" : "bg-amber-100 text-amber-600 hover:bg-amber-200"
                    )}>
                    {p.status === 'received' ? <CheckCircle className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">{p.name}</div>
                    <div className="text-xs text-slate-400">
                      {p.partNumber && `#${p.partNumber} · `}
                      {p.supplier && `${p.supplier} · `}
                      {p.quantity > 1 ? `${p.quantity}x ` : ''}${p.unitCost.toFixed(2)}
                      {p.quantity > 1 && ` = $${(p.unitCost * p.quantity).toFixed(2)}`}
                    </div>
                    <div className={cn("text-xs font-medium", p.status === 'received' ? 'text-green-600' : 'text-amber-600')}>
                      {p.status === 'ordered' ? `Ordered ${p.dateOrdered ? format(parseISO(p.dateOrdered + 'T12:00:00'), 'MMM d') : ''}` : `✓ Received ${p.dateReceived ? format(parseISO(p.dateReceived + 'T12:00:00'), 'MMM d') : ''}`}
                    </div>
                  </div>
                  <button onClick={() => deletePart(p.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 flex-shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {(wo.parts?.length || 0) > 0 && (
                <div className="text-right text-sm text-slate-600 pt-1">
                  Parts Total: <strong>${partsTotal.toFixed(2)}</strong>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-orange-500" />
            Payment
          </CardTitle>
          {!editPayment ? (
            <Button size="sm" variant="outline" onClick={() => setEditPayment(true)}>
              <Edit className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button size="sm" onClick={() => updateWO({ amountCharged: parseFloat(amountCharged)||0, amountPaid: parseFloat(amountPaid)||0, paymentMethod })} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
                <Save className="h-3.5 w-3.5 mr-1" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditPayment(false)}><X className="h-3.5 w-3.5" /></Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {suggestedTotal > 0 && (
            <div className="p-2 bg-slate-50 rounded text-sm text-slate-600">
              Suggested total: <strong className="text-slate-800">${suggestedTotal.toFixed(2)}</strong>
              <span className="text-xs ml-2">(${laborTotal.toFixed(2)} labor + ${partsTotal.toFixed(2)} parts)</span>
            </div>
          )}
          {editPayment ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Amount Charged ($)</Label>
                  <Input type="number" value={amountCharged} onChange={e => setAmountCharged(e.target.value)} step="0.01" min="0" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Amount Paid ($)</Label>
                  <Input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} step="0.01" min="0" className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select method…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="space-y-1">
              {wo.amountCharged > 0 ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Charged:</span>
                    <span className="font-semibold text-slate-800">${wo.amountCharged.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Paid:</span>
                    <span className={cn("font-semibold", wo.amountPaid >= wo.amountCharged ? "text-green-600" : "text-amber-600")}>
                      ${wo.amountPaid.toFixed(2)}
                    </span>
                  </div>
                  {wo.amountPaid < wo.amountCharged && (
                    <div className="flex justify-between text-sm font-medium text-red-600">
                      <span>Balance Due:</span>
                      <span>${(wo.amountCharged - wo.amountPaid).toFixed(2)}</span>
                    </div>
                  )}
                  {wo.paymentMethod && (
                    <div className="text-xs text-slate-400 capitalize">Method: {wo.paymentMethod}</div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400 italic">Payment not yet recorded.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, value, empty = '—' }: { label: string; value: string; empty?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">{label}</p>
      <p className={cn("text-sm", value ? "text-slate-700" : "text-slate-400 italic")}>{value || empty}</p>
    </div>
  )
}
