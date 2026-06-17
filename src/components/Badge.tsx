import { STATUS_MAP, ETAP_MAP } from '../constants/enums'
import type { Status, Etap } from '../lib/types'

const baza =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap'

export function StatusBadge({ status }: { status: Status }) {
  const opcja = STATUS_MAP[status]
  return <span className={`${baza} ${opcja.klasy}`}>{opcja.etykieta}</span>
}

export function EtapBadge({ etap }: { etap: Etap }) {
  const opcja = ETAP_MAP[etap]
  return <span className={`${baza} ${opcja.klasy}`}>{opcja.etykieta}</span>
}
