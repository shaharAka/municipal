// English names for the department's units.
//
// Entra ID carries one department string, in Hebrew. The English label is the
// tenant's, not the directory's: it lives here as a declared label with an
// owner, the same way an AKA overlay carries `labels`. It is not invented from
// the Hebrew at render time.

export const UNIT_LABELS_EN: Record<string, string> = {
  'רישוי ופיקוח מזון': 'Licensing & food inspection',
  'תברואה - שטח': 'Sanitation field operations',
  'הדברה': 'Pest control',
  'משרד המחלקה': 'Department office',
  'אגפי מטה': 'Corporate services',
  'רישוי ואכיפה': 'Licensing & enforcement',
  'תפעול תברואה': 'Sanitation operations',
};

export const UNIT_LABELS_OWNER = 'רון דיין, אחראי נתונים מחלקתי';
