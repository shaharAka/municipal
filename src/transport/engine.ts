import schedule from './schedule.json' with { type: 'json' };
import { composeBaseline, loadPacks, pageProblems } from '../ontology/compose.ts';
import { refFor } from '../graph/graph.ts';
import { liveFor, pointsFor, alertsFor, FLEET_CAUSE } from './simulate.ts';
export const DEMO_DATE = '2026-11-08';
export const DEMO_CLOCK = '07:05';
const DEMO_NAMES = ['דוד מזרחי','יעקב אוחיון','סאמר חלבי','אבי ברק','מוחמד ספדי','משה דהן','אלון שגיא','ראובן לוי','ניר עמר','אדהם אבו סאלח','שלמה פרץ','יוסי חזן','רמי נחום','אייל גבאי','ואיל מסעדה','עמית כרמי','חיים אזולאי','טל רוזן','ג׳מאל אבו זייד','אורי שלום','בני אדרי','גיל נאור','סלים חוסיין','אליהו ביטון','עופר זיו','נתן פרידמן','מאיר כהן','יגאל טל','שמעון דוד','איתי בר','רפאל אסולין','נאיף אבו שאהין','דניאל גולן','חסן אבו עוואד','אסף רביבו','קובי חדד','מג׳די אבו ג׳בל','אריאל סויסה','זיאד חלבי','עידו קורן','שאדי ספדי','רועי אלמליח','בועז שמש','פאדי ברכאת','אהרון מלכה','ליאור נגר','יהודה אוחנה','ויסאם טרביה','גדי שטרן','אמיר עזאם','צחי בן חמו'];
export const DAYS = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const ontology = composeBaseline(loadPacks());
export class TransportError extends Error {
  status: number;
  constructor(message: string, status = 422) { super(message); this.status = status; }
}
const fail = (message: string, status = 422): never => { throw new TransportError(message, status); };
export const numericCount = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export const minutes = (time: string) => /^\d\d:\d\d$/.test(time || '') ? Number(time.slice(0,2))*60+Number(time.slice(3)) : -1;
const validTime = (time: string) => minutes(time) >= 0 && minutes(time) < 1440 && Number(time.slice(3)) < 60;
const clone = <T>(x: T): T => structuredClone(x);
export function weekday(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date+'T12:00:00Z')) || new Date(date+'T12:00:00Z').toISOString().slice(0,10) !== date) fail('יש לבחור תאריך תקין.');
  return new Date(date+'T12:00:00Z').getUTCDay();
}
function plusDays(iso:string,n:number){return new Date(Date.parse(iso)+n*86_400_000).toISOString().slice(0,10);}
export function createTransportState(): any {
  const codes = [...new Set(schedule.trips.map(t => t.routeCode))].sort((a,b) => Number(a)-Number(b));
  const drivers: any = {}, vehicles: any = {};
  // Fictional names and plates: the workbook's real drivers and vehicles stay out of the demo.
  codes.forEach((code, i) => {
    const name = DEMO_NAMES[i % DEMO_NAMES.length];
    drivers['driver-'+code] = {id:'driver-'+code, name, routeCode:code, licenseType:Number(code)>=300?'C1':'D', licenseUntil:code==='21'?'2026-11-06':`2027-0${1+(i%9)}-15`, available:true, contact:`050-0000${String(100+i).slice(-3)}`, origin:'demo'};
    const capacity = (schedule.capacities as any)[code];
    vehicles['bus-'+code] = {id:'bus-'+code, label:'אוטובוס '+code, registration:`${10+i}-${300+i*7}-${String(40+i).padStart(2,'0')}`, capacity:capacity?.seats ?? null, capacitySource:capacity?.source || 'לא מופיע בקובץ', testUntil:code==='14'?'2026-11-06':`2027-0${1+((i+3)%9)}-28`, serviceDue:code==='15'?'2026-11-12':`2026-12-${String(10+(i%18)).padStart(2,'0')}`, available:true, origin:'demo'};
  });
  drivers['driver-spare'] = {id:'driver-spare', name:'רון אלמוג', routeCode:'', licenseType:'D', licenseUntil:'2027-08-31', available:true, contact:'050-0000999', origin:'demo'};
  vehicles['bus-spare'] = {id:'bus-spare',label:'אוטובוס חלופי',registration:'71-990-12',capacity:60,capacitySource:'נתון הדגמה',testUntil:'2027-04-30',serviceDue:'2026-12-15',available:true,origin:'demo'};
  return {schema:1, revision:1, drivers, vehicles, template:{}, days:{}, receipts:{}, inbox:[], createdAt:new Date().toISOString()};
}
export function actorFor(state: any, id: string) {
  if (id==='shuki' || id==='inbal') return {id, name:id==='shuki'?'שוקי':'ענבל', role:'dispatcher'};
  if (state.drivers[id]) return {id, name:state.drivers[id].name, role:'driver'};
  return fail('זהות הדגמה לא מוכרת.',403);
}
/** The regular crew of a route: its own driver and bus unless the weekly template says otherwise. */
export function crewOf(state: any, routeCode: string) {
  const t = state.template?.[routeCode] ?? {};
  return { driverId: t.driverId ?? 'driver-'+routeCode, vehicleId: t.vehicleId ?? 'bus-'+routeCode };
}
export function dayFor(state: any, date: string) {
  const day = weekday(date);
  if (!state.days[date]) {
    const trips = schedule.trips.filter(t => t.weekday===day).map(t => ({...clone(t), date, version:1, ...crewOf(state, t.routeCode), published:true, phase:'pending', reports:{}, departures:[], onBoard:0, boarded:null, alighted:0, delayMinutes:0, notes:[], events:[], demoFocus:['10-1','11-1','12-1'].includes(t.number)}));
    // The day starts just before the presenter's trip; other buses move by the demo clock (simulate.ts).
    state.days[date] = {date, trips, events:[], clock:DEMO_CLOCK, nextId:1};
    if (date===DEMO_DATE) handledYesterday(state, state.days[date]);
  }
  return state.days[date];
}
/** The demo morning starts where a real one would: Inbal already split the overloaded rides of
 *  routes 16-18 yesterday, with buses and drivers that only work on Fridays. The workbook's own
 *  numbers stay as they are; route 15 is left open to show the split live. */
function handledYesterday(state:any, day:any) {
  const near=(field:string,id:string,t:any)=>day.trips.some((o:any)=>o[field]===id&&Math.abs(minutes(o.departure)-minutes(t.departure))<120);
  const buses=Object.values(state.vehicles).filter((v:any)=>v.id.includes('שישי'));
  const drivers=Object.values(state.drivers).filter((d:any)=>String(d.routeCode).includes('שישי'));
  const inbal={id:'inbal',name:'ענבל',role:'dispatcher'};
  for (const t of day.trips.filter((x:any)=>['16','17','18'].includes(x.routeCode))) {
    const cap=state.vehicles[t.vehicleId]?.capacity; if (!cap||!(t.planned>cap)) continue;
    const bus:any=buses.find((v:any)=>!near('vehicleId',v.id,t)); const drv:any=drivers.find((d:any)=>!near('driverId',d.id,t));
    if (!bus||!drv) continue;
    const need=t.planned-cap;
    const whole=[...t.stops].filter((x:any)=>x.planned>=need&&x.planned<t.planned).sort((a:any,b:any)=>a.planned-b.planned)[0];
    let moving:any[];
    if (whole) { moving=[whole]; t.stops=t.stops.filter((x:any)=>x!==whole); }
    else { const big=[...t.stops].sort((a:any,b:any)=>b.planned-a.planned)[0]; moving=[{...big,planned:need}]; t.stops=t.stops.map((x:any)=>x===big?{...x,planned:x.planned-need}:x); }
    const n=moving.reduce((a:number,x:any)=>a+x.planned,0); t.planned-=n;
    const twin={...clone(t),id:t.id+'-b'+day.nextId++,number:t.number+' ב',stops:moving,planned:n,driverId:drv.id,vehicleId:bus.id,version:1,events:[],notes:[],reports:{},departures:[],splitFrom:t.id,published:true,demoFocus:false};
    day.trips.push(twin);
    event(state,day,t,inbal,'split',`פוצלה אתמול לשני רכבים: ${moving.map((x:any)=>x.name).join(', ')} עברו ל${bus.label} עם ${drv.name}`);
  }
}
/** An absence (a driver) or a period out of service (a bus) that covers the date. */
export const awayOn = (r: any, date: string) => (r?.away ?? []).some((x: any) => x.from <= date && date <= x.to);
export function readiness(state: any, trip: any, date: string): string[] {
  const issues = [...trip.reviewReasons];
  const driver=state.drivers[trip.driverId], bus=state.vehicles[trip.vehicleId];
  if (!driver) issues.push('חסר שיבוץ נהג');
  else {
    if (!driver.available || driver.archived) issues.push('הנהג אינו זמין');
    else if (awayOn(driver,date)) issues.push('הנהג לא זמין בתאריך הזה');
    if (!driver.licenseUntil || driver.licenseUntil<date) issues.push('הרישיון של הנהג פג');
  }
  if (!bus) issues.push('חסר שיבוץ רכב');
  else {
    if (!bus.available || bus.archived) issues.push('הרכב אינו זמין');
    else if (awayOn(bus,date)) issues.push('הרכב לא זמין בתאריך הזה');
    if (!bus.testUntil || bus.testUntil<date) issues.push('הטסט של הרכב פג');
    if (!bus.serviceDue || bus.serviceDue<date) issues.push('הרכב לא עבר טיפול בזמן');
    if (numericCount(trip.planned) && bus.capacity!=null && trip.planned>bus.capacity) issues.push(`מתוכננים ${trip.planned} תלמידים לרכב עם ${bus.capacity} מקומות`);
  }
  if (!validTime(trip.departure)) issues.push('חסרה שעת יציאה תקינה');
  if (!trip.stops.length || trip.stops.some((s:any)=>!numericCount(s.planned))) issues.push('חסרות כמויות תלמידים בתחנות');
  return [...new Set(issues)];
}
/** File checks come from the council's own workbook flags: worth a look, never a reason to stop a bus. */
export const FILE_CHECKS = new Set(['מספר התלמידים בתחנה אינו מאומת','שם תחנה דורש בירור','המקור מסומן לבדיקה','חסרות כמויות תלמידים בתחנות']);
/** Blockers stop publishing and driving: an expired licence or test, a missing driver or bus, too few seats, no time. */
export function blockers(state:any, trip:any, date:string): string[] { return readiness(state,trip,date).filter(i=>!FILE_CHECKS.has(i)); }
/** One problem per cause: a driver, a bus, or a route short of seats. The planner and the calendar count the same way. */
export function issueKeyFor(trip:any, list:string[]): string|null {
  if(!list.length) return null;
  if(list.some(x=>/נהג/.test(x))) return 'driver-'+(trip.driverId||'none');
  if(list.some(x=>/רכב|טסט/.test(x)&&!/מקומות/.test(x))) return 'bus-'+(trip.vehicleId||'none');
  if(list.some(x=>/מקומות/.test(x))) return 'seats-'+trip.routeCode;
  return 'trip-'+trip.id;
}
export function nextStop(trip:any) {
  const stops=trip.stops.map((s:any)=>({...s,kind:trip.direction==='morning'?'pickup':'dropoff'}));
  if (trip.direction==='morning') stops.push({id:'school',name:trip.school,time:null,planned:trip.boarded,kind:'dropoff'});
  return stops.find((s:any)=>!trip.departures.includes(s.id)) || null;
}
export function tripView(state:any, trip:any, clock = DEMO_CLOCK) {
  const issues=readiness(state,trip,trip.date);
  const blocking=issues.filter((i:string)=>!FILE_CHECKS.has(i)), checks=issues.filter((i:string)=>FILE_CHECKS.has(i));
  const reports=Object.values(trip.reports) as any[];
  // Blocked = cannot legally run (fleet) or a dispatcher change not yet published; workbook file checks never block.
  const blockedReason=blocking.find((i:string)=>FLEET_CAUSE.test(i)) ?? (!trip.published && !blocking.length ? 'לא פורסמה לנהג' : null);
  const live=liveFor(trip, clock, blockedReason);
  const mismatch=Object.values(live.stopCounts).some((c:any)=>c.expected!=null && c.count!==c.expected);
  return {...trip, issues, blockers:blocking, checks, points:pointsFor(trip), live, driverName:state.drivers[trip.driverId]?.name || 'לא משובץ',driverContact:state.drivers[trip.driverId]?.contact || null,vehicleName:state.vehicles[trip.vehicleId]?.label || 'לא משובץ',capacity:state.vehicles[trip.vehicleId]?.capacity || null,status:live.status, mismatch,nextStop:nextStop(trip), actual:live.boarded, reportSource:reports.length ? reports.some(r=>r.source==='driver')?'driver':'demo':null, canPublish:issues.length===0};
}
export function snapshot(state:any,date:string,viewer:string) {
  const actor=actorFor(state,viewer),day=dayFor(state,date);
  const trips=day.trips.filter((t:any)=>actor.role==='dispatcher'||(t.driverId===actor.id&&t.published&&!blockers(state,t,date).length));
  // Only today runs live; any other day is a plan, so nothing in it has left yet.
  const views=trips.map((t:any)=>tripView(state,t,date===DEMO_DATE?day.clock:'00:00'));
  const dispatcher=actor.role==='dispatcher';
  const drivers=dispatcher?Object.values(state.drivers):[state.drivers[actor.id]];
  const vehicles=dispatcher?Object.values(state.vehicles):[...new Set(trips.map((t:any)=>t.vehicleId))].map(id=>state.vehicles[id as string]);
  const template=dispatcher?Object.fromEntries([...new Set(schedule.trips.map((t:any)=>t.routeCode))].map((c:any)=>[c,crewOf(state,c)])):{};
  return {revision:state.revision,date,weekday:DAYS[weekday(date)],actor,clock:day.clock,template,inbox:dispatcher?(state.inbox??[]).filter((x:any)=>!x.done):[],cancelled:dispatcher?(day.cancelled??[]).map((t:any)=>({id:t.id,routeCode:t.routeCode,school:t.school,direction:t.direction,departure:t.departure,reason:t.cancelReason})):[],note:day.note||'',source:schedule.source,trips:views,drivers,vehicles,alerts:dispatcher?alertsFor(views,drivers,vehicles,date,day.clock,day.acks??{}):[],events:day.events.filter((e:any)=>dispatcher||trips.some((t:any)=>t.id===e.tripId)),identityMode:'demo',gps:{connected:false,source:'simulation',label:'מיקומי הרכבים בהדגמה הם סימולציה לפי שעון ההדגמה; אין חיבור GPS'},serverTime:new Date().toISOString()};
}
function event(state:any, day:any, trip:any,actor:any,kind:string,text:string,extra:any={}) {
  const e={id:'transport-event-'+day.nextId++,tripId:trip?.id||null,actor:actor.name,actorId:actor.id,kind,text,at:new Date().toISOString(),source:actor.role==='driver'?'driver':'dispatcher',...extra};
  day.events.push(e);if(trip)trip.events.push(e);return e;
}
function assertTripSchema(trip:any) {
  const properties={trip_id:trip.id,service_date:trip.date,route_code:trip.routeCode,school:trip.school,direction:trip.direction,phase:trip.phase,planned:trip.planned,source_locator:trip.source.sheet+'!'+trip.source.range};
  const problems=pageProblems(ontology,{ref:refFor('transport_trip',trip.id+':'+trip.date),type:'transport_trip',properties});
  if(problems.length)fail('נתוני הנסיעה אינם תקינים: '+problems.join('; '));
}
export function execute(state:any,viewer:string,command:any) {
  const actor=actorFor(state,viewer);
  if (!command || typeof command.id!=='string' || command.id.length>120) fail('חסר מזהה פעולה תקין.');
  const signature=JSON.stringify(command);
  const old=state.receipts[command.id];
  if(old) {if(old.actor!==actor.id||old.signature!==signature)fail('מזהה הפעולה כבר שימש לפעולה אחרת.',409);return {duplicate:true,revision:state.revision};}
  const date=command.date, day=dayFor(state,date);
  if(command.type==='reset') {
    if(actor.role!=='dispatcher')fail('איפוס זמין לסדרנים בלבד.',403);
    // A full demo reset: every day, and the fleet records edited during the run.
    const fresh=createTransportState();state.drivers=fresh.drivers;state.vehicles=fresh.vehicles;state.days={};state.inbox=[];state.template={};dayFor(state,date);state.revision++;return {revision:state.revision};
  }
  const trip=day.trips.find((t:any)=>t.id===command.tripId);
  const dispatcher=['assign','edit','publish','create','note','fleet','clock','ack','unack','plan','template','driver-save','vehicle-save','archive','split','merge','cancel','restore','shift'].includes(command.type);
  if(dispatcher&&actor.role!=='dispatcher')fail('הפעולה זמינה לסדרנים בלבד.',403);
  if(['inbox-done'].includes(command.type)&&actor.role!=='dispatcher')fail('הפעולה זמינה לסדרנים בלבד.',403);
  if(['confirm','concern','my-away'].includes(command.type)&&actor.role!=='driver')fail('הפעולה זמינה לנהגים בלבד.',403);
  if(!['fleet','clock','create','ack','unack','plan','template','driver-save','vehicle-save','archive','my-away','inbox-done','cancel','restore','shift'].includes(command.type)&&!trip)fail('הנסיעה אינה קיימת ביום שנבחר.',404);
  if(trip && actor.role==='driver' && (trip.driverId!==actor.id||!trip.published))fail('לנהג אין גישה לנסיעה הזו.',403);
  if(trip && command.version!==trip.version)fail('הנסיעה השתנתה. רעננו את הנתונים לפני ניסיון נוסף.',409);
  const data=command.data||{};
  if(command.type==='fleet') {
    const entity=data.kind==='driver'?state.drivers[data.entityId]:state.vehicles[data.entityId];
    if(!entity)fail('הרשומה לא נמצאה.');
    for(const key of data.kind==='driver'?['licenseUntil']:['testUntil','serviceDue'])if(data[key])weekday(data[key]);
    const allowed=data.kind==='driver'?['licenseUntil','available']:['testUntil','serviceDue','available'];
    for(const key of allowed)if(data[key]!==undefined)entity[key]=data[key];
    event(state,day,null,actor,'fleet','פרטי כשירות עודכנו');
  } else if(command.type==='driver-save'||command.type==='vehicle-save') {
    // Add or edit a driver or a bus. Everything that decides availability lives here: dates, the switch, absences.
    const isDriver=command.type==='driver-save';const store=isDriver?state.drivers:state.vehicles;
    const isDate=(v:any)=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&!Number.isNaN(Date.parse(v));
    const away=Array.isArray(data.away)?data.away.slice(0,30).map((x:any)=>({from:String(x.from||''),to:String(x.to||''),reason:String(x.reason||'').slice(0,80)})):undefined;
    if(away&&away.some((x:any)=>!isDate(x.from)||!isDate(x.to)||x.to<x.from))fail('יש להזין טווח תאריכים תקין להיעדרות.');
    let rec=data.id?store[data.id]:null;
    if(data.id&&!rec)fail('הרשומה לא נמצאה.',404);
    if(!rec){
      if(isDriver){if(!String(data.name||'').trim())fail('יש להזין שם נהג.');rec={id:'driver-'+Date.now().toString(36),routeCode:'',licenseType:'D',available:true,origin:'dispatcher'};}
      else{if(!String(data.label||'').trim())fail('יש להזין שם לרכב.');rec={id:'bus-'+Date.now().toString(36),available:true,capacitySource:'הוזן ידנית',origin:'dispatcher'};}
      store[rec.id]=rec;
    }
    const fields=isDriver?['name','contact','licenseType','licenseUntil','available']:['label','registration','capacity','testUntil','serviceDue','available'];
    for(const key of fields){if(data[key]===undefined)continue;
      if(/Until|Due/.test(key)&&!isDate(data[key]))fail('תאריך לא תקין.');
      if(key==='capacity'&&data[key]!==null&&!(Number.isInteger(data[key])&&data[key]>0&&data[key]<100))fail('מספר המקומות צריך להיות בין 1 ל־99.');
      rec[key]=typeof data[key]==='string'?data[key].trim().slice(0,80):data[key];}
    if(away)rec.away=away;
    if(isDriver&&(!rec.name||!isDate(rec.licenseUntil)))fail('לנהג נדרשים שם ותוקף רישיון.');
    if(!isDriver&&(!rec.label||!isDate(rec.testUntil)||!isDate(rec.serviceDue)))fail('לרכב נדרשים שם, תוקף טסט ומועד טיפול.');
    event(state,day,null,actor,'fleet',`${isDriver?rec.name:rec.label}: הפרטים עודכנו`,{entityId:rec.id});
    state.lastSaved=rec.id;
  } else if(command.type==='archive') {
    const rec=data.kind==='driver'?state.drivers[data.id]:state.vehicles[data.id];
    if(!rec||rec.id==='driver-spare'&&false)fail('הרשומה לא נמצאה.',404);
    rec.archived=data.restore!==true;rec.available=data.restore===true;
    event(state,day,null,actor,'fleet',`${rec.name??rec.label}: ${rec.archived?'הוסר מהצי':'הוחזר לצי'}`,{entityId:rec.id});
  } else if(command.type==='ack'||command.type==='unack') {
    const alertId=String(data.alertId||'');if(!alertId||alertId.length>200)fail('חסר מזהה התראה.');
    day.acks=day.acks||{};
    if(command.type==='ack'){const note=String(data.note||'').trim().slice(0,300);day.acks[alertId]={by:actor.name,at:new Date().toISOString(),note};event(state,day,null,actor,'ack',note?`סומן כטופל: ${note}`:'סומן כטופל',{alertId});}
    else{delete day.acks[alertId];event(state,day,null,actor,'unack','הוחזר לטיפול',{alertId});}
  } else if(command.type==='clock') {
    if(!validTime(data.time))fail('השעה אינה תקינה.');day.clock=data.time;
  } else if(command.type==='create') {
    if(!data.school||!validTime(data.departure)||!['morning','afternoon'].includes(data.direction))fail('יש למלא בית ספר, כיוון ושעת יציאה.');
    const id='custom-'+date+'-'+day.nextId++;
    const t={id,date,weekday:weekday(date),routeCode:String(data.routeCode||'חדש'),number:'חדש',school:String(data.school).slice(0,100),direction:data.direction,departure:data.departure,planned:0,stops:[],reviewReasons:[],source:{sheet:'תכנון סדרן',range:'טיוטה חדשה'},version:1,driverId:'',vehicleId:'',published:false,phase:'pending',reports:{},departures:[],onBoard:0,boarded:null,alighted:0,delayMinutes:0,notes:[],events:[],demoFocus:false};
    day.trips.push(t);event(state,day,t,actor,'create','נוצרה נסיעה חדשה בטיוטה');
  } else if(command.type==='template') {
    // The regular crew of a route, from the next day on: every future trip still on the old crew moves to the new one.
    const code=String(data.routeCode||'');if(!schedule.trips.some((t:any)=>t.routeCode===code))fail('הקו לא נמצא בסידור.',404);
    const prev=crewOf(state,code);const next={driverId:data.driverId??prev.driverId,vehicleId:data.vehicleId??prev.vehicleId};
    if(!state.drivers[next.driverId]||!state.vehicles[next.vehicleId])fail('יש לבחור נהג ורכב קיימים.');
    state.template=state.template||{};state.template[code]=next;
    let moved=0;
    for(const [d,dd] of Object.entries(state.days) as [string,any][]){
      if(d<=DEMO_DATE)continue;
      for(const t of dd.trips)if(t.routeCode===code&&t.phase==='pending'){let changed=false;
        if(t.driverId===prev.driverId&&next.driverId!==prev.driverId){t.driverId=next.driverId;changed=true;}
        if(t.vehicleId===prev.vehicleId&&next.vehicleId!==prev.vehicleId){t.vehicleId=next.vehicleId;changed=true;}
        if(changed){t.version++;moved++;}}
    }
    event(state,day,null,actor,'template',`הצוות הקבוע של קו ${code}: ${state.drivers[next.driverId].name}, ${state.vehicles[next.vehicleId].label}`,{routeCode:code,moved});
  } else if(command.type==='plan') {
    // One approval for several trips: the assistant's proposal, or a bulk swap. Every trip is checked before any is changed.
    const items=Array.isArray(data.assignments)?data.assignments:[];
    if(!items.length||items.length>60)fail('אין שינויים להחלה.');
    const targets=items.map((a:any)=>{const t=day.trips.find((x:any)=>x.id===a?.tripId);if(!t)fail('אחת הנסיעות לא נמצאה ביום שנבחר.',404);if(t.phase!=='pending')fail(`נסיעה ${t.number} כבר יצאה ואי אפשר לשנות אותה.`);
      const driverId=a.driverId??t.driverId,vehicleId=a.vehicleId??t.vehicleId;if(!state.drivers[driverId]||!state.vehicles[vehicleId])fail('יש לבחור נהג ורכב קיימים.');return {t,driverId,vehicleId,changed:driverId!==t.driverId||vehicleId!==t.vehicleId};});
    const reason=String(data.reason||'שיבוץ עודכן').slice(0,200);
    for(const {t,driverId,vehicleId,changed} of targets){
      t.driverId=driverId;t.vehicleId=vehicleId;
      if(data.publish===true&&!blockers(state,t,date).length)t.published=true;else if(changed)t.published=false;
      if(changed)delete t.confirmed;
      t.version++;event(state,day,t,actor,changed?'assign':'publish',t.published?`${reason}. פורסם לנהג`:reason);
    }
  } else if(command.type==='cancel') {
    // No school, a school trip, a strike: rides come off the day and can be put back.
    const pick=(t:any)=>t.phase==='pending'&&(data.all===true||(Array.isArray(data.tripIds)&&data.tripIds.includes(t.id))||(data.school&&t.school===data.school&&(!data.direction||t.direction===data.direction)));
    const out=day.trips.filter(pick);if(!out.length)fail('אין נסיעות לביטול ביום הזה.');
    const reason=String(data.reason||'').slice(0,80);
    day.cancelled=[...(day.cancelled??[]),...out.map((t:any)=>({...t,cancelReason:reason}))];
    day.trips=day.trips.filter((t:any)=>!pick(t));
    if(!day.trips.length)day.note=reason;
    event(state,day,null,actor,'cancel',`בוטלו ${out.length} נסיעות${data.school?` של ${data.school}`:''}${reason?`: ${reason}`:''}`,{tripIds:out.map((t:any)=>t.id)});
  } else if(command.type==='restore') {
    const back=(day.cancelled??[]).filter((t:any)=>data.all===true||(Array.isArray(data.tripIds)&&data.tripIds.includes(t.id)));
    if(!back.length)fail('אין נסיעות להחזרה.');
    day.cancelled=(day.cancelled??[]).filter((t:any)=>!back.includes(t));
    day.trips=[...day.trips,...back.map(({cancelReason,...t}:any)=>({...t,version:t.version+1}))].sort((a:any,b:any)=>a.departure.localeCompare(b.departure));
    if(day.trips.length)day.note='';
    event(state,day,null,actor,'restore',`הוחזרו ${back.length} נסיעות`,{tripIds:back.map((t:any)=>t.id)});
  } else if(command.type==='shift') {
    // A short day or a late start: move rides earlier or later, stops and all.
    const m=Number(data.minutes);if(!Number.isInteger(m)||!m||Math.abs(m)>240)fail('בחרו בכמה דקות להזיז.');
    const list=day.trips.filter((t:any)=>Array.isArray(data.tripIds)&&data.tripIds.includes(t.id));
    if(!list.length)fail('אין נסיעות להזזה.');
    if(list.some((t:any)=>t.phase!=='pending'))fail('אי אפשר להזיז נסיעה שכבר יצאה.');
    const at=(hm:string)=>{const v=minutes(hm)+m;if(v<0||v>=24*60)fail('השעה החדשה יוצאת מהיום.');return `${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`;};
    for(const t of list){t.departure=at(t.departure);t.stops=t.stops.map((x:any)=>validTime(x.time)?{...x,time:at(x.time)}:x);t.version++;if(t.published)event(state,day,t,actor,'shift',`השעה זזה ב־${Math.abs(m)} דקות ${m<0?'מוקדם':'מאוחר'} יותר. פורסם לנהג`);}
    day.trips.sort((a:any,b:any)=>a.departure.localeCompare(b.departure));
  } else if(command.type==='confirm') {
    // The driver saw a new or changed ride and confirms it.
    trip.confirmed={at:new Date().toISOString()};
    state.inbox=(state.inbox??[]).map((x:any)=>x.tripId===trip.id&&x.kind==='new'?{...x,done:true}:x);
    event(state,day,trip,actor,'confirm','הנהג אישר את הנסיעה');
  } else if(command.type==='concern') {
    // A problem with an upcoming ride: a short note, or just "call me".
    const text=String(data.text||'').trim().slice(0,300);const reason=String(data.reason||'').slice(0,60);
    const me=state.drivers[actor.id];
    state.inbox=state.inbox??[];
    state.inbox.push({id:'inbox-'+day.nextId++,kind:'concern',date,tripId:trip.id,routeCode:trip.routeCode,departure:trip.departure,driverId:actor.id,driverName:me.name,phone:me.contact,reason,text,call:data.call===true,at:new Date().toISOString(),done:false});
    event(state,day,trip,actor,'concern',[reason,text].filter(Boolean).join(': ')||'הנהג ביקש שיתקשרו אליו');
  } else if(command.type==='my-away') {
    // A driver updates their own availability for a day; the dispatcher sees it at once.
    weekday(String(data.date||''));const d=String(data.date);const me=state.drivers[actor.id];
    me.away=(me.away??[]).flatMap((a:any)=>{if(!(a.from<=d&&d<=a.to))return [a];const out=[];if(a.from<d)out.push({...a,to:plusDays(d,-1)});if(d<a.to)out.push({...a,from:plusDays(d,1)});return out;});
    const reason=String(data.reason||'').slice(0,60);
    if(data.away===true)me.away.push({from:d,to:d,reason,by:'driver'});
    state.inbox=state.inbox??[];
    // Changed their mind before the dispatcher handled it: the two messages cancel out.
    const open=state.inbox.find((x:any)=>!x.done&&x.driverId===actor.id&&x.date===d&&x.kind===(data.away===true?'back':'away'));
    if(open){open.done=true;open.by=actor.name;}
    else state.inbox.push({id:'inbox-'+day.nextId++,kind:data.away===true?'away':'back',date:d,driverId:actor.id,driverName:me.name,phone:me.contact,reason,text:'',call:false,at:new Date().toISOString(),done:false});
  } else if(command.type==='inbox-done') {
    const item=(state.inbox??[]).find((x:any)=>x.id===data.id);if(!item)fail('ההודעה לא נמצאה.',404);
    item.done=data.undo!==true;item.by=actor.name;
  } else if(command.type==='split') {
    // Too many students for one bus: some stops move to a second bus with its own driver.
    if(trip.phase!=='pending')fail('אי אפשר לפצל נסיעה שכבר יצאה.');
    if(!state.drivers[data.driverId]||!state.vehicles[data.vehicleId])fail('יש לבחור נהג ורכב קיימים.');
    let moving:any[];let n:number;
    if(data.partial){
      // One busy stop: part of its students board the second bus there.
      const st=trip.stops.find((x:any)=>x.id===data.partial.stopId);const c=Number(data.partial.count);
      if(!st||!Number.isInteger(c)||c<=0||c>=st.planned)fail('מספר התלמידים שעוברים לא תקין.');
      moving=[{...st,planned:c}];n=c;
    } else {
      const ids=Array.isArray(data.stopIds)?data.stopIds.map(String):[];
      moving=trip.stops.filter((x:any)=>ids.includes(x.id));
      if(!moving.length||moving.length===trip.stops.length)fail('בחרו אילו תחנות עוברות לרכב השני.');
      n=moving.reduce((a:number,x:any)=>a+(x.planned||0),0);
    }
    const twin={...structuredClone(trip),id:trip.id+'-b'+day.nextId++,number:trip.number+' ב',stops:moving,planned:n,driverId:data.driverId,vehicleId:data.vehicleId,version:1,events:[],notes:[],reports:{},departures:[],splitFrom:trip.id,published:false};
    if(data.partial)trip.stops=trip.stops.map((x:any)=>x.id===data.partial.stopId?{...x,planned:x.planned-n}:x);
    else trip.stops=trip.stops.filter((x:any)=>!moving.some((m:any)=>m.id===x.id));
    trip.planned-=n;trip.version++;
    day.trips.push(twin);
    if(!blockers(state,twin,date).length)twin.published=true;
    if(!blockers(state,trip,date).length)trip.published=true;
    event(state,day,trip,actor,'split',`פוצלה לשני רכבים: ${moving.map((x:any)=>x.name).join(', ')} עברו ל${state.vehicles[data.vehicleId].label}`);
    event(state,day,twin,actor,'assign',`נסיעה נוספת אחרי פיצול קו ${trip.routeCode}. פורסם לנהג`);
  } else if(command.type==='merge') {
    const twin=day.trips.find((t:any)=>t.id===data.fromId&&t.splitFrom===trip.id);
    if(!twin)fail('הנסיעה הנוספת לא נמצאה.',404);
    if(trip.phase!=='pending'||twin.phase!=='pending')fail('אי אפשר לאחד נסיעות שכבר יצאו.');
    const merged=trip.stops.map((x:any)=>{const same=twin.stops.find((y:any)=>y.id===x.id);return same?{...x,planned:x.planned+same.planned}:x;});
    trip.stops=[...merged,...twin.stops.filter((y:any)=>!trip.stops.some((x:any)=>x.id===y.id))].sort((a:any,b:any)=>minutes(a.time)-minutes(b.time));trip.planned+=twin.planned;trip.version++;
    day.trips=day.trips.filter((t:any)=>t!==twin);
    event(state,day,trip,actor,'merge','הפיצול בוטל, כל התחנות חזרו לרכב אחד');
  } else if(command.type==='assign') {
    if(trip.phase!=='pending')fail('אין לשנות שיבוץ בנסיעה שהחלה.');
    if(!state.drivers[data.driverId]||!state.vehicles[data.vehicleId])fail('יש לבחור נהג ורכב קיימים.');
    const clash=day.trips.some((t:any)=>t.id!==trip.id&&t.published&&t.departure===trip.departure&&(t.driverId===data.driverId||t.vehicleId===data.vehicleId));
    if(clash)fail('הנהג או הרכב משובצים לנסיעה נוספת באותה שעת יציאה.');
    trip.driverId=data.driverId;trip.vehicleId=data.vehicleId;trip.published=false;
    event(state,day,trip,actor,'assign','שיבוץ עודכן; נדרש פרסום מחדש');
  } else if(command.type==='edit') {
    if(trip.phase!=='pending')fail('אין לערוך מסלול שהחל.');
    if(!validTime(data.departure)||!Array.isArray(data.stops)||!data.stops.length||data.stops.length>10)fail('יש להגדיר שעת יציאה ו־1 עד 10 תחנות.');
    if(data.stops.some((s:any)=>!String(s.name||'').trim()||!numericCount(s.planned)||!validTime(s.time)))fail('לכל תחנה נדרשים שם, שעה וכמות שלמה שאינה שלילית.');
    if(data.stops.some((s:any,i:number)=>minutes(s.time)<minutes(i?data.stops[i-1].time:data.departure)))fail('שעות התחנות חייבות להיות בסדר נסיעה עולה.');
    trip.departure=data.departure;trip.stops=data.stops.map((s:any,i:number)=>({id:'stop-'+(i+1),name:String(s.name).slice(0,100),time:s.time,planned:s.planned}));trip.planned=trip.stops.reduce((s:number,t:any)=>s+t.planned,0);trip.reviewReasons=[];trip.published=false;
    event(state,day,trip,actor,'edit','עודכן תכנון התחנות; המקור המקורי נשמר בנפרד');
  } else if(command.type==='publish') {
    const issues=blockers(state,trip,date);if(issues.length)fail(issues.join(' · '));
    const clash=day.trips.some((t:any)=>t.id!==trip.id&&t.published&&t.departure===trip.departure&&(t.driverId===trip.driverId||t.vehicleId===trip.vehicleId));
    if(clash)fail('יש חפיפת שיבוץ באותה שעת יציאה.');
    trip.published=true;event(state,day,trip,actor,'publish','הסידור פורסם לנהג');
  } else if(command.type==='note') {
    const text=String(data.text||'').trim();if(!text||text.length>1000)fail('יש לכתוב הערה באורך עד 1,000 תווים.');
    trip.notes.push(event(state,day,trip,actor,'note',text));
  } else if(['start','report','depart','delay'].includes(command.type)) {
    if(actor.role!=='driver')fail('דיווח ביצוע מתקבל מהנהג המשויך בלבד.',403);
    if(data.stationary!==true)fail('יש לאשר שהרכב בעצירה בטוחה לפני דיווח.');
    const issues=blockers(state,trip,date);if(issues.length)fail(issues.join(' · '));
    if(trip.phase==='completed')fail('הנסיעה כבר הושלמה.');
    if(command.type==='start') {
      if(trip.phase!=='pending')fail('הנסיעה כבר החלה.');
      if(trip.direction==='afternoon'&&(!numericCount(data.count)||(state.vehicles[trip.vehicleId].capacity!=null&&data.count>state.vehicles[trip.vehicleId].capacity)))fail('יש לדווח כמות עלייה תקינה בבית הספר.');
      trip.phase='active';if(trip.direction==='afternoon'){trip.boarded=data.count;trip.onBoard=data.count;}
      event(state,day,trip,actor,'start','הנהג דיווח על תחילת נסיעה');
    } else if(command.type==='delay') {
      if(!Number.isInteger(data.minutes)||data.minutes<1||data.minutes>180)fail('יש לציין איחור של 1 עד 180 דקות.');
      trip.delayMinutes=data.minutes;event(state,day,trip,actor,'delay',`דווח איחור של ${data.minutes} דקות`);
    } else {
      if(trip.phase!=='active')fail('יש להתחיל את הנסיעה לפני דיווח תחנה.');
      const stop=nextStop(trip);if(!stop||stop.id!==data.stopId)fail('אפשר לדווח רק על התחנה הבאה בסדר המסלול.');
      if(command.type==='report') {
        const previous=trip.reports[stop.id];
        if(previous){if(previous.kind==='pickup'){trip.boarded-=previous.count;trip.onBoard-=previous.count;}else{trip.alighted-=previous.count;trip.onBoard+=previous.count;}delete trip.reports[stop.id];}
        if(!numericCount(data.count))fail('יש להזין מספר שלם שאינו שלילי.');
        if(stop.kind==='pickup'&&state.vehicles[trip.vehicleId].capacity!=null&&trip.onBoard+data.count>state.vehicles[trip.vehicleId].capacity)fail('הדיווח יחרוג מקיבולת הרכב.');
        if(stop.kind==='dropoff'&&data.count>trip.onBoard)fail('מספר היורדים גבוה ממספר הנוסעים ברכב.');
        const r={count:data.count,expected:stop.planned,kind:stop.kind,source:'driver',actor:actor.id,at:new Date().toISOString()};
        trip.reports[stop.id]=r;
        if(stop.kind==='pickup'){trip.boarded=(trip.boarded||0)+data.count;trip.onBoard+=data.count;}else{trip.alighted+=data.count;trip.onBoard-=data.count;}
        event(state,day,trip,actor,'report',`${stop.kind==='pickup'?'עלייה':'ירידה'} ב${stop.name}: ${data.count}`,{stopId:stop.id,count:data.count,expected:stop.planned});
      } else {
        if(!trip.reports[stop.id])fail('יש לדווח כמות לפני אישור יציאה.');
        const remaining=trip.stops.filter((s:any)=>!trip.departures.includes(s.id)&&s.id!==stop.id).length;
        const last=trip.direction==='morning'?stop.id==='school':remaining===0;
        trip.departures.push(stop.id);
        if(last){if(trip.onBoard>0){trip.unaccounted=trip.onBoard;trip.onBoard=0;event(state,day,trip,actor,'unaccounted',`${trip.unaccounted} תלמידים לא דווחו כיורדים`);}trip.phase='completed';trip.delayMinutes=0;}
        event(state,day,trip,actor,last?'complete':'depart',last?'הנהג השלים את הנסיעה':'הנהג אישר יציאה מהתחנה',{stopId:stop.id});
      }
    }
  } else fail('פעולה לא מוכרת.');
  if(trip){trip.version++;assertTripSchema(trip);}
  state.revision++;state.receipts[command.id]={actor:actor.id,signature};
  return {revision:state.revision};
}
/** Each school day of a month: how many rides, how many still need a crew, how many changes are unpublished. */
export function monthSummary(state:any, anyDate:string) {
  const [y,m]=anyDate.split('-').map(Number);
  const out:any[]=[];
  for(let d=1;d<=31;d++){
    const date=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if(new Date(date+'T00:00:00Z').getUTCMonth()+1!==m)break;
    const wd=weekday(date);if(wd===6)continue;
    const rides=schedule.trips.filter((t:any)=>t.weekday===wd).length;if(!rides)continue;
    const day=dayFor(state,date);
    const open=day.trips.filter((t:any)=>t.phase==='pending');
    const keys=open.map((t:any)=>issueKeyFor(t,blockers(state,t,date))).filter(Boolean);
    out.push({date,weekday:DAYS[wd],rides:day.trips.length,issues:new Set(keys).size,toFix:keys.length,cancelled:(day.cancelled??[]).length,noSchool:!day.trips.length&&(day.cancelled??[]).length>0,note:day.note||'',drafts:open.filter((t:any)=>!t.published).length,past:date<DEMO_DATE,today:date===DEMO_DATE});
  }
  return out;
}
export const sourceData = schedule;
