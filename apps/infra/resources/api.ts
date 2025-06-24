import { ComponentResource, ComponentResourceOptions, Output, interpolate } from "@pulumi/pulumi";
import { Deployment } from "@pulumi/kubernetes/apps/v1";
import { Service } from "@pulumi/kubernetes/core/v1";
import { CustomResource } from "@pulumi/kubernetes/apiextensions";
import { AppResourceConfig } from "./types";

export class ApiResource extends ComponentResource {
  public readonly deployment: Deployment;
  public readonly service: Service;
  public readonly serviceMonitor: CustomResource;
  public readonly serviceUrl: Output<string>;

  constructor(name: string, config: AppResourceConfig, opts?: ComponentResourceOptions) {
    super("maps:resources:Api", name, {}, opts);

    const deploymentName = `${config.appName}-api`;
    const appVersion = config.image.split(":").pop() || "latest";

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
              containers: [
                {
                  name: `${config.appName}-api`,
                  image: config.image,
                  ports: [{ containerPort: config.port }],
                  env: config.env,
                  resources: config.resources || {
                    limits: {
                      cpu: "500m",
                      memory: "512Mi",
                    },
                    requests: {
                      cpu: "250m",
                      memory: "256Mi",
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
      serviceUrl: this.serviceUrl,
    });
  }
}
