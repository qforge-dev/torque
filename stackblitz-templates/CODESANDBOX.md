# CodeSandbox Alternative Setup

CodeSandbox is an excellent alternative to StackBlitz for running TypeScript examples in the browser.

## Why CodeSandbox?

- ✅ Similar to StackBlitz - full Node.js in browser
- ✅ Great GitHub integration
- ✅ Strong TypeScript support
- ✅ Good performance and reliability
- ✅ Free for public projects

## Setup for CodeSandbox

### Method 1: GitHub Integration (Recommended)

CodeSandbox automatically works with GitHub repos. Users can access any template with:

```
https://codesandbox.io/p/github/qforge-dev/torque/main?file=/stackblitz-templates/[example-name]/index.ts
```

Example URLs:

- Quick Start: `https://codesandbox.io/p/github/qforge-dev/torque/main?file=/stackblitz-templates/quick-start/index.ts`
- Tool Calling: `https://codesandbox.io/p/github/qforge-dev/torque/main?file=/stackblitz-templates/tool-calling/index.ts`

### Method 2: Manual Project Creation

1. Go to [codesandbox.io/s](https://codesandbox.io/s)
2. Choose "Node.js" or "Vanilla" template
3. Upload files from template directory
4. Share the generated URL

### Method 3: Import from StackBlitz

CodeSandbox can import StackBlitz projects:

1. Open your StackBlitz project
2. Get the project URL
3. Import to CodeSandbox via GitHub or direct import

## Environment Variables in CodeSandbox

Users need to add their OpenAI API key:

1. Click **"Secrets"** in the left sidebar (or Settings)
2. Add key: `OPENAI_API_KEY`
3. Add value: Their OpenAI API key
4. The environment variable is now available

## Differences from StackBlitz

| Feature             | StackBlitz       | CodeSandbox |
| ------------------- | ---------------- | ----------- |
| Node.js Support     | ✅ WebContainers | ✅ Devboxes |
| GitHub Integration  | ✅               | ✅          |
| Free Tier           | ✅               | ✅          |
| Offline Mode        | ✅               | ❌          |
| VS Code Integration | ✅               | ✅          |
| Performance         | Fast             | Fast        |

Both are excellent choices!

## Adding CodeSandbox Badges to README

If you want to offer both options, add badges like:

```markdown
[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/...)
[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/github/...)
```

## Template Compatibility

All templates in `stackblitz-templates/` work identically in CodeSandbox:

- ✅ Same file structure
- ✅ Same package.json
- ✅ Same TypeScript config
- ✅ Same environment variable pattern

No modifications needed!

## Recommendation

**Use StackBlitz as primary, mention CodeSandbox as alternative:**

```markdown
Try in: [StackBlitz](https://stackblitz.com/...) | [CodeSandbox](https://codesandbox.io/...)
```

This gives users choice while keeping documentation simple.
