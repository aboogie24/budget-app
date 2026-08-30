# Mobile E2E — Maestro

YAML flows that drive the real app in a simulator. Run all of them with:

```bash
make test-e2e-app        # from the repo root
# or directly:
cd budget-app && maestro test .maestro/
```

## One-time setup

1. `brew install maestro`
2. Backend running locally: `make backend` (and Postgres: `make db`)
3. App installed in a booted iOS simulator (or Android emulator):
   `npx expo run:ios` (dev build; Expo Go also works — then use
   `maestro test --app-id host.exp.Exponent .maestro/`)
4. Seed the test user once (register through the API):

```bash
curl -s -X POST http://localhost:8080/users/register \
  -H 'Content-Type: application/json' \
  -d '{"id":"e2e00000-0000-4000-8000-000000000001","email":"e2e-maestro@test.local","full_name":"Maestro","password":"supersecret123"}'
```

To reset the user's data between runs: `make reset-user USER_EMAIL=e2e-maestro@test.local`

## Flows

| Flow | Proves |
|---|---|
| `01-login` | Cold start → login → dashboard renders |
| `02-add-transaction` | Quick-add expense with category picker → saved |
| `03-bills-add` | Bill created through the bottom-sheet form → appears in list |

## Conventions

- Flows select by **visible text** (labels/placeholders), so renaming UI copy
  breaks them loudly — that's intentional; update the flow with the copy.
- Every flow must end on an **assertion** (`extendedWaitUntil` / `assertVisible`),
  never on a tap.
- Keep flows independent: each starts with `launchApp` and assumes only the
  seeded user exists. Data-heavy scenarios (bank sync, AI approval cards)
  belong in the backend E2E suite (`make test-e2e-backend`), which is where
  state can be planted deterministically.
- Record a new flow interactively with `maestro studio`.
