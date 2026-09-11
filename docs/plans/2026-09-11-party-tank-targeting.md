# Party tank pointer acquisition — native QA, not a runtime balance change

The failed four-role run70393 ended with Rogue death against Rootbound Warden.
Repeated184damage hits at7.4584units without an active warning are consistent
with the scale4boss's7.5-unit normal melee reach. Server AI chooses the highest
decayed valid threat before nearest-player fallback. Neither fact proves that
threat generation is balanced or that the earlier tank inputs hit correctly.

Source inspection found an asymmetric input witness: damage roles acquire an
exposed point on the intended hostile's actual hitbox, but the tank clicked the
projected center without checking hover. Another party member can cover that
point. Whirlwind can still deal radial damage while a directional Shield Slam
aimed at a different actor fails to hit the intended boss. This is a plausible
failure path, not a claimed diagnosis of every hit in70393.

The party tank now uses the same bounded six-point hover acquisition as damage
roles and clicks the acquired point, not the original center. It rechecks hover
before Charge and hotbar inputs. Recent tank inputs retain actual hover, pending
target, distance, basic range and movement destination for native diagnosis.
Solo input behavior, skill priority, fixture gear/level, deadlines, collision
rules, four-alive/full-clear/individual-credit/manual-turn-in/save gates remain
unchanged. No gameplay state, damage, threat, health, mana or boss rule changes.

Four focused suites119tests passed0.624s plus full lint (22343exit0). Tests verify
that a Cleric covering the center results in the exposed boss point, complete
occlusion returns no attack point after bounded search, offscreen targets and
projection errors cannot manufacture acquisition, and solo aiming stays intact.
Logs `/tmp/eidolon-party-tank-target-{focused,lint}-20260911.log`.

Full integration and the next native four-role run remain required. This work
is in the primary development branch, excluded from the frozen1.0.63release.
