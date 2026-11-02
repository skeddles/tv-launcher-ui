// Things you've hidden (tile options → Hide…, Settings → Hidden): one item, a
// whole row, or a genre. A hidden genre removes its rows everywhere ("Horror",
// "Horror · Movies", "Horror on Netflix") and games or itch.io games of that
// genre from every row. Kept in prefs (they survive restarts).

import { getPrefs, setPrefs, usePrefs } from './prefs'

export type HiddenKind = 'item' | 'row' | 'genre'

export interface HiddenRule {
  kind: HiddenKind
  value: string // tile id, row title, or genre name
  label: string // shown in Settings
}

/** "Platformers", "Platformer", "platform" -> "platform"; "Role Playing", "RPGs" -> "rpg". */
export function genreKey(name: string): string {
  let k = name.toLowerCase().replace(/[^a-z]/g, '')
  if (k === 'roleplaying' || k === 'roleplayinggame' || k === 'rpgs') return 'rpg'
  k = k.replace(/(games|game)$/, '').replace(/(ers|er|s)$/, '')
  return k
}

/** A row's genre, if its title names one: "Horror on Netflix · Movies" -> "horror". */
function rowGenre(title: string): string {
  const base = title
    .replace(/\s*·.*$/, '')
    .replace(/\s+on Netflix$/i, '')
    .replace(/\s+(games|movies|shows)$/i, '')
  return genreKey(base)
}

export function useHidden(): HiddenRule[] {
  return usePrefs((p) => p.hidden)
}

export function hiddenSets(rules: HiddenRule[]) {
  return {
    items: new Set(rules.filter((r) => r.kind === 'item').map((r) => r.value)),
    rows: new Set(rules.filter((r) => r.kind === 'row').map((r) => r.value)),
    genres: new Set(rules.filter((r) => r.kind === 'genre').map((r) => genreKey(r.value))),
  }
}

export type HiddenSets = ReturnType<typeof hiddenSets>

export function rowHidden(h: HiddenSets, title: string): boolean {
  return h.rows.has(title) || (h.genres.size > 0 && h.genres.has(rowGenre(title)))
}

export function itemHidden(h: HiddenSets, id: string, genre?: string | null): boolean {
  return h.items.has(id) || (Boolean(genre) && h.genres.has(genreKey(genre!)))
}

export function hide(rule: HiddenRule) {
  const rules = getPrefs().hidden.filter((r) => !(r.kind === rule.kind && r.value === rule.value))
  setPrefs({ hidden: [...rules, rule] })
}

export function unhide(rule: HiddenRule) {
  setPrefs({ hidden: getPrefs().hidden.filter((r) => !(r.kind === rule.kind && r.value === rule.value)) })
}
