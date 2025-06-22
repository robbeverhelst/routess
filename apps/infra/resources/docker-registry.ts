import { ComponentResource, ComponentResourceOptions, interpolate } from "@pulumi/pulumi";
import { Secret } from "@pulumi/kubernetes/core/v1";
import { DockerRegistryConfig } from "./types";

export class DockerRegistrySecret extends ComponentResource {
  public readonly secret: Secret;

  constructor(name: string, config: DockerRegistryConfig, opts?: ComponentResourceOptions) {
    super("maps:resources:DockerRegistrySecret", name, {}, opts);

    const authString = interpolate`${config.username}:${config.token}`.apply((s) =>
      Buffer.from(s).toString("base64"),
    );

    const dockerConfigJson = authString.apply((auth) =>
      JSON.stringify({
        auths: {
          [config.registryUrl]: {
            auth: auth,
          },
        },
      }),
    );

    this.secret = new Secret(
      `${config.appName}-ghcr-secret`,
      {
        metadata: {
          name: "ghcr-pull-secret",
          namespace: config.namespace,
        },
        type: "kubernetes.io/dockerconfigjson",
        stringData: {
          ".dockerconfigjson": dockerConfigJson,
        },
      },
      {
        provider: config.provider,
        dependsOn: config.dependencies,
        parent: this,
      },
    );

    this.registerOutputs({
      secret: this.secret,
    });
  }
}
