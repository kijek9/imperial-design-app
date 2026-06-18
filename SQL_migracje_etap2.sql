-- ═══════════════════════════════════════════════════════════════════════
--  IMPERIAL DESIGN — migracje SQL (Etap 2)
--  Kalkulator wyceny + Płatności 40/40/20 + (kalendarz korzysta z tych danych)
--
--  Wklej CAŁOŚĆ tego pliku w panelu Supabase:
--    Supabase → Twój projekt → SQL Editor → New query → Wklej → "Run".
--
--  Dodaje:
--    • tabelę "wyceny"      (1:1 ze zleceniem — kalkulacja + zarobek)
--    • tabelę "platnosci"   (3 raty 40/40/20 na zlecenie, śledzenie wpłat)
--    • kolumnę "kwota_umowa_reczna" w tabeli "zlecenia"
--    • RLS + polityki (ten sam wzorzec co w Etapie 1: dostęp dla zalogowanych)
--
--  Skrypt jest idempotentny — można go uruchomić ponownie bez błędów.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto"; -- dla gen_random_uuid()

-- ═══════════════════════════════════════════════════════════════════════
--  ALTER: zlecenia — ręczne nadpisanie kwoty umowy
--  Gdy true → kwoty nie nadpisujemy automatycznie z wyceny (rabaty/negocjacje).
-- ═══════════════════════════════════════════════════════════════════════
alter table public.zlecenia
  add column if not exists kwota_umowa_reczna boolean not null default false;

-- ═══════════════════════════════════════════════════════════════════════
--  TABELA: wyceny  (jedna aktywna wycena na zlecenie — relacja 1:1)
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.wyceny (
  id          uuid primary key default gen_random_uuid(),
  zlecenie_id uuid not null unique references public.zlecenia (id) on delete cascade,
  typ         text not null check (typ in ('szafka', 'szafa', 'duza', 'kuchnia')),
  -- koszty: tablica obiektów { "l": "nazwa pozycji", "v": 8500 }
  koszty      jsonb not null default '[]'::jsonb,
  -- zarobek: czysty zysk do kieszeni po opłaceniu wszystkich kosztów (zł)
  zarobek     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════
--  TABELA: platnosci  (3 raty na zlecenie: 40 / 40 / 20)
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.platnosci (
  id                  uuid primary key default gen_random_uuid(),
  zlecenie_id         uuid not null references public.zlecenia (id) on delete cascade,
  etap                smallint not null check (etap in (1, 2, 3)),
  nazwa               text not null,                 -- Zadatek / Przed montażem / Po odbiorze
  procent             smallint not null,             -- 40 / 40 / 20
  kwota               integer not null default 0,    -- wyliczona z kwota_umowa (zł)
  zaplacone           boolean not null default false,
  data_wplaty         date,
  dokument_typ        text check (dokument_typ in ('faktura', 'paragon')), -- nullable
  dokument_wystawiony boolean not null default false,
  created_at          timestamptz not null default now(),
  -- jedna rata danego etapu na zlecenie (pozwala na bezpieczny upsert)
  unique (zlecenie_id, etap)
);

create index if not exists idx_platnosci_zlecenie_id
  on public.platnosci (zlecenie_id);

-- ═══════════════════════════════════════════════════════════════════════
--  TRIGGER: automatyczne odświeżanie updated_at w "wyceny"
-- ═══════════════════════════════════════════════════════════════════════
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wyceny_updated_at on public.wyceny;
create trigger trg_wyceny_updated_at
  before update on public.wyceny
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY + POLITYKI
--  Wzorzec z Etapu 1: dostęp ma każdy ZALOGOWANY użytkownik (authenticated).
-- ═══════════════════════════════════════════════════════════════════════

-- ── wyceny ──────────────────────────────────────────────────────────────
alter table public.wyceny enable row level security;

drop policy if exists "wyceny_select" on public.wyceny;
create policy "wyceny_select" on public.wyceny
  for select to authenticated using (true);

drop policy if exists "wyceny_insert" on public.wyceny;
create policy "wyceny_insert" on public.wyceny
  for insert to authenticated with check (true);

drop policy if exists "wyceny_update" on public.wyceny;
create policy "wyceny_update" on public.wyceny
  for update to authenticated using (true) with check (true);

drop policy if exists "wyceny_delete" on public.wyceny;
create policy "wyceny_delete" on public.wyceny
  for delete to authenticated using (true);

-- ── platnosci ─────────────────────────────────────────────────────────
alter table public.platnosci enable row level security;

drop policy if exists "platnosci_select" on public.platnosci;
create policy "platnosci_select" on public.platnosci
  for select to authenticated using (true);

drop policy if exists "platnosci_insert" on public.platnosci;
create policy "platnosci_insert" on public.platnosci
  for insert to authenticated with check (true);

drop policy if exists "platnosci_update" on public.platnosci;
create policy "platnosci_update" on public.platnosci
  for update to authenticated using (true) with check (true);

drop policy if exists "platnosci_delete" on public.platnosci;
create policy "platnosci_delete" on public.platnosci
  for delete to authenticated using (true);

-- ═══════════════════════════════════════════════════════════════════════
--  GOTOWE. Po uruchomieniu tego skryptu wróć do aplikacji — sekcje
--  "Wycena" i "Płatności" pojawią się na karcie zlecenia, a "Kalendarz"
--  w menu głównym.
-- ═══════════════════════════════════════════════════════════════════════
