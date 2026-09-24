---
name: ddconfig
description: Configures or troubleshoots the Datadog MCP server `datadog`. Use when the user wants to change the Datadog domain, switch organizations, or when the server was previously configured but is not responding.
---

## Datadog MCP Server

The id of the Datadog MCP Server referenced on this document is `datadog`. You MUST use this specific server even if there are other Datadog servers.

## Shared reference

Read [references/mcp-settings.md](references/mcp-settings.md) before proceeding. It contains the `datadog-server-state` check, registration file location, editing rules, and site-to-domain mapping used by the flows below.

## Entry flow

If the user reports a Cowork or Agents Toolkit connection failure, use the [Cowork OAuth Flow](#cowork-oauth-flow) instead of the local configuration flows below.

Check the `datadog-server-state` (see `mcp-settings.md`). Use the `datadog://mcp/whoami` resource on the `datadog` server as the MCP call (do NOT use any other Datadog MCP server). If the call fails or the resource is unavailable, continue with the reference's failure checks rather than waiting for resource content. Proceed based on the results:

- **datadog-server-state=working** and **valid content** — without any preamble, immediately show the user their current connection (from `whoami`): user name and email, organization name, and site (the `dd_site` value). Then let the user choose between [using a different Datadog MCP domain or site](#domain-flow) or [switching to a different Datadog organization](#organization-flow).
- **datadog-server-state=not-setup** — without any preamble, tell the user the plugin is not set up and instruct them to run `/ddsetup`, and stop.
- **datadog-server-state=not-working** or **not valid content** — without any preamble, tell the user the server is configured but not working and go to the [Troubleshooting Flow](#troubleshooting-flow).

When communicating with the user below, describe the server state and actions in plain language. Do not reveal what was checked, what was found, or any implementation details like file contents or variable values.

## Troubleshooting Flow

The server is configured but not responding. Read the current domain from the registration file (see `mcp-settings.md` for the file format and how to find the domain), then present the user with the likely causes — do not follow these sequentially, show them all and use judgment:

- **Domain issue.** Compare the domain against the site-to-domain table in `mcp-settings.md`. Only flag it as suspicious if it looks like a typo or a clearly malformed URL (e.g. `mcp.us5.datadog.com` missing the `hq`). A domain not in the standard table is not necessarily wrong — the user may be using a valid non-standard domain.
- **Authentication.** The authentication may have expired or was never completed, and the user needs to follow these steps:

  In Copilot:
  1. Run the command `/mcp` and select the `datadog` server
  2. Press `r` to reauthenticate

  In VS Code:
  1. Open the Command Palette (⌘⇧P on Mac or Ctrl+Shift+P on Windows/Linux — show the correct shortcut for the current operating system)
  2. Run the **`MCP: List Servers`** command and select the `datadog` server
  3. Click **Restart Server** — VS Code will prompt for authentication

- **Network or access.** The user's network may be blocking the connection, or their Datadog account may not have API access, like not having the `MCP Read` permission.

If the domain looks wrong, suggest running the [Domain Flow](#domain-flow) to correct it.

## Cowork OAuth Flow

Read the [Cowork OAuth limitations](../../README.md#cowork-oauth-limitations). Ask which stage failed if it is not already clear, then explain the matching blocker in plain language:

- **No Connect action / cannot be discovered:** the reported Cowork discovery path does not fall back to well-known metadata when Datadog's authentication challenge header is absent. This requires a host-client fix, not repeated setup or domain changes.
- **Registration rejected with InvalidAuthorizationServerMetadata:** Agents Toolkit's `dcr/register` requires a confidential client, while Datadog advertises public clients. Do not recommend a dummy client secret.
- **Sign-in rejected with Mismatching redirect URI:** static provisioning can succeed without working sign-in. The reported failure after an organization-specific redirect needs Datadog investigation; do not claim the root cause is confirmed or recommend disabling redirect validation.

Do not edit the local MCP registration file for these failures, add Cowork `authorization` blocks to it, or suggest static registration as a multi-organization solution. Explain that implicit per-user registration is the intended approach but remains blocked upstream. Offer the relevant Microsoft or Datadog escalation described in the README and request only sanitized diagnostics, never credentials or full sign-in URLs. Stop rather than looping through setup or reauthentication.

## Domain Flow

Changes the Datadog MCP domain the server connects to.

1. Show the current domain information (from `whoami` → `dd_site` if available, or from the current domain in the registration file — see `mcp-settings.md` for the file format). Present it in plain language (e.g. "the plugin is currently connected to …") — follow the "Stay on script" rule in `mcp-settings.md`.
2. **Ask for the new domain.** Present the available sites and their MCP domains from `mcp-settings.md`, and ask which domain to switch to. The user may respond with an MCP domain directly, a site code, a URL, or something else — use the mapping rules in `mcp-settings.md` to resolve the answer. Ask for clarification if ambiguous.

   Follow the "Stay on script" rule in `mcp-settings.md`. In particular, do not preview the follow-up instructions from step 4 below (reload, re-authenticate, etc.) — that step emits them verbatim at the right moment.

3. Edit the domain in the registration file following the editing rule in `mcp-settings.md`.

   Before (example):

   ```
   "url": "https://mcp.datadoghq.eu/v1/mcp?..."
   ```

   After (switching to us1):

   ```
   "url": "https://mcp.datadoghq.com/v1/mcp?..."
   ```

4. Tell the user the domain has been changed and to follow these steps:

   In Copilot:
   1. Run the command `/mcp` and select the `datadog` server
   2. Press `r` to reauthenticate

   In VS Code:
   1. Open the Command Palette (⌘⇧P on Mac or Ctrl+Shift+P on Windows/Linux — show the correct shortcut for the current operating system)
   2. Run the **`MCP: List Servers`** command and select the `datadog` server
   3. Click **Restart Server**
   4. Authenticate the Datadog MCP Server when prompted

## Organization Flow

Switches to a different Datadog organization. The agent cannot do this automatically — the user must select the target organization in the browser.

Ask the user if they want to use an organization on the same domain or on a different domain.

- If on the same domain:
  - The user needs to reauthenticate and, during sign-in, choose the target organization in the browser, using the following steps:

    In Copilot:
    1. Run the command `/mcp` and select the `datadog` server
    2. Press `r` to reauthenticate

    In VS Code:
    1. Open the Command Palette (⌘⇧P on Mac or Ctrl+Shift+P on Windows/Linux — show the correct shortcut for the current operating system)
    2. Run the **`MCP: List Servers`** command and select the `datadog` server
    3. Click **Restart Server** — VS Code will prompt for authentication; choose the target organization during sign-in

- If on a different domain:
  - Run the [Domain Flow](#domain-flow) telling the user to choose the target organization in the browser during sign-in.
