export type ServiceLifecycleStatus =
  | "RUNNING"
  | "STOPPING"
  | "STOPPED"
  | "STARTING"
  | "FAILED";

export type ServiceStatusResult = {
  serviceId: string;
  environmentId: string;
  status: ServiceLifecycleStatus;
  rawDeploymentStatus: string;
  deploymentId?: string;
};

export type DeploymentStatusResult = {
  deploymentId: string;
  status: string;
  createdAt: string;
  serviceId: string;
  environmentId: string;
};
