#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 15043 近代史真题.apkg 转成课件用的 exam_data.js"""
import zipfile, sqlite3, tempfile, os, json, re, html, collections

SRC = r'C:/Users/Administrator/Desktop/15043近代史真题.apkg'
OUT = r'C:/Users/Administrator/WorkBuddy/2026-11-12-08-37-32/exam_data.js'

def clean(s):
    s = s or ''
    s = re.sub(r'<br\s*/?>', '\n', s, flags=re.I)
    s = re.sub(r'</(p|div|li|tr)>', '\n', s, flags=re.I)
    s = re.sub(r'<li[^>]*>', '· ', s, flags=re.I)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s).replace('\u00a0', ' ')
    s = re.sub(r'[ \t]+\n', '\n', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()

def strip_num(s):
    return re.sub(r'^\s*\d+\s*[.、．]\s*', '', s).strip()

z = zipfile.ZipFile(SRC); tmp = tempfile.mkdtemp(); z.extract('collection.anki21', tmp)
con = sqlite3.connect(os.path.join(tmp, 'collection.anki21')); cur = con.cursor()
models = json.loads(cur.execute('select models from col').fetchone()[0])
decks  = json.loads(cur.execute('select decks from col').fetchone()[0])
mc = [k for k, v in models.items() if 'Choice' in v['name']][0]
mt = [k for k, v in models.items() if 'Text' in v['name']][0]

rows = cur.execute('''select n.id, n.mid, n.flds, c.did from notes n join cards c on c.nid = n.id''').fetchall()
items = []
sessions = collections.defaultdict(list)

for nid, mid, flds, did in rows:
    key = decks[str(did)]['name'].split('::')[-1]
    f = flds.split('\x1f')
    q = strip_num(clean(f[0]))
    m = re.match(r'\s*(\d+)', f[0])
    num = int(m.group(1)) if m else 0
    if str(mid) == mc:
        opts = [clean(o) for o in f[1].split('||') if o.strip()]
        ans = int(re.sub(r'\D', '', f[2]) or 1) - 1
        exp = re.sub(r'^\s*解\s*析\s*[:：]\s*', '', clean(f[3]))
        it = {'id': len(items), 't': 'c', 's': key, 'n': num, 'q': q, 'o': opts, 'a': ans, 'e': exp}
    else:
        it = {'id': len(items), 't': 's', 's': key, 'n': num, 'q': q,
              'a': clean(f[1]), 'e': clean(f[3]) or clean(f[2])}
    items.append(it); sessions[key].append(it['id'])

def label(k):
    return '%s年%s月' % (k[:4], '上旬' if k[4:] in ('04', '05') else ('中旬' if k[4:] in ('10', '11') else k[4:]))

ses = []
for k in sorted(sessions):
    ses.append({'key': k, 'label': '%s年%d月' % (k[:4], int(k[4:6])),
                'ids': sessions[k]})

data = {'name': '15043 中国近现代史纲要 · 历年真题', 'sessions': ses, 'items': items}

# 补齐 apkg 里未带 Remarks 的大题解析，并清掉混进答案的试卷说明
try:
    from exam_explain import apply_explain
    n = apply_explain(items)
    print('补充详解', n, '条')
except Exception as ex:            # noqa: BLE001
    print('补充详解跳过：', ex)

js = 'window.EXAM_DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
with open(OUT, 'w', encoding='utf-8') as fp:
    fp.write(js)

print('items', len(items), 'sessions', len(ses), 'bytes', os.path.getsize(OUT))
print('choice', sum(1 for i in items if i['t'] == 'c'), 'text', sum(1 for i in items if i['t'] == 's'))
print('样例单选:', json.dumps(items[0], ensure_ascii=False)[:300])
print('样例题26:', json.dumps([i for i in items if i['t'] == 's'][0], ensure_ascii=False)[:300])
