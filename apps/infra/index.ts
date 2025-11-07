import { Config, getStack } from "@pulumi/pulumi";
import { Namespace, Secret, Service } from "@pulumi/kubernetes/core/v1";
import { Deployment } from "@pulumi/kubernetes/apps/v1";
import { Ingress } from "@pulumi/kubernetes/networking/v1";

const config = new Config();
const stack = getStack();
const appName = "maps";
const namespace = config.get("namespace") || "maps";
const webImageRepository = "ghcr.io/robbeverhelst/maps-web";
const apiImageRepository = "ghcr.io/robbeverhelst/maps-api";
const imageTag = config.get("imageTag") || "latest";
const replicas = config.getNumber("replicas") || 2;
const ingressClassName = config.get("ingressClassName") || "cloudflare-tunnel";
const ghcrToken = config.requireSecret("ghcrToken");

// PostgreSQL configuration from 1Password (external database)
const dbHost = config.require("dbHost"); // op://Homelab/TrueNAS PostgreSQL/hostname
const dbPort = config.get("dbPort") || "5432";
const dbUser = config.require("dbUser"); // op://Homelab/TrueNAS PostgreSQL/username
const dbPassword = config.requireSecret("dbPassword"); // op://Homelab/TrueNAS PostgreSQL/password
const dbName = config.get("dbName") || "maps";

// API secrets
const jwtSecret = config.requireSecret("jwtSecret"); // op://Homelab/Maps API/JWT Secret
const googleClientId = config.require("googleClientId");

// Web hosts
const hosts = config.getObject<string[]>("hosts") ?? ["maps.robbeverhelst.com"];

const labels = {
  app: appName,
  stack,
};

// Create namespace
const ns = new Namespace(`${appName}-namespace`, {
  metadata: {
    name: namespace,
  },
});

// Create GHCR pull secret
const ghcrSecret = new Secret(
  `${appName}-ghcr-secret`,
  {
    metadata: {
      name: "ghcr-secret",
      namespace,
    },
    type: "kubernetes.io/dockerconfigjson",
    data: {
      ".dockerconfigjson": ghcrToken.apply((token: string) =>
        Buffer.from(
          JSON.stringify({
            auths: {
              "ghcr.io": {
                username: "robbeverhelst",
                password: token,
                auth: Buffer.from(`robbeverhelst:${token}`).toString("base64"),
              },
            },
          }),
        ).toString("base64"),
      ),
    },
  },
  { dependsOn: [ns] },
);

// API secrets
const apiSecrets = new Secret(
  `${appName}-api-secrets`,
  {
    metadata: {
      name: `${appName}-api-secrets`,
      namespace,
    },
    type: "Opaque",
    stringData: {
      "jwt-secret": jwtSecret.apply((s) => s),
      "google-client-id": googleClientId,
      "db-host": dbHost,
      "db-port": dbPort,
      "db-user": dbUser,
      "db-password": dbPassword.apply((p) => p),
      "db-name": dbName,
    },
  },
  { dependsOn: [ns] },
);

// ============================================
// WEB APPLICATION
// ============================================

const webResourceName = `${appName}-web-${stack}`;
const webDeploymentLabels = {
  ...labels,
  component: "web",
  version: imageTag,
};

const webDeployment = new Deployment(
  `${appName}-web-deployment`,
  {
    metadata: {
      name: webResourceName,
      namespace,
      labels: webDeploymentLabels,
    },
    spec: {
      replicas,
      selector: {
        matchLabels: { ...labels, component: "web" },
      },
      template: {
        metadata: {
          labels: webDeploymentLabels,
        },
        spec: {
          containers: [
            {
              name: `${appName}-web`,
              image: `${webImageRepository}:${imageTag}`,
              imagePullPolicy: "Always",
              ports: [
                {
                  name: "http",
                  containerPort: 80,
                },
              ],
              resources: {
                requests: {
                  cpu: "100m",
                  memory: "128Mi",
                },
                limits: {
                  cpu: "200m",
                  memory: "256Mi",
                },
              },
              livenessProbe: {
                httpGet: {
                  path: "/",
                  port: 80,
                },
                initialDelaySeconds: 10,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
              readinessProbe: {
                httpGet: {
                  path: "/",
                  port: 80,
                },
                initialDelaySeconds: 5,
                periodSeconds: 5,
                timeoutSeconds: 3,
                failureThreshold: 3,
              },
            },
          ],
          imagePullSecrets: [
            {
              name: ghcrSecret.metadata.name,
            },
          ],
        },
      },
    },
  },
  { dependsOn: [ghcrSecret] },
);

const webService = new Service(
  `${appName}-web-service`,
  {
    metadata: {
      name: webResourceName,
      namespace,
      labels: { ...labels, component: "web" },
      annotations: {
        "pulumi.com/skipAwait": "true",
      },
    },
    spec: {
      selector: { ...labels, component: "web" },
      ports: [
        {
          name: "http",
          port: 80,
          targetPort: 80,
          protocol: "TCP",
        },
      ],
      type: "ClusterIP",
    },
  },
  { dependsOn: [webDeployment] },
);

const webIngress = new Ingress(
  `${appName}-web-ingress`,
  {
    metadata: {
      name: webResourceName,
      namespace,
      labels: { ...labels, component: "web" },
      annotations: {
        "pulumi.com/patchForce": "true",
      },
    },
    spec: {
      ingressClassName,
      rules: hosts.map((host: string) => ({
        host,
        http: {
          paths: [
            {
              path: "/",
              pathType: "Prefix",
              backend: {
                service: {
                  name: webResourceName,
                  port: {
                    number: 80,
                  },
                },
              },
            },
          ],
        },
      })),
    },
  },
  { dependsOn: [webService] },
);

// ============================================
// API APPLICATION
// ============================================

const apiResourceName = `${appName}-api-${stack}`;
const apiDeploymentLabels = {
  ...labels,
  component: "api",
  version: imageTag,
};

const apiDeployment = new Deployment(
  `${appName}-api-deployment`,
  {
    metadata: {
      name: apiResourceName,
      namespace,
      labels: apiDeploymentLabels,
    },
    spec: {
      replicas,
      selector: {
        matchLabels: { ...labels, component: "api" },
      },
      template: {
        metadata: {
          labels: apiDeploymentLabels,
        },
        spec: {
          containers: [
            {
              name: `${appName}-api`,
              image: `${apiImageRepository}:${imageTag}`,
              imagePullPolicy: "Always",
              ports: [
                {
                  name: "http",
                  containerPort: 3000,
                },
              ],
              env: [
                {
                  name: "NODE_ENV",
                  value: "production",
                },
                {
                  name: "PORT",
                  value: "3000",
                },
                {
                  name: "FRONTEND_URL",
                  value: hosts[0] ? `https://${hosts[0]}` : "https://maps.robbeverhelst.com",
                },
                {
                  name: "JWT_SECRET",
                  valueFrom: {
                    secretKeyRef: {
                      name: apiSecrets.metadata.name,
                      key: "jwt-secret",
                    },
                  },
                },
                {
                  name: "GOOGLE_CLIENT_ID",
                  valueFrom: {
                    secretKeyRef: {
                      name: apiSecrets.metadata.name,
                      key: "google-client-id",
                    },
                  },
                },
                {
                  name: "DB_HOST",
                  valueFrom: {
                    secretKeyRef: {
                      name: apiSecrets.metadata.name,
                      key: "db-host",
                    },
                  },
                },
                {
                  name: "DB_PORT",
                  valueFrom: {
                    secretKeyRef: {
                      name: apiSecrets.metadata.name,
                      key: "db-port",
                    },
                  },
                },
                {
                  name: "DB_USER",
                  valueFrom: {
                    secretKeyRef: {
                      name: apiSecrets.metadata.name,
                      key: "db-user",
                    },
                  },
                },
                {
                  name: "DB_PASSWORD",
                  valueFrom: {
                    secretKeyRef: {
                      name: apiSecrets.metadata.name,
                      key: "db-password",
                    },
                  },
                },
                {
                  name: "DB_NAME",
                  valueFrom: {
                    secretKeyRef: {
                      name: apiSecrets.metadata.name,
                      key: "db-name",
                    },
                  },
                },
              ],
              resources: {
                requests: {
                  cpu: "250m",
                  memory: "256Mi",
                },
                limits: {
                  cpu: "500m",
                  memory: "512Mi",
                },
              },
              livenessProbe: {
                httpGet: {
                  path: "/health/live",
                  port: 3000,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
              readinessProbe: {
                httpGet: {
                  path: "/health/ready",
                  port: 3000,
                },
                initialDelaySeconds: 10,
                periodSeconds: 5,
                timeoutSeconds: 3,
                failureThreshold: 3,
              },
            },
          ],
          imagePullSecrets: [
            {
              name: ghcrSecret.metadata.name,
            },
          ],
        },
      },
    },
  },
  { dependsOn: [ghcrSecret, apiSecrets] },
);

const apiService = new Service(
  `${appName}-api-service`,
  {
    metadata: {
      name: apiResourceName,
      namespace,
      labels: { ...labels, component: "api" },
      annotations: {
        "pulumi.com/skipAwait": "true",
      },
    },
    spec: {
      selector: { ...labels, component: "api" },
      ports: [
        {
          name: "http",
          port: 3000,
          targetPort: 3000,
          protocol: "TCP",
        },
      ],
      type: "ClusterIP",
    },
  },
  { dependsOn: [apiDeployment] },
);

const apiIngress = new Ingress(
  `${appName}-api-ingress`,
  {
    metadata: {
      name: apiResourceName,
      namespace,
      labels: { ...labels, component: "api" },
      annotations: {
        "pulumi.com/patchForce": "true",
      },
    },
    spec: {
      ingressClassName,
      rules: [
        {
          host: "maps-api.robbeverhelst.com",
          http: {
            paths: [
              {
                path: "/",
                pathType: "Prefix",
                backend: {
                  service: {
                    name: apiResourceName,
                    port: {
                      number: 3000,
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  },
  { dependsOn: [apiService] },
);

// Exports
export const namespaceName = ns.metadata.name;
export const webDeploymentName = webDeployment.metadata.name;
export const webServiceName = webService.metadata.name;
export const webIngressName = webIngress.metadata.name;
export const apiDeploymentName = apiDeployment.metadata.name;
export const apiServiceName = apiService.metadata.name;
export const apiIngressName = apiIngress.metadata.name;
export const currentImageTag = imageTag;
export const configuredHosts = hosts;
