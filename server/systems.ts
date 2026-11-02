// Game systems the launcher shows, and how each one runs in RetroArch.
//
// Folders on the TV: ~/Games/ROMs/<id>/ (shown on the Games page) and
// ~/Games/ROMs Extra/<id>/ (only under "All games"). BIOS files go in
// ~/Games/BIOS (RetroArch's system folder).
//
// `cores` are tried in order; the first one installed (and whose BIOS is
// present, if it needs one) runs the game. `art` names the system's folder on
// thumbnails.libretro.com, where the box art comes from.

export interface SystemDef {
  id: string
  name: string
  cores: Array<{ core: string; bios?: string[] }>
  exts: string[] // lower case, without the dot, most preferred first
  art: string[] // libretro-thumbnails system folders, searched in order
}

export const SYSTEMS: SystemDef[] = [
  { id: 'nes', name: 'NES', cores: [{ core: 'mesen' }], exts: ['nes', 'fds', 'unf'], art: ['Nintendo - Nintendo Entertainment System'] },
  {
    id: 'snes',
    name: 'Super Nintendo',
    cores: [{ core: 'snes9x' }],
    exts: ['sfc', 'smc'],
    art: ['Nintendo - Super Nintendo Entertainment System'],
  },
  { id: 'n64', name: 'Nintendo 64', cores: [{ core: 'mupen64plus_next' }], exts: ['z64', 'n64', 'v64'], art: ['Nintendo - Nintendo 64'] },
  {
    id: 'gb',
    name: 'Game Boy',
    cores: [{ core: 'gambatte' }],
    exts: ['gb', 'gbc'],
    art: ['Nintendo - Game Boy', 'Nintendo - Game Boy Color'],
  },
  {
    id: 'gbc',
    name: 'Game Boy Color',
    cores: [{ core: 'gambatte' }],
    exts: ['gbc', 'gb'],
    art: ['Nintendo - Game Boy Color', 'Nintendo - Game Boy'],
  },
  { id: 'gba', name: 'Game Boy Advance', cores: [{ core: 'mgba' }], exts: ['gba'], art: ['Nintendo - Game Boy Advance'] },
  { id: 'nds', name: 'Nintendo DS', cores: [{ core: 'melondsds' }], exts: ['nds'], art: ['Nintendo - Nintendo DS'] },
  { id: '3ds', name: 'Nintendo 3DS', cores: [{ core: 'azahar' }], exts: ['3ds', 'cci', 'cia', '3dsx'], art: ['Nintendo - Nintendo 3DS'] },
  {
    id: 'gamecube',
    name: 'GameCube',
    cores: [{ core: 'dolphin' }],
    exts: ['rvz', 'gcz', 'iso', 'gcm', 'ciso'],
    art: ['Nintendo - GameCube'],
  },
  { id: 'wii', name: 'Wii', cores: [{ core: 'dolphin' }], exts: ['rvz', 'wbfs', 'iso', 'wad'], art: ['Nintendo - Wii'] },
  {
    id: 'megadrive',
    name: 'Sega Genesis',
    cores: [{ core: 'genesis_plus_gx' }],
    exts: ['md', 'gen', 'smd', 'bin'],
    art: ['Sega - Mega Drive - Genesis'],
  },
  { id: 'mastersystem', name: 'Master System', cores: [{ core: 'genesis_plus_gx' }], exts: ['sms'], art: ['Sega - Master System - Mark III'] },
  { id: 'gamegear', name: 'Game Gear', cores: [{ core: 'genesis_plus_gx' }], exts: ['gg'], art: ['Sega - Game Gear'] },
  {
    id: 'saturn',
    name: 'Sega Saturn',
    cores: [{ core: 'mednafen_saturn', bios: ['sega_101.bin', 'mpr-17933.bin'] }, { core: 'yabasanshiro' }],
    exts: ['m3u', 'chd', 'cue', 'ccd', 'iso'],
    art: ['Sega - Saturn'],
  },
  { id: 'dreamcast', name: 'Dreamcast', cores: [{ core: 'flycast' }], exts: ['m3u', 'chd', 'gdi', 'cdi', 'cue'], art: ['Sega - Dreamcast'] },
  {
    id: 'psx',
    name: 'PlayStation',
    cores: [{ core: 'pcsx_rearmed' }, { core: 'swanstation' }],
    exts: ['m3u', 'chd', 'pbp', 'cue', 'ccd'],
    art: ['Sony - PlayStation'],
  },
  { id: 'ps2', name: 'PlayStation 2', cores: [{ core: 'pcsx2', bios: ['pcsx2/bios'] }], exts: ['chd', 'iso', 'cso'], art: ['Sony - PlayStation 2'] },
  { id: 'dos', name: 'DOS', cores: [{ core: 'dosbox_pure' }], exts: ['zip', 'dosz', 'conf'], art: ['DOS'] },
  { id: 'scummvm', name: 'ScummVM', cores: [{ core: 'scummvm' }], exts: ['scummvm'], art: ['ScummVM'] },
]
