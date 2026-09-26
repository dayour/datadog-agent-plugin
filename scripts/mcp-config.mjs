import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const sites = Object.freeze({
  us1: 'mcp.datadoghq.com',
  us3: 'mcp.us3.datadoghq.com',
  us5: 'mcp.us5.datadoghq.com',
  eu: 'mcp.datadoghq.eu',
  ap1: 'mcp.ap1.datadoghq.com',
  ap2: 'mcp.ap2.datadoghq.com',
});

function parseHttps(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Expected a valid HTTPS URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) {
    throw new Error('Use HTTPS without credentials, a non-default port, or a fragment.');
  }
  return url;
}

export function resolveDomain(value) {
  const input = value.trim().toLowerCase();
  if (Object.hasOwn(sites, input)) return sites[input];
  const url = parseHttps(input.includes('://') ? input : `https://${input}`);
  for (const [site, domain] of Object.entries(sites)) {
    const webDomain = site === 'us1' ? 'app.datadoghq.com' : domain.slice(4);
    if (url.hostname === domain) {
      if (!['/', '/v1/mcp'].includes(url.pathname)) {
        throw new Error('The supported MCP path is /v1/mcp.');
      }
      return domain;
    }
    if (url.hostname === webDomain || (site === 'us1' && url.hostname === 'datadoghq.com')) {
      return domain;
    }
  }
  throw new Error('Unrecognized site. Select a supported site code; do not send credentials to a custom host.');
}

function serverUrl(config) {
  const server = config?.mcpServers?.datadog;
  if (!server || server.type !== 'http' || typeof server.url !== 'string') {
    throw new Error('Expected an HTTP datadog entry in mcpServers.');
  }
  const url = parseHttps(server.url);
  if (url.pathname !== '/v1/mcp') throw new Error('The supported MCP path is /v1/mcp.');
  return url;
}

function requireKnownHost(url) {
  if (url.hostname !== 'not-setup' && !Object.values(sites).includes(url.hostname)) {
    throw new Error('Unrecognized MCP host. Select a supported site before connecting.');
  }
}

export function inspectConfig(config) {
  const url = serverUrl(config);
  requireKnownHost(url);
  return {
    state: url.hostname === 'not-setup' ? 'not-setup' : 'configured-unverified',
    hostname: url.hostname,
    toolsets: url.searchParams.get('toolsets') ?? '',
  };
}

export function updateConfig(config, operation, value) {
  const url = serverUrl(config);
  if (operation === 'site') {
    url.hostname = resolveDomain(value);
  } else if (operation === 'toolsets') {
    requireKnownHost(url);
    if (url.hostname === 'not-setup') throw new Error('Select a site before editing toolsets.');
    const toolsets = value === 'default' ? '' : value;
    if (toolsets && !/^[a-z][a-z0-9_-]*(,[a-z][a-z0-9_-]*)*$/.test(toolsets)) {
      throw new Error('Expected comma-separated toolset names or default.');
    }
    url.searchParams.set('toolsets', [...new Set(toolsets.split(','))].join(','));
  } else {
    throw new Error('Expected site or toolsets.');
  }
  const updated = structuredClone(config);
  updated.mcpServers.datadog.url = url.href;
  return updated;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [operation, value, ...extra] = process.argv.slice(2);
    if (extra.length || !['inspect', 'site', 'toolsets'].includes(operation) ||
        (operation === 'inspect' ? value !== undefined : value === undefined)) {
      throw new Error('Usage: node scripts/mcp-config.mjs inspect | site <site> | toolsets <names|default>');
    }
    const path = fileURLToPath(new URL('../.dd_copilot_mcp.json', import.meta.url));
    let config;
    try {
      config = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
    } catch {
      throw new Error('Cannot read valid MCP configuration JSON. No changes were made.');
    }
    if (operation === 'inspect') {
      console.log(JSON.stringify(inspectConfig(config)));
    } else {
      const updated = updateConfig(config, operation, value);
      writeFileSync(path, `${JSON.stringify(updated, null, 2)}\n`);
      console.log('Configuration updated. Authentication and data access remain unverified.');
    }
  } catch (error) {
    console.error(error.code ? 'Configuration operation failed. Check file access.' : error.message);
    process.exitCode = 1;
  }
}