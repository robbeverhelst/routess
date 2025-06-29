import {
  ComponentResource,
  ComponentResourceOptions,
  Output,
  interpolate,
  output,
} from "@pulumi/pulumi";
import { Deployment } from "@pulumi/kubernetes/apps/v1";
import { Service, ServiceAccount, Secret } from "@pulumi/kubernetes/core/v1";
import { CustomResource } from "@pulumi/kubernetes/apiextensions";
import { AppResourceConfig } from "./types";

export class ApiResource extends ComponentResource {
  public readonly deployment: Deployment;
  public readonly service: Service;
  public readonly serviceMonitor: CustomResource;
  public readonly serviceAccount: ServiceAccount;
  public readonly secrets: Secret;
  public readonly serviceUrl: Output<string>;

  constructor(name: string, config: AppResourceConfig, opts?: ComponentResourceOptions) {
    super("maps:resources:Api", name, {}, opts);

    const deploymentName = `${config.appName}-api`;
    const appVersion = config.image.split(":").pop() || "latest";

    // API Service Account with minimal permissions
    this.serviceAccount = new ServiceAccount(
      `${config.appName}-api-sa`,
      {
        metadata: {
          name: `${config.appName}-api-sa`,
          namespace: config.namespace,
          annotations: {
            "kubernetes.io/description": "Service account for API backend",
          },
        },
        automountServiceAccountToken: true, // API needs to read secrets
      },
      { parent: this, provider: config.provider },
    );

    // API Secrets
    this.secrets = new Secret(
      `${config.appName}-api-secrets`,
      {
        metadata: {
          name: `${config.appName}-api-secrets`,
          namespace: config.namespace,
          annotations: {
            "kubernetes.io/description": "Sensitive configuration for API service",
          },
        },
        type: "Opaque",
        stringData: {
          "jwt-secret": process.env.JWT_SECRET || "generate-secure-jwt-secret",
          "google-client-id": process.env.GOOGLE_CLIENT_ID || "",
          "google-client-secret": process.env.GOOGLE_CLIENT_SECRET || "",
          "mapbox-access-token": process.env.VITE_MAPBOX_ACCESS_TOKEN || "",
          "database-url": `postgresql://postgres:${process.env.DB_PASSWORD || "changeme"}@${config.appName}-postgres:5432/maps_db`,
        },
      },
      { parent: this, provider: config.provider },
    );

    this.deployment = new Deployment(
      deploymentName,
      {
        metadata: {
          name: deploymentName,
          namespace: config.namespace,
          labels: config.labels,
          annotations: {
            "app.kubernetes.io/version": appVersion,
          },
        },
        spec: {
          selector: {
            matchLabels: config.labels,
          },
          replicas: config.replicas || 2,
          strategy: {
            type: "RollingUpdate",
            rollingUpdate: {
              maxUnavailable: 1,
              maxSurge: 1,
            },
          },
          template: {
            metadata: {
              labels: {
                ...config.labels,
                "app.kubernetes.io/component": "api",
              },
              annotations: {
                "app.kubernetes.io/version": appVersion,
                "prometheus.io/scrape": "true",
                "prometheus.io/port": config.port.toString(),
                "prometheus.io/path": "/metrics",
              },
            },
            spec: {
              serviceAccountName: this.serviceAccount.metadata.name,
              automountServiceAccountToken: true,
              securityContext: {
                runAsNonRoot: true,
                runAsUser: 1000,
                runAsGroup: 1000,
                fsGroup: 1000,
                seccompProfile: {
                  type: "RuntimeDefault",
                },
              },
              containers: [
                {
                  name: `${config.appName}-api`,
                  image: config.image,
                  ports: [{ containerPort: config.port }],
                  env: config.env
                    ? output(config.env).apply((envVars) => [
                        ...envVars,
                        {
                          name: "JWT_SECRET",
                          valueFrom: {
                            secretKeyRef: {
                              name: this.secrets.metadata.name,
                              key: "jwt-secret",
                            },
                          },
                        },
                        {
                          name: "GOOGLE_CLIENT_ID",
                          valueFrom: {
                            secretKeyRef: {
                              name: this.secrets.metadata.name,
                              key: "google-client-id",
                            },
                          },
                        },
                        {
                          name: "DATABASE_URL",
                          valueFrom: {
                            secretKeyRef: {
                              name: this.secrets.metadata.name,
                              key: "database-url",
                            },
                          },
                        },
                      ])
                    : [
                        {
                          name: "JWT_SECRET",
                          valueFrom: {
                            secretKeyRef: {
                              name: this.secrets.metadata.name,
                              key: "jwt-secret",
                            },
                          },
                        },
                        {
                          name: "GOOGLE_CLIENT_ID",
                          valueFrom: {
                            secretKeyRef: {
                              name: this.secrets.metadata.name,
                              key: "google-client-id",
                            },
                          },
                        },
                        {
                          name: "DATABASE_URL",
                          valueFrom: {
                            secretKeyRef: {
                              name: this.secrets.metadata.name,
                              key: "database-url",
                            },
                          },
                        },
                      ],
                  securityContext: {
                    allowPrivilegeEscalation: false,
                    runAsNonRoot: true,
                    runAsUser: 1000,
                    runAsGroup: 1000,
                    capabilities: {
                      drop: ["ALL"],
                    },
                    readOnlyRootFilesystem: true,
                    seccompProfile: {
                      type: "RuntimeDefault",
                    },
                  },
                  resources: config.resources || {
                    limits: {
                      cpu: "500m",
                      memory: "512Mi",
                      "ephemeral-storage": "1Gi",
                    },
                    requests: {
                      cpu: "250m",
                      memory: "256Mi",
                      "ephemeral-storage": "512Mi",
                    },
                  },
                  imagePullPolicy: "Always",
                  livenessProbe: config.livenessProbe,
                  readinessProbe: config.readinessProbe,
                },
              ],
            },
          },
        },
      },
      {
        provider: config.provider,
        dependsOn: config.dependencies,
        parent: this,
      },
    );

    this.service = new Service(
      `${config.appName}-api-service`,
      {
        metadata: {
          name: `${config.appName}-api-service`,
          namespace: config.namespace,
          labels: config.labels,
        },
        spec: {
          type: "ClusterIP",
          ports: [
            {
              name: "http",
              port: config.port,
              targetPort: config.port,
              protocol: "TCP",
            },
          ],
          selector: {
            ...config.labels,
            "app.kubernetes.io/component": "api",
          },
        },
      },
      {
        provider: config.provider,
        dependsOn: [this.deployment],
        parent: this,
      },
    );

    this.serviceUrl = interpolate`${this.service.metadata.name}.${config.namespace}.svc.cluster.local:${config.port}`;

    // ServiceMonitor for Prometheus scraping
    this.serviceMonitor = new CustomResource(
      `${config.appName}-api-servicemonitor`,
      {
        apiVersion: "monitoring.coreos.com/v1",
        kind: "ServiceMonitor",
        metadata: {
          name: `${config.appName}-api-metrics`,
          namespace: config.namespace,
          labels: {
            ...config.labels,
            "app.kubernetes.io/component": "metrics",
            release: "prometheus", // Required for Prometheus ServiceMonitor discovery
          },
        },
        spec: {
          selector: {
            matchLabels: config.labels,
          },
          endpoints: [
            {
              port: "http",
              path: "/metrics",
              interval: "30s",
              scrapeTimeout: "10s",
            },
          ],
        },
      },
      {
        provider: config.provider,
        dependsOn: [this.service],
        parent: this,
      },
    );

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      serviceMonitor: this.serviceMonitor,
      serviceAccount: this.serviceAccount,
      secrets: this.secrets,
      serviceUrl: this.serviceUrl,
    });
  }
}
