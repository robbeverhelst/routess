import { ComponentResource, ComponentResourceOptions, Output, interpolate } from "@pulumi/pulumi";
import { Chart } from "@pulumi/kubernetes/helm/v4";
import { PostgresResourceConfig } from "./types";

export class PostgresResource extends ComponentResource {
  public readonly chart: Chart;
  public readonly serviceUrl: Output<string>;
  public readonly serviceName: Output<string>;

  constructor(name: string, config: PostgresResourceConfig, opts?: ComponentResourceOptions) {
    super("maps:resources:Postgres", name, {}, opts);

    this.chart = new Chart(
      `${config.appName}-postgres`,
      {
        chart: "oci://registry-1.docker.io/bitnamicharts/postgresql",
        version: "15.5.36",
        namespace: config.namespace,
        values: {
          auth: {
            postgresPassword: config.password,
            username: config.username,
            password: config.password,
            database: config.database,
          },
          primary: {
            persistence: config.persistence || {
              enabled: true,
              size: "10Gi",
              storageClass: "truenas-hdd-mirror-iscsi",
            },
            resources: config.resources?.primary || {
              limits: {
                cpu: "500m",
                memory: "512Mi",
              },
              requests: {
                cpu: "250m",
                memory: "256Mi",
              },
            },
          },
          metrics: {
            enabled: true,
            resources: config.resources?.metrics || {
              limits: {
                cpu: "100m",
                memory: "128Mi",
              },
              requests: {
                cpu: "50m",
                memory: "64Mi",
              },
            },
          },
        },
      },
      {
        provider: config.provider,
        dependsOn: config.dependencies,
        parent: this,
        transformations: [
          (args: any) => {
            if (args.type === "kubernetes:apps/v1:StatefulSet") {
              return {
                ...args,
                opts: {
                  ...args.opts,
                  serverSideApply: true,
                },
              };
            }
            return undefined;
          },
        ],
      },
    );

    this.serviceName = interpolate`${config.appName}-postgres-postgresql`;
    this.serviceUrl = interpolate`${this.serviceName}.${config.namespace}.svc.cluster.local:5432`;

    this.registerOutputs({
      chart: this.chart,
      serviceUrl: this.serviceUrl,
      serviceName: this.serviceName,
    });
  }
}
