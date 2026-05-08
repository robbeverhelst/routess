type Recorder = (operation: string, duration: number) => void;

let recorder: Recorder | null = null;

export function setDbMetricsRecorder(fn: Recorder | null) {
	recorder = fn;
}

export function recordDbQueryIfEnabled(operation: string, duration: number) {
	recorder?.(operation, duration);
}
