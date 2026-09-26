import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const coworkRoot = path.resolve(__dirname, '..');
const variantsDir = path.join(coworkRoot, 'build', 'variants');

const staticConfigId = 'NmIxMDQ0OTktYzQ5Zi00NWRjLWIzYTItZGY5NWVmZDZlZWI0IyNhYjZmOTQ1ZC0wMDIzLTQxZTItYThjYS1iNTQxZGUwNjNkNWQ=';
const clientId = '51ea5567-28b8-4c79-9a7d-e70239b14811';

const variants = [
  {
    key: 'datadog-static',
    appId: '66e79264-7ec2-42d0-a681-7bea071991c3',
    shortName: 'Datadog Static',
    fullName: 'Datadog for Copilot Cowork (Static OAuth)',
    descShort: 'Investigate Datadog telemetry with static OAuthPluginVault',
    descFull: 'Connect Copilot Cowork to Datadog through its remote MCP server using static OAuthPluginVault registration.',
    connectorDesc: 'Read Datadog telemetry using static OAuthPluginVault.',
    auth: {
      type: 'OAuthPluginVault',
      referenceId: staticConfigId
    },
    authTemplate: {
      type: 'OAuthPluginVault',
      referenceId: '${{DATADOG_OAUTH_CONFIGURATION_ID}}'
    },
    m365YamlProvision: `  - uses: teamsApp/create
    with:
      name: datadog-cowork-static\${{APP_NAME_SUFFIX}}
    writeToEnvironmentFile:
      teamsAppId: TEAMS_APP_ID

  - uses: oauth/register
    with:
      name: Datadog for Copilot Cowork (Static)
      appId: \${{TEAMS_APP_ID}}
      applicableToApps: AnyApp
      targetAudience: HomeTenant
      flow: authorizationCode
      identityProvider: Custom
      baseUrl: https://mcp.datadoghq.com/v1/mcp
      authorizationUrl: https://app.datadoghq.com/oauth2/v1/authorize
      tokenUrl: https://app.datadoghq.com/api/v2/oauth2/token
      refreshUrl: https://app.datadoghq.com/api/v2/oauth2/token
      clientId: \${{DATADOG_OAUTH_CLIENT_ID}}
      scope: mcp_read
      isPKCEEnabled: true
      tokenExchangeMethodType: PostRequestBody
    writeToEnvironmentFile:
      configurationId: DATADOG_OAUTH_CONFIGURATION_ID`,
    envVars: {
      TEAMSFX_ENV: 'dev',
      APP_NAME_SUFFIX: 'dev',
      TEAMS_APP_ID: '66e79264-7ec2-42d0-a681-7bea071991c3',
      DATADOG_OAUTH_CLIENT_ID: clientId,
      DATADOG_OAUTH_CONFIGURATION_ID: staticConfigId
    }
  },
  {
    key: 'datadog-implicit',
    appId: '77f89375-8fd3-43e1-b792-8cfb1820a2d4',
    shortName: 'Datadog Implicit',
    fullName: 'Datadog for Copilot Cowork (Implicit DCR)',
    descShort: 'Investigate Datadog telemetry with implicit Cowork DCR',
    descFull: 'Connect Copilot Cowork to Datadog through its remote MCP server using Cowork automatic runtime DCR (authorization omitted).',
    connectorDesc: 'Read Datadog telemetry using implicit Cowork DCR (omitted authorization).',
    auth: null,
    authTemplate: null,
    m365YamlProvision: `  - uses: teamsApp/create
    with:
      name: datadog-cowork-implicit\${{APP_NAME_SUFFIX}}
    writeToEnvironmentFile:
      teamsAppId: TEAMS_APP_ID`,
    envVars: {
      TEAMSFX_ENV: 'dev',
      APP_NAME_SUFFIX: 'dev',
      TEAMS_APP_ID: '77f89375-8fd3-43e1-b792-8cfb1820a2d4'
    }
  },
  {
    key: 'datadog-explicit',
    appId: '88a90486-90e4-44f2-c8a3-9d0c2931b3e5',
    shortName: 'Datadog Explicit',
    fullName: 'Datadog for Copilot Cowork (Explicit DCR)',
    descShort: 'Investigate Datadog telemetry with explicit DynamicClientRegistration',
    descFull: 'Connect Copilot Cowork to Datadog through its remote MCP server using explicit DynamicClientRegistration.',
    connectorDesc: 'Read Datadog telemetry using explicit DynamicClientRegistration.',
    auth: {
      type: 'DynamicClientRegistration',
      referenceId: 'NmIxMDQ0OTktYzQ5Zi00NWRjLWIzYTItZGY5NWVmZDZlZWI0IyMxY2IwMjEwNS1kNGNmLTQxOWQtYjY2Mi1hYjlhZTIzY2M2M2M='
    },
    authTemplate: {
      type: 'DynamicClientRegistration',
      referenceId: '${{DATADOG_DCR_CONFIGURATION_ID}}'
    },
    m365YamlProvision: `  - uses: teamsApp/create
    with:
      name: datadog-cowork-explicit\${{APP_NAME_SUFFIX}}
    writeToEnvironmentFile:
      teamsAppId: TEAMS_APP_ID

  - uses: dcr/register
    with:
      name: Datadog for Copilot Cowork (Explicit DCR)
      appId: \${{TEAMS_APP_ID}}
      applicableToApps: AnyApp
      targetAudience: HomeTenant
      baseUrl: https://mcp.datadoghq.com/v1/mcp
    writeToEnvironmentFile:
      configurationId: DATADOG_DCR_CONFIGURATION_ID`,
    envVars: {
      TEAMSFX_ENV: 'dev',
      APP_NAME_SUFFIX: 'dev',
      TEAMS_APP_ID: '88a90486-90e4-44f2-c8a3-9d0c2931b3e5',
      DATADOG_DCR_CONFIGURATION_ID: 'NmIxMDQ0OTktYzQ5Zi00NWRjLWIzYTItZGY5NWVmZDZlZWI0IyMxY2IwMjEwNS1kNGNmLTQxOWQtYjY2Mi1hYjlhZTIzY2M2M2M='
    }
  }
];

fs.mkdirSync(variantsDir, { recursive: true });

function createManifest(variant, isTemplate) {
  const connector = {
    id: 'datadog-us1',
    displayName: `${variant.shortName} MCP`,
    description: variant.connectorDesc,
    toolSource: {
      remoteMcpServer: {
        mcpServerUrl: 'https://mcp.datadoghq.com/v1/mcp?referrer_ide=copilot-cowork&plugin_version=1.3.1&toolsets=core',
        mcpToolDescription: {
          file: 'tools/datadog-tools.json'
        }
      }
    }
  };

  const authVal = isTemplate ? variant.authTemplate : variant.auth;
  if (authVal) {
    connector.toolSource.remoteMcpServer.authorization = authVal;
  }

  return {
    $schema: 'https://developer.microsoft.com/json-schemas/teams/vDevPreview/MicrosoftTeams.schema.json',
    manifestVersion: 'devPreview',
    version: '1.3.1',
    id: isTemplate ? '${{TEAMS_APP_ID}}' : variant.appId,
    packageName: `com.darbotlabs.${variant.key}`,
    developer: {
      name: 'Darbot Labs',
      websiteUrl: 'https://github.com/dayour/datadog-agent-plugin',
      privacyUrl: 'https://www.datadoghq.com/legal/privacy/',
      termsOfUseUrl: 'https://www.datadoghq.com/legal/terms/'
    },
    name: {
      short: variant.shortName,
      full: variant.fullName
    },
    description: {
      short: variant.descShort,
      full: variant.descFull
    },
    icons: {
      color: 'color.png',
      outline: 'outline.png'
    },
    accentColor: '#632CA6',
    agentSkills: [
      {
        folder: './skills/datadog-observability'
      }
    ],
    agentConnectors: [connector]
  };
}

for (const variant of variants) {
  const vDir = path.join(variantsDir, variant.key);
  const appPackageDir = path.join(vDir, 'appPackage');
  const envDir = path.join(vDir, 'env');
  const buildDir = path.join(appPackageDir, 'build');

  fs.mkdirSync(appPackageDir, { recursive: true });
  fs.mkdirSync(envDir, { recursive: true });
  fs.mkdirSync(buildDir, { recursive: true });

  // Copy icons, skills, and tools
  fs.copyFileSync(path.join(coworkRoot, 'appPackage', 'color.png'), path.join(appPackageDir, 'color.png'));
  fs.copyFileSync(path.join(coworkRoot, 'appPackage', 'outline.png'), path.join(appPackageDir, 'outline.png'));
  fs.cpSync(path.join(coworkRoot, 'appPackage', 'skills'), path.join(appPackageDir, 'skills'), { recursive: true });
  fs.cpSync(path.join(coworkRoot, 'appPackage', 'tools'), path.join(appPackageDir, 'tools'), { recursive: true });

  // Write template manifest
  const templateManifest = createManifest(variant, true);
  fs.writeFileSync(path.join(appPackageDir, 'manifest.json'), JSON.stringify(templateManifest, null, 2) + '\n');

  // Resolved manifest for standalone packaging
  const resolvedManifest = createManifest(variant, false);

  // Write m365agents.yml
  const ymlContent = `# yaml-language-server: $schema=https://aka.ms/m365-agents-toolkits/v1.13/yaml.schema.json
version: v1.13

environmentFolderPath: ./env

provision:
${variant.m365YamlProvision}

publish:
  - uses: teamsApp/zipAppPackage
    with:
      manifestPath: ./appPackage/manifest.json
      outputZipPath: ./appPackage/build/appPackage.\${{TEAMSFX_ENV}}.zip
      outputFolder: ./appPackage/build

  - uses: teamsApp/update
    with:
      appPackagePath: ./appPackage/build/appPackage.\${{TEAMSFX_ENV}}.zip

  - uses: copilotAgent/publish
    with:
      appPackagePath: ./appPackage/build/appPackage.\${{TEAMSFX_ENV}}.zip
      scope: personal
    writeToEnvironmentFile:
      titleId: M365_TITLE_ID
      appId: M365_APP_ID
      shareLink: SHARE_LINK
projectId: 916be5a8-8da3-4111-9c77-dda54f288afd
`;
  fs.writeFileSync(path.join(vDir, 'm365agents.yml'), ymlContent);

  // Write env files
  const envContent = Object.entries(variant.envVars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  fs.writeFileSync(path.join(envDir, '.env.dev'), envContent);
  fs.writeFileSync(path.join(envDir, '.env.dev.example'), Object.keys(variant.envVars).map(k => `${k}=`).join('\n') + '\n');

  console.log(`Generated project structure for ${variant.key}`);

  // Validate with atk validate
  try {
    process.env.ATK_CLI_SKILL = 'true';
    const valOut = execSync(`atk validate --env dev -i false -f "${vDir}"`, { encoding: 'utf8' });
    console.log(`[PASS] Validation for ${variant.key}:`);
    console.log(valOut.trim().split('\n').slice(-2).join('\n'));
  } catch (e) {
    console.error(`[FAIL] Validation for ${variant.key}:`, e.message);
  }

  // Package with atk package
  try {
    const pkgOut = execSync(`atk package --env dev -i false -f "${vDir}"`, { encoding: 'utf8' });
    console.log(`[PASS] Package for ${variant.key}:`);
    console.log(pkgOut.trim());
  } catch (e) {
    console.error(`[FAIL] Package for ${variant.key}:`, e.message);
  }

  // Also create a standalone distribution zip with resolved manifest for direct Cowork sideload upload
  const distZipPath = path.join(variantsDir, `${variant.key}.zip`);
  const stageDir = path.join(vDir, 'dist_staging');
  fs.mkdirSync(stageDir, { recursive: true });
  fs.copyFileSync(path.join(appPackageDir, 'color.png'), path.join(stageDir, 'color.png'));
  fs.copyFileSync(path.join(appPackageDir, 'outline.png'), path.join(stageDir, 'outline.png'));
  fs.cpSync(path.join(appPackageDir, 'skills'), path.join(stageDir, 'skills'), { recursive: true });
  fs.cpSync(path.join(appPackageDir, 'tools'), path.join(stageDir, 'tools'), { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'manifest.json'), JSON.stringify(resolvedManifest, null, 2) + '\n');

  // Zip using powershell Compress-Archive
  execSync(`powershell -Command "Compress-Archive -Path '${stageDir}\\*' -DestinationPath '${distZipPath}' -Force"`);
  fs.rmSync(stageDir, { recursive: true, force: true });
  console.log(`Created standalone sideload zip: ${distZipPath}`);
}
