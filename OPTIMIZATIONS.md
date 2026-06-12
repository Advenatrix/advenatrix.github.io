# GeoRP — Code Optimizations & Side Effects

Prioritized list of refactors to improve reusability, readability, and maintainability
without sacrificing function.

---

## P0: High Impact, Low Risk (Pure Extractions)

These are purely mechanical: no behavior changes, no API contract changes.

### 0.1 Extract `FlexCol` / `FlexRow` / `SpaceBetween` layout primitives

**What:** Create 3 layout-only React components in `src/components/ui/Flex.tsx`:

```tsx
export function FlexCol({ gap, style, children, ...props }:
  { gap?: number; style?: CSSProperties } & HTMLAttributes<HTMLDivElement>) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }} {...props}>{children}</div>
}
export function FlexRow({ gap, style, children, ...props }: ...) {
  return <div style={{ display: 'flex', gap, alignItems: 'center', ...style }} {...props}>{children}</div>
}
export function SpaceBetween({ gap, style, children, ...props }: ...) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap, ...style }} {...props}>{children}</div>
}
```

Then replace 167 inline flexbox style objects across all pages.

**Side effects:**
- None if component spreads the `style` prop last (allowing callers to override)
- `FlexRow` hard-codes `alignItems: 'center'` — if a row needs `flex-start`, the caller must pass `style={{ alignItems: 'flex-start' }}`
- Gap defaults to `undefined` (0 in flex gap), matching current behavior
- Existing code may have minor padding/margin differences if `gap` is not set; verify visually

---

### 0.2 Extract shared constants (`SECTORS`, `SECTOR_COLORS`, tax rates)

**What:** Move all duplicate definitions into `src/game/constants.ts`:

| Constant | Currently defined in |
|---|---|
| `SECTORS` | `types/index.ts:43`, `GamePage.tsx:9`, `EconomyPage.tsx:360` |
| `SECTOR_COLORS` | `GamePage.tsx:26`, `EconomyPage.tsx:370` |
| `TAX_RATES` / `TAX_RATES_DEC` | `EconomyPage.tsx:100-124` |
| `COMPANY_TAX_RATES` | `EconomyPage.tsx:126-132` |
| `CIVIL_COST_MULT` | `EconomyPage.tsx:140` |
| `ARMY_UPKEEP_MULT` | `EconomyPage.tsx:144` |
| `FUNDING_LABELS` | `EconomyPage.tsx:134-138` |

Update imports in `GamePage.tsx`, `EconomyPage.tsx`. Remove local definitions.

**Side effects:**
- `SECTOR_COLORS` in `EconomyPage.tsx` uses different values than `GamePage.tsx`. If both are genuine differences, they must be merged intentionally, or the semantic difference (admin map vs economy chart) should be named separately: `SECTOR_CHART_COLORS` vs `SECTOR_MAP_COLORS`
- None otherwise — pure extraction, same values

---

### 0.3 Extract shared form styles (`inputStyle`, `selectStyle`, `btnStyle`)

**What:** Create `src/components/ui/FormStyles.ts` exporting plain style objects:

```ts
export const inputStyle: CSSProperties = {
  padding: '6px 8px', background: '#000', border: '1px solid var(--border)',
  color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 14, outline: 'none',
}
export const selectStyle: CSSProperties = { ...inputStyle, cursor: 'pointer' }
export const btnStyle: CSSProperties = {
  padding: '6px 12px', background: 'var(--accent)', color: '#000',
  border: 'none', fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer',
}
```

Import in 7 files instead of redefining.

**Side effects:**
- None. Pure extraction. All 7 definitions are byte-for-byte identical.
- If a page later needs to customize, it can use `{ ...inputStyle, ...custom }` or the component `style` prop

---

### 0.4 Extract `MapPinIcon` component

**What:** Pull the SVG pin path (currently duplicated in `GameMap.tsx:79-87` and `PinsPage.tsx:148-151`) into `src/components/map/MapPinIcon.tsx`:

```tsx
export function MapPinIcon({ color = 'var(--accent)', size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} ...>
    <path d="..." />
    <circle cx="12" cy="10" r="3" fill="var(--bg)" />
  </svg>
}
```

**Side effects:**
- None. Pure extraction. The SVG paths are identical.
- Callers may need to adjust position offsets if replacing inline SVGs with identical size

---

### 0.5 Delete dead code: `src/pages/AdminPage.tsx` (67 lines)

**What:** Remove the file. It is not imported anywhere — not in `pages/index.ts`, not in `App.tsx`, no route registered.

**Side effects:**
- None. It's dead code. Git preserves history.

---

### 0.6 Fix O(n²) loop in `EconomyPage.tsx:290-297`

**What:** Change `for (const d of data) { const i = data.indexOf(d) }` to `data.forEach((d, i) => { ... })` or use a manual index variable.

**Side effects:**
- None. Pure algorithmic fix. Output is identical.
- `data.indexOf(d)` was already working correctly, just slow O(n²) vs O(n)

---

### 0.7 Object-lookup routing in `GamePage.tsx:299-310`

**What:** Replace the 8-level nested ternary with a component map:

```tsx
const PAGES: Record<string, React.ComponentType<GamePageProps>> = {
  political: PoliticalPage,
  economy: EconomyPage,
  military: MilitaryPage,
  operations: OperationsPage,
  diplomacy: DiplomacyPage,
  trade: TradePage,
}
const PageComponent = page && PAGES[page]
return PageComponent ? <PageComponent ... /> : <Panel title="Map">...</Panel>
```

**Side effects:**
- None. Pure readability. Same rendering, same props.
- If a page is added/removed, the map changes in one place instead of adding another ternary branch

---

### 0.8 Fix broken `AbortController` in `EconomyPage.tsx:499-513`

**What:** Pass `{ signal: controller.signal }` to the API call. Also add a `signal` parameter to `request()` in `api.ts`:

```ts
async function request<T>(path: string, options: RequestInit & { admin?: boolean } = {}): Promise<T> {
  const res = await fetch(path, { ...options, headers: { ... } })
  ...
}
```

Then in EconomyPage:
```ts
const controller = new AbortController()
getUpkeepBreakdown(nationId, { signal: controller.signal })
  .then(...).catch(() => {})
return () => controller.abort()
```

**Side effects:**
- The `catch (e)` now also catches `AbortError` — the existing `.catch(() => {})` already swallows all errors, so this is fine
- Existing callers of `request()` are unaffected (signal is optional)
- Prevents stale state updates on fast unmount/remount (e.g., navigating away quickly)

---

## P1: Medium Impact — Component Extraction

These extract new reusable components out of existing code. Behavior preserved, but introduces new import boundaries.

### 1.1 Promote `InputField` to shared UI library

**What:** The pattern `<div flex-col gap:2><label uppercase>Name</label><input style={inputStyle} /></div>` appears 30+ times. `CompaniesPage.tsx:132-139` already has a local version. Promote to `src/components/ui/InputField.tsx`:

```tsx
export function InputField({
  label, value, onChange, type = 'text', placeholder, ...props
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <FlexCol gap={2}>
      <label style={{ color: 'var(--text-dim)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} {...props as any} />
    </FlexCol>
  )
}
```

Optionally add a `SelectField` for `<select>` variants.

**Side effects:**
- Existing modals that use separate `<label>` and `<input>` with non-standard arrangement (e.g., extra sibling elements between label and input) need manual migration
- The `onChange` signature differs from native `<input onChange={...}>` — uses `(value: string)` instead of `(event)`. This is a convenience choice; the caller must adjust. Mitigation: also accept native `onChange`
- Some inputs may have additional props (e.g., `maxLength`, `min`, `step`, `pattern`) — `InputField` must forward unknown props to `<input>` properly

---

### 1.2 Create `useFetch<T>` hook

**What:** Create `src/hooks/useFetch.ts`:

```ts
export function useFetch<T>(fetcher: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(() => {
    setLoading(true)
    setError(null)
    fetcher().then(setData).catch(setError).finally(() => setLoading(false))
  }, deps)

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}
```

Replace the `useCallback` + `useEffect` boilerplate in 8 files.

**Side effects:**
- Existing catch handlers that swallow errors (e.g., `.catch(() => {})`) would need to use `error` state instead
- If a page needs to chain multiple fetches (e.g., fetch A then fetch B), the pattern must be adapted with sequential `useFetch` calls or a second `useEffect`
- The `deps` array is passed to `useCallback`, which follows standard React rules (stale closure risk if deps change)
- If a page currently refetches by calling `fetch()` manually, they now call `refetch()` — trivial rename

---

### 1.3 Create `ConfirmDialog` / `useConfirm` hook

**What:** Replace 8+ `window.confirm('...')` calls with a component that wraps `<Modal>`:

```tsx
export function ConfirmDialog({
  open, onConfirm, onCancel, title, message, confirmLabel = 'Delete', variant = 'danger',
}: { open: boolean; onConfirm: () => void; onCancel: () => void; title: string; message: string; confirmLabel?: string; variant?: 'danger' | 'primary' }) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>{message}</p>
      <FlexRow style={{ justifyContent: 'flex-end' }} gap={8}>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant={variant} onClick={onConfirm}>{confirmLabel}</Button>
      </FlexRow>
    </Modal>
  )
}
```

Or a hook-based approach:
```ts
export function useConfirm() {
  const [state, setState] = useState<{ ... } | null>(null)
  const confirm = (message: string) => new Promise<boolean>(resolve => {
    setState({ message, resolve })
  })
  // render ConfirmDialog when state is non-null
  return { confirm, dialog: state && <ConfirmDialog ... /> }
}
```

**Side effects:**
- `window.confirm()` is synchronous (blocks JS thread). A React modal is async — calling code must change from `if (!confirm('...')) return` to `if (!await confirm('...')) return`. Every call site must be wrapped in `async`
- The modal requires user interaction (click button) instead of Enter key accepting — subtle UX change
- However, it matches the visual theme and is testable, which are significant improvements

---

### 1.4 Use existing `Badge` component instead of inline `<span style>`

**What:** `Badge.tsx` exists with variants (`default`, `success`, `warning`, `danger`) and matching CSS classes. Replace all status-indicator `<span style={{color: 'var(--green-bright)'}}>` with `<Badge variant="success" label="Submitted" />`.

Occurrences:
- `DashboardPage.tsx:153` — submitted/pending
- `TurnsPage.tsx:18-21` — turn status
- `FrontsPage.tsx:242` — battle status
- `OperationsPage.tsx:292-303` — front/battle statuses

**Side effects:**
- `Badge` renders `<span className="badge badge-${variant}">` which has its own color/style via CSS. The colors may differ slightly from the inline `var(--green-bright)` values used currently
- If the current implementation uses different colors per status, `Badge` must support those variants or CSS must be updated
- If `Badge` adds background/padding that the inline version didn't have, layout shifts may occur

---

### 1.5 Use existing `DataTable` instead of hand-rolled tables

**What:** Replace raw `<table>`/`<tr>`/`<td>` constructions in:
- `PinsPage.tsx:182-228` (pin list table)
- `MilitaryPage.tsx:396-431` (template list table)
- `FrontsPage.tsx:240-270` (battle list)
- `OperationsPage.tsx:336-360` (battle history)

with the existing `DataTable` component which supports columns, custom renderers, sorting, filtering, pagination.

**Side effects:**
- `DataTable` expects `columns` array with `header`, `render`, optional `sortValue`, and `filterable` fields (see `DataTable.tsx`). The render functions need to match this API
- If the hand-rolled table uses multi-row rendering (e.g., a row that spans multiple lines), `DataTable` may not support it. Verify before migrating
- `DataTable` uses a `<table>` internally, so visual results should be similar
- The `DataTable` might not support row click handlers — check before migrating

---

### 1.6 Use existing `Button` component instead of inline `<button style>`

**What:** Replace `<button style={{background, color, padding, border, cursor, fontFamily, fontSize}}>` with `<Button variant="primary|secondary|danger">` across all pages.

**Side effects:**
- `Button` renders a fixed subset of styles. If the inline version had a custom width (e.g., `width: '100%'`), the caller must pass `style={{ width: '100%' }}` or use the `btn-full` CSS class
- `Button` accepts `className` — all CSS class overrides are possible
- The `onClick` behavior is identical

---

## P2: Medium Risk — Merge & Consolidation

These change structure, potentially affecting behavior. Requires careful QA.

### 2.1 Merge `api.ts` and `adminApi.ts`

**What:** Unify into a single `request()` function with a `prefix` option:

```ts
// src/services/api.ts
let token: string | null = null

export function setToken(t: string | null) { token = t }

async function request<T>(path: string, options: RequestInit & { admin?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = options.admin ? localStorage.getItem('georp_token') : token
  if (t) headers['Authorization'] = `Bearer ${t}`
  const prefix = options.admin ? '/api/admin' : '/api'
  const res = await fetch(`${prefix}${path}`, { ...options, headers })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || 'Request failed')
  return body
}
```

Then re-export admin-prefixed wrappers from a single module that all pages share:

```ts
// api.ts
export const getAdminNations = () => request<{ nations: Nation[] }>('/nations', { admin: true })
export const getNations = () => request<{ nations: Nation[] }>('/nations')
```

**Side effects:**
- `adminApi.ts` reads token from `localStorage` on every call; `api.ts` reads from an in-memory variable. Merging to always read from `localStorage` (or always from memory) changes the stale-token behavior. If token is revoked mid-session, in-memory still passes the old token while localStorage may have been cleared. **Use a single source of truth** — the in-memory variable (set on login, cleared on logout) is safer and avoids localStorage race conditions
- All imports of `adminApi.ts` must change to `api.ts`. 5 files affected
- If a function name conflicts (e.g., `createCompany` exists in both), rename the admin version or use namespace imports
- Eliminates ~200 lines of duplicated code

---

### 2.2 Unify `fmtMoney` into shared utility

**What:** Create `src/utils/format.ts`:

```ts
export function fmtMoney(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  return `${sign}${(abs).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`
  // or: return sign + (abs >= 1_000 ? ...)
}
```

**Side effects:**
- 3 different implementations exist with subtle differences:
  - `EconomyPage` / `GamePage`: `toFixed(1)` for billions/millions, `toFixed(0)` for thousands
  - `MilitaryPage`: adds `toFixed(0)` when `abs % 1_000_000 === 0` (no "1.0M", shows "1M" instead)
  - `NationsPage`: inline ternary in column render
- Merging to a single version changes display formatting. The "1.0M" vs "1M" difference is minor but may be intentional (precision vs conciseness)
- **Recommendation:** Use the `MilitaryPage` variant (strictest, most edge-case aware). Accept that some numbers may display differently

---

### 2.3 Complete `Nation` interface in `src/game/types/index.ts`

**What:** Add all missing fields that the server actually returns:

```ts
export interface Nation {
  id: number; name: string; flag_url: string; leader_name: string;
  color: string; ideology: Ideology; is_major: boolean; is_human: boolean;
  // Missing fields:
  treasury: number; treasury_history?: number;
  tax_level: number; corporate_tax_level: number;
  army_level: number; airforce_level: number; naval_level: number;
  civil_level: number;
  money_printed: number; last_printed_turn?: number;
  companies: Company[]; sector_caps: SectorCap[];
  sector_modifiers: SectorModifier[];
}
```

Also create the missing types (`SectorCap`, `SectorModifier`).

**Side effects:**
- Existing code that accesses these fields on `any`-typed data will now get proper type checking. This may reveal type errors (e.g., accessing `nation.treasury` which was typed as `any` but now requires it to exist)
- Server response must match the interface at runtime. If a field is sometimes absent, use `?:` (optional) or `| null`
- This is the most impactful change for TypeScript safety — the entire app benefits

---

### 2.4 Add proper TypeScript return types to `api.ts` (stop using `any`)

**What:** Change all return types from `Promise<any>` / `Promise<{ nations: any[] }>` to typed versions using the completed interfaces:

```ts
export function getNations(): Promise<{ nations: Nation[] }> { ... }
export function getNation(id: number): Promise<Nation> { ... }
export function getProvinces(): Promise<{ provinces: Province[] }> { ... }
```

**Side effects:**
- If server returns a field with a different type than declared, TypeScript won't catch it at compile time — only at runtime. Must ensure server and client types stay in sync
- Strong typing will break any code that previously depended on `any` flexibility (e.g., accessing `nations.someUndeclaredField`)
- This is a one-time cost that pays dividends in IDE autocompletion and compile-time error catching

---

### 2.5 Create `useAdminCrud<T>` hook for admin CRUD pages

**What:** Encapsulate the 13-step CRUD template into a reusable hook:

```ts
export function useAdminCrud<T extends { id: number }>(config: {
  fetchFn: () => Promise<{ [key: string]: T[] }>
  fetchKey: string
  updateFn: (id: number, data: Partial<T>) => Promise<any>
  deleteFn: (id: number) => Promise<any>
  initialForm: T
  createFn?: () => Promise<T> | null
}) {
  // Shared state: items, loading, editTarget, editForm
  // Shared actions: fetch, openEdit, handleSave, handleDelete
  // Returns all needed for the template
}
```

**Side effects:**
- Not every CRUD page follows the exact same pattern:
  - `TurnsPage.tsx` is read-only (no create/edit/delete)
  - `PinsPage.tsx` has map-click position picking
  - `PlayersPage.tsx` has parallel nation fetch
  - `CompaniesPage.tsx` has a separate create flow
- A hook with optional overrides (e.g., `onEditOpen`, `customActions`) can handle variation, but risks becoming overly complex
- **Recommendation:** Start with a simpler `useFetch` hook (1.2) which covers 80% of the benefit with 20% of the abstraction risk. Only extract full CRUD if 3+ pages share identical create/edit/delete patterns

---

## P3: Lower Priority

### 3.1 Fix `useDebounce` hook stale closure

**What:** The debounced function is recreated every render because `useCallback` is missing. Also, pending promises from old invocations are never resolved.

```ts
export function useDebounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const debouncedFn = useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    return new Promise<ReturnType<T>>((resolve, reject) => {
      timerRef.current = setTimeout(async () => {
        try { resolve(await fnRef.current(...args)) }
        catch (e) { reject(e) }
      }, delay)
    })
  }, [delay])

  useEffect(() => () => clearTimeout(timerRef.current), [delay])
  return debouncedFn
}
```

**Side effects:**
- The previous Promise from a cleared timer is now silently dropped (was previously pending forever — neither resolved nor rejected)
- The debounced function identity now only changes when `delay` changes, preventing unnecessary re-renders
- If a slider's `onChange` depends on the debounced function identity, it now correctly maintains stability

---

### 3.2 Auth form consolidation

**What:** Merge `LoginForm.tsx` and `SignUpForm.tsx` into a shared `AuthForm` component:

```tsx
type AuthMode = 'login' | 'register'
// Shared fields: username, password, error, handleSubmit
// LoginForm-specific: mousePos + tooltip quote
```

**Side effects:**
- The tooltip quote on LoginForm is a UI flourish — it must be preserved or made optional via prop
- Button labels differ ("Start" vs "Create account")
- Error messages differ ("Invalid credentials" vs "Username taken")
- If the two forms diverge later, the shared component makes it harder to change one independently
- **Recommendation:** Only consolidate if you expect to add more auth modes (e.g., "forgot password"). Otherwise, the duplication is minimal (~18 lines different)

---

### 3.3 Auth layout: remove hardcoded `isAdmin` in `App.tsx`

**What:** Replace:
```ts
const isAdmin = user?.username === 'admin'
```
with:
```ts
const isAdmin = user?.role === 'admin'
```
This requires the server to populate a `role` field on the JWT/user object.

**Side effects:**
- Requires backend change: JWT payload and `/auth/me` must include `role`
- All existing `admin` accounts would not have a `role` field until migration. Must handle backwards compatibility: `const isAdmin = user?.role === 'admin' || user?.username === 'admin'`
- If multiple admin accounts are desired, this is necessary. If only one admin exists, the hardcoded check is fine for now

---

### 3.4 Split `EconomyPage.tsx` into 4-5 components

**What:** Extract:
- `EconomyPolicySliders` (GDP, taxes, civil, military funding sliders)
- `EconomyGraphPanel` (line graph + KPI cards)
- `MarketsPanel` (sector breakdown + company list)
- `CreateCompanyModal` (company creation form)

**Side effects:**
- State is currently shared via local `useState` in `EconomyPage`. After extraction, state must be lifted up to a parent or placed in a context. This is the main complexity
- The `computeForecastIncome` function is used by both the sliders and the tooltip — it must remain accessible to both extracted components
- The `AbortController` for upkeep breakdown is local — its scope must be clear
- **Estimated complexity:** Medium. Worth doing but requires careful state management design
- **Recommendation:** Use a single `economyStore` Zustand slice to avoid prop drilling, or keep state in the parent `EconomyPage` and pass down as props

---

## Summary Table

| # | Change | Lines Saved | Risk | Reuse | Readability |
|---|--------|------------|------|-------|-------------|
| 0.1 | FlexCol/FlexRow primitives | ~300 | None | ★★★★★ | ★★★★★ |
| 0.2 | Shared constants | ~40 | None | ★★★★★ | ★★★ |
| 0.3 | Shared form styles | ~84 | None | ★★★★★ | ★★★ |
| 0.4 | MapPinIcon component | ~20 | None | ★★★★ | ★★★ |
| 0.5 | Delete dead code | -67 | None | — | ★★ |
| 0.6 | Fix O(n²) loop | ~0 | None | — | ★★ |
| 0.7 | Object-lookup routing | ~0 | None | — | ★★★★★ |
| 0.8 | Fix AbortController | ~0 | None | — | ★★★ |
| 1.1 | InputField component | ~200 | Low | ★★★★★ | ★★★★★ |
| 1.2 | useFetch hook | ~80 | Low | ★★★★★ | ★★★★★ |
| 1.3 | ConfirmDialog component | ~8 callsites | Low | ★★★★ | ★★★★ |
| 1.4 | Use Badge component | ~20 | Low | ★★★ | ★★★ |
| 1.5 | Use DataTable | ~150 | Low | ★★★★ | ★★★★ |
| 1.6 | Use Button component | ~200 | Low | ★★★ | ★★★★ |
| 2.1 | Merge api.ts + adminApi.ts | ~200 | Medium | ★★★★★ | ★★★★ |
| 2.2 | Unify fmtMoney | ~30 | Medium | ★★★★★ | ★★★ |
| 2.3 | Complete Nation interface | ~20 | Medium | ★★★★★ | ★★★★ |
| 2.4 | Type api.ts returns | ~0 | Medium | ★★★★★ | ★★★★ |
| 2.5 | useAdminCrud hook | ~150 | Medium | ★★★★ | ★★★★ |
| 3.1 | Fix useDebounce | ~0 | Low | — | ★★★ |
| 3.2 | Auth form consolidation | ~40 | Low | ★★★ | ★★★ |
| 3.3 | Remove hardcoded isAdmin | ~1 | Medium | — | ★★★ |
| 3.4 | Split EconomyPage | ~700 | Medium | ★★★★ | ★★★★★ |

---

## Recommended First Steps (quick wins, no behavioral risk)

1. **P0.1** + **P0.2** + **P0.3** + **P0.7** (layout primitives, constants, form styles, object routing) — pure mechanical extraction, no risk, immediate readability gains
2. **P1.1** (InputField) — biggest single impact on form readability
3. **P1.4** + **P1.6** (Badge + Button usage) — starts using existing component library
4. **P2.4** (Type api.ts returns) — enables TypeScript to help you on every subsequent change
5. Then **P1.2** (useFetch) + **P1.5** (DataTable) + **P2.1** (merge APIs)
6. Finally **P3.4** (split EconomyPage) — biggest, save for last
