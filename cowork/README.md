# Datadog for Copilot Cowork

This Microsoft 365 app package connects Copilot Cowork to Datadog's remote MCP
server. 

The `devPreview` manifest points to the Datadog US1 MCP endpoint and references
an OAuth configuration in Microsoft's Enterprise Token Store. The OAuth client
is a Datadog public client secured with PKCE; no client secret is used. The
manifest intentionally omits `mcpToolDescription` so Cowork discovers the live
tool surface through MCP `tools/list`. Neither the package nor the skill
contains a Datadog token, API key, or application key.

## Local validation

From this repository's root, run:

```powershell
& ./cowork/scripts/make-icons.ps1
$env:ATK_CLI_SKILL = 'true'
atk validate --env dev -i false -f ./cowork
atk package --env dev -i false -f ./cowork
```

Copy `cowork/env/.env.dev.example` to the ignored `cowork/env/.env.dev`, set a
stable `TEAMS_APP_ID` GUID, and set `DATADOG_OAUTH_CLIENT_ID` to a Datadog
public OAuth client registered with this redirect URI:

```text
https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect
```

In the Datadog organization that owns the telemetry, also add this exact URI
under **Organization Preferences > MCP OAuth Redirect URLs**. Client
registration alone does not establish that organization-level allowlist.

Run `atk provision --env dev -i false -f ./cowork`. Provisioning creates the
Enterprise Token Store OAuth configuration if needed, writes its ID to the
ignored environment file, and leaves an existing registration unchanged. Inspect
and adjust existing OAuth settings explicitly in the Teams Developer Portal;
local provisioning does not validate provider consent or token exchange. It
does not package, publish, or install the app.

Use `atk validate` and `atk package` above for local checks and packaging.
Only when ready to publish, run `atk publish --env dev -i false -f ./cowork`.
That separate lifecycle packages the app, updates its Developer Portal
registration, and publishes it to Personal scope.

## Connection test

1. In Cowork, open the uploaded Datadog plugin and confirm that **Connections**
   lists **Datadog US1 MCP**.
2. Enable the plugin and start a new Cowork task.
3. Use its native Connect flow if offered. Complete login in the browser
   yourself; never copy authorization codes, cookies, tokens, or callback URLs.
4. Start a fresh task that asks the Datadog MCP tool for CPU and memory metrics
   over the last 30 minutes, filtered by `host:HP11D`. Require the actual MCP
   tool name, filter, time window, timestamps, and returned values. A valid
   package, matching OAuth metadata, consent screen, or Connect button is not
   proof of a working connection.

The `devPreview` manifest version is used to enable runtime tool discovery for the remote MCP connector.

## Comparative verification builds

To isolate and verify the three different OAuth/DCR integration architectures, three comparative packages are maintained under `cowork/build/variants/`:

- `datadog-static.zip` — Static `OAuthPluginVault` referencing pre-registered token store configuration.
- `datadog-implicit.zip` — Automatic Cowork runtime DCR (omits `authorization` entirely).
- `datadog-explicit.zip` — Explicit `DynamicClientRegistration` configuration.

To rebuild and validate all three variants:

```powershell
node cowork/scripts/build-variants.mjs
```

See [ROOT_CAUSE_ANALYSIS.md](ROOT_CAUSE_ANALYSIS.md) for the complete root cause analysis and protocol audit.

