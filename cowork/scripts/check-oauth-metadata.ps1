[CmdletBinding()]
param(
    [string]$McpServerUrl = 'https://mcp.datadoghq.com/v1/mcp'
)

$uri = [Uri]$McpServerUrl

# 1. Unauthenticated challenge probe (RFC 9728 Mechanism A)
$challengeHeader = $null
$statusCode = $null
try {
    $probe = Invoke-WebRequest -Uri $McpServerUrl -Method Get -Headers @{ Accept = 'application/json,text/event-stream' } -TimeoutSec 15 -ErrorAction Stop
    $statusCode = [int]$probe.StatusCode
} catch {
    $resp = $_.Exception.Response
    if ($resp) {
        $statusCode = [int]$resp.StatusCode
        $challengeHeader = $resp.Headers['WWW-Authenticate']
    }
}

# 2. Resource metadata probe (RFC 9728 Mechanism B)
$resourceMetadataUrl = '{0}://{1}/.well-known/oauth-protected-resource{2}' -f $uri.Scheme, $uri.Authority, $uri.AbsolutePath
$resourceMetadata = $null
try {
    $resourceMetadata = Invoke-RestMethod -Uri $resourceMetadataUrl -TimeoutSec 15
} catch {
    # Fallback to root
    try {
        $resourceMetadata = Invoke-RestMethod -Uri ("{0}://{1}/.well-known/oauth-protected-resource" -f $uri.Scheme, $uri.Authority) -TimeoutSec 15
    } catch {}
}

# 3. Authorization server metadata probe (RFC 8414)
$authMetadata = $null
$authMetadataUrl = $null
$candidateUrls = @()
if ($resourceMetadata.authorization_servers) {
    $asUri = [Uri]$resourceMetadata.authorization_servers[0]
    $candidateUrls += "{0}://{1}/.well-known/oauth-authorization-server" -f $asUri.Scheme, $asUri.Authority
    $candidateUrls += "$($resourceMetadata.authorization_servers[0].TrimEnd('/'))/.well-known/oauth-authorization-server"
}
$candidateUrls += "{0}://{1}/.well-known/oauth-authorization-server" -f $uri.Scheme, $uri.Authority

foreach ($cand in $candidateUrls) {
    try {
        $meta = Invoke-RestMethod -Uri $cand -TimeoutSec 10
        if ($meta.authorization_endpoint) {
            $authMetadata = $meta
            $authMetadataUrl = $cand
            break
        }
    } catch {}
}

[pscustomobject]@{
    McpServerUrl = $McpServerUrl
    UnauthenticatedProbe = [pscustomobject]@{
        StatusCode = $statusCode
        WWWAuthenticateHeader = $challengeHeader
        MechanismASupported = [bool]($challengeHeader -match 'resource_metadata')
    }
    ProtectedResourceMetadata = [pscustomobject]@{
        Url = $resourceMetadataUrl
        Resource = $resourceMetadata.resource
        AuthorizationServers = $resourceMetadata.authorization_servers
        MechanismBSupported = [bool]($resourceMetadata -ne $null)
    }
    AuthorizationServerMetadata = [pscustomobject]@{
        Url = $authMetadataUrl
        Issuer = $authMetadata.issuer
        AuthorizationEndpoint = $authMetadata.authorization_endpoint
        TokenEndpoint = $authMetadata.token_endpoint
        RegistrationEndpoint = $authMetadata.registration_endpoint
        ScopesSupported = $authMetadata.scopes_supported
        TokenEndpointAuthMethods = $authMetadata.token_endpoint_auth_methods_supported
        PKCERequired = $authMetadata.pkce_required
        CodeChallengeMethods = $authMetadata.code_challenge_methods_supported
        PublicClientsOnly = [bool]($authMetadata.token_endpoint_auth_methods_supported -contains 'none' -and $authMetadata.token_endpoint_auth_methods_supported.Count -eq 1)
    }
} | ConvertTo-Json -Depth 5
