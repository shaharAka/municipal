// Synthetic sanitation fixture and pure selectors for the UI skeleton.
// IDs are shared across work, map, requests, memory and workflow views.
// Production adapters will map these records through the existing ontology engine.
export const SNAPSHOT = '2026-10-24';
export const PERIOD = 'ספטמבר 2026';
export const DEPOT = { lat: 33.113, lng: 35.567, title: 'נקודת יציאה לדוגמה' };
export const CAPACITY_TONNES = 10;
export const ROLES = {
  manager: { name: 'מוטי', title: 'מנהל אגף התברואה', finance: true, resolve: true, dispatch: true },
  finance: { name: 'צוות הכספים', title: 'בדיקת התחשבנות', finance: true, resolve: false, dispatch: false },
  dispatcher: { name: 'רכז הפינוי', title: 'תכנון וטיפול בפניות', finance: false, resolve: false, dispatch: true },
};

export const SOURCES = [
  { id: 'erp', title: 'ERP המועצה', purpose: 'לקוחות, חיובים ותעריפים', status: 'ממשק לתיאום', example: 'ייצוא חיובים לדוגמה', maps: ['לקוח ← יישוב / עסק', 'שורת חיוב ← חיוב', 'כרטיס ספק ← ספק פינוי'] },
  { id: 'crm', title: 'CRM ש. בינה', purpose: 'פניות תושבים וסטטוס טיפול', status: 'ממשק לתיאום', example: 'פניות לדוגמה', maps: ['פניית שירות ← פנייה', 'כתובת ← נקודת פינוי', 'מטפל ← עובד / תפקיד'] },
  { id: 'excel', title: 'קובצי ההתחשבנות', purpose: 'כמויות, התאמות ולוגיקת החישוב', status: 'דוגמאות נדרשות', example: 'התחשבנות_09_2026.xlsx', maps: ['שורת כמות ← שקילה / פינוי', 'נוסחה ← כלל מוצע', 'גיליון סיכום ← תצוגת התחשבנות'] },
];

const specs = [
  ['s1', 'כפר בלום', 'יישוב', 33.17, 35.609, 'mixed', 18.4, 18.4, null, 1.8, 'ריכוז מכולות מערבי'],
  ['s2', 'הגושרים', 'יישוב', 33.218, 35.622, 'mixed', 14.2, 12.2, 'quantity', 1.3, 'רחבת המיחזור'],
  ['s3', 'מרכז מסחרי צפוני', 'עסק', 33.198, 35.575, 'mixed', null, 8.6, 'missing', 0.9, 'מתחם העסקים'],
  ['s4', 'שדה נחמיה', 'יישוב', 33.187, 35.624, 'green', 9.8, 9.8, null, 1.1, 'נקודת הגזם'],
  ['s5', 'עמיר', 'יישוב', 33.178, 35.62, 'mixed', 22.6, 22.6, 'tariff', 2.1, 'מרכז היישוב'],
  ['s6', 'נאות מרדכי', 'יישוב', 33.16, 35.597, 'cardboard', 6.4, 6.4, null, 0.7, 'מרכז איסוף קרטון'],
  ['s7', 'כפר סאלד', 'יישוב', 33.194, 35.656, 'mixed', 11.8, 11.8, null, 1.5, 'רחבת פינוי דרומית'],
  ['s8', 'להבות הבשן', 'יישוב', 33.142, 35.647, 'green', 15.6, 15.6, null, 1.4, 'מתחם הגזם'],
];
export const WASTE = { mixed: 'פסולת מעורבת', green: 'גזם', cardboard: 'קרטון' };
export const RATES = { mixed: 450, green: 320, cardboard: 220 };

export function createWorkspace() {
  const entities = {};
  for (const [id, title, category, lat, lng, waste, measured, billed, issue, load, pointName] of specs) {
    entities[id] = { id, type: 'site', title, category, pointId: `point-${id}`, chargeId: `charge-${id}`, requestIds: [], sources: ['erp', 'excel'] };
    entities[`point-${id}`] = { id: `point-${id}`, type: 'collection_point', title: pointName, siteId: id, lat, lng, waste, load, bins: id === 's5' ? 4 : 2, frequency: 'שלוש פעמים בשבוע', lastVisit: id === 's2' ? '2026-10-21' : '2026-10-23', sources: ['excel'] };
    entities[`charge-${id}`] = { id: `charge-${id}`, type: 'charge', title: `חיוב ${title}`, siteId: id, quantity: measured, billedQuantity: billed, rate: issue === 'tariff' ? 470 : RATES[waste], waste, issue, resolved: !issue, ruleId: 'rule-tariff', evidence: { workbook: 'התחשבנות_09_2026.xlsx', sheet: 'פינויים', row: specs.findIndex(s => s[0] === id) + 2, weightRef: measured === null ? null : `WEIGHT-09-${id.slice(1).padStart(3, '0')}`, erpRef: `ERP-0926-${id.slice(1).padStart(3, '0')}` }, sources: ['erp', 'excel'] };
  }
  const requests = [
    { id: 'request-1042', type: 'request', title: 'המכולה מלאה לאחר מועד הפינוי', siteId: 's2', pointId: 'point-s2', state: 'open', owner: 'רכז הפינוי', opened: '2026-10-24', evidence: 'תושב דיווח על מכולה מלאה. לא נמצא אישור פינוי לאחר 21.10.', sources: ['crm'] },
    { id: 'request-1038', type: 'request', title: 'בקשה להסבר על חיוב הפינוי', siteId: 's5', pointId: 'point-s5', state: 'investigating', owner: 'מוטי', opened: '2026-10-23', evidence: 'פניית היישוב מציינת תעריף שונה מהתעריף המאושר.', sources: ['crm', 'erp'] },
    { id: 'request-1029', type: 'request', title: 'איסוף גזם נוסף', siteId: 's4', pointId: 'point-s4', state: 'closed', owner: 'רכז הפינוי', opened: '2026-10-22', evidence: 'אישור פינוי לדוגמה מ־23.10 מצורף לרשומה.', sources: ['crm', 'excel'] },
  ];
  for (const r of requests) { entities[r.id] = r; entities[r.siteId].requestIds.push(r.id); }
  const memories = [
    { id: 'rule-tariff', type: 'rule', title: 'תעריפי פינוי לפי סוג פסולת', category: 'כלל חישוב', owner: 'מוטי', status: 'approved', summary: 'כמות בטונות כפול התעריף המאושר לסוג הפסולת. ההתחשבנות מוצגת לפני מע״מ.', body: 'כלל לדוגמה: פסולת מעורבת 450 ₪ לטונה, גזם 320 ₪, קרטון 220 ₪. מקור ההגדרה הוא הסכם ספק לדוגמה וגיליון התעריפים. שינוי מחייב אישור בעל הכלל.', related: ['s2', 's5'], source: 'הסכם פינוי לדוגמה · נספח תעריפים, סעיף 3', sources: ['excel', 'erp'], version: 2 },
    { id: 'rule-proof', type: 'rule', title: 'אישור שקילה לפני חיוב', category: 'כלל בקרה', owner: 'מוטי', status: 'approved', summary: 'חיוב שאין לו אסמכתת שקילה נשאר לבדיקה ולא נכלל בקובץ מאושר.', body: 'דיווח כמות ללא אסמכתה אינו מספיק לאישור חיוב. בעל התהליך מאמת את הכמות ואת האסמכתה לפני הפקת קבצים לכספים.', related: ['s3'], source: 'נוהל התחשבנות לדוגמה · סעיף 4', sources: ['excel'], version: 1 },
    { id: 'memory-handover', type: 'memory', title: 'איך נסגרת ההתחשבנות החודשית', category: 'נוהל עבודה', owner: 'מוטי', status: 'approved', summary: 'איסוף כמויות, התאמה לחיובים, בדיקת חריגים והכנת קבצים לכספים.', body: 'רכז הפינוי מרכז את נתוני הביצוע. מוטי בודק כמויות ותעריפים. צוות הכספים מקבל סיכום לפי לקוח, פירוט חיובים ויומן התאמות. לכל תיקון נשמרים הסיבה, האסמכתה והמאשר.', related: ['workflow-monthly'], source: 'תיאור תהליך לדוגמה · שיחת העברת תפקיד', sources: ['excel'], version: 1 },
    { id: 'memory-gps', type: 'memory', title: 'מיקום משאית אינו אישור פינוי', category: 'ידע תפעולי', owner: 'רכז הפינוי', status: 'approved', summary: 'כאשר יש תלונה, יש לבדוק גם אירוע פינוי או אסמכתה ולא רק מיקום.', body: 'מעבר ליד נקודה הוא ראיה תומכת בלבד. עד לחיבור מערכת איתור ונתוני ביצוע, אין במפה מידע חי על מיקום משאית או הוכחת פינוי.', related: ['s2', 'request-1042'], source: 'עיקרון בדיקה לדוגמה · לא מידע שנלמד מהלקוח', sources: ['crm'], version: 1 },
    { id: 'candidate-tariff', type: 'rule', title: 'תעריף 470 ₪ מופיע בחיוב של עמיר', category: 'פער לאישור', owner: 'מוטי', status: 'candidate', summary: 'נמצא תעריף שונה מהכלל המאושר. נדרש לברר את המקור לפני שינוי הכלל.', body: 'זוהי מועמדות לדוגמה, לא הסכם חדש. אפשר להתאים את החיוב לכלל המאושר מתוך רשומת החיוב; לא מתבצע שינוי אוטומטי בתעריף המשותף.', related: ['s5', 'rule-tariff'], source: 'ERP לדוגמה · שורת חיוב ERP-0926-005', sources: ['erp'], version: 1 },
  ];
  for (const m of memories) entities[m.id] = m;
  const model = { entities, resolutions: {}, requestUpdates: {}, audit: [], prepared: false };
  initializeCollaboration(model);
  return model;
}

export const sites = model => Object.values(model.entities).filter(e => e.type === 'site');
// AKA knowledge-layer convention: derivative findings are reproducible views.
// Recomputing them never edits imported source observations or recorded decisions.
export function findings(model) {
  return charges(model).filter(c => !c.resolved).map(c => ({
    id: `finding-${c.id}`, type: 'finding', title: `${model.entities[c.siteId].title}: ${c.issue === 'quantity' ? 'אי התאמה בכמות' : c.issue === 'tariff' ? 'תעריף שונה מהכלל' : 'חסרה אסמכתת שקילה'}`,
    category: 'ממצא מחושב', owner: 'מוטי', status: 'derived', knowledgeLevel: 2, provenanceKind: 'computed',
    summary: c.issue === 'quantity' ? `החיוב מציין ${c.billedQuantity} טונות; אסמכתת השקילה מציינת ${c.quantity}.` : c.issue === 'tariff' ? `בחיוב מופיע תעריף ${c.rate}; הכלל המאושר מציין ${RATES[c.waste]}.` : 'יש דיווח כמות, אך לא נמצאה אסמכתה לאימותה.',
    body: 'ממצא שמחושב מחדש מהמקורות וכלל הבקרה. הוא אינו משנה את ערכי המקור ואינו מהווה אישור חיוב. ההחלטה של בעל התהליך נשמרת בנפרד.',
    derivedFrom: [c.id, c.issue === 'missing' ? 'rule-proof' : 'rule-tariff'], method: 'sanitation.reconcile', version: 1, asOf: SNAPSHOT,
    related: [c.siteId, c.id, c.issue === 'missing' ? 'rule-proof' : 'rule-tariff'], source: `ERP לדוגמה ${c.evidence.erpRef} · ${c.evidence.workbook} שורה ${c.evidence.row}`, sources: c.sources,
  }));
}
export const memories = model => [...Object.values(model.entities).filter(e => e.type === 'memory' || e.type === 'rule'), ...findings(model)];
export function charges(model) {
  return Object.values(model.entities).filter(e => e.type === 'charge').map(c => ({ ...c, ...model.resolutions[c.id] }));
}
export function requests(model) {
  return Object.values(model.entities).filter(e => e.type === 'request').map(r => ({ ...r, ...model.requestUpdates[r.id] }));
}
export function record(model, id) {
  if (id?.startsWith('finding-')) return findings(model).find(f => f.id === id);
  const entity = model.entities[id];
  if (entity?.type === 'charge') return charges(model).find(c => c.id === id);
  if (entity?.type === 'request') return requests(model).find(r => r.id === id);
  return entity;
}
export function amount(charge) { return charge.quantity === null ? null : Math.round(charge.quantity * charge.rate * 100) / 100; }
export function totals(model) {
  const list = charges(model);
  return { count: list.length, issues: list.filter(c => !c.resolved).length, knownAmount: list.reduce((sum, c) => sum + (amount(c) ?? 0), 0), missing: list.filter(c => c.quantity === null).length };
}
export function resolveCharge(model, id, role, input = {}) {
  if (!ROLES[role]?.resolve) throw new Error('אישור התאמה זמין למנהל אגף התברואה.');
  const c = record(model, id);
  if (c?.type !== 'charge') throw new Error('החיוב לא נמצא.');
  if (c.resolved) return;
  let patch = { resolved: true };
  let note = '';
  if (c.issue === 'missing') {
    const weight = Number(input.quantity);
    const proof = String(input.proof ?? '').trim();
    if (!Number.isFinite(weight) || weight <= 0 || !proof) throw new Error('יש להזין כמות חיובית ואסמכתת שקילה.');
    patch = { ...patch, quantity: weight, proof };
    note = `אושרו ${weight} טונות לפי אסמכתה ${proof}`;
  } else if (c.issue === 'tariff') {
    patch.rate = RATES[c.waste];
    note = `התעריף הותאם לכלל המאושר: ${patch.rate} ₪ לטונה`;
  } else {
    patch.billedQuantity = c.quantity;
    note = `כמות החיוב הותאמה לאסמכתה: ${c.quantity} טונות`;
  }
  model.resolutions[id] = { ...model.resolutions[id], ...patch };
  model.prepared = false;
  model.audit.push({ subject: id, actor: ROLES[role].name, note, at: new Date().toISOString() });
  tellFollowers(model, id, role, note);
}
export function updateRequest(model, id, role, next) {
  if (!ROLES[role]?.dispatch) throw new Error('עדכון טיפול זמין למנהל האגף ולרכז הפינוי.');
  const r = record(model, id);
  if (r?.type !== 'request' || !['open', 'investigating', 'closed'].includes(next)) throw new Error('הפנייה או מצב הטיפול אינם תקינים.');
  if (r.state === next) return;
  model.requestUpdates[id] = { state: next };
  model.audit.push({ subject: id, actor: ROLES[role].name, note: next === 'closed' ? 'הפנייה סומנה כטופלה בהדגמה' : 'הפנייה הועברה לבדיקה', at: new Date().toISOString() });
  tellFollowers(model, id, role, model.audit.at(-1).note);
}
export function financeRows(model, role) {
  if (!ROLES[role]?.finance) throw new Error('נתוני חיוב זמינים למנהל האגף ולצוות הכספים.');
  if (totals(model).issues) throw new Error('יש להשלים את בדיקת החריגים לפני הכנת קבצים.');
  if (!settlementApproved(model)) throw new Error('נדרש אישור נפרד של צוות הכספים לגרסת ההתחשבנות הזו.');
  return charges(model).map(c => ({ id: c.id, site: model.entities[c.siteId].title, quantity: c.quantity, tariff: c.rate, amount: amount(c), source: c.evidence.erpRef, proof: c.proof || c.evidence.weightRef }));
}

export function routePlan(points, _improve = false, capacity = CAPACITY_TONNES) {
  if (!Number.isFinite(capacity) || capacity <= 0) throw new Error('קיבולת אינה תקינה.');
  if (points.some(p => !Number.isFinite(p.load) || p.load <= 0 || p.load > capacity)) throw new Error('כמות הפינוי חייבת להיות חיובית ומתאימה לקיבולת המשאית.');
  const pending = points.slice();
  const tours = [];
  while (pending.length) {
    let load = 0;
    const stops = [];
    for (;;) {
      const feasible = pending.map((p, i) => ({ p, i })).filter(({ p }) => load + p.load <= capacity + 1e-9);
      if (!feasible.length) break;
      const { p, i } = feasible[0];
      pending.splice(i, 1); stops.push(p); load += p.load;
    }
    const path = [DEPOT, ...stops, DEPOT];
    tours.push({ stops, load: Math.round(load * 10) / 10, path });
  }
  return { tours };
}

// Adapted semantics from AKA @776496e: notifications.py, comms/Thread.tsx,
// comms/activity.ts and D54. These are browser-local demo records, not delivery.
export const PEOPLE = {
  manager: { id: 'user:moti', name: 'מוטי' },
  finance: { id: 'user:finance', name: 'צוות הכספים' },
  dispatcher: { id: 'user:dispatch', name: 'רכז הפינוי' },
};
export function canReadWorkspace(model, id, role) {
  const e = record(model, id);
  return Boolean(ROLES[role] && e && (ROLES[role].finance || !(e.financial || ['charge', 'finding', 'settlement'].includes(e.type) || ['rule-tariff', 'candidate-tariff'].includes(e.id))));
}
const personRole = id => Object.keys(PEOPLE).find(role => PEOPLE[role].id === id);
const instant = () => new Date().toISOString();
function collabId(model, prefix) { return `${prefix}-${model.collaboration.nextId++}`; }
function needRecord(model, id, role) {
  if (!canReadWorkspace(model, id, role)) throw new Error('הרשומה אינה זמינה לתפקיד הזה.');
  return record(model, id);
}
function approvalBasis(model, subject) {
  const list = subject === 'settlement-september' ? charges(model) : [record(model, subject)];
  return JSON.stringify(list.map(c => ({ id: c.id, quantity: c.quantity, billedQuantity: c.billedQuantity, rate: c.rate, resolved: c.resolved, proof: c.proof || c.evidence.weightRef, ruleVersion: record(model, c.ruleId).version })));
}
export function initializeCollaboration(model) {
  model.entities['settlement-september'] = { id: 'settlement-september', type: 'settlement', title: `אישור התחשבנות ${PERIOD}`, financial: true, sources: ['erp', 'excel'] };
  model.entities['workflow-monthly'] = { id: 'workflow-monthly', type: 'workflow', title: 'תהליך ההתחשבנות החודשית', financial: true, sources: [] };
  model.entities['workflow-collections'] = { id: 'workflow-collections', type: 'workflow', title: 'תכנון סבב פינוי', sources: [] };
  model.entities['workflow-requests'] = { id: 'workflow-requests', type: 'workflow', title: 'טיפול בפניית שירות', sources: ['crm'] };
  model.collaboration = { comments: [], watches: [], notifications: [], approvals: {}, nextId: 1 };
  for (const c of charges(model).filter(c => !c.resolved)) {
    const id = `approval-${c.id}`;
    model.collaboration.approvals[id] = { id, subject: c.id, title: `בדיקת התאמה: ${model.entities[c.siteId].title}`, requester: 'finance', approver: 'manager', state: 'pending', due: '2026-10-24', version: 1, basis: approvalBasis(model, c.id), decisions: [] };
  }
  model.collaboration.approvals['approval-settlement'] = { id: 'approval-settlement', subject: 'settlement-september', title: 'אישור כספים להתחשבנות ספטמבר', requester: 'manager', approver: 'finance', state: 'pending', due: '2026-10-25', version: 1, basis: null, decisions: [] };
  addComment(model, 'charge-s2', 'finance', 'בקובץ החיוב נרשמו 12.2 טונות ובשקילה 14.2. מוטי, נדרש אישורך להתאמה.', [PEOPLE.manager.id]);
  addComment(model, 'point-s2', 'manager', 'התקבלה פנייה על מכולה מלאה. בדקו אסמכתת פינוי ועדכנו את הפנייה המקושרת.', [PEOPLE.dispatcher.id]);
  addComment(model, 'workflow-monthly', 'manager', 'לאחר בדיקת החריגים נדרש אישור נפרד של כספים לפני הפקת הקבצים.', [PEOPLE.finance.id]);
}
function discussionSubject(model, subject) { const e = record(model, subject); return e?.type === 'finding' ? e.derivedFrom[0] : subject; }
export function commentsFor(model, subject, role) {
  needRecord(model, subject, role);
  subject = discussionSubject(model, subject);
  return model.collaboration.comments.filter(c => c.subject === subject);
}
export function isFollowing(model, subject, role) {
  subject = discussionSubject(model, subject);
  return model.collaboration.watches.some(w => w.subject === subject && w.person === PEOPLE[role]?.id);
}
export function followRecord(model, subject, role, follow = true) {
  needRecord(model, subject, role);
  subject = discussionSubject(model, subject);
  model.collaboration.watches = model.collaboration.watches.filter(w => w.subject !== subject || w.person !== PEOPLE[role].id);
  if (follow) model.collaboration.watches.push({ subject, person: PEOPLE[role].id });
}
function tell(model, subject, actor, kind, body, recipients, commentId = null) {
  for (const person of new Set(recipients)) {
    const role = personRole(person);
    if (!role || role === actor || !canReadWorkspace(model, subject, role)) continue;
    model.collaboration.notifications.push({ id: collabId(model, 'notification'), subject, person, actor: PEOPLE[actor].id, kind, body, commentId, at: instant(), read: false });
  }
}
export function addComment(model, subject, role, body, mentions = [], part = '') {
  needRecord(model, subject, role);
  subject = discussionSubject(model, subject);
  body = String(body || '').trim();
  if (!body || body.length > 2000) throw new Error('יש לכתוב תגובה באורך של עד 2,000 תווים.');
  if (!Array.isArray(mentions) || mentions.some(id => !personRole(id) || !canReadWorkspace(model, subject, personRole(id)))) throw new Error('אפשר לתייג רק אדם שיכול לקרוא את הרשומה.');
  const comment = { id: collabId(model, 'comment'), subject, author: PEOPLE[role].id, body, part: String(part).slice(0, 80), mentions: [...new Set(mentions.filter(id => id !== PEOPLE[role].id))], at: instant() };
  model.collaboration.comments.push(comment);
  followRecord(model, subject, role);
  tell(model, subject, role, 'mentioned', body, comment.mentions, comment.id);
  const followers = model.collaboration.watches.filter(w => w.subject === subject && !comment.mentions.includes(w.person)).map(w => w.person);
  tell(model, subject, role, 'watching', body, followers, comment.id);
  for (const person of comment.mentions) followRecord(model, subject, personRole(person));
  return comment;
}
export function notificationsFor(model, role) {
  return model.collaboration.notifications.filter(n => n.person === PEOPLE[role]?.id && canReadWorkspace(model, n.subject, role)).slice().reverse();
}
export function markNotificationRead(model, id, role) {
  const n = model.collaboration.notifications.find(n => n.id === id);
  if (!n || n.person !== PEOPLE[role]?.id || !canReadWorkspace(model, n.subject, role)) throw new Error('ההתראה שייכת לאדם אחר או שאינה זמינה.');
  n.read = true;
}
export function approvalsFor(model, role) {
  return Object.values(model.collaboration.approvals).filter(a => canReadWorkspace(model, a.subject, role)).map(a => {
    const final = a.subject === 'settlement-september';
    const resolved = !final && record(model, a.subject).resolved;
    const stale = a.basis && a.basis !== approvalBasis(model, a.subject);
    const state = final && totals(model).issues ? 'blocked' : stale && (!resolved || a.state === 'approved') ? 'stale' : resolved && a.state === 'pending' ? 'approved' : a.state;
    return { ...a, state, assignedTo: ['needs_information', 'changes_requested', 'stale'].includes(state) ? a.requester : a.approver, currentBasis: approvalBasis(model, a.subject) };
  });
}
export function attentionCount(model, role) {
  return approvalsFor(model, role).filter(a => a.assignedTo === role && ['pending', 'needs_information', 'changes_requested', 'stale'].includes(a.state)).length + notificationsFor(model, role).filter(n => !n.read && n.kind === 'mentioned').length;
}
export function decideApproval(model, id, role, outcome, input = {}) {
  const a = model.collaboration.approvals[id];
  if (!a) throw new Error('בקשת האישור לא נמצאה.');
  needRecord(model, a.subject, role);
  const current = approvalsFor(model, role).find(x => x.id === id);
  if (input.version !== a.version || input.basis !== current.currentBasis) throw new Error('הרשומה השתנתה מאז פתיחת הבקשה. יש לפתוח שוב ולבדוק את הגרסה העדכנית.');
  if (outcome === 'resubmit') {
    if (role !== a.requester || !['needs_information', 'changes_requested', 'stale'].includes(current.state)) throw new Error('רק מבקש האישור יכול להחזיר את הבקשה לבדיקה.');
  } else {
    if (role !== a.approver || current.state !== 'pending') throw new Error('האישור ממתין לבעל תפקיד אחר או לשלב קודם.');
    if (!['approved', 'needs_information', 'changes_requested'].includes(outcome)) throw new Error('החלטה לא תקינה.');
  }
  const note = String(input.note || '').trim();
  if (outcome !== 'approved' && !note) throw new Error('יש להסביר מה נדרש לפני המשך הטיפול.');
  if (outcome === 'approved' && a.basis && a.basis !== current.currentBasis) throw new Error('המקורות השתנו. יש להחזיר את הבקשה לבדיקה עם בסיס עדכני.');
  if (outcome === 'approved' && a.subject !== 'settlement-september') resolveCharge(model, a.subject, role, input);
  const decision = { outcome, person: PEOPLE[role].id, at: instant(), note, basis: current.currentBasis, input: { quantity: input.quantity || null, proof: input.proof || null } };
  a.decisions.push(decision);
  a.state = outcome === 'resubmit' ? 'pending' : outcome;
  a.basis = approvalBasis(model, a.subject);
  a.version++;
  model.prepared = false;
  model.audit.push({ subject: a.subject, actor: PEOPLE[role].name, at: decision.at, note: `${outcome === 'approved' ? 'אושר' : outcome === 'resubmit' ? 'הוחזר לאישור' : outcome === 'needs_information' ? 'התבקש מידע נוסף' : 'הוחזר לתיקון'}${note ? `: ${note}` : ''}` });
  const recipient = outcome === 'resubmit' ? a.approver : a.requester;
  tell(model, a.subject, role, 'approval', model.audit.at(-1).note, [PEOPLE[recipient].id]);
  return a;
}
export function settlementApproved(model) {
  const a = model.collaboration.approvals['approval-settlement'];
  return !totals(model).issues && a.state === 'approved' && a.basis === approvalBasis(model, a.subject);
}
export function restoreCollaboration(model, saved) {
  if (!saved || !Array.isArray(saved.comments) || !Array.isArray(saved.notifications) || !Array.isArray(saved.watches)) return;
  // Session storage is a demo convenience, never an authentication boundary.
  model.collaboration.comments = saved.comments.filter(c => model.entities[c.subject] && personRole(c.author) && typeof c.body === 'string' && Array.isArray(c.mentions));
  model.collaboration.notifications = saved.notifications.filter(n => model.entities[n.subject] && personRole(n.person) && personRole(n.actor));
  model.collaboration.watches = saved.watches.filter(w => model.entities[w.subject] && personRole(w.person));
  for (const [id, current] of Object.entries(model.collaboration.approvals)) {
    const old = saved.approvals?.[id];
    if (old && old.subject === current.subject && old.approver === current.approver && old.requester === current.requester && ['pending', 'approved', 'needs_information', 'changes_requested'].includes(old.state) && Array.isArray(old.decisions) && Number.isInteger(old.version)) Object.assign(current, { state: old.state, version: old.version, basis: old.basis, decisions: old.decisions });
  }
  model.collaboration.nextId = Math.max(Number(saved.nextId) || 1, 100);
}

function tellFollowers(model, subject, role, text) {
  tell(model, subject, role, 'watching', text, model.collaboration.watches.filter(w => w.subject === subject).map(w => w.person));
}
