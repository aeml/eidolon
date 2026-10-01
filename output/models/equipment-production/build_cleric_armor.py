from pathlib import Path
exec(compile((Path(__file__).resolve().parents[3] / 'output/models/equipment-production/armor.py').read_text(),'armor.py','exec'))
print(build_armor('Cleric'),flush=True)
