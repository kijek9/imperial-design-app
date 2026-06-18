-- ═══════════════════════════════════════════════════════════════════════
--  IMPERIAL DESIGN — migracje SQL (Płatności: typ klienta + dokumenty + umowa)
--
--  Wklej CAŁOŚĆ tego pliku w panelu Supabase:
--    Supabase → Twój projekt → SQL Editor → New query → Wklej → "Run".
--
--  Dodaje:
--    • zlecenia.typ_klienta            ('firma' | 'indywidualny', domyślnie null)
--    • zlecenia.umowa_wyslana (+ _at)  checkbox "Umowa Autenti wysłana" + trigger
--    • platnosci.faktura_wystawiona    per transza (boolean)
--    • platnosci.paragon_wystawiony    per transza (boolean)
--
--  Dlaczego osobne kolumny boolean, a nie jsonb: "platnosci" to tabela
--  wiersz-na-transzę z typowanymi boolami (zaplacone, dokument_wystawiony);
--  dwie stałe flagi dokumentów pasują jako kolumny — typowane, indeksowalne,
--  bez parsowania. jsonb miałby sens dla zmiennej liczby pól, nie dla dwóch.
--
--  RLS nie wymaga zmian — istniejące polityki tabel "zlecenia" i "platnosci"
--  (dostęp dla każdego zalogowanego) obejmują nowe kolumny automatycznie.
--
--  Skrypt jest idempotentny — można go uruchomić ponownie bez błędów.
-- ═══════════════════════════════════════════════════════════════════════

-- ── zlecenia: typ klienta (ustalany raz na zlecenie) ────────────────────
alter table public.zlecenia
  add column if not exists typ_klienta text
    check (typ_klienta in ('firma', 'indywidualny'));

-- ── zlecenia: "Umowa Autenti wysłana" + znacznik czasu ──────────────────
alter table public.zlecenia
  add column if not exists umowa_wyslana boolean not null default false,
  add column if not exists umowa_wyslana_at timestamptz;

-- ── platnosci: dokumenty per transza ────────────────────────────────────
alter table public.platnosci
  add column if not exists faktura_wystawiona boolean not null default false,
  add column if not exists paragon_wystawiony boolean not null default false;

-- ── Indeks pod przyszłą automatyzację (przypomnienia po wysłaniu umowy) ──
create index if not exists idx_zlecenia_umowa_wyslana_at
  on public.zlecenia (umowa_wyslana_at)
  where umowa_wyslana_at is not null;

-- ═══════════════════════════════════════════════════════════════════════
--  TRIGGER: umowa_wyslana_at
--  Ten sam wzorzec co przekazany_do_rysowania_at: zaznaczenie (false → true)
--  zapisuje now(); odznaczenie (→ false) czyści znacznik. Serwerowy czas,
--  trwałe — pod późniejszą automatyzację.
-- ═══════════════════════════════════════════════════════════════════════
create or replace function public.set_umowa_wyslana_at()
returns trigger
language plpgsql
as $$
begin
  if new.umowa_wyslana is true
     and (old.umowa_wyslana is distinct from true) then
    new.umowa_wyslana_at = now();
  elsif new.umowa_wyslana is false then
    new.umowa_wyslana_at = null;
  end if;
  -- gdy true → true (zapis innych pól): zachowujemy istniejący znacznik
  return new;
end;
$$;

drop trigger if exists trg_zlecenia_umowa_wyslana_at on public.zlecenia;
create trigger trg_zlecenia_umowa_wyslana_at
  before update on public.zlecenia
  for each row execute function public.set_umowa_wyslana_at();

-- ═══════════════════════════════════════════════════════════════════════
--  GOTOWE. Po uruchomieniu wróć do aplikacji — w zakładce "Płatności"
--  pojawi się wybór typu klienta, checkbox umowy i dokumenty per transza.
-- ═══════════════════════════════════════════════════════════════════════
