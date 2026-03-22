import type { GraphSnapshot } from "@/knitgraph/snapshot";

export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type WorkerNodeState = {
  id: number;
  position: Vec3;
  normal: Vec3;
  force: Vec3;
  knitPath: Vec3[];
};

export enum GraphWorkerMessageType {
  Init,
  StartSim,
  StopSim,
  Cancel,
  Ready,
  SimulationStep,
  SimStopped,
  Canceled,
  Error,
}

export type GraphWorkerInitMessage = {
  type: GraphWorkerMessageType.Init;
  runId: number;
  snapshot: GraphSnapshot;
};

export type GraphWorkerStartSimMessage = {
  type: GraphWorkerMessageType.StartSim;
  runId: number;
  timeStep: number;
};

export type GraphWorkerStopSimMessage = {
  type: GraphWorkerMessageType.StopSim;
  runId: number;
};

export type GraphWorkerCancelMessage = {
  type: GraphWorkerMessageType.Cancel;
  runId: number;
};

export type GraphWorkerRequest =
  | GraphWorkerInitMessage
  | GraphWorkerStartSimMessage
  | GraphWorkerStopSimMessage
  | GraphWorkerCancelMessage;

export type GraphWorkerReadyMessage = {
  type: GraphWorkerMessageType.Ready;
  runId: number;
  nodeStates: WorkerNodeState[];
};

export type GraphWorkerSimFrameMessage = {
  type: GraphWorkerMessageType.SimulationStep;
  runId: number;
  step: number;
  accDelta: number;
  nodeStates: WorkerNodeState[];
};

export type GraphWorkerSimStoppedMessage = {
  type: GraphWorkerMessageType.SimStopped;
  runId: number;
  step: number;
};

export type GraphWorkerCanceledMessage = {
  type: GraphWorkerMessageType.Canceled;
  runId: number;
};

export type GraphWorkerErrorMessage = {
  type: GraphWorkerMessageType.Error;
  runId: number;
  message: string;
};

export type GraphWorkerResponse =
  | GraphWorkerReadyMessage
  | GraphWorkerSimFrameMessage
  | GraphWorkerSimStoppedMessage
  | GraphWorkerCanceledMessage
  | GraphWorkerErrorMessage;
