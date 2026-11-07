import {ja} from '@/lib/critour-ja';
import Link from 'next/link';
import { getAdminUser } from '@/lib/admin-auth';
import { publicDirectory } from '@/lib/critour-discovery';
import { ProjectCard, PublicHeader } from './critour-public-ui';

export async function CritourLanding() {
  const user = await getAdminUser();
  const projects = await publicDirectory(new URLSearchParams({mode:'home'}), user?.accountId);

  return <div className="cm-root cr-public cr-landing">
    <PublicHeader current="Home"/>
    <main id="main" tabIndex={-1}>
      <section className="cr-landing-hero cr-beginner-hero">
        <span className="cm-eyebrow">ひとりで作り、みんなで育てる。</span>
        <h1>一緒に、何かをつくろう。</h1>
        <p>気になる作品を見つけて、小さな一歩から始めよう。</p>
        <div className="cr-build-actions">
          <Link className="cm-primary" href="/explore">プロジェクトを探す <span aria-hidden="true">→</span></Link>
          <Link className="cr-secondary" href="/codemate/create">つくり始める</Link>
        </div>
        <p className="cr-first-step"><strong>プログラミングが初めてでも参加できます。</strong> 作品を試して、気づいたことを作者に伝えてみよう。</p>
      </section>
      <section aria-labelledby="public-projects">
        <div className="cr-section-head"><h2 id="public-projects">できそうなことを見つける</h2><p>初心者歓迎の作品を先に表示しています。</p></div>
        {projects.length ? <div className="cm-card-grid">{projects.slice(0,4).map(project => <ProjectCard key={project.token} project={project} home/>)}</div> :
          <div className="cm-empty"><p>参加者を募集している作品はまだありません。</p><Link href="/explore">{ja.findProjects}</Link></div>}
        <Link href="/explore">すべてのプロジェクトを見る →</Link>
      </section>
      <section className="cr-how cr-first-path" aria-label="参加の流れ">
        <p><strong>さがす → 試す → 参加する → 学ぶ → つくる</strong></p>
        <p>気になるところから始めよう。感想ひとつでも作品づくりに参加できます。</p>
      </section>
      <section className="cr-critday"><strong>CritDay・毎週金曜日</strong><p>まだ感想が少ない作品を見てみよう。感想はいつでも送れます。</p></section>
      <footer className="cm-footer"><span>つくる楽しさを、すべての人に。</span><Link href="/team">制作チームのサイト →</Link></footer>
    </main>
  </div>;
}
