import dotenv from 'dotenv';dotenv.config({path:'.env.local'});dotenv.config();
const base=process.env.BASE_URL||'http://localhost:3000';const secret:string=process.env.CRON_SECRET??'';if(!secret)throw new Error('CRON_SECRET is required');
console.log(`Hold expiry scheduler active for ${base}; press Ctrl+C to stop.`);
async function tick(){try{const r=await fetch(`${base}/api/internal/expire-holds`,{method:'POST',headers:{'x-cron-secret':secret}});const body=await r.json();if(!r.ok)console.error('Expiry sweep failed:',body.error);else console.log(`Expired ${body.expired} stale holds.`);}catch(e){console.error('Expiry endpoint unavailable:',e);}}
await tick();setInterval(tick,60_000);
