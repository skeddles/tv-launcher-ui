import { useCallback, useEffect, useState } from 'react'
import { hexToHsl, hslToHex, isHex, type Hsl } from '../lib/color'
import { currentElement, focus, useFocused } from '../lib/focus'
import { interceptInput } from '../lib/input'
import { BACKGROUNDS, getPrefs, setPrefs } from '../lib/prefs'
import { Dialog } from './Dialog'

// Brightness stops at 26%: the launcher's text is light, so the page stays dark.
const MAX_LIGHTNESS = 26

type SliderKey = 'h' | 's' | 'l'
const SLIDERS: Array<{ key: SliderKey; label: string; min: number; max: number; step: number }> = [
  { key: 'h', label: 'Hue', min: 0, max: 360, step: 10 },
  { key: 's', label: 'Color amount', min: 0, max: 100, step: 5 },
  { key: 'l', label: 'Brightness', min: 0, max: MAX_LIGHTNESS, step: 1 },
]

function trackFor(key: SliderKey, hsl: Hsl): string {
  if (key === 'h') {
    const stops = [0, 60, 120, 180, 240, 300, 360].map((h) => hslToHex({ h, s: Math.max(hsl.s, 40), l: 40 }))
    return `linear-gradient(to right, ${stops.join(', ')})`
  }
  if (key === 's') return `linear-gradient(to right, ${hslToHex({ ...hsl, s: 0 })}, ${hslToHex({ ...hsl, s: 100 })})`
  return `linear-gradient(to right, #000000, ${hslToHex({ ...hsl, l: MAX_LIGHTNESS })})`
}

function Slider({
  k,
  label,
  value,
  min,
  max,
  track,
  onChange,
}: {
  k: SliderKey
  label: string
  value: number
  min: number
  max: number
  track: string
  onChange: (v: number) => void
}) {
  const id = `bgpick:${k}`
  const focused = useFocused(id)
  const pct = ((value - min) / (max - min)) * 100
  return (
    <button
      type="button"
      className={`bg-slider${focused ? ' is-focused' : ''}`}
      data-focus={id}
      data-focus-group="dialog"
      aria-label={`${label} ${value}`}
    >
      <span className="bg-slider__label">{label}</span>
      <span
        className="bg-slider__track"
        style={{ background: track }}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          onChange(Math.round(min + ((e.clientX - r.left) / r.width) * (max - min)))
        }}
      >
        <span className="bg-slider__thumb" style={{ left: `${pct}%` }} />
      </span>
    </button>
  )
}

function Preset({ i, color, label, current, onPick }: { i: number; color: string; label: string; current: boolean; onPick: () => void }) {
  const id = `bgpick:preset:${i}`
  const focused = useFocused(id)
  return (
    <button
      type="button"
      className={`bg-preset${current ? ' bg-preset--on' : ''}${focused ? ' is-focused' : ''}`}
      data-focus={id}
      data-focus-group="dialog"
      style={{ background: color }}
      aria-label={label}
      title={label}
      onClick={onPick}
    />
  )
}

/** Settings > Background color: presets, or any dark colour by hue, color amount and brightness. */
export function BackgroundPicker({ onClose }: { onClose: () => void }) {
  const start = getPrefs().background
  const [hsl, setHsl] = useState<Hsl>(() => {
    const v = hexToHsl(isHex(start) ? start : BACKGROUNDS[0].color)
    return { ...v, l: Math.min(v.l, MAX_LIGHTNESS) }
  })
  const [hex, setHex] = useState(isHex(start) ? start.toUpperCase() : BACKGROUNDS[0].color)

  const apply = useCallback((next: Hsl) => {
    const color = hslToHex(next)
    setHsl(next)
    setHex(color)
    setPrefs({ background: color })
  }, [])

  const setPart = useCallback(
    (key: SliderKey, v: number) => {
      const s = SLIDERS.find((x) => x.key === key)!
      apply({ ...hsl, [key]: Math.max(s.min, Math.min(s.max, v)) })
    },
    [hsl, apply],
  )

  // Left/right change the highlighted slider; up/down move between rows as usual.
  useEffect(
    () =>
      interceptInput((a) => {
        if (a !== 'left' && a !== 'right') return false
        const id = currentElement()?.dataset.focus ?? ''
        const s = SLIDERS.find((x) => id === `bgpick:${x.key}`)
        if (!s) return false
        const dir = a === 'right' ? 1 : -1
        // Hue goes round; the others stop at the ends.
        const raw = hsl[s.key] + dir * s.step
        setPart(s.key, s.key === 'h' ? (raw + 360) % 360 : raw)
        return true
      }),
    [hsl, setPart],
  )

  // Start on the first slider (the dialog itself focuses Done first).
  useEffect(() => {
    const t = window.setTimeout(() => focus('bgpick:h'), 60)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <Dialog title="Background color" options={[{ label: 'Done', onSelect: onClose }]} onClose={onClose}>
      <div className="bg-presets">
        {BACKGROUNDS.map((b, i) => (
          <Preset
            key={b.color}
            i={i}
            color={b.color}
            label={b.label}
            current={b.color.toUpperCase() === hex}
            onPick={() => {
              setHex(b.color.toUpperCase())
              const v = hexToHsl(b.color)
              setHsl({ ...v, l: Math.min(v.l, MAX_LIGHTNESS) })
              setPrefs({ background: b.color })
            }}
          />
        ))}
      </div>
      {SLIDERS.map((s) => (
        <Slider
          key={s.key}
          k={s.key}
          label={s.label}
          value={hsl[s.key]}
          min={s.min}
          max={s.max}
          track={trackFor(s.key, hsl)}
          onChange={(v) => setPart(s.key, v)}
        />
      ))}
      <p className="adjust__help muted">Up/down to pick a slider, left/right to change it · {hex}</p>
    </Dialog>
  )
}
