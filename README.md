# Datadog Plugin for Copilot & VS Code

Query your Datadog data directly from Copilot and VS Code using natural language. Ask about logs, metrics, traces, dashboards, monitors, and more.

## What you need

- A [Datadog](https://www.datadoghq.com/) account
- [Visual Studio Code](https://code.visualstudio.com/) (latest version recommended) with the [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension, and/or the [Copilot CLI](https://github.com/features/copilot/cli)

## Getting started

To install using the Copilot CLI:

- Type `copilot plugin install datadog@awesome-copilot`

To install using VS Code:

1. Enter `@agentPlugins datadog` in the search field of the Extensions activity.
2. Select the Datadog plugin and click **Install**.

After installation:

- Run `/ddsetup` in Copilot to connect the plugin to your Datadog account. The agent will guide you through selecting the correct Datadog MCP domain. You can run this again at any time.

### Notes

If you already have the Datadog MCP server registered separately (for example, in `.vscode/mcp.json`), disable or remove it to avoid conflicts.

## Using the plugin

Once connected, just ask the agent anything about your Datadog data:

```
Show me error logs for the "checkout" service from the last hour
```

```
What monitors are currently alerting?
```

```
Find traces for service "api-gateway" with latency > 500ms
```

```
List my dashboards
```

## Can't connect?

**Never connected before?** Run the `/ddsetup` command in Copilot. It will help you provide the correct Datadog MCP domain and set up the MCP server.

**Was working before but stopped?** Run the `/ddconfig` command in Copilot. It will check your site, authentication status, and network access to help diagnose the issue.

### Cowork OAuth limitations

This repository packages skills and an MCP connection for Copilot CLI and VS Code. It does not implement Cowork's OAuth client or Agents Toolkit's registration actions. The Cowork failures reported in [issue #1](https://github.com/dayour/datadog-agent-plugin/issues/1) remain upstream blockers; changing this plugin's domain or restarting it cannot fix them.

| Approach | Reported blocker | Next step |
| --- | --- | --- |
| Implicit registration (no `authorization` block) | No **Connect** action; tools report that the server “cannot be discovered.” Datadog's unauthenticated `401` lacks a `WWW-Authenticate` discovery challenge, although well-known metadata is available. | Cowork needs well-known protected-resource discovery when the challenge is absent. |
| Agents Toolkit `dcr/register` (`DynamicClientRegistration`) | Provisioning rejects metadata with `InvalidAuthorizationServerMetadata`: it requires `client_secret_basic` or `client_secret_post`, but Datadog advertises only `none`. | Agents Toolkit needs public-client registration support; do not invent or supply a dummy secret. |
| Agents Toolkit `oauth/register` (`OAuthPluginVault`) with a self-registered public client | Provisioning succeeds with PKCE, but live sign-in reports `invalid_request - Mismatching redirect URI.` | Escalate the observed registration/redirect behavior to Datadog; successful provisioning is not proof of working sign-in. |

#### Required discovery behavior

For the reported US1 endpoint, `https://mcp.datadoghq.com/v1/mcp`, the [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) requires clients to support both the `WWW-Authenticate` challenge and well-known discovery. When the challenge is missing, the client must try the path-specific protected-resource metadata URL, then the root fallback:

1. `https://mcp.datadoghq.com/.well-known/oauth-protected-resource/v1/mcp`
2. `https://mcp.datadoghq.com/.well-known/oauth-protected-resource`

The issue reports that the root document supplies `authorization_servers: ["https://mcp.datadoghq.com/v1/mcp"]`. Authorization-server discovery must then follow that metadata; the reported root metadata at `https://mcp.datadoghq.com/.well-known/oauth-authorization-server` advertises:

- Authorization endpoint: `https://app.datadoghq.com/oauth2/v1/authorize`
- Token endpoint: `https://app.datadoghq.com/api/v2/oauth2/token`
- Registration endpoint: `https://app.datadoghq.com/api/v2/oauth2/register`
- Token endpoint authentication: `none` (a public client), with PKCE required and `S256` supported.

These are reported US1 values, not endpoints to hard-code for every site. Discovery belongs in the host client, and the MCP connection must still point to `/v1/mcp`, not a metadata URL. [RFC 7591](https://www.rfc-editor.org/rfc/rfc7591.html#section-2) defines `none` as a valid token endpoint authentication method; requiring a confidential client is a tooling restriction, not a reason to add a secret to this plugin.

#### Why static registration is not the general workaround

In the reported attempt, the registered and requested callback were both `https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect`, yet sign-in failed after an organization-specific vanity-host redirect. Re-registering with different client names and redirect URIs reportedly returned the same client ID. The cause is unconfirmed; Datadog's [public-client registration endpoint](https://docs.datadoghq.com/api/latest/oauth2-client-public/register-an-oauth2-client/) is documented as preview. Do not disable redirect validation or repeatedly re-register as a workaround.

The issue also reports that the static client is organization-bound, so it would not cover the organization's eight Datadog orgs even if the redirect mismatch were resolved. Implicit, per-user registration remains the intended path, once the host supports discovery and public-client OAuth correctly.

For escalation, capture the client/toolkit version, Datadog site, failure stage, error code, and sanitized discovery metadata. Never share API/application keys, tokens, authorization codes, cookies, PKCE verifiers, or full sign-in URLs. The [key authentication](#key-authentication) instructions below apply to Copilot CLI/VS Code; they are not a verified workaround for Cowork.

## Changing settings

The plugin provides a few commands you can run in the agent to manage configuration:

- `/ddconfig` — change your Datadog site or switch organizations
- `/ddtoolsets` — enable or disable groups of tools

## Advanced usage

### Key authentication

Instead of OAuth, you can authenticate using a Datadog API key and application key.

1. Run `/ddsetup` as usual to configure the MCP domain.
2. Set the following environment variables before starting Copilot / VS Code:

   ```bash
   export DD_API_KEY=your-api-key
   export DD_APPLICATION_KEY=your-application-key
   ```

3. Restart Copilot / VS Code (or reload the MCP server via **`MCP: List Servers`** → Restart Server). The server will use the API keys instead of prompting for OAuth.

> On macOS, launch VS Code from the terminal after exporting the variables, or use a launcher that inherits your shell environment.

## Good to know

- By default, authentication is handled via OAuth in your browser. Key authentication is also [supported](#key-authentication).
- No Datadog credentials are sent to the AI model provider.

## Support

- [Datadog MCP Server Documentation](https://docs.datadoghq.com/mcp_server/)

## Legal

See the [LICENSE](LICENSE) and [NOTICE](NOTICE) files included with this plugin.

For details on how Datadog handles your data, see the [Datadog Privacy Policy](https://www.datadoghq.com/legal/privacy).
