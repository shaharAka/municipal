// The local model behind the Azure OpenAI-compatible endpoint.
//
// Deterministic and rule-based on purpose: scenario evals assert exact output,
// and a demo must not depend on a network. It is NOT a quality proxy — model
// quality is measured in the benchmark role (slice 10) against a real endpoint.
//
// Each role gets the same contract a real deployment gets: a system prompt
// naming the role and a JSON-shaped answer.

export type ExtractionFact = {
  property: string;
  value: string | number | boolean;
  confidence: number;
  excerpt: string;
};

export type ExtractionResult = {
  facts: ExtractionFact[];
  flags: { kind: string; excerpt: string; severity: 'high' | 'medium' }[];
};

const INJECTION_PATTERNS = [
  /התעלם מהנחיות/,
  /התעלם מההוראות/,
  /ignore (all )?previous instructions/i,
  /approve all/i,
  /אשר את כל הבקשות/,
];

/** Rule-based extraction: enough structure to prove the pipeline, no pretence. */
export function extractFromText(text: string): ExtractionResult {
  const facts: ExtractionFact[] = [];
  const flags: ExtractionResult['flags'] = [];
  const lines = text.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Numbered procedure steps ("3. שיבוץ מפקח ...")
    const step = /^(\d+)[.)]\s+(.{3,})$/.exec(line);
    if (step) {
      facts.push({
        property: 'procedureStep',
        value: `${step[1]}. ${step[2]}`,
        confidence: 0.82,
        excerpt: line,
      });
    }

    // Money amounts, shekel-denominated
    const amount = /(\d[\d,]{2,})\s*(?:ש"ח|₪|ILS|שקל)/.exec(line);
    if (amount) {
      facts.push({
        property: 'amountIls',
        value: Number(amount[1].replace(/,/g, '')),
        confidence: 0.76,
        excerpt: line,
      });
    }

    // Percentages (discounts, thresholds)
    const pct = /(\d{1,2})\s*%/.exec(line);
    if (pct) {
      facts.push({
        property: 'percent',
        value: Number(pct[1]),
        confidence: 0.74,
        excerpt: line,
      });
    }

    // Explicit ISO dates
    const date = /(\d{4}-\d{2}-\d{2})/.exec(line);
    if (date) {
      facts.push({ property: 'mentionedDate', value: date[1], confidence: 0.7, excerpt: line });
    }

    // Standards stated in a procedure ("סטנדרט זמן: 30 יום")
    const sla = /(\d{1,3})\s*יום/.exec(line);
    if (sla && /סטנדרט|SLA|זמן/.test(line)) {
      facts.push({
        property: 'slaDays',
        value: Number(sla[1]),
        confidence: 0.8,
        excerpt: line,
      });
    }

    if (INJECTION_PATTERNS.some((re) => re.test(line))) {
      flags.push({ kind: 'instruction-injection', excerpt: line, severity: 'high' });
    }
  }

  return { facts, flags };
}

const TARIFF_ROW =
  /([\u0590-\u05FFa-zA-Z0-9 "'\-]{3,})\s*\|\s*(\d[\d,]*)\s*\|\s*(\d{1,2})%/u;

/** Reads the tariff table format from the fee spreadsheet fixture. */
export function extractTariff(text: string) {
  const rows: { category: string; annualFeeIls: number; discountPercent: number }[] = [];
  for (const line of text.split('\n')) {
    const m = TARIFF_ROW.exec(line.trim());
    if (m) {
      rows.push({
        category: m[1].trim(),
        annualFeeIls: Number(m[2].replace(/,/g, '')),
        discountPercent: Number(m[3]),
      });
    }
  }
  return rows;
}

export function runLocalModel(role: string, system: string, user: string): string {
  switch (role) {
    case 'extraction': {
      const result = extractFromText(user);
      if (/תעריף|tariff/i.test(system + user)) {
        const tariff = extractTariff(user);
        if (tariff.length) {
          return JSON.stringify({
            facts: [
              ...result.facts,
              ...tariff.map((t) => ({
                property: 'tariffRow',
                value: t.annualFeeIls,
                confidence: 0.85,
                excerpt: `${t.category} | ${t.annualFeeIls} | ${t.discountPercent}%`,
              })),
            ],
            flags: result.flags,
          });
        }
      }
      return JSON.stringify(result);
    }
    case 'answer-writing': {
      return JSON.stringify({
        answer: 'Local model: see the evidence listed alongside this draft.',
        confidence: 0.5,
      });
    }
    case 'interviewing': {
      return JSON.stringify({ questions: [] });
    }
    default:
      return JSON.stringify({ note: 'no local behaviour for role ' + role });
  }
}
