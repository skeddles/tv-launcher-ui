// Built-in launcher entries. Edit freely: add a service, reorder, recolor.
// `needs` names a Flatpak that must be installed; if it's missing, selecting the
// tile offers to install it from Flathub instead.

import type { LaunchTarget } from '../lib/bridge'

export type Tag = 'movies' | 'tv' | 'music' | 'games' | 'video'

export interface CatalogItem {
  id: string
  title: string
  color: string
  tags: Tag[]
  launch: LaunchTarget
  needs?: string // Flatpak app id
  image?: string
  icon?: string
  // A logo filling the tile (Roku style), from Wikimedia Commons: the file name of
  // the service's current logo on its Wikidata entry (property P154). The tile's
  // `color` is the background behind it.
  logo?: string
  // Recolour the logo for contrast: 'white' = all white; 'invert' = dark parts
  // light, colours kept roughly (for logos with black text)
  logoTone?: 'white' | 'invert'
}

/** A Commons file as a PNG of the given width (Commons renders SVGs). */
export function commonsImage(file: string, width = 640): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`
}

// DRM services (Netflix, Disney+, Prime Video) open in Google Chrome in kiosk
// mode, because Chrome has Widevine. On Linux that means about 720p.
const chrome = (url: string): LaunchTarget => ({ kind: 'chrome', url })

export const streaming: CatalogItem[] = [
  {
    id: 'netflix',
    title: 'Netflix',
    color: '#000000',
    logo: 'Netflix 2015 logo.svg',
    tags: ['movies', 'tv'],
    launch: chrome('https://www.netflix.com/browse'),
    needs: 'com.google.Chrome',
  },
  {
    id: 'youtube',
    title: 'YouTube',
    color: '#FFFFFF',
    logo: 'YouTube 2024.svg',
    tags: ['video', 'tv'],
    launch: { kind: 'flatpak', appId: 'rocks.shy.VacuumTube' },
    needs: 'rocks.shy.VacuumTube',
  },
  {
    id: 'plex',
    title: 'Plex',
    color: '#1F1F1F',
    logo: 'Plex logo 2022.svg',
    logoTone: 'invert',
    tags: ['movies', 'tv'],
    launch: { kind: 'flatpak', appId: 'tv.plex.PlexHTPC' },
    needs: 'tv.plex.PlexHTPC',
  },
  {
    id: 'disney',
    title: 'Disney+',
    color: '#0E2A5C',
    logo: 'Disney+ 2024.svg',
    logoTone: 'white',
    tags: ['movies', 'tv'],
    launch: chrome('https://www.disneyplus.com/'),
    needs: 'com.google.Chrome',
  },
  {
    id: 'prime',
    title: 'Prime Video',
    color: '#0F171E',
    logo: 'Prime Video logo (2024).svg',
    tags: ['movies', 'tv'],
    launch: chrome('https://www.primevideo.com/'),
    needs: 'com.google.Chrome',
  },
  {
    id: 'twitch',
    title: 'Twitch',
    color: '#FFFFFF',
    logo: 'Twitch logo 2019.svg', // a filled shape with cut-out letters: keep its own colours
    tags: ['video'],
    launch: { kind: 'web', url: 'https://www.twitch.tv/' },
  },
]

export const steamBigPicture: CatalogItem = {
  id: 'steam-bigpicture',
  title: 'Steam Big Picture',
  color: 'var(--tile-bg)',
  tags: ['games'],
  launch: { kind: 'steam-bigpicture' },
}

// Flatpaks known to work well with a controller. The store lists these first,
// alongside apps whose Flathub listing says they support a gamepad (few do).
export const controllerFriendly: string[] = [
  'tv.plex.PlexHTPC',
  'rocks.shy.VacuumTube',
  'tv.kodi.Kodi',
  'org.jellyfin.JellyfinDesktop',
  'com.moonlight_stream.Moonlight',
  'org.libretro.RetroArch',
  'org.ppsspp.PPSSPP',
  'net.pcsx2.PCSX2',
  'org.DolphinEmu.dolphin-emu',
  'net.kuribo64.melonDS',
  'com.google.Chrome',
]

// Flatpaks that are part of the plumbing, hidden from the Apps row.
export const hiddenApps = new Set<string>(['com.google.Chrome', 'com.valvesoftware.Steam'])

// Tiles for apps without artwork use a shade of the background colour
// (Settings > Background color), so icons sit on a matching backdrop.
export function colorFor(_id: string): string {
  return 'var(--tile-bg)'
}

export const accents = ['#4F8EF7', '#E5484D', '#30A46C', '#F5A524']
