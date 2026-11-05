export const dynamic='force-dynamic';
import '../admin.css';import Link from 'next/link';import {TeamCalendar} from '@/components/workspace-extras';export default function Calendar(){return <main className="shell" style={{paddingTop:50,paddingBottom:60}}><Link href="/">← motto.</Link><TeamCalendar/></main>}
