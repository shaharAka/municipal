// Guided-demo catalogue. Each item starts from a real screen and performs one
// real action; nothing here invents data or a second product surface.
import { esc, icon } from './ui.js';

export const SCENARIOS = [
  {
    id: 'rights',
    n: '1',
    titleHe: 'מיצוי זכויות',
    promiseHe: 'למי מגיעה הנחה בארנונה, ומי לא קיבל אותה.',
    outcomeHe: '5 תושבים · 19,796 ₪ בשנה',
    roleKind: 'secretary',
    roleLabelHe: 'הילה קורן · מזכירת מחלקה',
    tab: 'rights',
    action: { kind: 'click', selector: '[data-v-letter]' },
    steps: [
      'השמות גלויים רק לתפקיד שמטפל בבקשות הנחה.',
      'המכתב נבנה מהשדות; אף רשומה לא נשלחת למודל.',
      'השליחה נרשמת כהחלטה על שמך, לא כשינוי בגבייה.',
    ],
  },
  {
    id: 'meetings',
    n: '2',
    titleHe: 'מהישיבה למשימות',
    promiseHe: 'מה הוחלט, מי אחראי, ומה נתקע.',
    outcomeHe: '8 החלטות · 2 בלי אחראי · 1 באיחור',
    roleKind: 'head',
    roleLabelHe: 'דנה לוי · מנהלת המחלקה',
    tab: 'meetings',
    action: { kind: 'focus', selector: '.v-alerts' },
    steps: [
      'ההחלטות נקראו מסיכומי הישיבה, לא הוקלדו מחדש.',
      'אחראי ומועד מגיעים מהשורה במקור.',
      'אפשר להפוך החלטות למשימות עם תזכורת.',
    ],
  },
  {
    id: 'eligibility',
    n: '3',
    titleHe: 'שאלה עם כלל ומקור',
    promiseHe: 'כמה משקי בית זכאים להנחה — ומה לא ידוע.',
    outcomeHe: '28 זכאים · 10 לא זכאים · 6 לא ידוע',
    roleKind: 'head',
    roleLabelHe: 'דנה לוי · מנהלת המחלקה',
    tab: 'home',
    action: { kind: 'palette', question: 'כמה משקי בית זכאים להנחה באגרת תברואה?' },
    steps: [
      'השאלה עוברת למתכנן טיפוסים, לא ל-SQL חופשי.',
      'התשובה נושאת את גרסת הכלל, הבעלים והמקור.',
      '6 משקי בית נשארים "לא ידוע"; הם לא הופכים לאפס.',
    ],
  },
  {
    id: 'gap',
    n: '4',
    titleHe: 'פער שנסגר בשאלה',
    promiseHe: 'לשאול את מי שמחזיק את הנתון, לא לנחש.',
    outcomeHe: '6 משקי בית · 3 שאלות',
    roleKind: 'clerk',
    roleLabelHe: 'מיכל ברק · רכזת רישוי',
    tab: 'home',
    action: { kind: 'focus', selector: '[data-gap-open]' },
    steps: [
      'הפער נבחר מהתשובה, לא מתוך רשימת משימות.',
      'השאלות מנוסחות מראש, עם הניחוש שלנו.',
      'רק האדם שאליו נשלחה השאלה יכול לענות.',
    ],
  },
];

export const scenarioById = (id) => SCENARIOS.find((scenario) => scenario.id === id) ?? null;

export const hubBody = () => `
  <p class="sheet-lead">ארבעה תרחישים מהעבודה היומית. כל תרחיש מחליף לתפקיד המתאים ופותח את המסך האמיתי — עם נתוני הדגמה, לא מסך מזויף.</p>
  <div class="demo-grid">
    ${SCENARIOS.map(
      (scenario) => `
        <article class="demo-card" data-demo-card="${esc(scenario.id)}">
          <header class="demo-head">
            <span class="demo-number">${esc(scenario.n)}</span>
            <div>
              <h3>${esc(scenario.titleHe)}</h3>
              <p>${esc(scenario.promiseHe)}</p>
            </div>
          </header>
          <p class="demo-role">${icon('users')} ${esc(scenario.roleLabelHe)}</p>
          <ol class="demo-steps">${scenario.steps.map((step) => `<li>${esc(step)}</li>`).join('')}</ol>
          <div class="demo-foot">
            <b>${esc(scenario.outcomeHe)}</b>
            <button class="btn btn-small" type="button" data-demo-start="${esc(scenario.id)}">פתיחת התרחיש ${icon('arrowLeft')}</button>
          </div>
        </article>`,
    ).join('')}
  </div>
  <p class="sheet-note">${icon('info')} הסיור משתמש בנתוני הדגמה ומחליף תפקיד אוטומטית. אפשר לעצור בכל שלב; שום דבר לא נכתב חזרה למערכות העירייה.</p>`;
