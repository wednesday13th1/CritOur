import {DisplayPreferences} from './critour-accessibility';
import {ja} from '@/lib/critour-ja';
import Link from 'next/link';
import {GalleryCover} from './critour-gallery-cover';
import {categoryLabel} from '@/lib/critour-showcase-media';
import type { GalleryCard } from '@/lib/critour-discovery';

export function PublicHeader({ current }: { current?: 'Home' | 'Explore' }) {
  return <><a className="cm-skip" href="#main">本文へ移動</a><header className="cr-public-header cr-beginner-header">
    <Link href="/" className="cr-wordmark">⌘ CritOur</Link>
    <nav aria-label="メインメニュー">
      <Link href="/" aria-current={current === 'Home' ? 'page' : undefined}>{ja.home}</Link>
      <Link href="/explore" aria-current={current === 'Explore' ? 'page' : undefined}>{ja.explore}</Link>
      <Link href="/codemate/create">{ja.create}</Link>
      <Link href="/codemate/profile">{ja.profile}</Link>
    </nav>
    <Link href="/codemate/profile#notifications" className="cr-notifications">{ja.notifications}</Link>
    <DisplayPreferences/>
  </header></>;
}

export function ProjectCard({ project, home = false }: { project: GalleryCard; home?: boolean }) {
  const Heading = home ? 'h3' : 'h2';
  return <article className="cm-card cr-discovery-card cr-beginner-card">
    <GalleryCover src={project.image?'/api/public/'+project.token+'/image':undefined} title={project.title}
      category={categoryLabel(project.category,project.kind)} x={project.focusX} y={project.focusY}/>
    <Heading>{project.title}</Heading>
    {project.description && <p className="cr-card-description">{project.description}</p>}
    <div className="cr-card-tags">
      {!!project.beginner && <span className="cm-chip">初心者歓迎</span>}
      {project.minutes !== null && <span className="cm-chip">約{project.minutes}分</span>}
      <span className="cm-chip">{project.requests ? "参加者募集中" : "募集中のタスクはありません"}</span>
    </div>
    <Link className="cm-primary" href={'/p/' + project.token + (project.requests ? '#help' : '')}>
      {project.requests ? ja.help : "作品を見る"} <span aria-hidden="true">→</span>
    </Link>
  </article>;
}
