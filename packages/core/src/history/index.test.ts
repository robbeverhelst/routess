import { describe, expect, it } from "bun:test";
import { canRedo, canUndo, emptyHistory, recordSnapshot, redoStep, undoStep } from "./index";

describe("history", () => {
	it("starts empty with nothing to undo or redo", () => {
		const history = emptyHistory<number>();
		expect(canUndo(history)).toBe(false);
		expect(canRedo(history)).toBe(false);
		expect(undoStep(history, 1)).toBeNull();
		expect(redoStep(history, 1)).toBeNull();
	});

	it("undo returns the last snapshot and moves the current value to the future", () => {
		let history = emptyHistory<number>();
		history = recordSnapshot(history, 1);
		history = recordSnapshot(history, 2);

		const undone = undoStep(history, 3);
		expect(undone?.previous).toBe(2);
		expect(undone?.history).toEqual({ past: [1], future: [3] });
	});

	it("redo walks back what undo moved", () => {
		let history = recordSnapshot(emptyHistory<number>(), 1);
		const undone = undoStep(history, 2);
		if (!undone) throw new Error("expected an undo step");
		history = undone.history;
		expect(canRedo(history)).toBe(true);

		const redone = redoStep(history, undone.previous);
		expect(redone?.next).toBe(2);
		expect(redone?.history).toEqual({ past: [1], future: [] });
	});

	it("recording a snapshot clears the redo stack", () => {
		const undone = undoStep(recordSnapshot(emptyHistory<number>(), 1), 2);
		if (!undone) throw new Error("expected an undo step");
		const history = recordSnapshot(undone.history, 5);
		expect(history.future).toEqual([]);
		expect(history.past).toEqual([5]);
	});

	it("caps the undo stack at maxDepth, dropping the oldest snapshots", () => {
		let history = emptyHistory<number>();
		for (let i = 1; i <= 5; i++) history = recordSnapshot(history, i, { maxDepth: 3 });
		expect(history.past).toEqual([3, 4, 5]);
	});

	it("defaults to a depth of 50", () => {
		let history = emptyHistory<number>();
		for (let i = 1; i <= 60; i++) history = recordSnapshot(history, i);
		expect(history.past).toHaveLength(50);
		expect(history.past[0]).toBe(11);
	});

	it("skips a snapshot equal to the last one when an equals function is given", () => {
		const equals = (a: number[], b: number[]) => a.join() === b.join();
		const first = recordSnapshot(emptyHistory<number[]>(), [1, 2], { equals });
		const second = recordSnapshot(first, [1, 2], { equals });
		expect(second).toBe(first);
		expect(recordSnapshot(first, [1, 3], { equals }).past).toHaveLength(2);
	});

	it("records duplicates when no equals function is given", () => {
		const history = recordSnapshot(recordSnapshot(emptyHistory<number>(), 1), 1);
		expect(history.past).toEqual([1, 1]);
	});

	it("never mutates the input stacks", () => {
		const history = recordSnapshot(emptyHistory<number>(), 1);
		const frozen = structuredClone(history);
		recordSnapshot(history, 2);
		undoStep(history, 2);
		expect(history).toEqual(frozen);
	});
});
