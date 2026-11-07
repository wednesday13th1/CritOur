import {ja} from '@/lib/critour-ja';
import {categoryLabel,showcaseMedia} from '@/lib/critour-showcase-media';

export function ShowcaseGallery({title,media,endpoint}:{title:string;media:ReturnType<typeof showcaseMedia>;endpoint:string}) {
  if (!media.cover && !media.screenshots.length) return null;
  return <div className="cr-showcase-gallery">
    {media.cover&&<img className="cr-showcase-cover" src={endpoint} alt={title+'のカバー画像'}/>}
    {!!media.screenshots.length&&<ul aria-label="スクリーンショット">
      {media.screenshots.map((id,index)=><li key={id}>
        <a href={endpoint+'?asset='+encodeURIComponent(id)} target="_blank" rel="noopener noreferrer" aria-label={'スクリーンショット'+(index+1)+'を別のタブで開く'}>
          <img loading="lazy" src={endpoint+'?asset='+encodeURIComponent(id)} alt={title+'のスクリーンショット'+(index+1)}/>
        </a>
      </li>)}
    </ul>}
  </div>;
}

export function ShowcaseDetails({title,description,category,kind,stage,media,children,level=1}:{
  title:string;description:string;category:string;kind:string;stage:string;media:ReturnType<typeof showcaseMedia>;children?:React.ReactNode;level?:1|2;
}) {
  const Title = level===1?'h1':'h2';
  const AboutHeading = level===1?'h2':'h3';
  const intro = description.length>180?description.slice(0,179).trimEnd()+'…':description;
  const links = [[ja.demo,media.demo],[ja.video,media.video],['GitHub',media.github]] as const;
  return <div className="cr-showcase-details">
    <Title>{title}</Title>
    <p className="cr-meta">{categoryLabel(category,kind)} · {stage==='ready'?"試せる状態":"制作中"}</p>
    {intro===description&&<AboutHeading>{ja.about}</AboutHeading>}
    <p className="cr-body cr-showcase-intro">{intro}</p>
    {links.some(([,url])=>url)&&<ul className="cr-showcase-links" aria-label="作品のリンク">
      {links.map(([label,url])=>url&&<li key={label}><a href={url} target="_blank" rel="noopener noreferrer">{label} <span aria-hidden="true">↗</span></a></li>)}
    </ul>}
    {media.video&&<p><small>字幕がある場合は、動画プレーヤーの字幕ボタンで表示できます。作品の説明もあわせて確認できます。</small></p>}
    {intro!==description&&<section><AboutHeading>{ja.about}</AboutHeading><p className="cr-body">{description}</p></section>}
    {children}
  </div>;
}
