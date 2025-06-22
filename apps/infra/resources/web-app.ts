import { ComponentResource, ComponentResourceOptions, Output, interpolate } from "@pulumi/pulumi";
import { Deployment } from "@pulumi/kubernetes/apps/v1";
import { Service } from "@pulumi/kubernetes/core/v1";
import { AppResourceConfig } from "./types";

export class WebAppResource extends ComponentResource {
  public readonly deployment: Deployment;
  public readonly service: Service;
  public readonly serviceUrl: Output<string>;

  constructor(name: string, config: AppResourceConfig, opts?: ComponentResourceOptions) {
    super("maps:resources:WebApp", name, {}, opts);

    const deploymentName = `${config.appName}-web`;
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
          strategy: { type: "Recreate" },
          template: {
            metadata: {
              labels: config.labels,
              annotations: {
                "app.kubernetes.io/version": appVersion,
              },
            },
            spec: {
              containers: [
                {
                  name: `${config.appName}-web`,
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
      serviceUrl: this.serviceUrl,
    });
  }
}
