-- ═══════════════════════════════════════════════════════════════════════
--  IMPERIAL DESIGN — migracje SQL (Płatności: "Zamówiono materiały")
--
--  Wklej CAŁOŚĆ tego pliku w panelu Supabase:
--    Supabase → Twój projekt → SQL Editor → New query → Wklej → "Run".
--
--  Dodaje do tabeli "zlecenia":
--    • zamowiono_materialy            checkbox przy Płatnościach
--    • zamowiono_materialy_at         znacznik czasu zaznaczenia (trigger)
--      → od tej daty Finanse liczą termin zapłaty hurtowni (+14 dni)
--
--  Trigger tym samym wzorcem co umowa_wyslana_at / przekazany_do_rysowania_at:
--  zaznaczenie (false → true) zapisuje now(); odznaczenie (→ false) czyści.
--
--  RLS nie wymaga zmian — istniejące polityki tabeli "zlecenia"
--  (dostęp dla każdego zalogowanego) obejmują nowe kolumny automatycznie.
--
--  Skrypt jest idempotentny — można go uruchomić ponownie bez błędów.
-- ═══════════════════════════════════════════════════════════════════════

-- ── zlecenia: zamówiono materiały + znacznik czasu ──────────────────────
alter table public.zlecenia
  add column if not exists zamowiono_materialy boolean not null default false,
  add column if not exists zamowiono_materialy_at timestamptz;

-- ── Indeks pod liczenie terminów zapłaty hurtowni (Finanse) ─────────────
create index if not exists idx_zlecenia_zamowiono_materialy_at
  on public.zlecenia (zamowiono_materialy_at)
  where zamowiono_materialy_at is not null;

-- ═══════════════════════════════════════════════════════════════════════
--  TRIGGER: zamowiono_materialy_at
-- ═══════════════════════════════════════════════════════════════════════
create or replace function public.set_zamowiono_materialy_at()
returns trigger
language plpgsql
as $$
begin
  if new.zamowiono_materialy is true
     and (old.zamowiono_materialy is distinct from true) then
    new.zamowiono_materialy_at = now();
  elsif new.zamowiono_materialy is false then
    new.zamowiono_materialy_at = null;
  end if;
  -- gdy true → true (zapis innych pól): zachowujemy istniejący znacznik
  return new;
end;
$$;

drop trigger if exists trg_zlecenia_zamowiono_materialy_at on public.zlecenia;
create trigger trg_zlecenia_zamowiono_materialy_at
  before update on public.zlecenia
  for each row execute function public.set_zamowiono_materialy_at();

-- ═══════════════════════════════════════════════════════════════════════
--  GOTOWE. Po uruchomieniu w zakładce "Płatności" pojawi się checkbox
--  "Zamówiono materiały", a zakładka "Finanse" zacznie liczyć terminy.
-- ═══════════════════════════════════════════════════════════════════════
