import schedule from './schedule.json' with { type: 'json' };
import { composeBaseline, loadPacks, pageProblems } from '../ontology/compose.ts';
import { refFor } from '../graph/graph.ts';
import { liveFor, pointsFor, alertsFor } from './simulate.ts';
export const DEMO_DATE = '2026-11-08';
export const DEMO_CLOCK = '07:05';
const DEMO_NAMES = ['דוד מזרחי','יעקב אוחיון','סאמר חלבי','אבי ברק','מוחמד ספדי','משה דהן','אלון שגיא','ראובן לוי','ניר עמר','אדהם אבו סאלח','שלמה פרץ','יוסי חזן','רמי נחום','אייל גבאי','ואיל מסעדה','עמית כרמי','חיים אזולאי','טל רוזן','ג׳מאל אבו זייד','אורי שלום','בני אדרי','גיל נאור','סלים חוסיין','אליהו ביטון','עופר זיו','נתן פרידמן','מאיר כהן','יגאל טל','שמעון דוד','איתי בר','רפאל אסולין'];
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
  return {schema:1, revision:1, drivers, vehicles, days:{}, receipts:{}, createdAt:new Date().toISOString()};
}
export function actorFor(state: any, id: string) {
  if (id==='shuki' || id==='inbal') return {id, name:id==='shuki'?'שוקי':'ענבל', role:'dispatcher'};
  if (state.drivers[id]) return {id, name:state.drivers[id].name, role:'driver'};
  return fail('זהות הדגמה לא מוכרת.',403);
}
export function dayFor(state: any, date: string) {
  const day = weekday(date);
  if (!state.days[date]) {
    const trips = schedule.trips.filter(t => t.weekday===day).map(t => ({...clone(t), date, version:1, driverId:'driver-'+t.routeCode, vehicleId:'bus-'+t.routeCode, published:!t.reviewReasons.length, phase:'pending', reports:{}, departures:[], onBoard:0, boarded:null, alighted:0, delayMinutes:0, notes:[], events:[], demoFocus:['10-1','11-1','12-1'].includes(t.number)}));
    // The day starts just before the presenter's trip; other buses move by the demo clock (simulate.ts).
    state.days[date] = {date, trips, events:[], clock:DEMO_CLOCK, nextId:1};
  }
  return state.days[date];
}
export function readiness(state: any, trip: any, date: string): string[] {
  const issues = [...trip.reviewReasons];
  const driver=state.drivers[trip.driverId], bus=state.vehicles[trip.vehicleId];
  if (!driver) issues.push('חסר שיבוץ נהג');
  else {
    if (!driver.available) issues.push('הנהג אינו זמין');
    if (!driver.licenseUntil || driver.licenseUntil<date) issues.push('תוקף רישיון הנהג דורש טיפול');
  }
  if (!bus) issues.push('חסר שיבוץ רכב');
  else {
    if (!bus.available) issues.push('הרכב אינו זמין');
    if (!bus.testUntil || bus.testUntil<date) issues.push('תוקף רישוי הרכב דורש טיפול');
    if (!bus.serviceDue || bus.serviceDue<date) issues.push('מועד טיפול הרכב חלף');
    if (numericCount(trip.planned) && bus.capacity!=null && trip.planned>bus.capacity) issues.push(`מתוכננים ${trip.planned} תלמידים לרכב עם ${bus.capacity} מקומות`);
  }
  if (!validTime(trip.departure)) issues.push('חסרה שעת יציאה תקינה');
  if (!trip.stops.length || trip.stops.some((s:any)=>!numericCount(s.planned))) issues.push('יש להשלים את כמויות התחנות');
  return [...new Set(issues)];
}
export function nextStop(trip:any) {
  const stops=trip.stops.map((s:any)=>({...s,kind:trip.direction==='morning'?'pickup':'dropoff'}));
  if (trip.direction==='morning') stops.push({id:'school',name:trip.school,time:null,planned:trip.boarded,kind:'dropoff'});
  return stops.find((s:any)=>!trip.departures.includes(s.id)) || null;
}
export function tripView(state:any, trip:any, clock = DEMO_CLOCK) {
  const issues=readiness(state,trip,trip.date);
  const reports=Object.values(trip.reports) as any[];
  const live=liveFor(trip, clock);
  const mismatch=Object.values(live.stopCounts).some((c:any)=>c.expected!=null && c.count!==c.expected);
  return {...trip, issues, points:pointsFor(trip), live, driverName:state.drivers[trip.driverId]?.name || 'לא משובץ',driverContact:state.drivers[trip.driverId]?.contact || null,vehicleName:state.vehicles[trip.vehicleId]?.label || 'לא משובץ',capacity:state.vehicles[trip.vehicleId]?.capacity || null,status:live.status, mismatch,nextStop:nextStop(trip), actual:live.boarded, reportSource:reports.length ? reports.some(r=>r.source==='driver')?'driver':'demo':null, canPublish:issues.length===0};
}
export function snapshot(state:any,date:string,viewer:string) {
  const actor=actorFor(state,viewer),day=dayFor(state,date);
  const trips=day.trips.filter((t:any)=>actor.role==='dispatcher'||(t.driverId===actor.id&&t.published&&!readiness(state,t,date).length));
  const views=trips.map((t:any)=>tripView(state,t,day.clock));
  const dispatcher=actor.role==='dispatcher';
  const drivers=dispatcher?Object.values(state.drivers):[state.drivers[actor.id]];
  const vehicles=dispatcher?Object.values(state.vehicles):[...new Set(trips.map((t:any)=>t.vehicleId))].map(id=>state.vehicles[id as string]);
  return {revision:state.revision,date,weekday:DAYS[weekday(date)],actor,clock:day.clock,source:schedule.source,trips:views,drivers,vehicles,alerts:dispatcher?alertsFor(views,drivers,vehicles,date,day.clock):[],events:day.events.filter((e:any)=>dispatcher||trips.some((t:any)=>t.id===e.tripId)),identityMode:'demo',gps:{connected:false,source:'simulation',label:'מיקומי הרכבים בהדגמה הם סימולציה לפי שעון ההדגמה; אין חיבור GPS'},serverTime:new Date().toISOString()};
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
    delete state.days[date];dayFor(state,date);state.revision++;return {revision:state.revision};
  }
  const trip=day.trips.find((t:any)=>t.id===command.tripId);
  const dispatcher=['assign','edit','publish','create','note','fleet','clock'].includes(command.type);
  if(dispatcher&&actor.role!=='dispatcher')fail('הפעולה זמינה לסדרנים בלבד.',403);
  if(!['fleet','clock','create'].includes(command.type)&&!trip)fail('הנסיעה אינה קיימת ביום שנבחר.',404);
  if(trip && actor.role==='driver' && (trip.driverId!==actor.id||!trip.published))fail('לנהג אין גישה לנסיעה הזו.',403);
  if(trip && command.version!==trip.version)fail('הנסיעה השתנתה. רעננו את הנתונים לפני ניסיון נוסף.',409);
  const data=command.data||{};
  if(command.type==='fleet') {
    const entity=data.kind==='driver'?state.drivers[data.entityId]:state.vehicles[data.entityId];
    if(!entity)fail('הרשומה לא נמצאה.');
    for(const key of data.kind==='driver'?['licenseUntil']:['testUntil','serviceDue'])if(data[key])weekday(data[key]);
    const allowed=data.kind==='driver'?['licenseUntil','available']:['testUntil','serviceDue','available'];
    for(const key of allowed)if(data[key]!==undefined)entity[key]=data[key];
    event(state,day,null,actor,'fleet','פרטי כשירות עודכנו בהדגמה');
  } else if(command.type==='clock') {
    if(!validTime(data.time))fail('שעת ההדגמה אינה תקינה.');day.clock=data.time;
  } else if(command.type==='create') {
    if(!data.school||!validTime(data.departure)||!['morning','afternoon'].includes(data.direction))fail('יש למלא בית ספר, כיוון ושעת יציאה.');
    const id='custom-'+date+'-'+day.nextId++;
    const t={id,date,weekday:weekday(date),routeCode:String(data.routeCode||'חדש'),number:'חדש',school:String(data.school).slice(0,100),direction:data.direction,departure:data.departure,planned:0,stops:[],reviewReasons:[],source:{sheet:'תכנון סדרן',range:'טיוטה חדשה'},version:1,driverId:'',vehicleId:'',published:false,phase:'pending',reports:{},departures:[],onBoard:0,boarded:null,alighted:0,delayMinutes:0,notes:[],events:[],demoFocus:false};
    day.trips.push(t);event(state,day,t,actor,'create','נוצרה נסיעה חדשה בטיוטה');
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
    const issues=readiness(state,trip,date);if(issues.length)fail(issues.join(' · '));
    const clash=day.trips.some((t:any)=>t.id!==trip.id&&t.published&&t.departure===trip.departure&&(t.driverId===trip.driverId||t.vehicleId===trip.vehicleId));
    if(clash)fail('יש חפיפת שיבוץ באותה שעת יציאה.');
    trip.published=true;event(state,day,trip,actor,'publish','הסידור פורסם לנהג');
  } else if(command.type==='note') {
    const text=String(data.text||'').trim();if(!text||text.length>1000)fail('יש לכתוב הערה באורך עד 1,000 תווים.');
    trip.notes.push(event(state,day,trip,actor,'note',text));
  } else if(['start','report','depart','delay'].includes(command.type)) {
    if(actor.role!=='driver')fail('דיווח ביצוע מתקבל מהנהג המשויך בלבד.',403);
    if(data.stationary!==true)fail('יש לאשר שהרכב בעצירה בטוחה לפני דיווח.');
    const issues=readiness(state,trip,date);if(issues.length)fail(issues.join(' · '));
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
export const sourceData = schedule;
