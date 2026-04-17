$feedUrl = "http://127.0.0.1:8788/discover/feed?quickFilters=all"
$secret = "Vn1Qm7xK9rL2cT5yH8pD4sW0aZ6uJ3eNfB1qR7mY"
$header = @{ alg = "HS256"; typ = "JWT" } | ConvertTo-Json -Compress
$payload = @{ sub = "local-test-user"; iat = [int][double]::Parse((Get-Date -UFormat %s)); exp = [int][double]::Parse((Get-Date -UFormat %s)) + 3600 } | ConvertTo-Json -Compress
$enc = { param($s) [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($s)).TrimEnd('=') -replace '\+','-' -replace '/','_' }
$headerB64 = & $enc $header
$payloadB64 = & $enc $payload
$toSign = "$headerB64.$payloadB64"
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$sigBytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($toSign))
$sigB64 = [Convert]::ToBase64String($sigBytes).TrimEnd('=') -replace '\+','-' -replace '/','_'
$jwt = "$toSign.$sigB64"
$authHeader = "Authorization: Bearer $jwt"

# Warm-up
try { curl.exe -s -H $authHeader $feedUrl | Out-Null } catch {}

# Measure latency
$latencies = @()
1..3 | ForEach-Object {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $resp = curl.exe -s -H $authHeader $feedUrl
  $sw.Stop()
  $latencies += $sw.ElapsedMilliseconds
}

# Save payload
$resp = curl.exe -s -H $authHeader $feedUrl
$resp | Out-File -Encoding utf8 .\tmp_discover_feed.json

# Count URL types
$public = (Select-String -Path .\tmp_discover_feed.json -Pattern "/storage/v1/object/public/" -AllMatches).Matches.Count
$signed = (Select-String -Path .\tmp_discover_feed.json -Pattern "/storage/v1/object/sign/" -AllMatches).Matches.Count

$summary = [pscustomobject]@{
  latencies_ms = $latencies
  public_url_count = $public
  signed_url_count = $signed
}
$summary | ConvertTo-Json -Depth 4
