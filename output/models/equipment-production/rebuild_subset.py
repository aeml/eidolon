from pathlib import Path
exec(compile((Path(__file__).resolve().parents[3] / 'output/models/equipment-production/armor.py').read_text(),'armor.py','exec'))
def rebuild_subset(CLASS,slots):
    fit=Fit(CLASS);gear=bpy.data.collections['EQUIPMENT | individual fitted pieces'];report_path=WORK/(CLASS.lower()+'-report.json');reports=json.loads(report_path.read_text())
    for item in json.loads((WORK/'inventory.json').read_text())['items']:
        if item['slot'] not in slots:continue
        for tier in ['standard','legendary']:
            name=item['id']+'__'+tier+'__'+CLASS;old=bpy.data.objects.get(name)
            if old:bpy.data.objects.remove(old,do_unlink=True)
            ob=build_item(fit,item,tier)
            for col in list(ob.users_collection):col.objects.unlink(ob)
            gear.objects.link(ob);stats=export_mesh(ob,DEST/'fits'/CLASS/(item['id']+'-'+tier+'.glb'),fit.rig)
            for report in reports:
                if report['id']==item['id'] and report['tier']==tier:report.update(stats,maximumInfluences=max(len(v.groups) for v in ob.data.vertices))
            ob.hide_set(True);ob.hide_render=True
    report_path.write_text(json.dumps(reports,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(WORK/(CLASS.lower()+'-equipment.blend')),compress=True)
