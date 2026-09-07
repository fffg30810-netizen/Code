import csv, json, os, time, datetime, requests, dataclasses
from fast_flights import FlightQuery, Passengers, create_query
from fast_flights.parser import parse
RAW="data/flights/raw"
rt=list(csv.DictReader(open('data/flights/round_trips.csv'))); rt.sort(key=lambda r:(float(r['total_eur']), r['out_date']))
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
S=requests.Session(); S.headers.update({"User-Agent":UA,"Accept-Language":"it-IT,it;q=0.9"})
out=[]
for r in rt[:5]:
    o,d=r['pair'].split('-')
    q=create_query(flights=[FlightQuery(date=r['out_date'], from_airport=o, to_airport=d), FlightQuery(date=r['ret_date'], from_airport=d, to_airport=o)], trip="round-trip", passengers=Passengers(adults=1), currency="EUR", language="it")
    url="https://www.google.com/travel/flights?"+"&".join(f"{k}={v}" for k,v in q.params().items())
    rec={"pair":r['pair'],"out_date":r['out_date'],"ret_date":r['ret_date'],"our_total":r['total_eur'],"url":url,"fetched_at":datetime.datetime.utcnow().isoformat()+"Z"}
    try:
        resp=S.get("https://www.google.com/travel/flights", params=q.params(), timeout=60); rec["status"]=resp.status_code
        res=parse(resp.text); items=[dataclasses.asdict(x) for x in res]
        direct=[x for x in items if x.get('price') is not None]
        if direct:
            b=min(direct,key=lambda x:x['price']); rec["gf_price"]=b['price']; rec["gf_airlines"]=", ".join(b['airlines']); rec["gf_top"]=[{"price":x['price'],"airlines":x['airlines'],"dep":x['flights'][0]['departure'] if x['flights'] else None} for x in direct[:5]]
        else: rec["gf_price"]="no result"
    except Exception as e: rec["error"]=repr(e)[:200]
    print({k:v for k,v in rec.items() if k!='gf_top'}, flush=True); out.append(rec); time.sleep(1.5)
json.dump(out, open(f"{RAW}/gflights_roundtrip_check.json","w"), indent=1)
