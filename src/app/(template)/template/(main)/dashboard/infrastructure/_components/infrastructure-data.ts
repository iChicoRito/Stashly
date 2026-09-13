import type { SimpleIcon } from "simple-icons";
import { siNodedotjs, siReact, siRemix, siVite } from "simple-icons";

export interface InfrastructureEnvironment {
  domain: string;
  platform: {
    name: string;
    icon: SimpleIcon;
  };
  environment: "Expired" | "Production" | "Staging";
  status: "Online" | "Unhealthy";
  latency: string;
  uptime: string;
  server: string;
  countryCode: string;
  plan: string;
  resources: {
    cpu: number;
    ram: number;
    disk: number;
  };
}

export interface InfrastructureGroup {
  name: string;
  organization: string;
  rows: InfrastructureEnvironment[];
}

export const infrastructureGroups: InfrastructureGroup[] = [
  {
    name: "Admin Console",
    organization: "Weblabs Studio",
    rows: [
      {
        domain: "stashly.local/dashboard",
        platform: {
          name: "Vite",
          icon: siVite,
        },
        environment: "Expired",
        status: "Unhealthy",
        latency: "86ms",
        uptime: "8d 23h",
        server: "Hetzner Cloud",
        countryCode: "DE",
        plan: "CX33, Falkenstein",
        resources: { cpu: 60, ram: 73, disk: 41 },
      },
    ],
  },
  {
    name: "Analytics",
    organization: "Aiy Cap",
    rows: [
      {
        domain: "stashly.local/analytics",
        platform: {
          name: "React",
          icon: siReact,
        },
        environment: "Production",
        status: "Online",
        latency: "246ms",
        uptime: "9d 23h",
        server: "AWS",
        countryCode: "NL",
        plan: "eu-west-1, Amsterdam",
        resources: { cpu: 49, ram: 42, disk: 44 },
      },
      {
        domain: "stashly.local/reports",
        platform: {
          name: "Remix",
          icon: siRemix,
        },
        environment: "Staging",
        status: "Online",
        latency: "110ms",
        uptime: "9d 23h",
        server: "Azure",
        countryCode: "EE",
        plan: "North Europe, Tallinn",
        resources: { cpu: 37, ram: 46, disk: 64 },
      },
    ],
  },
  {
    name: "Kanban",
    organization: "Storeframe",
    rows: [
      {
        domain: "stashly.local/kanban",
        platform: {
          name: "Node.js",
          icon: siNodedotjs,
        },
        environment: "Production",
        status: "Online",
        latency: "25ms",
        uptime: "10d 23h",
        server: "Bare Metal / Custom",
        countryCode: "DE",
        plan: "EX101, Falkenstein",
        resources: { cpu: 1, ram: 21, disk: 4 },
      },
    ],
  },
  {
    name: "Inbox",
    organization: "Acme Corp",
    rows: [],
  },
];
