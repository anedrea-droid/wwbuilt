export interface EquipMake { id: string; name: string }

// Decide the final make name for a typed "Other" make.
//  - If it matches a make already in the list (ignoring capitals and spaces), use the list's spelling.
//  - Otherwise, if addToList is true, save it to the shared make list (same list as Settings).
// Never throws: if saving to the list fails, the equipment is still saved with the typed name.
export async function resolveMake(
  typed: string,
  existing: EquipMake[],
  addToList: boolean
): Promise<{ name: string; added?: EquipMake }> {
  const clean = typed.trim().replace(/\s+/g, ' ')
  if (!clean) return { name: 'Other' }
  const match = existing.find(m => m.name.trim().toLowerCase() === clean.toLowerCase())
  if (match) return { name: match.name }
  if (!addToList) return { name: clean }
  try {
    const res = await fetch('/api/settings/equipment-makes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: clean }),
    })
    if (res.ok) {
      const added = await res.json()
      if (added && added.id && added.name) return { name: added.name, added }
    }
  } catch {
    // fall through - keep the typed name
  }
  return { name: clean }
}

export function sortMakes(list: EquipMake[]): EquipMake[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name))
}
