"""Extract the bounded L2 case-study sample. No database access."""
import argparse
import csv
import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'sample'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path, help='directory containing the original CSV files')
    parser.add_argument('--output', type=Path, default=OUT / 'l2_seed_sample.json')
    args = parser.parse_args()

    def read(name):
        with (args.source / name).open(encoding='utf-8-sig', newline='') as f:
            return list(csv.DictReader(f))

    def date(value):
        if not value:
            return None
        return datetime.fromisoformat(value).strftime('%Y-%m-%dT%H:%M:%S+07:00')

    def phone(value):
        value = re.sub(r'[\s.\-()]', '', value.strip())
        if value.startswith('+84'):
            value = '0' + value[3:]
        elif value.startswith('84') and len(value) == 11:
            value = '0' + value[2:]
        return value

    tickets = read('tickets_history.csv')
    customers = {x['record_id']: x for x in read('customers_raw.csv')}
    products = {x['product_id']: x for x in read('products.csv')}
    logs = defaultdict(list)
    for row in read('ticket_status_log.csv'):
        logs[row['ticket_id']].append(row)
    for rows in logs.values():
        rows.sort(key=lambda x: (x['changed_at'], x['log_id']))
    manifest = json.loads((OUT / 'l2_legacy_ids.json').read_text(encoding='utf-8'))
    by_code = {x['ticket_code']: x for x in tickets}
    selected = [by_code[x['ticket_code']] for x in manifest['tickets']]
    selected_codes = {x['ticket_code'] for x in selected}
    chosen_customers = {x['customer_id'] for x in selected}
    used_phones = {phone(customers[x]['so_dien_thoai']) for x in chosen_customers}
    used_serials = {x['serial_no'].upper() for x in selected}
    log_count = sum(len(logs[x['ticket_id']]) for x in selected)
    # Prefer repeated customers, then new customers; favor short genuine histories.
    for existing_only in (True, False):
        for t in sorted(tickets, key=lambda x: (len(logs[x['ticket_id']]), x['ticket_id'])):
            if len(selected) >= 50:
                break
            c = customers.get(t['customer_id'])
            p = phone(c['so_dien_thoai']) if c else ''
            is_existing = t['customer_id'] in chosen_customers
            if (t['ticket_code'] in selected_codes or not c or not c['ho_ten'].strip()
                or not re.fullmatch(r'0\d{9}', p) or (not is_existing and p in used_phones)
                or (existing_only and not is_existing) or len(chosen_customers) >= 50 and not is_existing
                or not t['serial_no'] or t['serial_no'].upper() in used_serials
                or t['product_id'] not in products or not logs[t['ticket_id']]
                or log_count + len(logs[t['ticket_id']]) > 200):
                continue
            selected.append(t)
            selected_codes.add(t['ticket_code'])
            chosen_customers.add(t['customer_id'])
            used_phones.add(p)
            used_serials.add(t['serial_no'].upper())
            log_count += len(logs[t['ticket_id']])
    if not (50 <= len(selected) <= 100 and 30 <= len(chosen_customers) <= 50 and 100 <= log_count <= 200):
        raise ValueError('Source selection does not satisfy scope')

    legacy = {x['ticket_code']: x for x in manifest['tickets']}
    legacy_logs = {str(x['source_log_id']): x['log_id'] for x in manifest['logs']}
    customer_ids = {by_code[x['ticket_code']]['customer_id']: x['customer_id'] for x in manifest['tickets']}
    result = {'source': 'CDTN1_Mekong Mobile_Dataset Smart CRM/dataset',
              'note': 'Source tickets and complete source status histories; see README.md for transformations.',
              'customers': [], 'devices': [], 'tickets': [], 'status_logs': []}
    emitted = set()
    for t in selected:
        c, p = customers[t['customer_id']], products[t['product_id']]
        old = legacy.get(t['ticket_code'], {})
        cid = customer_ids.setdefault(t['customer_id'], 'SRC-CUS-' + t['customer_id'])
        did = old.get('device_id', 'SRC-DEV-' + t['ticket_id'])
        tid = old.get('ticket_id', 'SRC-TCK-' + t['ticket_id'])
        if cid not in emitted:
            result['customers'].append({'customer_id': cid, 'full_name': c['ho_ten'].strip(),
                'phone': phone(c['so_dien_thoai']), 'email': c['email'].strip() or None,
                'address': c['dia_chi'].strip(), 'segment': 'THUONG',
                'created_at': c['ngay_tao'] or date(t['received_at']), 'is_deleted': False})
            emitted.add(cid)
        result['devices'].append({'device_id': did, 'customer_id': cid, 'product_id': int(p['product_id']),
            'product_code': p['product_code'], 'product_name': p['product_name'], 'serial_no': t['serial_no'],
            'purchase_date': None, 'warranty_months': int(p['warranty_months']), 'is_deleted': False})
        warranty = {'true': True, 'false': False, '': None}[t['is_warranty'].strip().lower()]
        result['tickets'].append({'ticket_id': tid, 'ticket_code': t['ticket_code'], 'customer_id': cid,
            'device_id': did, 'center_id': t['center_id'], 'category_id': t['category_id'],
            'issue_desc': t['issue_desc'].strip(), 'accessories': [], 'exterior_note': '',
            'priority': t['priority'], 'priority_reason': '', 'status': t['status'], 'is_warranty': warranty,
            'received_at': date(t['received_at']), 'due_date': date(t['due_date']),
            'closed_at': date(t['closed_at']), 'is_deleted': False})
        for log in logs[t['ticket_id']]:
            result['status_logs'].append({'log_id': legacy_logs.get(log['log_id'], 'SRC-LOG-' + log['log_id']),
                'ticket_id': tid, 'from_status': log['from_status'].strip() or None, 'to_status': log['to_status'],
                'changed_at': date(log['changed_at']), 'changed_by': 'NV_' + log['changed_by'] if log['changed_by'].strip() else 'SYSTEM',
                'note': log['note'].strip()})
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('customers={}, devices={}, tickets={}, logs={}'.format(*(len(result[k]) for k in ('customers','devices','tickets','status_logs'))))


if __name__ == '__main__':
    main()
