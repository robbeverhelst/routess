import { Config, interpolate, output } from "@pulumi/pulumi";
import { Provider } from "@pulumi/kubernetes";
import { Namespace } from "@pulumi/kubernetes/core/v1";
import { NetworkPolicy } from "@pulumi/kubernetes/networking/v1";
import { WebAppResource, ApiResource, PostgresResource } from "./resources";
// import { DockerRegistrySecret } from "./resources"; // Commented out for now

// Get configuration
const config = new Config();
const appName = "maps";
const namespace = "maps";

// Get app version from environment variable or use "latest" as fallback
const appVersion = process.env.APP_VERSION || "latest";
console.log(`Deploying version: ${appVersion}`);

// Get image names from environment variables with lowercase repository owner
const webImage = process.env.WEB_IMAGE || `ghcr.io/robbeverhelst/maps-web:${appVersion}`;
const apiImage = process.env.API_IMAGE || `ghcr.io/robbeverhelst/maps-api:${appVersion}`;
console.log(`Web image: ${webImage}`);
console.log(`API image: ${apiImage}`);

// PostgreSQL configuration
const postgresConfig = {
  database: "maps",
  username: "maps_user",
  password: config.get("postgresPassword") || "maps_password_change_me",
};

// Create a Kubernetes provider instance that uses kubeconfig from Pulumi configuration
const provider = new Provider("k8s-provider", {
  kubeconfig: config.requireSecret("kubeconfig"),
});

// Create a Kubernetes namespace
const ns = new Namespace(
  namespace,
  {
    metadata: {
      name: namespace,
    },
  },
  { provider },
);

// Get GitHub credentials: Prefer GHA environment variables, fallback to Pulumi config
const githubUsername = process.env.GHCR_USERNAME || config.require("githubUsername");
const githubTokenInput = process.env.GHCR_TOKEN || config.requireSecret("githubToken");
const githubToken = output(githubTokenInput);

// Validate GitHub credentials
if (!githubUsername || githubUsername.trim() === "") {
  throw new Error(
    "GitHub username for GHCR is required (from GHCR_USERNAME env or Pulumi config 'githubUsername').",
  );
}

githubToken.apply((token) => {
  if (!token || token.trim() === "") {
    throw new Error(
      "GitHub token for GHCR is required (from GHCR_TOKEN env or Pulumi config 'githubToken').",
    );
  }
  // Basic check for PAT format if not using GITHUB_TOKEN (which has a different format)
  if (!process.env.GHCR_TOKEN && (!token.startsWith("ghp_") || token.length < 40)) {
    console.warn(
      `Warning: Configured 'githubToken' (from Pulumi config) does not look like a standard GitHub PAT (ghp_...). Please verify it's correct. Length: ${token.length}`,
    );
  }
});

console.log(`Using GitHub username for GHCR: ${githubUsername}`);
if (process.env.GHCR_TOKEN) {
  console.log("Using GHCR_TOKEN from GitHub Actions environment for GHCR authentication.");
} else {
  console.log(
    "GHCR_TOKEN not found in environment, using 'githubToken' from Pulumi config for GHCR authentication (secret will not be displayed).",
  );
}

// Create Docker registry secret (commented out for now)
// const dockerRegistry = new DockerRegistrySecret("ghcr", {
//   appName,
//   namespace,
//   provider,
//   username: githubUsername,
//   token: githubToken,
//   registryUrl: "ghcr.io",
//   dependencies: [ns],
// });

// Deploy PostgreSQL
const postgres = new PostgresResource("postgres", {
  appName,
  namespace,
  provider,
  database: postgresConfig.database,
  username: postgresConfig.username,
  password: postgresConfig.password,
  dependencies: [ns],
});

// Create web application environment variables
const webEnv = [
  {
    name: "VITE_MAPBOX_ACCESS_TOKEN",
    value: process.env.VITE_MAPBOX_ACCESS_TOKEN || "",
  },
  {
    name: "VITE_GOOGLE_CLIENT_ID",
    value: process.env.VITE_GOOGLE_CLIENT_ID || "",
  },
  {
    name: "VITE_APP_URL",
    value: process.env.VITE_APP_URL || "https://maps.robbeverhelst.com",
  },
  {
    name: "VITE_APP_VERSION",
    value: process.env.VITE_APP_VERSION || appVersion,
  },
  {
    name: "NODE_ENV",
    value: "production",
  },
];

// Deploy web application
const webApp = new WebAppResource("web", {
  appName,
  namespace,
  provider,
  image: webImage,
  port: 8080,
  labels: { app: `${appName}-web` },
  env: webEnv,
  dependencies: [ns, postgres.chart], // dockerRegistry.secret commented out for now
});

// Create API environment variables
const apiEnv = [
  {
    name: "NODE_ENV",
    value: "production",
  },
  {
    name: "PORT",
    value: "3000",
  },
  {
    name: "DB_HOST",
    value: interpolate`${postgres.serviceName}.${namespace}.svc.cluster.local`,
  },
  {
    name: "DB_PORT",
    value: "5432",
  },
  {
    name: "DB_NAME",
    value: postgresConfig.database,
  },
  {
    name: "DB_USER",
    value: postgresConfig.username,
  },
  {
    name: "DB_PASSWORD",
    value: postgresConfig.password,
  },
  {
    name: "FRONTEND_URL",
    value: process.env.FRONTEND_URL || "https://maps.robbeverhelst.com",
  },
];

// Deploy API
const api = new ApiResource("api", {
  appName,
  namespace,
  provider,
  image: apiImage,
  port: 3000,
  labels: { app: `${appName}-api` },
  env: apiEnv,
  postgres: {
    serviceName: postgres.serviceName,
    database: postgresConfig.database,
    username: postgresConfig.username,
    password: postgresConfig.password,
  },
  livenessProbe: {
    httpGet: {
      path: "/health/live",
      port: 3000,
    },
    initialDelaySeconds: 30,
    periodSeconds: 10,
  },
  readinessProbe: {
    httpGet: {
      path: "/health/ready",
      port: 3000,
    },
    initialDelaySeconds: 5,
    periodSeconds: 5,
  },
  dependencies: [ns, postgres.chart], // dockerRegistry.secret commented out for now
});

// Network Policies for security
new NetworkPolicy(
  `${appName}-default-deny`,
  {
    metadata: {
      name: `${appName}-default-deny`,
      namespace,
    },
    spec: {
      podSelector: {}, // Apply to all pods in namespace
      policyTypes: ["Ingress", "Egress"],
      // No ingress/egress rules = deny all
    },
  },
  { provider, dependsOn: [ns] },
);

new NetworkPolicy(
  `${appName}-web-policy`,
  {
    metadata: {
      name: `${appName}-web-policy`,
      namespace,
    },
    spec: {
      podSelector: {
        matchLabels: { app: `${appName}-web` },
      },
      policyTypes: ["Ingress", "Egress"],
      ingress: [
        {
          // Allow Cloudflare tunnel ingress
          from: [
            {
              namespaceSelector: {
                matchLabels: { name: "cloudflare-tunnel" },
              },
            },
            {
              // Allow from kube-system for health checks
              namespaceSelector: {
                matchLabels: { name: "kube-system" },
              },
            },
          ],
          ports: [{ protocol: "TCP", port: 80 }],
        },
      ],
      egress: [
        {
          // Allow DNS resolution
          to: [
            {
              namespaceSelector: {},
              podSelector: {
                matchLabels: { "k8s-app": "kube-dns" },
              },
            },
          ],
          ports: [
            { protocol: "UDP", port: 53 },
            { protocol: "TCP", port: 53 },
          ],
        },
      ],
    },
  },
  { provider, dependsOn: [webApp.deployment] },
);

new NetworkPolicy(
  `${appName}-api-policy`,
  {
    metadata: {
      name: `${appName}-api-policy`,
      namespace,
    },
    spec: {
      podSelector: {
        matchLabels: { app: `${appName}-api` },
      },
      policyTypes: ["Ingress", "Egress"],
      ingress: [
        {
          // Allow from web frontend
          from: [
            {
              podSelector: {
                matchLabels: { app: `${appName}-web` },
              },
            },
            {
              // Allow Cloudflare tunnel for direct API access
              namespaceSelector: {
                matchLabels: { name: "cloudflare-tunnel" },
              },
            },
          ],
          ports: [{ protocol: "TCP", port: 3000 }],
        },
      ],
      egress: [
        {
          // Allow DNS resolution
          to: [
            {
              namespaceSelector: {},
              podSelector: {
                matchLabels: { "k8s-app": "kube-dns" },
              },
            },
          ],
          ports: [
            { protocol: "UDP", port: 53 },
            { protocol: "TCP", port: 53 },
          ],
        },
        {
          // Allow communication to database
          to: [
            {
              podSelector: {
                matchLabels: { "app.kubernetes.io/name": "postgresql" },
              },
            },
          ],
          ports: [{ protocol: "TCP", port: 5432 }],
        },
        {
          // Allow HTTPS outbound for external APIs (Google OAuth, etc.)
          ports: [
            { protocol: "TCP", port: 443 },
            { protocol: "TCP", port: 80 },
          ],
        },
      ],
    },
  },
  { provider },
);

new NetworkPolicy(
  `${appName}-db-policy`,
  {
    metadata: {
      name: `${appName}-db-policy`,
      namespace,
    },
    spec: {
      podSelector: {
        matchLabels: { "app.kubernetes.io/name": "postgresql" },
      },
      policyTypes: ["Ingress", "Egress"],
      ingress: [
        {
          // Only allow API to connect to database
          from: [
            {
              podSelector: {
                matchLabels: { app: `${appName}-api` },
              },
            },
          ],
          ports: [{ protocol: "TCP", port: 5432 }],
        },
      ],
      egress: [
        {
          // Allow DNS resolution
          to: [
            {
              namespaceSelector: {},
              podSelector: {
                matchLabels: { "k8s-app": "kube-dns" },
              },
            },
          ],
          ports: [
            { protocol: "UDP", port: 53 },
            { protocol: "TCP", port: 53 },
          ],
        },
      ],
    },
  },
  { provider, dependsOn: [postgres.chart] },
);

// Export the service names and namespace
export const webServiceName = webApp.service.metadata.name;
export const apiServiceName = api.service.metadata.name;
export const serviceNamespace = namespace;
export const kubernetesCluster = config.require("clusterName");
export const webServiceUrl = webApp.serviceUrl;
export const apiServiceUrl = api.serviceUrl;
export const deployedVersion = appVersion;

// Export PostgreSQL connection details
export const postgresServiceName = postgres.serviceName;
export const postgresServiceUrl = postgres.serviceUrl;
export const postgresDatabase = postgresConfig.database;
export const postgresUsername = postgresConfig.username;
