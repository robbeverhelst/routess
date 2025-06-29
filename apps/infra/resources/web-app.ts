import { ComponentResource, ComponentResourceOptions, Output, interpolate } from "@pulumi/pulumi";
import { Deployment } from "@pulumi/kubernetes/apps/v1";
import { Service, ServiceAccount } from "@pulumi/kubernetes/core/v1";
import { AppResourceConfig } from "./types";

export class WebAppResource extends ComponentResource {
  public readonly deployment: Deployment;
  public readonly service: Service;
  public readonly serviceAccount: ServiceAccount;
  public readonly serviceUrl: Output<string>;

  constructor(name: string, config: AppResourceConfig, opts?: ComponentResourceOptions) {
    super("maps:resources:WebApp", name, {}, opts);

    const deploymentName = `${config.appName}-web`;
    const appVersion = config.image.split(":").pop() || "latest";

    // Web Service Account with minimal permissions
    this.serviceAccount = new ServiceAccount(
      `${config.appName}-web-sa`,
      {
        metadata: {
          name: `${config.appName}-web-sa`,
          namespace: config.namespace,
          annotations: {
            "kubernetes.io/description":
              "Service account for web frontend with minimal permissions",
          },
        },
        automountServiceAccountToken: false, // Web frontend doesn't need API access
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
              labels: config.labels,
              annotations: {
                "app.kubernetes.io/version": appVersion,
              },
            },
            spec: {
              serviceAccountName: this.serviceAccount.metadata.name,
              automountServiceAccountToken: false,
              securityContext: {
                runAsNonRoot: true, // Run as nginx user (not root)
                runAsUser: 101, // nginx user UID
                runAsGroup: 101, // nginx group GID
                fsGroup: 101, // nginx group for volume permissions
                seccompProfile: {
                  type: "RuntimeDefault",
                },
              },
              containers: [
                {
                  name: `${config.appName}-web`,
                  image: config.image,
                  ports: [{ containerPort: config.port }],
                  env: config.env,
                  securityContext: {
                    allowPrivilegeEscalation: false,
                    runAsNonRoot: true,
                    runAsUser: 101, // nginx user UID
                    runAsGroup: 101, // nginx group GID
                    capabilities: {
                      drop: ["ALL"],
                      add: ["NET_BIND_SERVICE"], // Allow binding to port 80
                    },
                    readOnlyRootFilesystem: false, // nginx needs to write cache and temp files
                    seccompProfile: {
                      type: "RuntimeDefault",
                    },
                  },
                  resources: config.resources || {
                    limits: {
                      cpu: "200m",
                      memory: "256Mi",
                      "ephemeral-storage": "512Mi",
                    },
                    requests: {
                      cpu: "100m",
                      memory: "128Mi",
                      "ephemeral-storage": "256Mi",
                    },
                  },
                  imagePullPolicy: "Always",
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
      `${config.appName}-web-service`,
      {
        metadata: {
          name: `${config.appName}-web-service`,
          namespace: config.namespace,
          labels: config.labels,
        },
        spec: {
          type: "ClusterIP",
          ports: [{ port: config.port, targetPort: config.port }],
          selector: config.labels,
        },
      },
      {
        provider: config.provider,
        dependsOn: [this.deployment],
        parent: this,
      },
    );

    this.serviceUrl = interpolate`${this.service.metadata.name}.${config.namespace}.svc.cluster.local`;

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      serviceAccount: this.serviceAccount,
      serviceUrl: this.serviceUrl,
    });
  }
}
