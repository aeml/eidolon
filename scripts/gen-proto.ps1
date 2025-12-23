param(
  [string]$Version = "33.2"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ToolsDir = Join-Path $RepoRoot "tools"
$ProtocDir = Join-Path $ToolsDir "protoc-$Version"
$ProtocExe = Join-Path $ProtocDir "bin\protoc.exe"

New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null

if (-not (Test-Path $ProtocExe)) {
  Write-Host "Downloading protoc v$Version..."
  $ZipPath = Join-Path $ToolsDir "protoc-$Version-win64.zip"
  $Url = "https://github.com/protocolbuffers/protobuf/releases/download/v$Version/protoc-$Version-win64.zip"
  Invoke-WebRequest -Uri $Url -OutFile $ZipPath

  New-Item -ItemType Directory -Force -Path $ProtocDir | Out-Null
  Expand-Archive -Path $ZipPath -DestinationPath $ProtocDir -Force
  Remove-Item $ZipPath -Force
}

# Ensure protoc-gen-go exists
Write-Host "Ensuring protoc-gen-go is installed..."
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest

$GoPath = (go env GOPATH)
$GoBin = Join-Path $GoPath "bin"

$env:PATH = "$($ProtocDir)\bin;$GoBin;$env:PATH"

# Go output
$GoOutDir = Join-Path $RepoRoot "server\internal\proto"
New-Item -ItemType Directory -Force -Path $GoOutDir | Out-Null

# JS output
$JsOutDir = Join-Path $RepoRoot "src\proto"
New-Item -ItemType Directory -Force -Path $JsOutDir | Out-Null

$ProtoFile = Join-Path $RepoRoot "proto\state.proto"
$ProtoInclude = Join-Path $RepoRoot "proto"

Write-Host "Generating Go protobuf..."
& $ProtocExe --proto_path=$ProtoInclude --go_out=$GoOutDir --go_opt=paths=source_relative $ProtoFile

Write-Host "Generating browser JS protobuf module..."
# Install protobufjs as a dev dependency if needed for pbjs/pbts
Push-Location $RepoRoot
try {
  $Pbjs = Join-Path $RepoRoot "node_modules\.bin\pbjs.cmd"
  if (-not (Test-Path $Pbjs)) {
    Write-Host "Installing protobufjs + protobufjs-cli for pbjs..."
    npm install --save-dev protobufjs protobufjs-cli
  }

  if (-not (Test-Path $Pbjs)) {
    throw "pbjs still not found at $Pbjs"
  }

  $JsOutFile = Join-Path $JsOutDir "state_pb.js"
  & $Pbjs -t static-module -w es6 -o $JsOutFile $ProtoFile

  # Post-process for browser runtime: use globalThis.protobuf (loaded via <script>)
  $Content = Get-Content -Raw -Path $JsOutFile

  if (-not $Content.Contains('globalThis.protobuf')) {
    $Replacement = @'
const $protobuf = globalThis.protobuf;

if (!$protobuf) {
    throw new Error("protobufjs minimal not found on globalThis.protobuf. Load https://unpkg.com/protobufjs/dist/minimal/protobuf.min.js (or equivalent) before importing state_pb.js.");
}
'@

    $Needles = @(
      'import * as $protobuf from "protobufjs/minimal";'
      'import * as $protobuf from "protobufjs/minimal"'
      'import * as $protobuf from "protobufjs/minimal";\r\n'
      'import * as $protobuf from "protobufjs/minimal"\r\n'
      "import * as $protobuf from 'protobufjs/minimal';"
      "import * as $protobuf from 'protobufjs/minimal'"
    )

    foreach ($Needle in $Needles) {
      if ($Content.Contains($Needle)) {
        $Content = $Content.Replace($Needle, $Replacement)
        Set-Content -Path $JsOutFile -Value $Content -NoNewline
        break
      }
    }
  }
} finally {
  Pop-Location
}

Write-Host "Done. Generated:"
Write-Host " - $GoOutDir"
Write-Host " - $JsOutDir\state_pb.js"
