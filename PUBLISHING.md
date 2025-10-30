# Publishing to npm

This guide explains how to build and publish the `torque` package to npm.

## Prerequisites

1. **npm account**: Create one at [npmjs.com](https://www.npmjs.com/signup) if you don't have one
2. **npm authentication**: Log in to npm on your local machine:
   ```bash
   npm login
   ```

## Pre-publish Checklist

Before publishing, make sure to:

1. **Update the version** in `package.json`:
   - Patch release (bug fixes): `0.1.0` → `0.1.1`
   - Minor release (new features): `0.1.0` → `0.2.0`
   - Major release (breaking changes): `0.1.0` → `1.0.0`

2. **Update package metadata** in `package.json`:
   - Set correct `repository.url` (currently points to placeholder)
   - Set correct `bugs.url`
   - Set correct `homepage`
   - Add `author` information

3. **Review the README**: Make sure documentation is up-to-date

4. **Test the build**:
   ```bash
   bun run build
   ```

5. **Verify what will be published**:
   ```bash
   npm pack --dry-run
   ```
   This shows exactly what files will be included in the package.

## Publishing

### First-time publish

For the first publish, you may need to check if the package name is available:

```bash
npm search torque
```

If the name is taken, you'll need to either:
- Choose a different name (update `name` in `package.json`)
- Use a scoped package name like `@yourusername/torque`

### Publish command

The build will automatically run before publishing (via `prepublishOnly` script):

```bash
npm publish
```

For scoped packages, if you want to make it public:

```bash
npm publish --access public
```

### Dry run

To test the publish process without actually publishing:

```bash
npm publish --dry-run
```

## Post-publish

1. **Verify the package**: Check your package at `https://www.npmjs.com/package/torque`
2. **Tag the release** in git:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
3. **Create a GitHub release** with changelog

## Publishing Updates

For subsequent releases:

1. Update the version in `package.json`
2. Commit your changes:
   ```bash
   git add .
   git commit -m "Bump version to x.x.x"
   ```
3. Publish:
   ```bash
   npm publish
   ```
4. Tag and push:
   ```bash
   git tag vx.x.x
   git push origin main --tags
   ```

## Automated Publishing (Optional)

You can set up GitHub Actions to automatically publish to npm when you create a new release. Let me know if you'd like me to set this up!

## Scripts Reference

- `bun run build` - Build the package (compiles TypeScript to JavaScript)
- `bun run clean` - Remove the dist folder
- `bun run compile` - Compile TypeScript files
- `npm pack` - Create a tarball of the package (for testing)
- `npm publish` - Publish to npm registry

## Troubleshooting

### "You do not have permission to publish"
- Make sure you're logged in: `npm whoami`
- If using a scoped package, add `--access public`

### "Package name already exists"
- Choose a different name or use a scoped package name

### Build errors before publish
- The `prepublishOnly` script will catch these
- Fix TypeScript errors and try again

### Wrong files published
- Check `.npmignore` to ensure correct files are excluded
- Use `npm pack --dry-run` to verify

