declare module "@mediapipe/pose" {
  export type Results = {
    poseLandmarks?: Array<{ x: number; y: number }>;
    image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
  };

  export const POSE_CONNECTIONS: Array<[number, number]>;

  export class Pose {
    constructor(options: { locateFile: (file: string) => string });
    setOptions(options: {
      modelComplexity?: number;
      smoothLandmarks?: boolean;
      enableSegmentation?: boolean;
      selfieMode?: boolean;
    }): void;
    onResults(callback: (results: Results) => void): void;
    send(input: { image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement }): Promise<void>;
    close(): void;
  }
}

declare module "@mediapipe/drawing_utils" {
  export function drawConnectors(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number }>,
    connections: Array<[number, number]>,
    style?: { color?: string; lineWidth?: number }
  ): void;
  export function drawLandmarks(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number }>,
    style?: { color?: string; lineWidth?: number }
  ): void;
}
