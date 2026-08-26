export type ServiceInstanceScope = {
  environmentId: string;
  serviceId: string;
};

export type LatestDeploymentRecord = {
  id: string;
  status: string;
  createdAt: string;
};
