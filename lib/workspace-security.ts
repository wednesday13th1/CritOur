const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
export async function digest(value: string) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
export function validPin(pin: unknown): pin is string {
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return false;
  return !/^(\d)\1{3}$/.test(pin) && !['0123','1234','2345','3456','4567','5678','6789','7890','9876','8765','7654','6543','5432','4321','3210','1212','1112','1122','1313','2000','2026','2580','0852'].includes(pin);
}
export async function hashPin(pin: string, salt = crypto.randomUUID()) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:100000,salt:encoder.encode(salt)},key,256);
  return `pbkdf2$100000$${salt}$${hex(bits)}`;
}
export async function verifyPin(pin: string, stored: string) {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2' || parts[1] !== '100000') return false;
  const computed = await hashPin(pin,parts[2]);
  let different = computed.length ^ stored.length;
  for(let i=0;i<computed.length;i++) different |= computed.charCodeAt(i) ^ (stored.charCodeAt(i)||0);
  return different === 0;
}
