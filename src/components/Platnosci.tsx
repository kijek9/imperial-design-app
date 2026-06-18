import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Platnosc,
  PlatnoscUpdate,
  TypKlienta,
  Zlecenie,
  ZlecenieUpdate,
} from '../lib/types'
import { podzialRat, terminRaty2, NAZWY_RAT, PROCENTY_RAT } from '../lib/raty'
import { formatZl, formatData } from '../lib/format'
import Spinner from './Spinner'

// Ile dni od dziś do podanej daty (ujemne = w przeszłości).
function dniDo(iso: string | null): number | null {
  if (!iso) return null
  const dzis = new Date()
  dzis.setHours(0, 0, 0, 0)
  const cel = new Date(iso)
  if (Number.isNaN(cel.getTime())) return null
  cel.setHours(0, 0, 0, 0)
  return Math.round((cel.getTime() - dzis.getTime()) / 86_400_000)
}

// Tekst terminu danej raty (terminy liczymy w UI, nie trzymamy w bazie).
function terminRaty(etap: number, dataMontazu: string | null): string {
  if (etap === 1) return 'po podpisaniu umowy'
  if (etap === 3) return 'po odbiorze i podpisaniu protokołu'
  const t = terminRaty2(dataMontazu)
  return t ? formatData(t) : 'po ustaleniu montażu'
}

export default function Platnosci({
  zlecenie,
  onZlecenieUpdate,
  onZapisano,
}: {
  zlecenie: Zlecenie
  // Pozwala zsynchronizować zmiany pól zlecenia (typ klienta, umowa) z kartą
  // nadrzędną — zapis idzie i tak bezpośrednio do bazy poniżej.
  onZlecenieUpdate?: (patch: Partial<Zlecenie>) => void
  // Sygnał udanego autozapisu (wspólny toast „Zapisano" w karcie zlecenia).
  onZapisano?: () => void
}) {
  const [raty, setRaty] = useState<Platnosc[]>([])
  const [loading, setLoading] = useState(true)

  // Wczytaj raty; jeśli brak, a jest kwota umowy → wygeneruj 3 raty.
  useEffect(() => {
    let aktywne = true
    async function zaladuj() {
      setLoading(true)
      const { data } = await supabase
        .from('platnosci')
        .select('*')
        .eq('zlecenie_id', zlecenie.id)
        .order('etap', { ascending: true })

      let rows = data ?? []

      if (rows.length === 0 && zlecenie.kwota_umowa != null) {
        const kwoty = podzialRat(zlecenie.kwota_umowa)
        const nowe = [0, 1, 2].map((i) => ({
          zlecenie_id: zlecenie.id,
          etap: i + 1,
          nazwa: NAZWY_RAT[i],
          procent: PROCENTY_RAT[i],
          kwota: kwoty[i],
        }))
        await supabase
          .from('platnosci')
          .upsert(nowe, { onConflict: 'zlecenie_id,etap' })
        const { data: data2 } = await supabase
          .from('platnosci')
          .select('*')
          .eq('zlecenie_id', zlecenie.id)
          .order('etap', { ascending: true })
        rows = data2 ?? []
      }

      if (aktywne) {
        setRaty(rows)
        setLoading(false)
      }
    }
    zaladuj()
    return () => {
      aktywne = false
    }
  }, [zlecenie.id])

  // Synchronizuj kwoty rat przy zmianie kwoty umowy — BEZ kasowania statusów
  // „zapłacone" już odhaczonych rat (aktualizujemy tylko pole kwota).
  useEffect(() => {
    if (raty.length !== 3 || zlecenie.kwota_umowa == null) return
    const docelowe = podzialRat(zlecenie.kwota_umowa)
    const doZmiany = raty.filter((r) => r.kwota !== docelowe[r.etap - 1])
    if (doZmiany.length === 0) return

    Promise.all(
      doZmiany.map((r) =>
        supabase
          .from('platnosci')
          .update({ kwota: docelowe[r.etap - 1] })
          .eq('id', r.id)
      )
    ).then(() => {
      setRaty((prev) =>
        prev.map((r) => ({ ...r, kwota: docelowe[r.etap - 1] }))
      )
    })
  }, [zlecenie.kwota_umowa, raty])

  // Aktualizacja pojedynczej raty (DB + lokalny stan).
  async function aktualizuj(id: string, patch: PlatnoscUpdate) {
    setRaty((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    const { error } = await supabase.from('platnosci').update(patch).eq('id', id)
    if (!error) onZapisano?.()
  }

  // Aktualizacja pól samego zlecenia (typ klienta, umowa) — DB + synchronizacja
  // z kartą nadrzędną. umowa_wyslana_at ustawia trigger w bazie.
  async function aktualizujZlecenie(patch: ZlecenieUpdate) {
    onZlecenieUpdate?.(patch)
    const { error } = await supabase
      .from('zlecenia')
      .update(patch)
      .eq('id', zlecenie.id)
    if (!error) onZapisano?.()
  }

  if (loading) return <Spinner label="Wczytywanie płatności…" />

  const brakRat = zlecenie.kwota_umowa == null || raty.length === 0
  const suma = raty.reduce((s, r) => s + r.kwota, 0)
  const wplacono = raty.filter((r) => r.zaplacone).reduce((s, r) => s + r.kwota, 0)
  const procent = suma > 0 ? Math.round((wplacono / suma) * 100) : 0

  return (
    <div className="space-y-5">
      {/* ── Ustawienia zlecenia: umowa Autenti + typ klienta ── */}
      <div className="karta space-y-4 p-6">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={zlecenie.umowa_wyslana}
            onChange={(e) =>
              aktualizujZlecenie({ umowa_wyslana: e.target.checked })
            }
            className="h-4 w-4 accent-akcent"
          />
          Umowa Autenti wysłana
        </label>

        <div>
          <label className="etykieta">Typ klienta</label>
          <select
            value={zlecenie.typ_klienta ?? ''}
            onChange={(e) =>
              aktualizujZlecenie({
                typ_klienta: (e.target.value || null) as TypKlienta | null,
              })
            }
            className="pole max-w-xs"
          >
            <option value="">— nieustalony —</option>
            <option value="firma">Firma</option>
            <option value="indywidualny">Klient indywidualny</option>
          </select>
        </div>
      </div>

      {brakRat ? (
        <div className="karta p-8 text-center text-przygaszony">
          Ustaw <span className="text-krem">kwotę na umowie</span> (zakładka
          Szczegóły lub Wycena), aby wygenerować raty 40/40/20.
        </div>
      ) : (
        <>
      {/* Podsumowanie + pasek postępu */}
      <div className="karta p-6">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm text-przygaszony">Wpłacono</span>
          <span className="text-lg font-semibold text-krem">
            {formatZl(wplacono)} <span className="text-przygaszony">z</span>{' '}
            {formatZl(suma)}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-panel">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${procent}%` }}
          />
        </div>
      </div>

      {/* Trzy karty rat */}
      <div className="grid gap-4 lg:grid-cols-3">
        {raty.map((r) => (
          <RataKarta
            key={r.id}
            rata={r}
            typKlienta={zlecenie.typ_klienta}
            termin={terminRaty(r.etap, zlecenie.data_montazu)}
            dni={r.etap === 2 ? dniDo(terminRaty2(zlecenie.data_montazu)) : null}
            onChange={(patch) => aktualizuj(r.id, patch)}
          />
        ))}
      </div>
        </>
      )}
    </div>
  )
}

function RataKarta({
  rata,
  typKlienta,
  termin,
  dni,
  onChange,
}: {
  rata: Platnosc
  typKlienta: TypKlienta | null
  termin: string
  dni: number | null
  onChange: (patch: PlatnoscUpdate) => void
}) {
  // Ostrzeżenie: rata 2 z terminem w ciągu 7 dni (lub po terminie), niezapłacona.
  const ostrzezenie =
    !rata.zaplacone && dni !== null && dni <= 7

  const obwodka = rata.zaplacone
    ? 'ring-emerald-500/40 bg-emerald-500/5'
    : ostrzezenie
      ? 'ring-amber-500/50 bg-amber-500/5'
      : 'ring-white/10'

  function przelaczZaplacone(checked: boolean) {
    const patch: PlatnoscUpdate = { zaplacone: checked }
    // Przy zaznaczeniu ustaw dzisiejszą datę, jeśli pusta.
    if (checked && !rata.data_wplaty) {
      patch.data_wplaty = new Date().toISOString().slice(0, 10)
    }
    onChange(patch)
  }

  return (
    <div className={`karta space-y-3 p-5 ring-1 ${obwodka}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-krem">{rata.nazwa}</p>
          <p className="text-xs text-przygaszony">{rata.procent}%</p>
        </div>
        <p className="text-xl font-bold text-krem">{formatZl(rata.kwota)}</p>
      </div>

      <p className="text-sm text-przygaszony">
        Termin: <span className="text-krem">{termin}</span>
        {ostrzezenie && (
          <span className="ml-2 text-amber-300">
            {dni !== null && dni < 0 ? '⚠ po terminie' : '⚠ wkrótce'}
          </span>
        )}
      </p>

      {/* Dokumenty per transza — nad „Zapłacone" (najpierw faktura, potem wpłata) */}
      <div className="space-y-2 border-t border-white/10 pt-3">
        {typKlienta == null ? (
          <p className="text-xs text-przygaszony">
            Wybierz typ klienta, aby oznaczać dokumenty
          </p>
        ) : (
          <>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rata.faktura_wystawiona}
                onChange={(e) =>
                  onChange({ faktura_wystawiona: e.target.checked })
                }
                className="h-4 w-4 accent-akcent"
              />
              Faktura wysłana
            </label>
            {typKlienta === 'indywidualny' && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rata.paragon_wystawiony}
                  onChange={(e) =>
                    onChange({ paragon_wystawiony: e.target.checked })
                  }
                  className="h-4 w-4 accent-akcent"
                />
                Paragon wystawiony
              </label>
            )}
          </>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2 border-t border-white/10 pt-3 text-sm">
        <input
          type="checkbox"
          checked={rata.zaplacone}
          onChange={(e) => przelaczZaplacone(e.target.checked)}
          className="h-4 w-4 accent-emerald-500"
        />
        Zapłacone
      </label>

      {rata.zaplacone && (
        <div>
          <label className="etykieta">Data wpłaty</label>
          <input
            type="date"
            value={rata.data_wplaty ?? ''}
            onChange={(e) => onChange({ data_wplaty: e.target.value || null })}
            className="pole"
          />
        </div>
      )}
    </div>
  )
}
