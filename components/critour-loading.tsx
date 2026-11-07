export function CritourLoading({label}:{label:string}){
 return <div className="cr-loading" role="status" aria-label={label}><span className="cm-sr-only">{label}</span><span className="cr-skeleton cr-skeleton-short" aria-hidden="true"/><span className="cr-skeleton" aria-hidden="true"/><span className="cr-skeleton" aria-hidden="true"/></div>;
}
