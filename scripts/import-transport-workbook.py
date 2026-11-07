"""Read the council workbook without changing it; import aggregate schedule fields only."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as E
from zipfile import ZipFile

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי']
# Only public place labels cross into the demo. Some structured cells also
# contain personal names; retain their source locator, not their text.
PUBLIC_STOPS = set('אבני איתן|אבני איתן ת"ת|אודם|אוהלו בתחנה על הכביש|אורטל|אל רום|אלוני הבשן|אליעד|אמיר|אניעם|אפיק|בני יהודה|בני יהודה – ישנה חדשה|בני יהודה – ישנה חדשה תחנה לכיוון גשור|ברנקו וייס רמות|גבעת יואב|גבעת יואב – מתנס מזכירות|גבעת יואב – מתנס מזכירות – ברנקו וייס רמות|גנים דרום הגולן|גשור|דימוקרטי אליעד|חד נס|חיספין|יונתן|כנף|כפר חרוב|כפר חרוב – הרחבה מזכירות|כפר חרוב – הרחבה מרכז|לקצרין|מבא חמה|מבוא חמה|מיצר|מעלה גמלא|מרום גולן|נאות גולן|נוב|נופי גולן|נטור|נטור אפיק|נטור רמגש|עין זיוון|קדמת צבי|קדמת צבי – הרחבה ישוב|קלע אלון|קצרין|קצרין הורדה בטרמפידה|קשת|רמות|רמת טראמפ|רמת מגשימים|שעל|שעל מיניבוס'.split('|'))

def read_sheets(path):
    with ZipFile(path) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(t.text or '' for t in si.findall('.//s:t', NS)) for si in E.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        book = E.fromstring(archive.read('xl/workbook.xml'))
        relations = {r.attrib['Id']: r.attrib['Target'] for r in E.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        result = {}
        # Deliberately exclude free-text notes, hidden archives, names and phones.
        for sheet in book.findall('s:sheets/s:sheet', NS):
            if sheet.attrib['name'] not in ['סידור נסיעות', 'ראשון']:
                continue
            target = relations[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
            target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            rows = []
            for row in E.fromstring(archive.read(target)).findall('s:sheetData/s:row', NS):
                values = {}
                for cell in row.findall('s:c', NS):
                    value = cell.find('s:v', NS)
                    text = value.text if value is not None else ''
                    if cell.attrib.get('t') == 's' and text:
                        text = strings[int(text)]
                    if cell.attrib.get('t') == 'inlineStr':
                        text = ''.join(t.text or '' for t in cell.findall('.//s:t', NS))
                    if text:
                        values[re.sub(r'\d', '', cell.attrib['r'])] = text
                rows.append((int(row.attrib['r']), values))
            result[sheet.attrib['name']] = rows
        return result

def number(value):
    try:
        n = float(value)
        return int(n) if n.is_integer() and n >= 0 else None
    except (ValueError, TypeError):
        return None

def time_text(value):
    try:
        n = float(value)
        if not 0 <= n < 1:
            return None
        minute = round(n * 1440)
        return f'{minute // 60:02d}:{minute % 60:02d}'
    except (ValueError, TypeError):
        return value.strip() if value and re.fullmatch(r'\d{1,2}:\d\d', value.strip()) else None

def extract(path):
    sheets = read_sheets(path)
    rows = sheets['סידור נסיעות']
    assert rows[0][1].get('A') == 'יום' and rows[0][1].get('G') == 'סה"כ ילדים', 'Unexpected source columns'
    triples = [('J','K','L'),('M','N','O'),('P','Q','R'),('S','T','U'),('V','W','X'),('Y','Z','AA'),('AB','AC','AD'),('AE','AF','AG'),('AH','AI','AJ'),('AK','AL','AM')]
    trips = []
    for row, cells in rows[1:]:
        if cells.get('A') not in DAYS:
            continue
        code, trip_number = str(cells.get('B', '')).strip(), str(cells.get('C', '')).strip()
        stops = [{'id': f'stop-{i+1}', 'name': cells[n].strip(), 'time': time_text(cells.get(t)), 'planned': number(cells.get(c)), 'sourceRange': f'{t}{row}:{c}{row}'} for i,(t,n,c) in enumerate(triples) if cells.get(n, '').strip()]
        reasons = []
        for stop in stops:
            if stop['name'] not in PUBLIC_STOPS:
                stop['name'] = 'תחנה לבירור'
                reasons.append('שם תחנה דורש בירור')
        if cells.get('AO'):
            reasons.append('המקור מסומן לבדיקה')
        if not time_text(cells.get('E')):
            reasons.append('חסרה שעת יציאה תקינה')
        if not stops or any(s['planned'] is None for s in stops):
            reasons.append('מספר התלמידים בתחנה אינו מאומת')
        total = number(cells.get('G'))
        if total is None or (all(s['planned'] is not None for s in stops) and total != sum(s['planned'] for s in stops)):
            reasons.append('סכום התחנות דורש התאמה למקור')
        trips.append({'id': f'trip-{DAYS.index(cells["A"])}-{code}-{trip_number}', 'weekday': DAYS.index(cells['A']), 'routeCode': code, 'number': trip_number, 'direction': 'morning' if cells.get('D','').startswith('בוקר') else 'afternoon', 'departure': time_text(cells.get('E')), 'school': cells.get('F','').strip(), 'planned': total, 'stops': stops, 'reviewReasons': reasons, 'source': {'sheet': 'סידור נסיעות', 'row': row, 'range': f'A{row}:AM{row}'}})
    assert len({t['id'] for t in trips}) == len(trips), 'Duplicate day/code/trip identity'
    sunday = dict(sheets['ראשון']); capacities = {}
    for column, label in sunday.get(5, {}).items():
        code = re.search(r'קוד\s*סידור\s*(\d+)', label)
        seats = re.search(r'אוטובוס\s*(\d+)', sunday.get(2, {}).get(column,''))
        if code and seats:
            capacities[code.group(1)] = {'seats': int(seats.group(1)), 'source': f'ראשון!{column}2'}
    return {'source': {'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'sheet': 'סידור נסיעות', 'range': f'A2:AM{max(r for r,_ in rows)}', 'weekTrips': len(trips), 'days': {day: sum(t['weekday']==i for t in trips) for i,day in enumerate(DAYS)}, 'sourceFlagged': sum(bool(c.get('AO')) for _,c in rows[1:]), 'reviewTrips': sum(bool(t['reviewReasons']) for t in trips), 'privacy': 'Aggregate schedules only; no student names, contact details or legacy notes imported.'}, 'capacities': capacities, 'trips': trips}

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('source',type=Path);parser.add_argument('--output',type=Path,default=Path('src/transport/schedule.json'));args=parser.parse_args()
    output=extract(args.source);args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'weeklyTrips':len(output['trips']),'days':output['source']['days'],'sourceReview':output['source']['sourceFlagged'],'capacityMappings':output['capacities']},ensure_ascii=False))
