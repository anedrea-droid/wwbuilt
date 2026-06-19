export type CustomerSource = 'own' | 'referral'
export type WorkOrderStatus = 'pending' | 'in-progress' | 'waiting-parts' | 'complete' | 'at-shop' | 'picked-up'
export type TechName = 'Wade' | 'Wayne' | 'Both'
export type PaymentMethod = 'cash' | 'check' | 'card' | 'other' | ''
export type PartStatus = 'ordered' | 'received'

export interface Customer {
  id: string
  name: string
  phone: string
  email: string
  source: CustomerSource
  referralShop: string
  notes: string
  createdAt: string
}

export interface Equipment {
  id: string
  customerId: string
  type: string
  make: string
  model: string
  serialNumber: string
  notes: string
  createdAt: string
}

export interface Part {
  id: string
  workOrderId: string
  name: string
  partNumber: string
  supplier: string
  unitCost: number
  quantity: number
  status: PartStatus
  dateOrdered: string
  dateReceived: string
}

export interface WorkOrder {
  id: string
  orderNumber: string
  customerId: string
  equipmentId: string
  status: WorkOrderStatus
  technician: TechName
  complaint: string
  diagnosis: string
  workDone: string
  laborHours: number
  laborRate: number
  dateIn: string
  dateComplete: string
  datePickedUp: string
  notes: string
  paymentMethod: PaymentMethod
  amountCharged: number
  amountPaid: number
  createdAt: string
  updatedAt: string
}

export interface DB {
  customers: Customer[]
  equipment: Equipment[]
  workOrders: WorkOrder[]
  parts: Part[]
  orderCounter: number
}
