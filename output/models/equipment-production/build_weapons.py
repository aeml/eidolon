from pathlib import Path
exec(compile((Path(__file__).resolve().parents[3] / 'output/models/equipment-production/weapons.py').read_text(),'weapons.py','exec'))
result=build_weapons()
print(result,flush=True)
