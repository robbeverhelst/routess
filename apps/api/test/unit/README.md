# Unit Tests

This directory is reserved for unit tests that test individual functions, classes, and components in isolation.

Currently, unit tests are co-located with source files using the `*.spec.ts` pattern in the `src/` directory.

## Future Organization

As the codebase grows, consider moving unit tests here and organizing them by domain:

```
unit/
├── services/
│   ├── auth.service.spec.ts
│   ├── users.service.spec.ts
│   └── routes.service.spec.ts
├── controllers/
│   ├── auth.controller.spec.ts
│   ├── users.controller.spec.ts
│   └── routes.controller.spec.ts
├── guards/
│   └── jwt-auth.guard.spec.ts
└── utils/
    └── validation.utils.spec.ts
```

## Guidelines

- Test single functions/methods in isolation
- Mock all external dependencies
- Focus on business logic and edge cases
- Keep tests fast and independent
