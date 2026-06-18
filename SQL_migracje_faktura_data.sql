-- ═══════════════════════════════════════════════════════════════════════
--  IMPERIAL DESIGN — migracje SQL (Płatności: data wysłania faktury)
--
--  Wklej CAŁOŚĆ tego pliku w panelu Supabase:
--    Supabase → Twój projekt → SQL Editor → New query → Wklej → "Run".
--
--  Dodaje:
--    • platnosci.faktura_wystawiona_at  znacznik czasu zaznaczenia
--      "Faktura wysłana" przy transzy (pod terminy płatności + zakładkę Finanse)
--    • trigger ustawiający/czyszczący ten znacznik (ten sam wzorzec co
--      umowa_wyslana_at i przekazany_do_rysowania_at)
--
--  RLS nie wymaga zmian — istniejące polityki tabeli "platnosci"
--  (dostęp dla każdego zalogowanego) obejmują nową kolumnę automatycznie.
--
--  Skrypt jest idempotentny — można go uruchomić ponownie bez błędów.
-- ═══════════════════════════════════════════════════════════════════════

-- ── platnosci: data wysłania faktury ────────────────────────────────────
alter table public.platnosci
  add column if not exists faktura_wystawiona_at timestamptz;

-- ── Indeks pod przyszłe liczenie terminów płatności (Finanse) ───────────
create index if not exists idx_platnosci_faktura_wystawiona_at
  on public.platnosci (faktura_wystawiona_at)
  where faktura_wystawiona_at is not null;

-- ═══════════════════════════════════════════════════════════════════════
--  TRIGGER: faktura_wystawiona_at
--  Zaznaczenie "Faktura wysłana" (false → true) zapisuje now();
--  odznaczenie (→ false) czyści znacznik. Serwerowy czas, trwałe.
-- ═══════════════════════════════════════════════════════════════════════
create or replace function public.set_faktura_wystawiona_at()
returns trigger
language plpgsql
as $$
begin
  if new.faktura_wystawiona is true
     and (old.faktura_wystawiona is distinct from true) then
    new.faktura_wystawiona_at = now();
  elsif new.faktura_wystawiona is false then
    new.faktura_wystawiona_at = null;
  end if;
  -- gdy true → true (zapis innych pól transzy): zachowujemy istniejący znacznik
  return new;
end;
$$;

drop trigger if exists trg_platnosci_faktura_at on public.platnosci;
create trigger trg_platnosci_faktura_at
  before update on public.platnosci
  for each row execute function public.set_faktura_wystawiona_at();

-- ═══════════════════════════════════════════════════════════════════════
--  GOTOWE. Znacznik zapisuje się automatycznie przy zaznaczaniu
--  "Faktura wysłana" — na razie nigdzie nie jest wyświetlany.
-- ═══════════════════════════════════════════════════════════════════════
