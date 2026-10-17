// What we are connected to, and what the same connection looks like in
// production. The local column is a mock, not a different design: same paths,
// same auth style, same permissions. Swapping a row is a configuration change.

export type Connection = {
  id: string;
  label: string;
  kind: 'identity' | 'mail' | 'files' | 'database' | 'ai' | 'governance';
  /** What the platform is allowed to do. Always read-only in the POC. */
  access: 'read' | 'write';
  localEndpoint: string;
  productionEndpoint: string;
  auth: string;
  scopes: string[];
  swap: string;
};

export const CONNECTIONS: Connection[] = [
  {
    id: 'entra',
    label: 'Microsoft Entra ID',
    kind: 'identity',
    access: 'read',
    localEndpoint: 'http://127.0.0.1:{port}/v1.0/users',
    productionEndpoint: 'https://graph.microsoft.com/v1.0/users',
    auth: 'OAuth 2.0 client credentials (app registration, certificate)',
    scopes: ['User.Read.All', 'GroupMember.Read.All', 'Directory.Read.All'],
    swap: 'Set GRAPH_BASE_URL and ENTRA_TENANT_ID/CLIENT_ID/CLIENT_SECRET.',
  },
  {
    id: 'exchange',
    label: 'Exchange Online (Graph mail)',
    kind: 'mail',
    access: 'read',
    localEndpoint: 'http://127.0.0.1:{port}/v1.0/users/{id}/messages',
    productionEndpoint: 'https://graph.microsoft.com/v1.0/users/{id}/messages',
    auth: 'OAuth 2.0 client credentials + application access policy',
    scopes: ['Mail.Read'],
    swap: 'Same Graph base URL; scope the app to the department mailboxes with an application access policy.',
  },
  {
    id: 'sharepoint',
    label: 'SharePoint / OneDrive',
    kind: 'files',
    access: 'read',
    localEndpoint: 'http://127.0.0.1:{port}/v1.0/drives',
    productionEndpoint: 'https://graph.microsoft.com/v1.0/drives',
    auth: 'OAuth 2.0 client credentials, site-scoped',
    scopes: ['Sites.Read.All', 'Files.Read.All'],
    swap: 'Same Graph base URL; grant the app access to the one department site only.',
  },
  {
    id: 'sql',
    label: 'Azure SQL (line of business)',
    kind: 'database',
    access: 'read',
    localEndpoint: 'in-process fixture tables',
    productionEndpoint: 'sqlsrv://givatrimon.database.windows.net:1433/municipal',
    auth: 'Entra service principal (managed identity)',
    scopes: ['db_datareader on the read replica'],
    swap: 'Replace LocalSqlClient with the mssql driver; the SqlPort contract is the same.',
  },
  {
    id: 'purview',
    label: 'Microsoft Purview (sensitivity labels)',
    kind: 'governance',
    access: 'read',
    localEndpoint: 'http://127.0.0.1:{port}/v1.0/informationProtection/sensitivityLabels',
    productionEndpoint: 'https://graph.microsoft.com/v1.0/informationProtection/sensitivityLabels',
    auth: 'OAuth 2.0 client credentials',
    scopes: ['InformationProtectionPolicy.Read'],
    swap: 'Same Graph client; enable information protection in the tenant.',
  },
  {
    id: 'openai',
    label: 'Azure OpenAI',
    kind: 'ai',
    access: 'read',
    localEndpoint: 'http://127.0.0.1:{port}/openai/deployments/gpt-4o',
    productionEndpoint: 'https://{resource}.openai.azure.com/openai/deployments/gpt-4o',
    auth: 'api-key or Entra managed identity',
    scopes: ['Cognitive Services OpenAI User'],
    swap: 'Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY. The gateway code is unchanged.',
  },
];
