import type { Finish } from "./materials";
import type { Service } from "./sinapi";
import type { ObservedCalibration } from "./prices_observed";

export type ServicePost = {
  serviceId: string;
  surface: number;
  modifiers: Record<string, number>;
  confidence?: number;
  enabled?: boolean;
};

export type Chantier = {
  id: string;
  name: string;
  posts: ServicePost[];
  finish: Finish;
  total: [number, number];
  photoUrl?: string;
  createdAt: string;
};

export type PostEstimate = {
  svc: Service;
  post: ServicePost;
  material: [number, number];
  moBase: [number, number];
  moEncargos: [number, number];
  moFinal: [number, number];      // moBase + moEncargos
  bdi: [number, number];
  contingencia: [number, number];
  total: [number, number];         // matériel + MO final + BDI + contingência
  days: number;
  observedSource: ObservedCalibration | null;
};

export type ChantierEstimate = {
  estimates: PostEstimate[];
  total: [number, number];
  material: [number, number];
  moBase: [number, number];
  moEncargos: [number, number];
  moFinal: [number, number];
  bdi: [number, number];
  contingencia: [number, number];
  days: number;
  workers: number;
};
