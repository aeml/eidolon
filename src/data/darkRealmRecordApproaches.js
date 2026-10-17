// Public side streets lead to existing Chronicle records. These are visual
// approaches, not safe corridors, automatic navigation or new discoveries.
// Full widths clear current record/court colliders inside the walking union.
// Each street stops twelve metres on the open side of its existing record.
// No eligibility, rewards, collisions or saved locations change.
export const DARK_REALM_RECORD_APPROACHES = Object.freeze([
    {"id":"record-shelter_cups-approach","siteId":"dark_shelter_cups","width":4,"points":[[40000,40532],[40090,40532]],"streetId":"elin-approach"},
    {"id":"record-expedition_signal-approach","siteId":"dark_expedition_signal","width":4,"points":[[40000,40372],[40130,40372]],"streetId":"elin-approach"},
    {"id":"record-crossing_copy-approach","siteId":"dark_crossing_copy","width":4,"points":[[39860,40400],[39860,40352]],"streetId":"elin-approach"},
    {"id":"record-names_stone-approach","siteId":"dark_names_stone","width":4,"points":[[40000,40252],[40040,40252]],"streetId":"elin-approach"},
    {"id":"record-tovin_hideaway-approach","siteId":"dark_tovin_hideaway","width":4,"points":[[40000,40312],[40160,40312]],"streetId":"elin-approach"},
    {"id":"record-relief_charter-approach","siteId":"dark_relief_charter","width":4,"points":[[39840,40400],[39840,40482],[39820,40482]],"streetId":"elin-approach"},
    {"id":"record-revised_decree-approach","siteId":"dark_revised_decree","width":4,"points":[[40000,40212],[39910,40212]],"streetId":"elin-approach"},
    {"id":"record-returned_petitions-approach","siteId":"dark_returned_petitions","width":4,"points":[[39300,40522],[39410,40522]],"streetId":"oss-approach"},
    {"id":"record-binding_room-approach","siteId":"dark_binding_room","width":4,"points":[[39450,40400],[39450,40392]],"streetId":"oss-approach"},
    {"id":"record-first_petition-approach","siteId":"dark_first_petition","width":4,"points":[[39200,40592],[39120,40472]],"streetId":"oss-approach"},
    {"id":"record-four_replies-approach","siteId":"dark_four_replies","width":4,"points":[[39300,40242],[39240,40242]],"streetId":"oss-approach"},
    {"id":"record-unsent_page-approach","siteId":"dark_unsent_page","width":4,"points":[[39300,40272],[39420,40272]],"streetId":"oss-approach"},
    {"id":"record-oath_desk-approach","siteId":"dark_oath_desk","width":4,"points":[[39300,40332],[39140,40332]],"streetId":"oss-approach"},
    {"id":"record-withdrawal_register-approach","siteId":"dark_withdrawal_register","width":4,"points":[[39300,40212],[39340,40212]],"streetId":"oss-approach"},
    {"id":"record-fuel_order-approach","siteId":"dark_fuel_order","width":4,"points":[[39300,40202],[39210,40202]],"streetId":"oss-approach"},
    {"id":"record-earth_conduit-approach","siteId":"dark_earth_conduit","width":4,"points":[[39180,39700],[39160,39832]],"streetId":"vara-approach"},
    {"id":"record-water_conduit-approach","siteId":"dark_water_conduit","width":4,"points":[[39442.07,39756.83],[39420,39812]],"streetId":"vara-approach"},
    {"id":"record-air_conduit-approach","siteId":"dark_air_conduit","width":4,"points":[[39348.97,39719.59],[39400,39592]],"streetId":"vara-approach"},
    {"id":"record-release_stone-approach","siteId":"dark_release_stone","width":4,"points":[[39300,39792],[39230,39792]],"streetId":"vara-approach"},
    {"id":"record-release_water-approach","siteId":"dark_release_water","width":4,"points":[[39369.66,39727.86],[39380,39702]],"streetId":"vara-approach"},
    {"id":"record-release_fire-approach","siteId":"dark_release_fire","width":4,"points":[[39180,39632],[39210,39632]],"streetId":"vara-approach"},
    {"id":"record-release_air-approach","siteId":"dark_release_air","width":4,"points":[[39300,39700],[39360,39532]],"streetId":"vara-approach"},
    {"id":"record-production_tally-approach","siteId":"dark_production_tally","width":4,"points":[[39180,39700],[39100,39712]],"streetId":"vara-approach"},
    {"id":"record-overseer_account-approach","siteId":"dark_overseer_account","width":4,"points":[[39460,39760],[39460,39732]],"streetId":"vara-approach"},
    {"id":"record-delivery_seal-approach","siteId":"dark_delivery_seal","width":4,"points":[[39534.82,39720.71],[39500,39712]],"streetId":"vara-approach"},
    {"id":"record-schoolroom-approach","siteId":"dark_schoolroom","width":4,"points":[[40000,39862],[39860,39862]],"streetId":"oren-approach"},
    {"id":"record-waiting_table-approach","siteId":"dark_waiting_table","width":4,"points":[[40000,39642],[40150,39642]],"streetId":"oren-approach"},
    {"id":"record-departure_board-approach","siteId":"dark_departure_board","width":4,"points":[[39820,39700],[39820,39682]],"streetId":"oren-approach"},
    {"id":"record-stayers_shelter-approach","siteId":"dark_stayers_shelter","width":4,"points":[[40000,39552],[40070,39552]],"streetId":"oren-approach"},
    {"id":"record-citizens_memorial-approach","siteId":"dark_citizens_memorial","width":4,"points":[[40130,39862],[40170,39862],[40170,39742]],"streetId":"oren-approach"},
    {"id":"record-herald_warrant-approach","siteId":"dark_herald_warrant","width":4,"points":[[40000,39532],[39880,39532]],"streetId":"oren-approach"},
    {"id":"record-devourer_tithe-approach","siteId":"dark_devourer_tithe","width":4,"points":[[40000,39532],[40120,39532]],"streetId":"oren-approach"}
].map(path => Object.freeze({ ...path, points: Object.freeze(path.points.map(Object.freeze)) })));
