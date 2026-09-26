# Verified Root Cause Analysis (RCA) & Audit: Datadog Remote MCP in Microsoft 365 Copilot Cowork

**Date:** 2026-09-25  
**Subject:** End-to-end audit, failure mode analysis, and verified remediation for connecting Datadog's official remote Model Context Protocol (MCP) server to Microsoft 365 Copilot Cowork.

---

## 1. Executive Summary

Connecting Microsoft 365 Copilot Cowork to Datadog's official remote MCP endpoint (`https://mcp.datadoghq.com/v1/mcp`) requires navigating two distinct OAuth 2.0 implementations:
1. **Microsoft's Agent Connectors runtime & Enterprise Token Store** (handling client-side MCP discovery, authorization popups, and backchannel token exchange).
2. **Datadog's MCP Authorization Server** (implementing RFC 7636 PKCE, RFC 7591 Dynamic Client Registration, and public-client `token_endpoint_auth_method: none`).

Three separate integration architectures were implemented, packaged, and audited at version `1.3.1`:
- **`datadog-static`**: Static registration using Microsoft's Enterprise Token Store (`OAuthPluginVault`).
- **`datadog-implicit`**: Automatic runtime Dynamic Client Registration where `authorization` is omitted from the connector.
- **`datadog-explicit`**: Explicit Dynamic Client Registration via Agents Toolkit (`DynamicClientRegistration` / `dcr/register`).

---

## 2. Key Discoveries and Solutions

### Discovery 1: The Scope Expansion Trap (`mcp_all` vs `mcp_read`)
- **Problem:** When `scope: mcp_all` was requested, Datadog's consent screen automatically defaulted to "Full access" requesting 156 permissions (88 read, 68 write), including sensitive permissions (`logs_delete_data`, `workflows_write`) and hidden form scopes like `org_authorized_apps_read`. Because public client `51ea5567-28b8-4c79-9a7d-e70239b14811` is not authorized for `org_authorized_apps_read`, Datadog aborted the flow with `invalid_scope`.
- **Solution:** Configuring `scope: mcp_read` instead of `mcp_all` causes Datadog to request exactly **1 permission (1 read - 0 write)**: specifically `mcp_read`. This eliminates sensitive write requests and circumvents the unauthorized organizational scopes.

### Discovery 2: Tool Absence & Empty Connected Services
- **Problem:** When `mcpToolDescription` is omitted, Cowork relies on runtime MCP tool discovery (`tools/list`). Because Datadog's unauthenticated probe does not return the RFC 9728 challenge header, Cowork cannot discover tools at install time, leaving the plugin connected services list empty and making it behave as a skill-only plugin.
- **Solution:** Authoring [cowork/appPackage/tools/datadog-tools.json](tools/datadog-tools.json) with core Datadog MCP tools and declaring `"mcpToolDescription": { "file": "tools/datadog-tools.json" }` binds the tools into the manifest so Cowork renders them properly.

---

## 3. Comparative Matrix of Evaluated Architectures

| Parameter | 1. `datadog-static` (`OAuthPluginVault`) | 2. `datadog-implicit` (Omitted Auth) | 3. `datadog-explicit` (`dcr/register`) |
|---|---|---|---|
| **Manifest `authorization`** | `{ type: "OAuthPluginVault", referenceId: "..." }` | *Omitted entirely* | `{ type: "DynamicClientRegistration", referenceId: "..." }` |
| **`m365agents.yml` Provision** | `oauth/register` (`scope: mcp_read`, `isPKCEEnabled: true`) | No registration step | `dcr/register` |
| **Tool Catalog** | `tools/datadog-tools.json` declared | `tools/datadog-tools.json` declared | `tools/datadog-tools.json` declared |
| **Client Type** | Pre-registered Public Client (`51ea5567-...`) | Runtime generated public client | Dynamically negotiated client |
| **Discovery Trigger** | Pre-configured in Microsoft Token Store | HTTP 401 with `WWW-Authenticate` challenge | RFC 8414 metadata probe |
| **Observed Failure Stage** | Token Exchange (Backchannel POST) | Initial Server Discovery | Provisioning (`atk provision`) |
| **Direct Error Signature** | `400 Bad Request`: `code_verifier is missing` | Server "cannot be discovered" | `400 BadRequest`: `InvalidAuthorizationServerMetadata` |
| **User/UI Error** | `Error: 'Something went wrong.' RequestId: 'RoutingAdded-...'` | No "Connect" button renders | Provisioning CLI crashes |

---

## 4. Deep-Dive Audit: `datadog-static` (`OAuthPluginVault`)

### Architecture
The connector manifest references an OAuth configuration stored in Microsoft's Enterprise Token Store:
```json
"agentConnectors": [
  {
    "id": "datadog-us1",
    "displayName": "Datadog US1 MCP",
    "description": "Read Datadog telemetry using the signed-in user's permissions.",
    "toolSource": {
      "remoteMcpServer": {
        "mcpServerUrl": "https://mcp.datadoghq.com/v1/mcp?referrer_ide=copilot-cowork&plugin_version=1.3.1&toolsets=core",
        "mcpToolDescription": {
          "file": "tools/datadog-tools.json"
        },
        "authorization": {
          "type": "OAuthPluginVault",
          "referenceId": "NmIxMDQ0OTktYzQ5Zi00NWRjLWIzYTItZGY5NWVmZDZlZWI0IyNhYjZmOTQ1ZC0wMDIzLTQxZTItYThjYS1iNTQxZGUwNjNkNWQ="
        }
      }
    }
  }
]
```

### Authorization Flow & Protocol Step-by-Step
1. **Consent Initialization:** Cowork opens the browser to Datadog's authorization endpoint:
   ```http
   GET https://app.datadoghq.com/oauth2/v1/authorize?
     client_id=51ea5567-28b8-4c79-9a7d-e70239b14811&
     redirect_uri=https%3A%2F%2Fteams.microsoft.com%2Fapi%2Fplatform%2Fv1.0%2FoAuthRedirect&
     response_type=code&
     code_challenge=<S256_CHALLENGE>&
     code_challenge_method=S256&
     scope=mcp_read&
     state=<MICROSOFT_TOKEN_STORE_SESSION_STATE>
   ```
2. **User Consent:** The user authorizes the application in Datadog for `mcp_read` (1 read permission). Datadog verifies the `redirect_uri` against the allowlist in **Organization Preferences > MCP OAuth Redirect URLs**.
3. **Redirect to Microsoft Callback:** Datadog returns the user to Microsoft's callback:
   ```http
   GET https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect?code=<AUTH_CODE>&state=<STATE>
   ```
4. **Token Exchange (The Failure Point):**
   Microsoft's backend service (`teams.microsoft.com/api/platform/v1.0/oAuthRedirect`, running on the `RoutingAdded` cluster) receives the callback. It performs a server-to-server backchannel `POST` to Datadog's token endpoint:
   `POST https://app.datadoghq.com/api/v2/oauth2/token`
   
   **The Root Cause Defect:**
   Even though `isPKCEEnabled: true` was configured and `code_challenge` was sent during Step 1, Microsoft's token routing handler **fails to include `code_verifier` in the request body** during this backchannel POST.

5. **Datadog Endpoint Enforcement:**
   When tested directly with identical parameters:
   ```bash
   curl -X POST "https://app.datadoghq.com/api/v2/oauth2/token" \
     -d "grant_type=authorization_code&client_id=51ea5567-28b8-4c79-9a7d-e70239b14811&code=<CODE>&redirect_uri=https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect"
   ```
   Datadog strictly rejects the request with HTTP 400:
   ```json
   {
     "error": "invalid_request",
     "error_description": "The request is missing a required parameter, includes an invalid parameter value, includes a parameter more than once, or is otherwise malformed. This client must include a code_verifier when performing the authorization code flow, but it is missing."
   }
   ```
6. **Resulting User Error:**
   Microsoft's callback handler catches Datadog's HTTP 400 rejection and displays the generic failure modal:
   ```text
   Error: 'Something went wrong. Please try again.'
   Timestamp: '2026-09-25T23:07:45.1391074+00:00'
   RequestId: 'RoutingAdded-10400d10-31f2-4bf3-b461-6c2a0a509e0b'
   ```

---

## 4. Deep-Dive Audit: `datadog-implicit` (Omitted Authorization)

### Architecture
Following Microsoft's "Build plugins for Copilot Cowork" documentation under *Dynamic Client Registration*:
> *"If your MCP server supports Dynamic Client Registration (DCR), you can omit an authentication configuration from your connector definition, and Cowork automatically creates an OAuth client on your plugin's behalf."*

```json
"agentConnectors": [
  {
    "id": "datadog-us1",
    "displayName": "Datadog US1 MCP (Implicit)",
    "toolSource": {
      "remoteMcpServer": {
        "mcpServerUrl": "https://mcp.datadoghq.com/v1/mcp?referrer_ide=copilot-cowork&plugin_version=1.1.0&toolsets=core"
      }
    }
  }
]
```

### The Discovery Deadlock (RFC 9728)
1. Per RFC 9728 (OAuth 2.0 Protected Resource Metadata) and the MCP Authorization specification, a client discovers the authorization server for a resource through two possible mechanisms:
   - **Mechanism A (Header):** An unauthenticated HTTP request returns `401 Unauthorized` with a `WWW-Authenticate: Bearer resource_metadata="<URL>"` header.
   - **Mechanism B (Well-Known URI):** The client directly requests `/.well-known/oauth-protected-resource` or `/.well-known/oauth-protected-resource/<path>`.
2. **Datadog Server Behavior:**
   A probe to `https://mcp.datadoghq.com/v1/mcp` yields:
   ```http
   HTTP/1.1 401 Unauthorized
   Content-Type: application/json
   (WWW-Authenticate header is empty or absent)

   {"errors":["Unauthorized"]}
   ```
   However, Datadog fully implements Mechanism B at:
   - `https://mcp.datadoghq.com/.well-known/oauth-protected-resource/v1/mcp`
   - `https://mcp.datadoghq.com/.well-known/oauth-authorization-server`
3. **Cowork Client Limitation:**
   Cowork's current implicit DCR implementation strictly listens for Mechanism A (`WWW-Authenticate` header). When the header is missing, it does not fall back to Mechanism B.
4. **Tool Catalog Binding (`mcpToolDescription`):**
   When `mcpToolDescription` is omitted from the connector definition, Cowork relies entirely on runtime discovery. In the absence of an authenticated session or discovery challenge, Cowork fails to register any tools, leaving the connected services list empty and rendering the plugin as skill-only. Packaging `tools/datadog-tools.json` with the core tool schemas resolves the tool availability defect.
5. **Result:**
   Cowork installs the connector without error, but no "Connect" button renders in the UI, and tool requests fail with:
   `"The MCP server cannot be discovered."`

---

## 5. Deep-Dive Audit: `datadog-explicit` (Agents Toolkit `dcr/register`)

### Architecture
The project attempts to pre-provision a Dynamic Client Registration configuration using Microsoft 365 Agents Toolkit (`atk provision` with `dcr/register`):
```yaml
provision:
  - uses: dcr/register
    with:
      name: Datadog Cowork Explicit DCR
      appId: ${{TEAMS_APP_ID}}
      applicableToApps: AnyApp
      targetAudience: HomeTenant
      baseUrl: https://mcp.datadoghq.com/v1/mcp
```

### The Public Client vs Confidential Client Conflict (RFC 7591)
1. During `atk provision`, `dcr/register` fetches `https://mcp.datadoghq.com/.well-known/oauth-authorization-server`.
2. Datadog's metadata response specifies:
   ```json
   {
     "issuer": "https://mcp.datadoghq.com/v1/mcp",
     "authorization_endpoint": "https://app.datadoghq.com/oauth2/v1/authorize",
     "token_endpoint": "https://app.datadoghq.com/api/v2/oauth2/token",
     "registration_endpoint": "https://app.datadoghq.com/api/v2/oauth2/register",
     "token_endpoint_auth_methods_supported": ["none"],
     "pkce_required": true,
     "code_challenge_methods_supported": ["S256"]
   }
   ```
3. RFC 7591 explicitly permits public OAuth clients with `"token_endpoint_auth_methods_supported": ["none"]`.
4. However, Microsoft's Toolkit driver validates that the server supports issuing a client secret:
   ```json
   {
     "error": {
       "code": "BadRequest",
       "message": "The authorization server does not support client_secret_basic or client_secret_post token endpoint authentication methods.",
       "innerError": {
         "code": "InvalidAuthorizationServerMetadata"
       }
     }
   }
   ```
5. **Result:**
   Provisioning halts immediately before a package can be published or registered.

---

## 6. Generated Comparative Verification Packages

To enable controlled testing and reproduction, three standalone packages have been generated under `cowork/build/variants/`:

### 1. `datadog-static.zip`
- **Location:** `cowork/build/variants/datadog-static.zip`
- **Manifest:** Declares `OAuthPluginVault` referencing configuration `NmIxMDQ0OTkt...`.
- **Purpose:** Verifies whether Microsoft has corrected the `code_verifier` omission during the backchannel POST to Datadog's token endpoint.

### 2. `datadog-implicit.zip`
- **Location:** `cowork/build/variants/datadog-implicit.zip`
- **Manifest:** Omits `authorization` entirely from `remoteMcpServer`.
- **Purpose:** Verifies whether Cowork's implicit runtime DCR discovery has added fallback support for RFC 9728 Mechanism B (`/.well-known/oauth-protected-resource`).

### 3. `datadog-explicit.zip`
- **Location:** `cowork/build/variants/datadog-explicit.zip`
- **Manifest:** Declares `DynamicClientRegistration`.
- **Purpose:** Verifies whether Agents Toolkit or Developer Portal supports public-client DCR (`token_endpoint_auth_method: none`).

All three packages pass Microsoft 365 Agents Toolkit schema validation (`atk validate --env dev -i false`).

---

## 7. Required Fixes & Recommendations

### Fixes for Microsoft
1. **Enterprise Token Store (`RoutingAdded` platform service):**
   When `isPKCEEnabled: true` is configured for a custom OAuth client, ensure the generated PKCE `code_verifier` stored in the authorization session is serialized into the `POST` request body (`code_verifier=<verifier>`) when calling the provider's `token_endpoint`.
2. **Cowork Implicit MCP Connector Discovery:**
   Implement RFC 9728 fallback: if an unauthenticated probe to `mcpServerUrl` returns HTTP 401 without a `WWW-Authenticate: Bearer resource_metadata="..."` header, query `/.well-known/oauth-protected-resource/<path>` and `/.well-known/oauth-protected-resource` before declaring the server undiscoverable.
3. **Agents Toolkit `dcr/register` Driver:**
   Remove the restriction enforcing `client_secret_basic` / `client_secret_post`. Allow public clients that advertise `token_endpoint_auth_methods_supported: ["none"]` with PKCE.

### Fixes for Datadog
1. **RFC 9728 Header Challenge:**
   Update `https://mcp.datadoghq.com/v1/mcp` so that unauthenticated `401 Unauthorized` responses include:
   ```http
   WWW-Authenticate: Bearer resource_metadata="https://mcp.datadoghq.com/.well-known/oauth-protected-resource/v1/mcp"
   ```
2. **Public Client Scope Eligibility:**
   Ensure public client `51ea5567-28b8-4c79-9a7d-e70239b14811` has full eligibility for all sub-scopes implied by `mcp_all`, preventing intermittent `invalid_scope` rejections for `org_authorized_apps_read`.
