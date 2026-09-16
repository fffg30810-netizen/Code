"""
Unisce le animazioni Mixamo (o Meshy/Tripo) in un unico GLB pronto per l'app.

Uso (da terminale, senza aprire Blender):
  blender -b -P tools/blender_export.py -- \
      --base  raw/malenia_rigged.fbx \
      --anim  Idle=raw/anim/idle.fbx Walk=raw/anim/walk.fbx Attack1=raw/anim/slash.fbx \
              Attack2=raw/anim/spin.fbx Hit=raw/anim/hit.fbx Death=raw/anim/death.fbx \
      --out   public/models/malenia.glb [--height 1.0]

Cosa fa:
  1. importa il modello riggato (FBX "with skin" da Mixamo, oppure GLB/FBX da Meshy/Tripo);
  2. importa ogni FBX di animazione ("without skin"), copia l'azione sull'armatura del modello
     e la rinomina con il nome scelto (Idle, Walk, Attack1, Attack2, Hit, Death, Victory);
  3. impila le azioni come strip NLA (così finiscono tutte nel GLB come clip separate);
  4. esporta un GLB con animazioni, texture incluse, Y-up.

Le clip vengono riconosciute dall'app con questi nomi (vedi public/bosses.json → defaults.clips).
"""
import sys
import argparse
import bpy


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--base", required=True, help="modello riggato (fbx/glb/gltf)")
    p.add_argument("--anim", nargs="*", default=[], help="Nome=percorso.fbx ...")
    p.add_argument("--out", required=True, help="GLB di output")
    p.add_argument("--height", type=float, default=None, help="altezza finale in metri (opzionale)")
    return p.parse_args(argv)


def import_any(path):
    before = set(bpy.data.objects)
    low = path.lower()
    if low.endswith(".fbx"):
        bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=True, ignore_leaf_bones=True)
    elif low.endswith((".glb", ".gltf")):
        bpy.ops.import_scene.gltf(filepath=path)
    elif low.endswith(".obj"):
        bpy.ops.wm.obj_import(filepath=path)
    else:
        raise SystemExit(f"Formato non supportato: {path}")
    return [o for o in bpy.data.objects if o not in before]


def find_armature(objs):
    for o in objs:
        if o.type == "ARMATURE":
            return o
    return None


def main():
    a = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)

    base_objs = import_any(a.base)
    arm = find_armature(base_objs)
    if arm is None:
        raise SystemExit("Nessuna armatura nel modello base: rigga il modello (Mixamo / Meshy Auto-Rig) prima.")

    # Rinomina l'eventuale azione già presente
    if arm.animation_data and arm.animation_data.action:
        arm.animation_data.action.name = "Idle" if "Idle" not in [x.split("=")[0] for x in a.anim] else "Base"

    actions = {}
    for spec in a.anim:
        if "=" not in spec:
            raise SystemExit(f"Formato --anim errato: {spec} (usa Nome=file.fbx)")
        name, path = spec.split("=", 1)
        objs = import_any(path)
        src_arm = find_armature(objs)
        if src_arm is None or not src_arm.animation_data or not src_arm.animation_data.action:
            print(f"⚠ nessuna azione trovata in {path}, salto")
            continue
        act = src_arm.animation_data.action
        act.name = name
        act.use_fake_user = True
        actions[name] = act
        # elimina gli oggetti importati per l'animazione (teniamo solo l'azione)
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)
        print(f"✓ {name}: {act.frame_range[0]:.0f}-{act.frame_range[1]:.0f} frame")

    if arm.animation_data is None:
        arm.animation_data_create()
    if arm.animation_data.action and arm.animation_data.action.name not in actions:
        actions[arm.animation_data.action.name] = arm.animation_data.action
    arm.animation_data.action = None

    # Una strip NLA per azione → l'esportatore glTF crea una clip per strip
    for track in list(arm.animation_data.nla_tracks):
        arm.animation_data.nla_tracks.remove(track)
    for name, act in actions.items():
        track = arm.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, int(act.frame_range[0]), act)
        strip.name = name
        track.mute = False

    # Scala all'altezza richiesta (opzionale): l'app normalizza comunque l'altezza a runtime
    if a.height:
        bpy.ops.object.select_all(action="DESELECT")
        for o in base_objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = arm
        import mathutils
        zs = []
        for o in base_objs:
            if o.type == "MESH":
                for v in o.bound_box:
                    zs.append((o.matrix_world @ mathutils.Vector(v)).z)
        cur = (max(zs) - min(zs)) if zs else 0
        if cur > 0:
            f = a.height / cur
            for o in base_objs:
                if o.parent is None:
                    o.scale *= f
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=a.out,
        export_format="GLB",
        export_animations=True,
        export_nla_strips=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_skins=True,
        export_image_format="AUTO",
        export_anim_single_armature=True,
        export_optimize_animation_size=True,
    )
    print(f"\n✓ Esportato {a.out} con clip: {', '.join(actions.keys())}")


if __name__ == "__main__":
    main()
