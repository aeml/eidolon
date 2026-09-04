#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
protoc_bin="${PROTOC:-protoc}"

"$protoc_bin" --proto_path="$repo_root/proto" \
  --go_out="$repo_root/server/internal/proto" --go_opt=paths=source_relative \
  "$repo_root/proto/state.proto"

"$repo_root/node_modules/.bin/pbjs" -t static-module -w es6 --force-number \
  -o "$repo_root/src/proto/state_pb.js" "$repo_root/proto/state.proto"

generated="$repo_root/src/proto/state_pb.js"
sed -i -E 's#import (\* as )?\$protobuf from "protobufjs/minimal(\.js)?";#const $protobuf = globalThis.protobuf;\n\nif (!$protobuf) {\n    throw new Error("protobufjs minimal not found on globalThis.protobuf. Load the pinned local browser runtime before importing state_pb.js.");\n}#' "$generated"
