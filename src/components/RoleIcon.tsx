import { Bus, Landmark, TrainFront, User } from 'lucide-react'

import type { RoleId } from '../lib/roles'

const ICONS = { kai: TrainFront, tj: Bus, dishub: Landmark, tamu: User } as const

export default function RoleIcon({ id, size = 20 }: { id: RoleId; size?: number }) {
  const Icon = ICONS[id]
  return <Icon size={size} strokeWidth={2} aria-hidden="true" />
}
