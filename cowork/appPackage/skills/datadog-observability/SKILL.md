---
name: datadog-observability
description: Investigate Datadog logs, metrics, traces, monitors, dashboards, incidents, and service health. Use when the user asks about production errors, alerts, latency, reliability, telemetry, or anything in Datadog.
---

# Datadog Observability

Use the Datadog US1 MCP connector for Datadog requests. Discover its current
tools at runtime and select the narrowest read-only tool that answers the
request.

## Workflow

1. Clarify the service, environment, time range, or Datadog organization only
   when the request cannot be answered safely without it.
2. Use the connector to retrieve current Datadog data. Prefer a narrow time
   range and targeted filters before broad searches.
3. Summarize the evidence, include the queried time range and filters, and
   distinguish observed facts from hypotheses.
4. If authorization is required, ask the user to complete Cowork's native
   connection flow. Never request or expose tokens, API keys, application keys,
   authorization codes, cookies, PKCE values, or full sign-in URLs.
5. If no Datadog MCP tool is available, report that the connector was not bound
   to the session. Do not claim that Datadog itself is unavailable.

Default to read-only investigation. Do not mute monitors, edit dashboards,
change incidents, or perform any other write unless the user explicitly asks
and Cowork presents the required confirmation.
