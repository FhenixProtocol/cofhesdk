# Changesets

This directory contains the configuration and changeset files for managing versioning and publishing of the `@cofhesdk` monorepo packages.

## What are Changesets?

Changesets are a way to manage versioning and publishing in monorepos. They help you:

- Track what changes you've made to each package
- Automatically bump versions based on the type of changes
- Generate changelogs
- Coordinate releases across multiple packages

## Repository Structure

This monorepo contains the following packages:

- `@cofhesdk/permits` - Core permits functionality
- `@cofhesdk/core` - React components and UI primitives
- `@cofhesdk/adapters` - Adapter utilities
- `@cofhesdk/utils` - Shared utility functions
- `@cofhesdk/eslint-config` - ESLint configuration
- `@cofhesdk/tsconfig` - TypeScript configuration

## How to Use Changesets

### 1. Creating a Changeset

When you make changes to any package, create a changeset to document what changed:

```bash
pnpm changeset
```

This will:

- Show you which packages have changed
- Ask you to select which packages are affected
- Ask you to select the type of change (patch, minor, or major)
- Ask you to write a description of the changes

### 2. Types of Changes

- **Patch** (`0.0.1` → `0.0.2`): Bug fixes, small improvements
- **Minor** (`0.0.1` → `0.1.0`): New features, new APIs (backward compatible)
- **Major** (`0.0.1` → `1.0.0`): Breaking changes, removed APIs

### 3. Changeset Files

When you create a changeset, a new file will be created in this directory with a format like:

```
---
"@cofhesdk/permits": patch
"@cofhesdk/core": minor
---

Add new permit validation functionality and update core components
```

### 4. Versioning Packages

To apply changesets and bump package versions:

```bash
pnpm version-packages
```

This will:

- Read all changeset files
- Update package.json versions
- Update changelogs
- Remove the changeset files

### 5. Publishing

To publish packages to npm:

```bash
pnpm release
```

This will:

- Build all packages
- Publish to npm registry
- Create git tags

## Automated Workflow

This repository uses GitHub Actions for automated releases:

1. **Pull Request Creation**: When changesets are merged to `main`, the changesets bot creates a "Version Packages" PR
2. **Review**: Review the version bumps and changelog updates
3. **Merge**: Merge the PR to trigger the release
4. **Publish**: GitHub Actions automatically publishes to npm

## Configuration

The changeset configuration is in `config.json`:

- **Base Branch**: `main`
- **Access**: `public` (packages are published publicly)
- **Update Internal Dependencies**: `patch` (internal deps get patch bumps)
- **Ignore**: `@cofhesdk/docs` (docs package is not published)

## Best Practices

1. **Create changesets for every change** that affects a package's public API
2. **Be descriptive** in your changeset messages - they become the changelog
3. **Group related changes** in a single changeset when possible
4. **Review version bumps** before merging the "Version Packages" PR
5. **Test thoroughly** before publishing major versions

## Common Commands

```bash
# Create a new changeset
pnpm changeset

# Apply changesets and bump versions
pnpm version-packages

# Build and publish packages
pnpm release

# Check what changesets are pending
pnpm changeset status
```

## Troubleshooting

- **Missing changeset**: If you forget to create a changeset, you can create one after the fact
- **Wrong version type**: You can edit changeset files before running `version-packages`
- **Publishing issues**: Check that you have the correct npm permissions and tokens

## Resources

- [Changesets Documentation](https://github.com/changesets/changesets)
- [Common Questions](https://github.com/changesets/changesets/blob/main/docs/common-questions.md)
- [Automating Changesets](https://github.com/changesets/changesets/blob/main/docs/automating-changesets.md)
