// Movies and TV Shows: the streaming services that carry each.
import { Header } from '../components/Header'
import type { Tag } from '../data/catalog'
import { appTiles, serviceTiles, useLibrary } from '../lib/library'
import { TileRow } from './shared'

const mediaApps = new Set(['tv.kodi.Kodi', 'org.jellyfin.JellyfinDesktop'])

export function Browse({ title, tag }: { title: string; tag: Tag }) {
  const lib = useLibrary()
  const services = serviceTiles().filter((s) => s.tags.includes(tag))
  const media = appTiles(lib.flatpaks).filter((a) => a.launch.kind === 'flatpak' && mediaApps.has(a.launch.appId))
  return (
    <>
      <Header title={title} />
      <TileRow first title="Streaming Services" tiles={services} />
      {media.length > 0 && <TileRow title="Media Apps" tiles={media} />}
    </>
  )
}
