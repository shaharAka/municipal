// How each source lands in the ontology.
//
// Readable by a data steward without reading code: which source, which page
// type, which column fills which property, and which declared rule (if any)
// accepts the value without a person.
//
//   mapped field       -> a page property, with a fact and a locator
//   unmapped column    -> a knowledge_candidate, never a silent new property
//   no acceptance rule -> the value stays a candidate fact for a person

export type Transform = 'trim' | 'date' | 'dateTime' | 'number' | 'boolean' | 'digits' | 'normalizeAddress' | 'lower';

export type FieldMap = { property: string; from: string; transform?: Transform };

export type EdgeMap = {
  kind: string;
  /** 'from' = this row is the source end of the edge; 'to' = this row is the target. */
  side: 'from' | 'to';
  targetType: string;
  from: string;
  payload?: Record<string, string>;
};

export type AcceptanceRule = { ruleId: string; owner: string; reason: string };

export type SourceSystem = 'entra' | 'exchange' | 'sharepoint' | 'sql';

export type EntityMapping = {
  id: string;
  system: SourceSystem;
  source: string;
  sourceKind: 'table' | 'endpoint';
  /** Page type in the ontology. */
  pageType: string;
  titleFrom: string;
  keyFrom: string;
  evidenceClass: 'sourced' | 'extracted';
  acceptance?: AcceptanceRule;
  fields: FieldMap[];
  edges?: EdgeMap[];
  unmapped?: { column: string; examples: string[]; reason: string }[];
};

const SOR: AcceptanceRule = {
  ruleId: 'R-001',
  owner: 'רון דיין, אחראי נתונים מחלקתי',
  reason: 'Values read directly from the system of record for this type are accepted without a person.',
};

export const SOURCE_LABELS: Record<SourceSystem, string> = {
  entra: 'Microsoft Entra ID',
  exchange: 'Exchange Online (Graph mail)',
  sharepoint: 'SharePoint / OneDrive',
  sql: 'Azure SQL (line of business)',
};

export const MAPPINGS: EntityMapping[] = [
  {
    id: 'people-from-entra',
    system: 'entra',
    source: '/users',
    sourceKind: 'endpoint',
    pageType: 'person',
    titleFrom: 'displayName',
    keyFrom: 'id',
    evidenceClass: 'sourced',
    acceptance: SOR,
    fields: [
      { property: 'display_name', from: 'displayName' },
      { property: 'mail', from: 'mail', transform: 'lower' },
      { property: 'job_title', from: 'jobTitle' },
      { property: 'department', from: 'department' },
      { property: 'department_en', from: '_departmentEn' },
      { property: 'employee_type', from: 'employeeType' },
      { property: 'account_enabled', from: 'accountEnabled', transform: 'boolean' },
    ],
    edges: [{ kind: 'reports_to', side: 'from', targetType: 'person', from: 'manager.id' }],
    unmapped: [
      {
        column: 'preferredLanguage',
        examples: ['he-IL'],
        reason: 'Decides the language of an interview; not modelled yet.',
      },
      {
        column: 'officeLocation',
        examples: ['בניין עירייה, קומה 2'],
        reason: 'Might matter for routing field work; unproven.',
      },
    ],
  },
  {
    id: 'groups-from-entra',
    system: 'entra',
    source: '/groups',
    sourceKind: 'endpoint',
    pageType: 'group',
    titleFrom: 'displayName',
    keyFrom: 'id',
    evidenceClass: 'sourced',
    acceptance: SOR,
    fields: [
      { property: 'display_name', from: 'displayName' },
      { property: 'mail_nickname', from: 'mailNickname' },
      { property: 'description', from: 'description' },
    ],
  },
  {
    id: 'properties-from-sql',
    system: 'sql',
    source: 'dbo.properties',
    sourceKind: 'table',
    pageType: 'property',
    titleFrom: 'address_raw',
    keyFrom: 'property_id',
    evidenceClass: 'sourced',
    acceptance: SOR,
    fields: [
      { property: 'property_id', from: 'property_id' },
      { property: 'street_name', from: 'street_name' },
      { property: 'house_number', from: 'house_number', transform: 'number' },
      { property: 'city', from: 'city' },
      { property: 'parcel_number', from: 'parcel_number' },
      { property: 'building_year', from: 'building_year', transform: 'number' },
      { property: 'floor_area_sqm', from: 'floor_area_sqm', transform: 'number' },
      { property: 'sanitation_fee_annual', from: 'sanitation_fee_annual', transform: 'number' },
      { property: 'address_raw', from: 'address_raw', transform: 'normalizeAddress' },
    ],
  },
  {
    id: 'households-from-sql',
    system: 'sql',
    source: 'dbo.households',
    sourceKind: 'table',
    pageType: 'household',
    titleFrom: 'household_id',
    keyFrom: 'household_id',
    evidenceClass: 'sourced',
    acceptance: SOR,
    fields: [
      { property: 'household_id', from: 'household_id' },
      { property: 'household_size', from: 'household_size', transform: 'number' },
      { property: 'income_band', from: 'income_band' },
      { property: 'discount_status', from: 'discount_status' },
    ],
    edges: [{ kind: 'household_at', side: 'from', targetType: 'property', from: 'property_id' }],
  },
  {
    id: 'residents-from-sql',
    system: 'sql',
    source: 'dbo.residents',
    sourceKind: 'table',
    pageType: 'resident',
    titleFrom: 'first_name',
    keyFrom: 'resident_id',
    evidenceClass: 'sourced',
    acceptance: SOR,
    fields: [
      { property: 'resident_id', from: 'resident_id' },
      { property: 'national_id', from: 'national_id', transform: 'digits' },
      { property: 'first_name', from: 'first_name' },
      { property: 'last_name', from: 'last_name' },
      { property: 'birth_date', from: 'birth_date', transform: 'date' },
      { property: 'residency_start_date', from: 'residency_start_date', transform: 'date' },
      { property: 'disability_certificate_expiry', from: 'disability_certificate_expiry', transform: 'date' },
      { property: 'income_band', from: 'income_band' },
      { property: 'phone', from: 'phone' },
    ],
    edges: [
      { kind: 'member_of_household', side: 'from', targetType: 'household', from: 'household_id' },
      { kind: 'resides_at', side: 'from', targetType: 'property', from: 'property_id' },
    ],
    unmapped: [
      {
        column: 'inspection_zone',
        examples: ['N', 'S', 'E', 'W'],
        reason: 'Appears in residents and businesses; likely a real routing attribute.',
      },
    ],
  },
  {
    id: 'businesses-from-sql',
    system: 'sql',
    source: 'dbo.businesses',
    sourceKind: 'table',
    pageType: 'business',
    titleFrom: 'business_name',
    keyFrom: 'business_id',
    evidenceClass: 'sourced',
    acceptance: SOR,
    fields: [
      { property: 'business_id', from: 'business_id' },
      { property: 'registry_number', from: 'registry_number' },
      { property: 'business_name', from: 'business_name' },
      { property: 'category', from: 'category' },
      { property: 'risk_level', from: 'risk_level' },
      { property: 'address_raw', from: 'address_raw', transform: 'normalizeAddress' },
      { property: 'contact_name', from: 'contact_name' },
      { property: 'contact_email', from: 'contact_email', transform: 'lower' },
      { property: 'licence_status', from: 'licence_status' },
    ],
    edges: [{ kind: 'located_at', side: 'from', targetType: 'property', from: 'property_id' }],
    unmapped: [
      {
        column: 'inspection_zone',
        examples: ['N', 'S', 'E', 'W'],
        reason: 'Same column as residents.inspection_zone — one candidate, two sources.',
      },
    ],
  },
  {
    id: 'licences-from-sql',
    system: 'sql',
    source: 'dbo.licences',
    sourceKind: 'table',
    pageType: 'licence',
    titleFrom: 'licence_id',
    keyFrom: 'licence_id',
    evidenceClass: 'sourced',
    acceptance: SOR,
    fields: [
      { property: 'licence_id', from: 'licence_id' },
      { property: 'licence_type', from: 'licence_type' },
      { property: 'status', from: 'status' },
      { property: 'issued_date', from: 'issued_date', transform: 'date' },
      { property: 'expiry_date', from: 'expiry_date', transform: 'date' },
      { property: 'conditions_text', from: 'conditions_text' },
    ],
    edges: [{ kind: 'holds', side: 'to', targetType: 'business', from: 'business_id' }],
  },
  {
    id: 'inspections-from-sql',
    system: 'sql',
    source: 'dbo.inspections',
    sourceKind: 'table',
    pageType: 'inspection',
    titleFrom: 'inspection_id',
    keyFrom: 'inspection_id',
    evidenceClass: 'sourced',
    acceptance: SOR,
    fields: [
      { property: 'inspection_id', from: 'inspection_id' },
      { property: 'scheduled_for', from: 'scheduled_for', transform: 'dateTime' },
      { property: 'completed_at', from: 'completed_at', transform: 'dateTime' },
      { property: 'result', from: 'result' },
      { property: 'findings_text', from: 'findings_text' },
    ],
    edges: [
      { kind: 'inspection_of', side: 'from', targetType: 'business', from: 'business_id' },
      { kind: 'performed_by', side: 'from', targetType: 'person', from: 'inspector_id' },
    ],
  },
  {
    id: 'cases-from-sql',
    system: 'sql',
    source: 'dbo.cases',
    sourceKind: 'table',
    pageType: 'case',
    titleFrom: 'case_id',
    keyFrom: 'case_id',
    evidenceClass: 'sourced',
    acceptance: SOR,
    fields: [
      { property: 'case_id', from: 'case_id' },
      { property: 'service_code', from: 'service_code' },
      { property: 'subject_ref', from: 'subject_ref' },
      { property: 'opened_at', from: 'opened_at', transform: 'dateTime' },
      { property: 'closed_at', from: 'closed_at', transform: 'dateTime' },
      { property: 'status', from: 'status' },
      { property: 'channel', from: 'channel' },
    ],
    edges: [{ kind: 'case_owner', side: 'from', targetType: 'person', from: 'owner_id' }],
  },
  {
    id: 'case-events-from-sql',
    system: 'sql',
    source: 'dbo.case_events',
    sourceKind: 'table',
    pageType: 'case_event',
    titleFrom: 'activity_code',
    keyFrom: 'event_id',
    evidenceClass: 'sourced',
    acceptance: SOR,
    fields: [
      { property: 'event_id', from: 'event_id' },
      { property: 'occurred_at', from: 'occurred_at', transform: 'dateTime' },
      { property: 'activity', from: 'activity_code' },
      { property: 'source', from: 'source' },
      { property: 'detail', from: 'detail' },
    ],
    edges: [
      { kind: 'event_of', side: 'from', targetType: 'case', from: 'case_id' },
      { kind: 'event_actor', side: 'from', targetType: 'person', from: 'actor_id' },
    ],
  },
  {
    id: 'complaints-from-sql',
    system: 'sql',
    source: 'dbo.complaints',
    sourceKind: 'table',
    pageType: 'complaint',
    titleFrom: 'complaint_id',
    keyFrom: 'complaint_id',
    evidenceClass: 'sourced',
    acceptance: SOR,
    fields: [
      { property: 'complaint_id', from: 'complaint_id' },
      { property: 'category', from: 'category' },
      { property: 'location', from: 'location' },
      { property: 'priority', from: 'priority' },
      { property: 'resolved_at', from: 'resolved_at', transform: 'dateTime' },
    ],
    edges: [{ kind: 'complaint_in_case', side: 'from', targetType: 'case', from: 'case_id' }],
  },
  {
    id: 'fees-from-sql',
    system: 'sql',
    source: 'dbo.fee_obligations',
    sourceKind: 'table',
    pageType: 'fee_obligation',
    titleFrom: 'fee_id',
    keyFrom: 'fee_id',
    evidenceClass: 'sourced',
    acceptance: SOR,
    fields: [
      { property: 'fee_id', from: 'fee_id' },
      { property: 'fiscal_year', from: 'fiscal_year', transform: 'number' },
      { property: 'amount', from: 'amount', transform: 'number' },
      { property: 'discount_granted', from: 'discount_granted', transform: 'boolean' },
      { property: 'paid_at', from: 'paid_at', transform: 'date' },
    ],
    edges: [{ kind: 'fee_for', side: 'from', targetType: 'property', from: 'property_id' }],
  },
  {
    id: 'documents-from-sharepoint',
    system: 'sharepoint',
    source: '/drives/{driveId}/items',
    sourceKind: 'endpoint',
    pageType: 'document',
    titleFrom: 'name',
    keyFrom: 'id',
    evidenceClass: 'sourced',
    acceptance: SOR,
    fields: [
      { property: 'drive_item_id', from: 'id' },
      { property: 'name', from: 'name' },
      { property: 'mime_type', from: 'file.mimeType' },
      { property: 'web_url', from: 'webUrl' },
      { property: 'sensitivity_label', from: 'sensitivityLabel.name' },
      { property: 'page_count', from: '_pageCount', transform: 'number' },
      { property: 'source_system', from: '_sourceSystem' },
    ],
  },
  {
    id: 'messages-from-exchange',
    system: 'exchange',
    source: '/users/{id}/messages',
    sourceKind: 'endpoint',
    pageType: 'message',
    titleFrom: 'subject',
    keyFrom: 'id',
    evidenceClass: 'sourced',
    acceptance: SOR,
    fields: [
      { property: 'message_id', from: 'id' },
      { property: 'subject', from: 'subject' },
      { property: 'from_address', from: 'from.emailAddress.address' },
      { property: 'received_at', from: 'receivedDateTime', transform: 'dateTime' },
      { property: 'conversation_id', from: 'conversationId' },
      { property: 'sensitivity_label', from: 'sensitivityLabel.name' },
      { property: 'participants', from: '_participantIds' },
    ],
  },
];

export function mappingsForType(pageType: string): EntityMapping[] {
  return MAPPINGS.filter((m) => m.pageType === pageType);
}

export function mappingsForSystem(system: SourceSystem): EntityMapping[] {
  return MAPPINGS.filter((m) => m.system === system);
}

/** Ontology properties with no source behind them yet — the coverage gap. */
export function unmappedProperties(pageType: string, properties: { name: string }[]): string[] {
  const mapped = new Set(mappingsForType(pageType).flatMap((m) => m.fields.map((f) => f.property)));
  return properties.map((p) => p.name).filter((n) => !mapped.has(n) && n !== 'provenance');
}
