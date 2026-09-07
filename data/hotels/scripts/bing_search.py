#!/usr/bin/env python3
"""Minimal Bing web search via plain HTTP (used to find official websites and Agoda listing URLs). Usage: bing_search.py "<query>" [max]"""
import sys, re, html, urllib.request, urllib.parse, json, time
def search(q, n=10):
    url = 'https://www.bing.com/search?' + urllib.parse.urlencode({'q': q, 'setlang': 'it', 'cc': 'IT', 'count': n})
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36', 'Accept-Language': 'it-IT,it;q=0.9'})
    h = urllib.request.urlopen(req, timeout=40).read().decode('utf-8', 'replace')
    out = []
    for m in re.finditer(r'<li class="b_algo".*?</li>', h, re.S):
        blk = m.group(0)
        a = re.search(r'<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', blk, re.S)
        if not a: continue
        title = html.unescape(re.sub(r'<[^>]+>', '', a.group(2)))
        href = html.unescape(a.group(1))
        um = re.search(r'[&?]u=a1([A-Za-z0-9_-]+)', href)
        if um:
            import base64
            b = um.group(1); b += '=' * (-len(b) % 4)
            try: href = base64.urlsafe_b64decode(b).decode('utf-8', 'replace')
            except Exception: pass
        snip = re.search(r'<p[^>]*>(.*?)</p>', blk, re.S)
        out.append({'url': href, 'title': title, 'snippet': html.unescape(re.sub(r'<[^>]+>', '', snip.group(1)))[:200] if snip else ''})
    return out
if __name__ == '__main__':
    res = search(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 10)
    print(json.dumps(res, ensure_ascii=False, indent=1))
