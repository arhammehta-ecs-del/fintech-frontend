# Feature Architecture Guide

This project uses **feature-first structure**.
Each feature owns its UI and business logic; app routes live in `src/pages`.

## Folder Rules

Inside each feature, use these folders consistently:

- `components/`: Reusable UI pieces for that feature.
- `hooks/`: Feature-specific hooks and state logic.
- `types.ts`, `utils.ts`, `constants.ts`: Feature-local contracts and pure utilities.

## What Goes Where

- Put a file in `components/` if it can be reused inside the feature.
- Put route composition in `src/pages` and compose feature views from there.
- Keep feature folders focused on domain logic, not router concerns.

## Onboarding Naming Convention

Use explicit onboarding names. Avoid generic `onboarding/` naming without context.

- `company-onboarding` for company onboarding flow components.
- `user-onboarding` for user onboarding flow components.

Examples:

- `src/features/company-list/components/company-onboarding/CompanyOnboardingWizard.tsx`
- `src/features/user-management/components/user-onboarding/UserOnboardingDialog.tsx`

## Routing Convention

- `App.tsx` should import route screens from `src/pages`.
- `pages` can import from `features`, but `features` should not import from `pages`.

## Barrel Exports

Each feature should expose public API from its `index.ts`:

- Export major reusable feature components intentionally.
- Do not export internal-only utilities unless needed outside the feature.

## Quick Checklist (Before Adding Files)

1. Is this route-level? Put it in `src/pages`.
2. Is this reusable UI inside the feature? Put it in `components/`.
3. Is naming explicit (`company` vs `user`)?
4. Is the file exported from feature `index.ts` only if it is part of public API?
