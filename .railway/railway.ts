import { defineRailway, github, postgres, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const PostgresAuditEvents = postgres("Postgres-audit-events", { region: "us-east4-eqdc4a" });
  PostgresAuditEvents.networking = { privateNetworkEndpoint: "postgres-c4oh", tcpProxies: { "5432": {} } };
  const Postgres = postgres("Postgres", { region: "us-east4-eqdc4a" });
  Postgres.networking = { privateNetworkEndpoint: "postgres", tcpProxies: { "5432": {} } };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-east4-eqdc4a", sizeMB: 5000 });
  const postgresVolumeU5H = volume("postgres-volume-U5-H", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-east4-eqdc4a", sizeMB: 5000 });
  const bookingWeb = service("booking-web", {
    build: {
      builder: "NIXPACKS",
      buildCommand: "npm run build:web",
    },
    start: "npm run start -w web",
    healthcheck: "/",
    healthcheckTimeout: 120,
    replicas: { "us-east4-eqdc4a": 1 },
  });
  const bookingApi = service("booking-api", {
    source: github("HawiCaesar/chaos-eng-demo", { branch: "main", checkSuites: false }),
    build: {
      builder: "NIXPACKS",
      buildCommand: "npm run build:api",
    },
    start: "node apps/api/dist/index.js",
    healthcheck: "/health",
    healthcheckTimeout: 120,
    replicas: { "us-east4-eqdc4a": 1 },
  });

  return project("hotel-chaos-simulator", {
    variables: { managed: false },
    resources: [PostgresAuditEvents, bookingWeb, bookingApi, Postgres, postgresVolume, postgresVolumeU5H],
  });
});
