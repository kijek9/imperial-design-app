import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import { STATUSY, ETAPY } from '../constants/enums'
import type { Zlecenie, Status, Etap } from '../lib/types'
import { StatusBadge, EtapBadge } from '../components/Badge'
import { formatData } from '../lib/format'
import Spinner from '../components/Spinner'
import NoweZlecenieModal from '../components/NoweZlecenieModal'

type Zakladka = 'aktywne' | 'archiwum'
type SortKierunek = 'asc' | 'desc'

export default function ZleceniaListPage() {
  const navigate = useNavigate()
  const { nazwa } = useProfile()

  const [zlecenia, setZlecenia] = useState<Zlecenie[]>([])
  const [loading, setLoading] = useState(true)
  const [blad, setBlad] = useState<string | null>(null)

  const [zakladka, setZakladka] = useState<Zakladka>('aktywne')
  const [szukaj, setSzukaj] = useState('')
  const [filtrStatus, setFiltrStatus] = useState<Status | ''>('')
  const [filtrEtap, setFiltrEtap] = useState<Etap | ''>('')
  const [sortKierunek, setSortKierunek] = useState<SortKierunek>('asc')

  const [modalOtwarty, setModalOtwarty] = useState(false)

  // Pobranie zleceń dla wybranej zakładki (aktywne / archiwum).
  useEffect(() => {
    let aktywne = true
    setLoading(true)
    setBlad(null)

    supabase
      .from('zlecenia')
      .select('*')
      .eq('zarchiwizowane', zakladka === 'archiwum')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!aktywne) return
        if (error) {
          setBlad('Nie udało się wczytać zleceń.')
        } else {
          setZlecenia(data ?? [])
        }
        setLoading(false)
      })

    return () => {
      aktywne = false
    }
  }, [zakladka])

  // Filtrowanie + wyszukiwanie + sortowanie po dacie montażu (po stronie klienta).
  const widoczne = useMemo(() => {
    const fraza = szukaj.trim().toLowerCase()
    const wynik = zlecenia.filter((z) => {
      if (filtrStatus && z.status !== filtrStatus) return false
      if (filtrEtap && z.etap !== filtrEtap) return false
      if (fraza) {
        const wTekscie =
          z.nazwa.toLowerCase().includes(fraza) ||
          z.numer.toLowerCase().includes(fraza)
        if (!wTekscie) return false
      }
      return true
    })

    // Sortowanie po dacie montażu; brak daty trafia na koniec listy.
    wynik.sort((a, b) => {
      const da = a.data_montazu ? new Date(a.data_montazu).getTime() : null
      const db = b.data_montazu ? new Date(b.data_montazu).getTime() : null
      if (da === null && db === null) return 0
      if (da === null) return 1
      if (db === null) return -1
      return sortKierunek === 'asc' ? da - db : db - da
    })

    return wynik
  }, [zlecenia, szukaj, filtrStatus, filtrEtap, sortKierunek])

  return (
    <div>
      {/* Nagłówek + akcja */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl">Zlecenia</h1>
          <p className="mt-1 text-sm text-przygaszony">
            {zakladka === 'aktywne'
              ? 'Aktywne zlecenia w toku'
              : 'Zakończone i zarchiwizowane zlecenia'}
          </p>
        </div>
        <button onClick={() => setModalOtwarty(true)} className="btn-primary">
          + Nowe zlecenie
        </button>
      </div>

      {/* Zakładki */}
      <div className="mb-5 inline-flex rounded-lg border border-white/10 bg-panel p-1">
        <button
          onClick={() => setZakladka('aktywne')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            zakladka === 'aktywne'
              ? 'bg-karta text-krem shadow'
              : 'text-przygaszony hover:text-krem'
          }`}
        >
          Aktywne
        </button>
        <button
          onClick={() => setZakladka('archiwum')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            zakladka === 'archiwum'
              ? 'bg-karta text-krem shadow'
              : 'text-przygaszony hover:text-krem'
          }`}
        >
          Zakończone / Archiwum
        </button>
      </div>

      {/* Pasek filtrów */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={szukaj}
          onChange={(e) => setSzukaj(e.target.value)}
          className="pole"
          placeholder="Szukaj po nazwie lub numerze…"
        />
        <select
          value={filtrStatus}
          onChange={(e) => setFiltrStatus(e.target.value as Status | '')}
          className="pole"
        >
          <option value="">Wszystkie statusy</option>
          {STATUSY.map((s) => (
            <option key={s.wartosc} value={s.wartosc}>
              {s.etykieta}
            </option>
          ))}
        </select>
        <select
          value={filtrEtap}
          onChange={(e) => setFiltrEtap(e.target.value as Etap | '')}
          className="pole"
        >
          <option value="">Wszystkie etapy</option>
          {ETAPY.map((e) => (
            <option key={e.wartosc} value={e.wartosc}>
              {e.etykieta}
            </option>
          ))}
        </select>
        <select
          value={sortKierunek}
          onChange={(e) => setSortKierunek(e.target.value as SortKierunek)}
          className="pole"
        >
          <option value="asc">Montaż: najbliższe najpierw</option>
          <option value="desc">Montaż: najdalsze najpierw</option>
        </select>
      </div>

      {/* Treść */}
      {loading ? (
        <Spinner label="Wczytywanie zleceń…" />
      ) : blad ? (
        <p className="rounded-lg bg-akcent/10 px-4 py-3 text-sm text-akcent ring-1 ring-akcent/30">
          {blad}
        </p>
      ) : widoczne.length === 0 ? (
        <div className="karta p-10 text-center text-przygaszony">
          {zlecenia.length === 0
            ? 'Brak zleceń w tej zakładce.'
            : 'Brak zleceń pasujących do filtrów.'}
        </div>
      ) : (
        <div className="karta overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-przygaszony">
                <tr>
                  <th className="px-4 py-3 font-medium">Numer</th>
                  <th className="px-4 py-3 font-medium">Nazwa</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Etap</th>
                  <th className="px-4 py-3 font-medium">Montaż</th>
                  <th className="px-4 py-3 font-medium">Data max.</th>
                  <th className="px-4 py-3 font-medium">Odpowiedzialny</th>
                </tr>
              </thead>
              <tbody>
                {widoczne.map((z) => (
                  <tr
                    key={z.id}
                    onClick={() => navigate(`/zlecenie/${z.id}`)}
                    className="cursor-pointer border-b border-white/5 transition last:border-0 hover:bg-white/5"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-krem">
                      {z.numer}
                    </td>
                    <td className="px-4 py-3 text-krem">{z.nazwa}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={z.status} />
                    </td>
                    <td className="px-4 py-3">
                      <EtapBadge etap={z.etap} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-przygaszony">
                      {formatData(z.data_montazu)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-przygaszony">
                      {formatData(z.data_max)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-przygaszony">
                      {nazwa(z.odpowiedzialny)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOtwarty && (
        <NoweZlecenieModal
          onClose={() => setModalOtwarty(false)}
          onCreated={(id) => navigate(`/zlecenie/${id}`)}
        />
      )}
    </div>
  )
}
