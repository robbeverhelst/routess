// Create a simple mock system for Bun
export const createMockFn = () => {
  let implementation: any = null;
  let resolvedValue: any = null;
  let rejectedValue: any = null;
  let calls: any[][] = [];

  const mockFn = (...args: any[]) => {
    calls.push(args);
    if (rejectedValue) {
      return Promise.reject(rejectedValue);
    }
    if (resolvedValue) {
      return Promise.resolve(resolvedValue);
    }
    if (implementation) {
      return implementation(...args);
    }
    return undefined;
  };

  mockFn.mockResolvedValue = (value: any) => {
    resolvedValue = value;
    rejectedValue = null;
    return mockFn;
  };

  mockFn.mockRejectedValue = (error: any) => {
    rejectedValue = error;
    resolvedValue = null;
    return mockFn;
  };

  mockFn.mockImplementation = (impl: any) => {
    implementation = impl;
    return mockFn;
  };

  mockFn.mockClear = () => {
    calls = [];
    return mockFn;
  };

  mockFn.getCalls = () => calls;

  return mockFn;
};

// Create global jest mock for compatibility
(global as any).jest = {
  fn: createMockFn,
  clearAllMocks: () => {},
};
