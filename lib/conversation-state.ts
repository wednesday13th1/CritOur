// Stable identity/order across live windows, pagination and optimistic delivery.
export function mergeRows<T extends {id:string}>(previous:T[],incoming:T[]):T[]{
 const rows=new Map(previous.map(row=>[row.id,row]));for(const row of incoming)rows.set(row.id,row);return [...rows.values()];
}
export function mergeMessages<T extends {id:string;seq?:number;created_at?:string;client_id?:string;sender_id?:string}>(previous:T[],incoming:T[]):T[]{
 return mergeRows(previous,incoming).sort((a,b)=>a.seq&&b.seq?a.seq-b.seq:(a.created_at||'').localeCompare(b.created_at||'')||a.id.localeCompare(b.id));
}
export function visiblePending<T extends {client_id?:string;sender_id?:string}>(pending:T[],confirmed:T[]):T[]{return pending.filter(p=>!confirmed.some(m=>p.client_id&&p.client_id===m.client_id&&p.sender_id===m.sender_id));}
// Each caller gets a ticket; a later request, scope change or unmount invalidates it.
export function requestGate(){let generation=0;return {begin(){const ticket=++generation;return ()=>ticket===generation},invalidate(){generation++}};}
