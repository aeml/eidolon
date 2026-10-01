from pathlib import Path
exec(compile((Path(__file__).resolve().parents[3] / 'output/models/equipment-production/motion_v2.py').read_text(),'motion_v2.py','exec'))
import sys
for CLASS in (sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['Fighter','Wizard','Cleric','Rogue']):author(CLASS)
