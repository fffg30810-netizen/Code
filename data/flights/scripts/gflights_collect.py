import os, json, time, datetime, requests, sys, dataclasses
from fast_flights import FlightQuery, Passengers, create_query
from fast_flights.parser import parse as _parse_strict, _parse_time
from fast_flights import parser as _fp
from fast_flights.exceptions import FlightsNotFound
from selectolax.lexbor import LexborHTMLParser
def parse(html):
    """Lenient copy of fast_flights.parser.parse: skips itineraries the strict parser chokes on (e.g. no price)."""
    try:
        return _parse_strict(html)
    except FlightsNotFound: raise
    except Exception:
        pass
    p = LexborHTMLParser(html)
    js = None
    for script in p.css("script"):
        t = script.text() or ""
        if "data:" in t and "errorHasStatus" in t or (t.startswith("AF_initDataCallback") and "data:" in t):
            js = t
    if js is None:
        for script in p.css("script"):
            t = script.text() or ""
            if "data:" in t and "AF_initDataCallback" in t: js = t
    data = js.split("data:", 1)[1].rsplit(",", 1)[0]
    if data.endswith("errorHasStatus: true"): raise FlightsNotFound("no flights found; received error")
    payload = json.loads(data)
    out = []
    for k in ((payload[3] or [None])[0] or []):
        try:
            flight = k[0]
            price = k[1][0][1] if (k[1] and k[1][0]) else None
            segs = []
            for sf in flight[2]:
                segs.append(dict(from_airport=dict(code=sf[3], name=sf[4]), to_airport=dict(code=sf[6], name=sf[5]),
                                 departure=dict(date=tuple(sf[20]) if sf[20] else None, time=_parse_time(sf[8])),
                                 arrival=dict(date=tuple(sf[21]) if sf[21] else None, time=_parse_time(sf[10])), duration=sf[11], plane_type=sf[17]))
            out.append(dict(type=flight[0], price=price, airlines=flight[1], flights=segs, carbon=None, lenient=True))
        except Exception as e:
            out.append(dict(type="parse_failed", price=None, airlines=[], flights=[], error=repr(e)[:100], lenient=True))
    return out
RAW="data/flights/raw"; os.makedirs(RAW, exist_ok=True)
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
S=requests.Session(); S.headers.update({"User-Agent":UA,"Accept-Language":"it-IT,it;q=0.9,en;q=0.8"})
def todict(o):
    if dataclasses.is_dataclass(o): return {k: todict(v) for k,v in dataclasses.asdict(o).items()}
    if isinstance(o,(list,tuple)): return [todict(x) for x in o]
    return o
pairs=sys.argv[1].split(',')
d0=datetime.date(2026,9,25); d1=datetime.date(2026,12,3)
if len(sys.argv)>2: d0=datetime.date.fromisoformat(sys.argv[2]); d1=datetime.date.fromisoformat(sys.argv[3])
log=open(f"{RAW}/gflights_fetch_log.jsonl","a")
for pr in pairs:
    o,d=pr.split('-')
    day=d0
    while day<=d1:
        ds=day.isoformat(); fn=f"{RAW}/gflights_{o}_{d}_{ds}.json"
        if os.path.exists(fn): day+=datetime.timedelta(days=1); continue
        q=create_query(flights=[FlightQuery(date=ds, from_airport=o, to_airport=d)], trip="one-way", passengers=Passengers(adults=1), currency="EUR", language="it")
        url="https://www.google.com/travel/flights?"+"&".join(f"{k}={v}" for k,v in q.params().items())
        t=datetime.datetime.utcnow().isoformat()+"Z"; rec={"route":pr,"date":ds,"url":url,"fetched_at":t}
        for attempt in range(3):
            try:
                r=S.get("https://www.google.com/travel/flights", params=q.params(), timeout=60)
                rec["status"]=r.status_code
                if r.status_code!=200: raise Exception(f"http {r.status_code}")
                try:
                    res=parse(r.text); items=[todict(x) if dataclasses.is_dataclass(x) else x for x in res]; rec["n"]=len(items); err=None
                except Exception as e:
                    items=[]; err=repr(e)[:200]; rec["parse_error"]=err
                    pass
                json.dump({"route":pr,"date":ds,"source_url":url,"fetched_at":t,"http_status":r.status_code,"parse_error":err,"flights":items}, open(fn,"w"), indent=1)
                break
            except Exception as e:
                rec["error"]=repr(e)[:200]; time.sleep(3*(attempt+1))
        log.write(json.dumps(rec)+"\n"); log.flush(); print(rec, flush=True)
        time.sleep(float(os.environ.get("GF_DELAY","1.2"))); day+=datetime.timedelta(days=1)
