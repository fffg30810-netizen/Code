import requests, json, time, os, sys, datetime
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
H={"User-Agent":UA,"Accept":"application/json","Accept-Language":"it-IT,it;q=0.9,en;q=0.8"}
RAW="data/flights/raw"
os.makedirs(RAW,exist_ok=True)
log=[]
def get(url,fn):
    t=datetime.datetime.utcnow().isoformat()+"Z"
    try:
        r=requests.get(url,headers=H,timeout=30)
        code=r.status_code; body=r.text
    except Exception as e:
        code="ERR"; body=str(e)
    with open(fn,"w") as f: f.write(body)
    log.append({"url":url,"file":fn,"status":code,"fetched_at":t,"bytes":len(body)})
    print(code,fn,len(body),flush=True)
    time.sleep(0.8)
pairs=[("REG","FCO"),("FCO","REG"),("CTA","FCO"),("FCO","CTA"),("CTA","CIA"),("CIA","CTA"),("REG","CIA"),("CIA","REG")]
for a,b in pairs:
    for m in ["2026-09-01","2026-10-01","2026-11-01","2026-12-01"]:
        get(f"https://www.ryanair.com/api/farfnd/v4/oneWayFares/{a}/{b}/cheapestPerDay?outboundMonthOfDate={m}&currency=EUR",f"{RAW}/ryanair_{a}_{b}_{m[:7]}.json")
for ap in ["REG","CTA","FCO","CIA"]:
    get(f"https://www.ryanair.com/api/views/locate/searchWidget/routes/en/airport/{ap}",f"{RAW}/ryanair_routes_{ap}.json")
# round trip finder
for a,b in [("REG","FCO"),("CTA","FCO"),("CTA","CIA"),("REG","CIA")]:
    for d in [(2,2),(3,3)]:
        get(f"https://www.ryanair.com/api/farfnd/v4/roundTripFares?departureAirportIataCode={a}&arrivalAirportIataCode={b}&outboundDepartureDateFrom=2026-09-25&outboundDepartureDateTo=2026-11-30&inboundDepartureDateFrom=2026-09-27&inboundDepartureDateTo=2026-12-03&durationFrom={d[0]}&durationTo={d[1]}&currency=EUR&market=it-it&adultPaxCount=1&limit=200",f"{RAW}/ryanair_roundtrip_{a}_{b}_dur{d[0]}.json")
json.dump(log,open(f"{RAW}/ryanair_fetch_log.json","w"),indent=1)
