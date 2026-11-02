// What the bracketed tags in ROM file names mean, in words: "(U) [!]" -> USA,
// verified good copy. Covers the No-Intro style "(USA, Europe) (Rev 1)" and the
// older GoodTools codes "(UE) (V1.1) [h1C]". Unknown tags are shown as written.

const REGION_CODES: Record<string, string> = {
  U: 'USA',
  E: 'Europe',
  J: 'Japan',
  W: 'World',
  UE: 'USA, Europe',
  JU: 'Japan, USA',
  JUE: 'Japan, USA, Europe',
  UA: 'USA, Australia',
  F: 'France',
  G: 'Germany',
  S: 'Spain',
  I: 'Italy',
  K: 'Korea',
  A: 'Australia',
  B: 'Brazil',
  C: 'China',
  H: 'Netherlands',
  Sw: 'Sweden',
}

const LANGUAGES: Record<string, string> = {
  En: 'English', Ja: 'Japanese', Fr: 'French', De: 'German', Ge: 'German', Es: 'Spanish', It: 'Italian', Nl: 'Dutch',
  Pt: 'Portuguese', Sv: 'Swedish', No: 'Norwegian', Da: 'Danish', Fi: 'Finnish', Ko: 'Korean', Zh: 'Chinese', Ru: 'Russian', Pl: 'Polish',
}

const REGION_WORDS =
  /^(USA|Europe|Japan|World|Korea|Brazil|Australia|France|Germany|Spain|Italy|China|Asia|Canada|Netherlands|Sweden|Taiwan|Hong Kong|UK)(,\s*(USA|Europe|Japan|World|Korea|Brazil|Australia|France|Germany|Spain|Italy|China|Asia|Canada|Netherlands|Sweden|Taiwan|Hong Kong|UK))*$/

/** One tag (without its brackets) in words, or null to leave it out. */
function describe(tag: string, square: boolean, system?: string): string | null {
  const t = tag.trim()
  if (!square) {
    if (REGION_CODES[t]) return REGION_CODES[t]
    if (REGION_WORDS.test(t)) return t
    let m = /^(?:Rev|V)\s?([\d.A-Z]+)$/i.exec(t)
    if (m) return `Version ${m[1]}`
    m = /^M(\d+)$/.exec(t)
    if (m) return `${m[1]} languages`
    if (/^[A-Z][a-z](,[A-Z][a-z])*$/.test(t) && t.split(',').every((c) => LANGUAGES[c]))
      return t.includes(',') ? `Languages: ${t.split(',').map((c) => LANGUAGES[c]).join(', ')}` : `In ${LANGUAGES[t]}`
    if (/^(Beta|Proto|Prototype|Demo|Sample|Kiosk|Debug)\b/i.test(t)) return t
    if (/^Unl$/i.test(t)) return 'Unlicensed'
    if (/hack/i.test(t)) return t
    if (/^(Cracked|Independent|Mugs|TrashMan|GBANow)$/i.test(t)) return `Dump: ${t}`
    return t
  }
  // [square] GoodTools flags
  if (t === '!') return 'Verified good copy'
  if (t === 'C' && (system === 'gb' || system === 'gbc')) return 'Game Boy Color'
  if (t === 'S' && (system === 'gb' || system === 'gbc')) return 'Super Game Boy features'
  let m = /^T([+-])(\w+)(.*)$/.exec(t)
  if (m) return `${m[2]} translation${m[1] === '-' ? ' (older)' : ''}${m[3] ? ` ${m[3].trim()}` : ''}`
  m = /^([abhotfp])(\d*)(.*)$/.exec(t)
  if (m) {
    const kind = { a: 'Alternate copy', b: 'Bad copy (may glitch)', h: 'Hacked', o: 'Overdump', t: 'With a trainer (cheats)', f: 'Fixed', p: 'Pirate' }[m[1]]
    if (kind) return `${kind}${m[2] ? ` ${m[2]}` : ''}${m[3] ? ` (${m[3].trim()})` : ''}`
  }
  return `[${t}]`
}

/** Every tag in a file name, in words. */
export function romTags(file: string, system?: string): string[] {
  const out: string[] = []
  for (const m of file.matchAll(/\(([^)]*)\)|\[([^\]]*)\]/g)) {
    const d = describe(m[1] ?? m[2], m[2] !== undefined, system)
    if (d && !out.includes(d)) out.push(d)
  }
  return out
}

/** A short line telling copies apart: region and version first. */
export function romShortTags(file: string, system?: string): string {
  return romTags(file, system).slice(0, 3).join(' · ')
}
