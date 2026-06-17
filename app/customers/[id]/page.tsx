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
  work
