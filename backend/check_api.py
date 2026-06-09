import urllib.request, json, sys
sys.stdout.reconfigure(encoding='utf-8')

req = urllib.request.Request(
    'https://api.football-data.org/v4/competitions/2000/teams',
    headers={'X-Auth-Token': 'bdd0e2ba30bd4368a5591ea1f1696067'}
)
with urllib.request.urlopen(req, timeout=15) as r:
    data = json.loads(r.read().decode('utf-8'))

comp = data.get('competition', {})
season = data.get('season', {})
teams = data.get('teams', [])

print(f"Competicion: {comp.get('name')}")
print(f"Temporada:   {season.get('startDate')} -> {season.get('endDate')}")
print(f"Equipos:     {len(teams)}")
print()

for team in teams[:6]:
    squad = team.get('squad', [])
    print(f"{team['name']}: {len(squad)} jugadores")
    for p in squad[:3]:
        dob = p.get('dateOfBirth', '?')[:4]
        print(f"   - {p['name']} ({p.get('position','?')}, {dob})")
    print()
