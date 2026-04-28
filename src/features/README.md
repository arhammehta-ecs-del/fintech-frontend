# Feature Architecture Guide

This project uses **feature-first structure**.  
Each feature owns its UI, state, and route entry points.

## Folder Rules

Inside each feature, use these folders consistently:

- `components/`: Reusable UI pieces for that feature.
- `hooks/`: Feature-specific hooks and state logic.
- `entry/`: Route-level screens/containers (what routes render).
- `types.ts`, `utils.ts`, `constants.ts`: Feature-local contracts/helpers.

## What Goes Where

- Put a file in `components/` if it can be reused inside the feature.
- Put a file in `entry/` if it is a route-facing screen/container.
- Keep `pages/` only for true app pages that are intentionally global.

## Onboarding Naming Convention

Use explicit onboarding names. Avoid generic `onboarding/` naming without context.

- `company-onboarding` for company onboarding flow components.
- `user-onboarding` for user onboarding flow components.

Examples:

- `src/features/company-list/components/company-onboarding/CompanyOnboardingWizard.tsx`
- `src/features/user-management/components/user-onboarding/UserOnboardingDialog.tsx`

## Routing Convention

- `App.tsx` should import route screens from feature `entry` (or intentional top-level pages).
- Avoid thin page wrappers that only re-export feature components unless there is a strong reason.

## Barrel Exports

Each feature should expose public API from its `index.ts`:

- Export route screens (from `entry`) that app routing needs.
- Export major reusable feature components intentionally.
- Do not export internal-only helpers unless needed outside the feature.

## Quick Checklist (Before Adding Files)

1. Is this route-level? Put it in `entry/`.
2. Is this reusable UI inside the feature? Put it in `components/`.
3. Is naming explicit (`company` vs `user`)?
4. Is the file exported from feature `index.ts` only if it is part of public API?
