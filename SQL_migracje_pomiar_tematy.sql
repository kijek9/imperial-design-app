-- ═══════════════════════════════════════════════════════════════════════
--  IMPERIAL DESIGN — migracje SQL (Szczegóły: Pomiar + Tematy otwarte)
--
--  Wklej CAŁOŚĆ tego pliku w panelu Supabase:
--    Supabase → Twój projekt → SQL Editor → New query → Wklej → "Run".
--
--  Dodaje do tabeli "zlecenia":
--    • sekcję Pomiar:  data_pomiaru, pomiar_wykonany,
--                      przekazany_do_rysowania (+ ..._at), drive_link
--    • tematy_otwarte: lista pozycji { id, tresc, domkniete } jako jsonb
--    • trigger ustawiający/czyszczący przekazany_do_rysowania_at
--      (data+czas zaznaczenia — pod późniejszą automatyzację/przypomnienia)
--
--  RLS nie wymaga zmian — to istniejące polityki tabeli "zlecenia"
--  (dostęp dla każdego zalogowanego) obejmują nowe kolumny automatycznie.
--
--  Skrypt jest idempotentny — można go uruchomić ponownie bez błędów.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Sekcja Pomiar ───────────────────────────────────────────────────────
alter table public.zlecenia
  add column if not exists data_pomiaru date,
  add column if not exists pomiar_wykonany boolean not null default false,
  add column if not exists przekazany_do_rysowania boolean not null default false,
  add column if not exists przekazany_do_rysowania_at timestamptz,
  add column if not exists drive_link text;

-- ── Tematy otwarte (lista pozycji jako jsonb) ───────────────────────────
-- Każda pozycja: { "id": "...", "tresc": "...", "domkniete": false }
alter table public.zlecenia
  add column if not exists tematy_otwarte jsonb not null default '[]'::jsonb;

-- ── Indeks pod przyszłą automatyzację (przypomnienia po przekazaniu) ─────
create index if not exists idx_zlecenia_przekazany_at
  on public.zlecenia (przekazany_do_rysowania_at)
  where przekazany_do_rysowania_at is not null;

-- ═══════════════════════════════════════════════════════════════════════
--  TRIGGER: przekazany_do_rysowania_at
--  Zaznaczenie checkboxa (false → true) zapisuje znacznik czasu now();
--  odznaczenie (→ false) czyści go. Trwale, niezależnie od zegara klienta.
-- ═══════════════════════════════════════════════════════════════════════
create or replace function public.set_przekazany_do_rysowania_at()
returns trigger
language plpgsql
as $$
begin
  if new.przekazany_do_rysowania is true
     and (old.przekazany_do_rysowania is distinct from true) then
    new.przekazany_do_rysowania_at = now();
  elsif new.przekazany_do_rysowania is false then
    new.przekazany_do_rysowania_at = null;
  end if;
  -- gdy true → true (zapis innych pól): zachowujemy istniejący znacznik
  return new;
end;
$$;

drop trigger if exists trg_zlecenia_przekazany_at on public.zlecenia;
create trigger trg_zlecenia_przekazany_at
  before update on public.zlecenia
  for each row execute function public.set_przekazany_do_rysowania_at();

-- ═══════════════════════════════════════════════════════════════════════
--  GOTOWE. Po uruchomieniu wróć do aplikacji — w zakładce "Szczegóły"
--  pojawią się sekcje "Pomiar" i "Tematy otwarte".
-- ═══════════════════════════════════════════════════════════════════════
