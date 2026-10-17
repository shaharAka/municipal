// Data sources and the research each one unlocks.
//
// A source is a permission, not a feature: enabling it starts a piece of
// research, and the research produces suggestions with the evidence behind
// them. A suggestion is never applied by itself. Approving one creates or
// updates a form, a workflow, an automation or a set of responsibilities.

import type { Graph } from '../graph/graph.ts';
import { refFor, stableId, type Provenance } from '../graph/graph.ts';
import type { Ontology } from '../ontology/compose.ts';
import type { OrgMap } from '../org/orgmap.ts';
import type { AutomationProposal, ProcessModel } from '../process/discover.ts';
import { generateForm, type FormKind, type FormSpec } from '../forms/generate.ts';

export type SourceId = 'entra' | 'exchange' | 'sharepoint' | 'sql';

export type SourceDef = {
  id: SourceId;
  nameHe: string;
  nameEn: string;
  descriptionHe: string;
  evidenceHe: string;
  unlocksHe: string;
  enabledByDefault: boolean;
  /** A source with staff or resident data needs an explicit gate before it is read. */
  consent?: {
    scopeHe: string;
    approversHe: string[];
    dpiaHe: string;
    optOutHe: string;
  };
};

export const SOURCES: SourceDef[] = [
  {
    id: 'entra',
    nameHe: 'זהות העובדים',
    nameEn: 'Microsoft Entra ID',
    descriptionHe: 'עובדים, יחידות וקווי דיווח מהמערכת הארגונית.',
    evidenceHe: '17 עובדים · 5 יחידות',
    unlocksHe: 'מבנה ארגוני וטופס קליטה',
    enabledByDefault: true,
  },
  {
    id: 'sql',
    nameHe: 'מערכות הפעלה',
    nameEn: 'Azure SQL',
    descriptionHe: 'תיקים, תושבים, נכסים, עסקים ותשלומים.',
    evidenceHe: '1,405 רשומות · 10 טבלאות',
    unlocksHe: 'תהליכים, זכאות ואוטומציות',
    enabledByDefault: true,
  },
  {
    id: 'exchange',
    nameHe: 'דואר העבודה',
    nameEn: 'Exchange Online',
    descriptionHe: 'תכתובות המחלקה: בקשות, שיבוצים ומעקבים.',
    evidenceHe: '55 הודעות · 6 נושאים',
    unlocksHe: 'אחריויות ומשימות ידניות לאוטומציה',
    enabledByDefault: false,
    consent: {
      scopeHe: 'תיבות הדואר של עובדי מחלקת תברואה ובריאות בלבד, לקריאה בלבד. אין קריאת דואר אישי שאינו קשור לעבודה.',
      approversHe: ['גלית אדלר, יועצת משפטית', 'מחלקת מערכות המידע העירונית'],
      dpiaHe: 'הערכת השפעה על הפרטיות (DPIA) — טיוטה לבדיקת היועץ המשפטי לפני חיבור בסביבה אמיתית.',
      optOutHe: 'עובד/ת רשאי/ת לבקש לא לכלול את תיבתו/ה. הבקשה נרשמת לפני החיבור, והחיבור לא יופעל עבורו/ה.',
    },
  },
  {
    id: 'sharepoint',
    nameHe: 'מסמכי המחלקה',
    nameEn: 'SharePoint / OneDrive',
    descriptionHe: 'נהלים, תעריפים, דוחות ביקורת ותנאי רישיון.',
    evidenceHe: '6 מסמכים · 2 מוגבלים',
    unlocksHe: 'טפסים וכללים מתוך הנהלים',
    enabledByDefault: false,
    consent: {
      scopeHe: 'אתר המחלקה ב-SharePoint וספריית המסמכים שלו בלבד. הרשאות המסמך נשמרות, ומסמך מוגבל לא נראה למי שאין לו הרשאה.',
      approversHe: ['גלית אדלר, יועצת משפטית', 'אחראית הגנת הפרטיות העירונית'],
      dpiaHe: 'הערכת השפעה על הפרטיות — המסמכים עלולים לכלול מידע אישי ותושבים.',
      optOutHe: 'מסמך שהגישה אליו הוסרה לא ייקרא; אין עקיפת הרשאות.',
    },
  },
];

export type Artifact =
  | { kind: 'workflow'; ref: string; labelHe: string }
  | { kind: 'automation'; ref: string; labelHe: string }
  | { kind: 'form'; ref: string; labelHe: string; spec: FormSpec }
  | { kind: 'responsibilities'; ref: string; labelHe: string; count: number };

export type Suggestion = {
  id: string;
  source: SourceId;
  kind: 'workflow' | 'form' | 'automation' | 'responsibility';
  titleHe: string;
  whyHe: string;
  evidenceHe: string[];
  action:
    | { type: 'validate_process'; processCode: string }
    | { type: 'approve_automation'; proposalRef: string }
    | { type: 'confirm_responsibilities' }
    | { type: 'create_form'; pageType: string; formKind: FormKind; nameHe: string; only?: string[]; serviceCode?: string };
  status: 'new' | 'approved';
  artifact?: Artifact;
};

export type ResearchContext = {
  graph: Graph;
  ontology: Ontology;
  org: OrgMap;
  models: ProcessModel[];
  proposals: AutomationProposal[];
  capturedAt: string;
  actor: string;
};

export type ResearchState = Map<string, Suggestion>;

const provenance = (asOf: string, source: string): Provenance => ({
  kind: 'computed',
  source,
  method: 'research v1',
  as_of: asOf,
  evidence_class: 'attributed',
});

/** Deterministic research: the same graph always yields the same suggestions. */
export function research(source: SourceId, ctx: ResearchContext): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lic = ctx.models.find((m) => m.serviceCode === 'LIC') ?? ctx.models[0];

  if (source === 'exchange') {
    const inferred = ctx.org.responsibilities.filter((r) => r.signal === 'mail').length;
    const caseActions = ctx.org.responsibilities.filter((r) => r.signal === 'case-events').length;
    suggestions.push({
      id: stableId('SUG', 'exchange', 'responsibilities'),
      source,
      kind: 'responsibility',
      titleHe: 'אשרו את האחריויות שזוהו מהדואר',
      whyHe: 'אחריות שנגזרת מהודעות היא הצעה, לא עובדה. אישור הופך אותה לבסיס לניתוב ולשאלות.',
      evidenceHe: [`${caseActions + inferred} אחריויות זוהו`, `${inferred} מתוכן מתוך נושאי הודעות`, 'כל אחת נושאת את מספר ההודעות או האירועים שמאחוריה'],
      action: { type: 'confirm_responsibilities' },
      status: 'new',
    });
    const docStep = lic?.steps.find((s) => s.activity === 'DOCUMENTS_REQUESTED');
    if (docStep) {
      suggestions.push({
        id: stableId('SUG', 'exchange', 'documents-workflow'),
        source,
        kind: 'workflow',
        titleHe: 'הוסיפו את שלב "בקשת מסמכים" לתהליך המאושר',
        whyHe: 'השלב מופיע בדואר אך לא הוכר כתחנה רשמית בתהליך.',
        evidenceHe: [`${docStep.occurrences} מקרים עם בקשת מסמכים`, `המתנה חציונית ${docStep.medianWaitDays} ימים`, 'המקור: הודעות שנשלחו לבתי עסק'],
        action: { type: 'validate_process', processCode: lic.serviceCode },
        status: 'new',
      });
    }
  }

  if (source === 'sharepoint') {
    suggestions.push({
      id: stableId('SUG', 'sharepoint', 'discount-form'),
      source,
      kind: 'form',
      titleHe: 'טופס בקשת הנחה באגרת תברואה',
      whyHe: 'הנוהל והתעריף קובעים אילו שדות נדרשים. הטופס נגזר מהם ומהמודל, ולכן לא סוטה מהם.',
      evidenceHe: ['נוהל הנחות באגרת תברואה', 'תעריף אגרת תברואה 2026', `${ctx.graph.ofType('household').length} משקי בית במודל`],
      action: { type: 'create_form', pageType: 'household', formKind: 'application', nameHe: 'בקשה להנחה באגרת תברואה', only: ['household_size', 'income_band', 'discount_status'], serviceCode: 'FEE' },
      status: 'new',
    });
  }

  if (source === 'sql' && lic) {
    suggestions.push({
      id: stableId('SUG', 'sql', 'validate-process'),
      source,
      kind: 'workflow',
      titleHe: 'אשרו את תהליך רישוי העסק כפי שהוא קורה בפועל',
      whyHe: 'התהליך שזוהה מהיומן הוא הצעה. אישור הופך אותו לתהליך מאושר שאפשר להריץ עליו אוטומציות.',
      evidenceHe: [`${lic.caseCount} תיקים`, `${lic.variants.length} מסלולים`, `חציון ${lic.medianTotalDays} יום לתיק`],
      action: { type: 'validate_process', processCode: lic.serviceCode },
      status: 'new',
    });
    const missingIncome = ctx.graph.ofType('household').filter((h) => !h.properties.income_band).length;
    if (missingIncome) {
      suggestions.push({
        id: stableId('SUG', 'sql', 'income-form'),
        source,
        kind: 'form',
        titleHe: 'טופס השלמת נתון הכנסה למשקי בית',
        whyHe: `${missingIncome} משקי בית לא ניתנים להכרעה כי חסר נתון הכנסה. טופס קצר, שנגזר מהמודל, יכול לאסוף בדיוק את השדה הזה.`,
        evidenceHe: [`${missingIncome} משקי בית חסרים`, 'השדה income_band', 'נגזר מטיפוס household'],
        action: {
          type: 'create_form',
          pageType: 'household',
          formKind: 'internal',
          nameHe: 'השלמת נתון הכנסה',
          only: ['household_size', 'income_band'],
        },
        status: 'new',
      });
    }
  }

  return suggestions;
}

/** Applies an approved suggestion, and only then does it change anything. */
export function approveSuggestion(suggestion: Suggestion, ctx: ResearchContext): Artifact {
  const decision = (subjectRef: string, labelHe: string, kind: string): string => {
    const ref = refFor('decision', stableId('DEC', suggestion.id).replace('DEC-', ''));
    if (!ctx.graph.page(ref)) {
      ctx.graph.addPage({ ref, type: 'decision', title: labelHe, properties: {}, createdAt: ctx.capturedAt });
      const values: Record<string, unknown> = {
        decision_id: ref,
        kind,
        status: 'approved',
        decided_at: ctx.capturedAt,
        decided_by: ctx.actor,
        rationale: suggestion.whyHe,
        subject_ref: subjectRef,
      };
      for (const [name, value] of Object.entries(values)) {
        ctx.graph.setProperty({
          pageRef: ref,
          property: name,
          value,
          status: 'confirmed',
          provenance: { ...provenance(ctx.capturedAt, 'suggestion approval'), evidence_class: 'asserted', confirmed_by_role: ctx.actor },
          evidenceIds: [],
        });
      }
    }
    ctx.graph.addEdge({ kind: 'approves', from: ref, to: subjectRef });
    return ref;
  };

  if (suggestion.action.type === 'validate_process') {
    const action = suggestion.action;
    const model = ctx.models.find((m) => m.serviceCode === action.processCode);
    const ref = refFor('process_model', action.processCode);
    if (ctx.graph.page(ref)) {
      ctx.graph.setProperty({
        pageRef: ref,
        property: 'status',
        value: 'validated',
        status: 'confirmed',
        provenance: { ...provenance(ctx.capturedAt, 'suggestion approval'), evidence_class: 'asserted', confirmed_by_role: ctx.actor },
        evidenceIds: [],
      });
    }
    decision(ref, 'אישור התהליך', 'process_validated');
    return { kind: 'workflow', ref, labelHe: `תהליך ${suggestion.action.processCode} אושר (${model?.caseCount ?? 0} תיקים)` };
  }

  if (suggestion.action.type === 'approve_automation') {
    const ref = suggestion.action.proposalRef;
    if (ctx.graph.page(ref)) {
      for (const [name, value] of Object.entries({ status: 'approved', approved_by: ctx.actor, approved_at: ctx.capturedAt })) {
        ctx.graph.setProperty({
          pageRef: ref,
          property: name,
          value,
          status: 'confirmed',
          provenance: { ...provenance(ctx.capturedAt, 'suggestion approval'), evidence_class: 'asserted', confirmed_by_role: ctx.actor },
          evidenceIds: [],
        });
      }
    }
    decision(ref, 'אישור אוטומציה', 'automation_approved');
    return { kind: 'automation', ref, labelHe: 'אוטומציה אושרה ותופעל על תיקים חדשים' };
  }

  if (suggestion.action.type === 'confirm_responsibilities') {
    let count = 0;
    for (const page of ctx.graph.ofType('knowledge_candidate')) {
      if (String(page.properties.candidate_kind) !== 'responsibility') continue;
      if (String(page.properties.status) !== 'open') continue;
      ctx.graph.setProperty({
        pageRef: page.ref,
        property: 'status',
        value: 'accepted',
        status: 'confirmed',
        provenance: { ...provenance(ctx.capturedAt, 'suggestion approval'), evidence_class: 'asserted', confirmed_by_role: ctx.actor },
        evidenceIds: [],
      });
      count++;
    }
    decision(refFor('org_unit', 'department'), 'אישור אחריויות', 'responsibility_confirmed');
    return { kind: 'responsibilities', ref: refFor('org_unit', 'department'), labelHe: `${count} אחריויות אושרו`, count };
  }

  const formAction = suggestion.action;
  const spec = generateForm(ctx.ontology, formAction.pageType, formAction.formKind, {
    only: formAction.only,
    titleHe: formAction.nameHe,
  });
  const ref = refFor('form_definition', spec.form_id);
  ctx.graph.addPage({ ref, type: 'form_definition', title: formAction.nameHe, properties: {}, createdAt: ctx.capturedAt });
  const values: Record<string, unknown> = {
    form_id: spec.form_id,
    name_he: formAction.nameHe,
    page_type: spec.page_type,
    kind: spec.kind,
    field_count: spec.fields.length,
    fields: spec.fields.map((f) => f.name),
    direction: spec.direction,
    status: 'approved',
    generated_at: ctx.capturedAt,
    source_ref: suggestion.source,
  };
  for (const [name, value] of Object.entries(values)) {
    ctx.graph.setProperty({
      pageRef: ref,
      property: name,
      value,
      status: 'confirmed',
      provenance: { ...provenance(ctx.capturedAt, 'suggestion approval'), evidence_class: 'asserted', confirmed_by_role: ctx.actor },
      evidenceIds: [],
    });
  }
  decision(ref, 'אישור טופס', 'schema_candidate_accepted');
  // The form is now connected to the service it collects a request for.
  if (formAction.serviceCode) {
    const serviceRef = refFor('service', formAction.serviceCode);
    if (ctx.graph.page(serviceRef)) ctx.graph.addEdge({ kind: 'form_for', from: ref, to: serviceRef });
  }
  return { kind: 'form', ref, labelHe: `${formAction.nameHe} · ${spec.fields.length} שדות`, spec };
}
