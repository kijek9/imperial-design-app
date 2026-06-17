-- ═══════════════════════════════════════════════════════════════════════
--  IMPERIAL DESIGN — migracje SQL (Etap 1)
--  Wklej CAŁOŚĆ tego pliku w panelu Supabase:
--    Supabase → Twój projekt → SQL Editor → New query → Wklej → "Run".
--
--  Tworzy: tabele "zlecenia", "komentarze", "profil"
--          + Row Level Security (RLS) i polityki dostępu
--          + trigger uzupełniający "profil" przy zakładaniu konta.
--
--  Model dostępu: KAŻDY ZALOGOWANY użytkownik widzi i edytuje WSZYSTKIE
--  zlecenia (wspólna baza firmy 2–4 osób — bez izolacji per użytkownik).
-- ═══════════════════════════════════════════════════════════════════════

-- ── Rozszerzenia ──────────────────────────────────────────────────────
create extension if not exists "pgcrypto"; -- dla gen_random_uuid()

-- ── Typy wyliczeniowe (enum) ──────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'status_zlecenia') then
    create type status_zlecenia as enum
      ('nowy', 'w_trakcie', 'wstrzymane', 'zakonczone');
  end if;

  if not exists (select 1 from pg_type where typname = 'etap_zlecenia') then
    create type etap_zlecenia as enum
      ('wycena', 'przeslano_do_klienta', 'projekt_na_gotowo',
       'w_produkcji', 'montaz', 'odbior');
  end if;
end$$;

-- ═══════════════════════════════════════════════════════════════════════
--  TABELA: profil
--  Lustro użytkowników z auth.users — pozwala wyświetlać nazwy i budować
--  dropdown "Odpowiedzialny" (auth.users nie jest dostępne z przeglądarki).
--  Uzupełniana automatycznie triggerem przy zakładaniu konta.
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.profil (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  imie       text,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════
--  TABELA: zlecenia
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.zlecenia (
  id                  uuid primary key default gen_random_uuid(),
  numer               text not null unique,
  nazwa               text not null,
  status              status_zlecenia not null default 'nowy',
  etap                etap_zlecenia   not null default 'wycena',
  data_montazu        date,
  data_max            date,                       -- deadline maksymalny
  adres               text,
  link_maps           text,
  telefon             text,
  kwota_umowa         numeric,
  projekt_sprawdzony  boolean not null default false,
  protokol_odbioru    boolean not null default false,
  utworzyl            uuid references auth.users (id),
  odpowiedzialny      uuid references auth.users (id),
  zarchiwizowane      boolean not null default false,
  created_at          timestamptz not null default now()
  -- TODO Etap 2: kolumny wyceny (np. kalkulacja, marza)
  -- TODO Etap 3: powiązania z zadaniami, akcesoriami, AGD
);

-- Indeksy pod typowe zapytania listy.
create index if not exists idx_zlecenia_zarchiwizowane
  on public.zlecenia (zarchiwizowane);
create index if not exists idx_zlecenia_data_montazu
  on public.zlecenia (data_montazu);

-- ═══════════════════════════════════════════════════════════════════════
--  TABELA: komentarze
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.komentarze (
  id           uuid primary key default gen_random_uuid(),
  zlecenie_id  uuid not null references public.zlecenia (id) on delete cascade,
  autor        uuid not null references auth.users (id),
  tresc        text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_komentarze_zlecenie_id
  on public.komentarze (zlecenie_id);

-- ═══════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY + POLITYKI
--  Zasada: dostęp ma każdy ZALOGOWANY użytkownik (rola "authenticated").
-- ═══════════════════════════════════════════════════════════════════════

-- ── zlecenia ──────────────────────────────────────────────────────────
alter table public.zlecenia enable row level security;

drop policy if exists "zlecenia_select" on public.zlecenia;
create policy "zlecenia_select" on public.zlecenia
  for select to authenticated using (true);

drop policy if exists "zlecenia_insert" on public.zlecenia;
create policy "zlecenia_insert" on public.zlecenia
  for insert to authenticated with check (true);

drop policy if exists "zlecenia_update" on public.zlecenia;
create policy "zlecenia_update" on public.zlecenia
  for update to authenticated using (true) with check (true);

drop policy if exists "zlecenia_delete" on public.zlecenia;
create policy "zlecenia_delete" on public.zlecenia
  for delete to authenticated using (true);

-- ── komentarze ────────────────────────────────────────────────────────
alter table public.komentarze enable row level security;

drop policy if exists "komentarze_select" on public.komentarze;
create policy "komentarze_select" on public.komentarze
  for select to authenticated using (true);

-- Dodawać komentarz można tylko we własnym imieniu (autor = zalogowany).
drop policy if exists "komentarze_insert" on public.komentarze;
create policy "komentarze_insert" on public.komentarze
  for insert to authenticated with check (autor = auth.uid());

-- Edytować / usuwać może tylko autor komentarza.
drop policy if exists "komentarze_update" on public.komentarze;
create policy "komentarze_update" on public.komentarze
  for update to authenticated using (autor = auth.uid()) with check (autor = auth.uid());

drop policy if exists "komentarze_delete" on public.komentarze;
create policy "komentarze_delete" on public.komentarze
  for delete to authenticated using (autor = auth.uid());

-- ── profil ────────────────────────────────────────────────────────────
alter table public.profil enable row level security;

-- Każdy zalogowany widzi katalog użytkowników (potrzebne do dropdownu).
drop policy if exists "profil_select" on public.profil;
create policy "profil_select" on public.profil
  for select to authenticated using (true);

-- Edytować własny wpis (np. imię) może tylko właściciel.
drop policy if exists "profil_update" on public.profil;
create policy "profil_update" on public.profil
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════
--  TRIGGER: automatyczne tworzenie wpisu w "profil" przy nowym koncie.
--  Dzięki temu po założeniu użytkownika w panelu Auth pojawia się on
--  od razu w aplikacji (dropdown "Odpowiedzialny", autorzy komentarzy).
-- ═══════════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profil (id, email, imie)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'imie', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Uzupełnienie profili dla kont założonych PRZED utworzeniem triggera ─
insert into public.profil (id, email, imie)
select u.id, u.email, split_part(u.email, '@', 1)
from auth.users u
on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════════════════
--  GOTOWE. Po uruchomieniu tego skryptu:
--   1) Załóż konta wspólników:  Authentication → Users → "Add user".
--   2) (Opcjonalnie) ustaw ładną nazwę w tabeli "profil" (kolumna "imie").
-- ═══════════════════════════════════════════════════════════════════════
