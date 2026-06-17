# Imperial Design — aplikacja firmowa (Etap 1)

Webowa aplikacja dla firmy meblarskiej **Imperial Design** (meble na wymiar).
Etap 1 to fundament: **logowanie**, **lista zleceń**, **karta zlecenia**
(z komentarzami) oraz **archiwum**. Kolejne funkcje (kalkulator wyceny,
kalendarz, zadania) dobudujemy w następnych etapach.

**Stos:** React + Vite + TypeScript · Tailwind CSS · Supabase (baza + logowanie)
· React Router. Gotowe do publikacji na Vercel.

---

## 📋 Co będzie potrzebne

- **Konto Supabase** (darmowe) — [supabase.com](https://supabase.com)
- **Node.js** w wersji 18 lub nowszej — [nodejs.org](https://nodejs.org)
  (instalujesz raz; daje komendy `npm`)
- Ten folder z projektem.

---

## 🚀 Instrukcja krok po kroku (dla osoby nietechnicznej)

### Krok 1 — Załóż projekt w Supabase

1. Wejdź na [supabase.com](https://supabase.com) i zaloguj się.
2. Kliknij **New project**.
3. Podaj nazwę (np. `imperial-design`), wymyśl i **zapisz hasło do bazy**,
   wybierz region (np. _Central EU (Frankfurt)_) i kliknij **Create new project**.
4. Poczekaj ~2 minuty, aż projekt się utworzy.

### Krok 2 — Utwórz tabele (migracje SQL)

1. W projekcie Supabase otwórz po lewej **SQL Editor**.
2. Kliknij **New query**.
3. Otwórz plik **`SQL_migracje.sql`** z tego folderu, skopiuj **całą** zawartość
   i wklej do okna zapytania.
4. Kliknij **Run** (lub `Ctrl/Cmd + Enter`).
5. Powinno pojawić się **Success**. Tabele `zlecenia`, `komentarze` i `profil`
   są gotowe (z włączonym zabezpieczeniem RLS).

### Krok 3 — Skopiuj klucze dostępu

1. W Supabase otwórz **Project Settings** (ikona koła zębatego) → **API**.
2. Znajdź dwie wartości:
   - **Project URL**
   - **Project API keys → `anon` `public`**
3. W folderze projektu znajdź plik **`.env.example`**, zrób jego **kopię**
   i nazwij ją **`.env`**.
4. Otwórz `.env` i wklej skopiowane wartości:

   ```bash
   VITE_SUPABASE_URL=tutaj-wklej-Project-URL
   VITE_SUPABASE_ANON_KEY=tutaj-wklej-klucz-anon-public
   ```

   > 🔒 Plik `.env` jest prywatny — nie wysyłaj go nikomu i nie wrzucaj do
   > repozytorium (jest już w `.gitignore`). Klucz `anon` jest bezpieczny do
   > użycia w przeglądarce — dostęp chroni RLS.

### Krok 4 — Uruchom aplikację lokalnie

W terminalu, **w folderze projektu**, wpisz kolejno:

```bash
npm install      # jednorazowo — pobiera zależności
npm run dev      # uruchamia aplikację
```

Otwórz w przeglądarce adres, który pokaże terminal (zwykle
**http://localhost:5173**).

### Krok 5 — Dodaj konta wspólników

Nie ma publicznej rejestracji — konta zakładasz ręcznie:

1. W Supabase otwórz **Authentication** → **Users** → **Add user**
   → **Create new user**.
2. Podaj **e-mail** i **hasło**, zaznacz **Auto Confirm User** (żeby konto
   działało od razu) i zapisz.
3. Gotowe — ta osoba może się zalogować w aplikacji tym e-mailem i hasłem.

> Każdy nowy użytkownik automatycznie pojawia się w aplikacji (w dropdownie
> „Odpowiedzialny" i jako autor komentarzy). Ładną nazwę można ustawić w
> tabeli **`profil`** (kolumna `imie`) w zakładce **Table Editor**.

---

## ☁️ Publikacja na Vercel (gdy będziesz gotów)

1. Wrzuć projekt do repozytorium na GitHub.
2. Na [vercel.com](https://vercel.com) → **Add New… → Project** → wybierz repo.
3. Vercel wykryje Vite automatycznie.
4. W **Environment Variables** dodaj te same dwie zmienne co w `.env`:
   `VITE_SUPABASE_URL` oraz `VITE_SUPABASE_ANON_KEY`.
5. Kliknij **Deploy**.

---

## 📁 Struktura projektu

```
src/
├── components/        Komponenty wielokrotnego użytku
│   ├── Badge.tsx          Kolorowe "pigułki" statusu i etapu
│   ├── Komentarze.tsx     Sekcja komentarzy na karcie zlecenia
│   ├── Layout.tsx         Górny pasek + ramka zalogowanej części
│   ├── Logo.tsx           Placeholder loga (podmień na grafikę)
│   ├── NoweZlecenieModal.tsx
│   ├── ProtectedRoute.tsx Ochrona tras przed niezalogowanymi
│   └── Spinner.tsx
├── constants/
│   └── enums.ts           Statusy i etapy + etykiety/kolory (jedno źródło)
├── contexts/
│   └── AuthContext.tsx    Logowanie / sesja (Supabase Auth)
├── hooks/
│   └── useProfile.ts      Katalog użytkowników (mapa id → nazwa)
├── lib/
│   ├── format.ts          Formatowanie dat i kwot (PL)
│   ├── supabase.ts        Klient Supabase
│   └── types.ts           Typy danych + typ bazy
├── pages/
│   ├── LoginPage.tsx
│   ├── ZleceniaListPage.tsx
│   └── ZlecenieDetailPage.tsx
├── App.tsx                Routing
└── main.tsx              Punkt wejścia
```

## 🧭 Etapy dalej (już zaplanowane w kodzie)

W kodzie zostawione są znaczniki `// TODO Etap 2/3/4` w miejscach, gdzie
dobudujemy resztę:

- **Etap 2:** kalkulator / wycena
- **Etap 3:** zadania, akcesoria, AGD
- **Etap 4:** kalendarz, załączniki / pliki

---

## 🛠️ Przydatne komendy

| Komenda           | Działanie                                  |
| ----------------- | ------------------------------------------ |
| `npm install`     | Instaluje zależności (raz)                 |
| `npm run dev`     | Uruchamia tryb deweloperski                |
| `npm run build`   | Buduje wersję produkcyjną do folderu `dist`|
| `npm run preview` | Podgląd zbudowanej wersji produkcyjnej     |
