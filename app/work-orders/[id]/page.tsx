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
  const [newPart, setNewPart] = useState({
    name: '', partNumber: '', supplier: '', quantity: 1,
    cost: '', price: '', dateOrdered: new Date().toISOString().split('T')[0],
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/work-orders/${id}`)
      .then(r => r.json()).then(data => { setWo(data); setForm(data) })
    fetch(`/api/parts?workOrderId=${id}`)
      .then(r => r.json()).then(setParts)
  }, [id])

  useEffect(() => {
    if (!wo) return
    fetch(`/api/customers/${wo.customerId}`).then(r => r.json()).then(data => setCustomer(data.customer ?? data))
    fetch(`/api/equipment/${wo.equipmentId}`).then(r => r.json()).then(setEquipment)
  }, [wo])

  async function saveWorkOrder() {
    setSaving(true)
    const res = await fetch(`/api/work-orders/${id}`, {
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
  }

  async function markReceived(partId: string) {
    const today = new Date().toISOString().split('T')[0]
    const res = await fetch(`/api/parts/${partId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': '
