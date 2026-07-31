#!/usr/bin/env python3
"""Full harvest of every phone number across the provider corpus. Resumable:
the container restarted mid-run once and lost 20 minutes of reads, so ids and
partial results are checkpointed to disk after every chunk."""
import json, os, re, subprocess, datetime
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor

ENV = dict(os.environ, GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE='/root/.config/gws/accounts/5311386k.json')
HERE = os.path.dirname(os.path.abspath(__file__))
IDS, PART = HERE + '/harvest_ids.json', HERE + '/harvest_part.json'
gws = lambda a: subprocess.run(['gws', *a], capture_output=True, text=True, env=ENV).stdout

Q = ('from:lebara.com OR from:lebara.co.uk OR from:1pmobile.com OR from:usmobile.com '
     'OR from:smarty.co.uk OR from:tello.com OR from:three.co.uk OR from:mobile.asda.com')

if os.path.exists(IDS):
    ids = json.load(open(IDS))
else:
    ids, tok = [], None
    while True:
        p = {'userId': 'me', 'q': Q, 'maxResults': 500}
        if tok:
            p['pageToken'] = tok
        try:
            d = json.loads(gws(['gmail', 'users', 'messages', 'list', '--params', json.dumps(p)]))
        except Exception:
            break
        ids += [m['id'] for m in d.get('messages', [])]
        tok = d.get('nextPageToken')
        print(f'  listing… {len(ids)}', flush=True)
        if not tok:
            break
    json.dump(ids, open(IDS, 'w'))
print(f'{len(ids)} messages to read', flush=True)

state = json.load(open(PART)) if os.path.exists(PART) else {'done': [], 'hits': []}
done = set(state['done'])
hits = state['hits']                      # [number, ts, provider]
todo = [i for i in ids if i not in done]
print(f'{len(todo)} still to read ({len(done)} already done)', flush=True)

NUM = re.compile(r'\b(0?7\d{9})\b')

def msg(mid):
    try:
        d = json.loads(gws(['gmail', 'users', 'messages', 'get', '--params', json.dumps({
            'userId': 'me', 'id': mid, 'format': 'metadata',
            'metadataHeaders': ['Subject', 'From']})]))
    except Exception:
        return mid, []
    h = {x['name']: x.get('value', '') for x in d.get('payload', {}).get('headers', [])}
    frm, ts = h.get('From', ''), int(d.get('internalDate', 0) or 0)
    prov = ('lebara' if 'lebara' in frm else '1pmobile' if '1pmobile' in frm
            else 'usmobile' if 'usmobile' in frm else 'other')
    blob = h.get('Subject', '') + ' ' + d.get('snippet', '')
    out = []
    for n in set(NUM.findall(blob)):
        out.append([n if n.startswith('0') else '0' + n, ts, prov])
    return mid, out

CHUNK = 1500
for s in range(0, len(todo), CHUNK):
    batch = todo[s:s + CHUNK]
    with ThreadPoolExecutor(16) as ex:
        for mid, found in ex.map(msg, batch):
            done.add(mid)
            hits += found
    json.dump({'done': list(done), 'hits': hits}, open(PART, 'w'))
    print(f'  {len(done)}/{len(ids)} read … {len({h[0] for h in hits})} distinct numbers', flush=True)

seen, first, last, kind = Counter(), {}, {}, defaultdict(Counter)
for n, ts, prov in hits:
    seen[n] += 1
    kind[n][prov] += 1
    if n not in first or ts < first[n]:
        first[n] = ts
    if n not in last or ts > last[n]:
        last[n] = ts
fmt = lambda t: datetime.datetime.utcfromtimestamp(t / 1000).strftime('%Y-%m-%d') if t else ''
rows = [{'number': n, 'messages': c, 'first_seen': fmt(first[n]), 'last_seen': fmt(last[n]),
         'provider': kind[n].most_common(1)[0][0]} for n, c in seen.most_common()]
json.dump(rows, open(HERE + '/numbers.json', 'w'), indent=1)
print(f'\nDISTINCT NUMBERS: {len(rows)}')
print('by provider:', Counter(r['provider'] for r in rows).most_common())
print('last seen by year:', sorted(Counter(r['last_seen'][:4] for r in rows).items()))
