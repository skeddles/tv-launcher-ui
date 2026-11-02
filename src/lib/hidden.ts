// Things you've hidden (tile options → Hide…, Settings → Hidden): one item, a
// whole row, or a genre. Genres are kept apart for games and for movies & TV:
// hiding the game genre "Action" leaves the "Action" movie rows alone. A hidden
// video genre removes its rows ("Horror", "Horror · Movies", "Horror on
// Netflix"); a hidden game genre removes its game rows and games of that genre
// from every row. Kept in prefs (they survive restarts).

import { getPrefs, setPrefs, usePrefs } from './prefs'

export type HiddenKind = 'item' | 'row' | 'genre'
export type Domain = 'games' | 'video'

export interface HiddenRule {
  kind: HiddenKind
  value: string // tile id, row title, or genre name
  label: string // shown in Settings
  domain?: Domain // genres only (older rules without one were game genres)
}

export const DOMAIN_NAME: Record<Domain, string> = { games: 'games', video: 'movies & TV' }

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
  const genres = (d: Domain) => new Set(rules.filter((r) => r.kind === 'genre' && (r.domain ?? 'games') === d).map((r) => genreKey(r.value)))
  return {
    items: new Set(rules.filter((r) => r.kind === 'item').map((r) => r.value)),
    rows: new Set(rules.filter((r) => r.kind === 'row').map((r) => r.value)),
    genres: { games: genres('games'), video: genres('video') } as Record<Domain, Set<string>>,
  }
}

export type HiddenSets = ReturnType<typeof hiddenSets>

/** A row is hidden by its title, or by a hidden genre of its kind (game rows / movie & TV rows). */
export function rowHidden(h: HiddenSets, title: string, domain?: Domain): boolean {
  if (h.rows.has(title)) return true
  return Boolean(domain) && h.genres[domain!].size > 0 && h.genres[domain!].has(rowGenre(title))
}

/** Items are hidden one by one, or (games) by a hidden game genre. */
export function itemHidden(h: HiddenSets, id: string, genre?: string | null): boolean {
  return h.items.has(id) || (Boolean(genre) && h.genres.games.has(genreKey(genre!)))
}

const same = (a: HiddenRule, b: HiddenRule) => a.kind === b.kind && a.value === b.value && (a.domain ?? 'games') === (b.domain ?? 'games')

export function hide(rule: HiddenRule) {
  const rules = getPrefs().hidden.filter((r) => !same(r, rule))
  setPrefs({ hidden: [...rules, rule] })
}

export function unhide(rule: HiddenRule) {
  setPrefs({ hidden: getPrefs().hidden.filter((r) => !same(r, rule)) })
}
