export function validEventDate(value:unknown):value is string {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function tokyoToday(now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(type=>parts.find(p=>p.type===type)!.value).join('-');
}
export function upcomingDeadlines(events:any[],today=tokyoToday()) {
 return events.filter(e=>e.kind==='deadline'&&!e.completed&&e.event_date>=today).sort((a,b)=>a.event_date.localeCompare(b.event_date)||a.title.localeCompare(b.title));
}
