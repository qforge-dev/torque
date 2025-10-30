# StackBlitz Templates for Torque

This directory contains interactive playground templates for all Torque examples. Users can run these examples directly in their browser with their own OpenAI API key.

## Available Templates

1. **quick-start** - Simplest example to get started
2. **basic-conversation** - Static and AI-generated conversations
3. **composition-utilities** - oneOf, times, between, optional
4. **schema-composition** - Reusable conversation patterns
5. **tool-calling** - Tool definitions and usage
6. **multiple-tool-variations** - Multiple tools with random selection
7. **async-tools** - Long-running tool operations pattern
8. **custom-generation-context** - Customizing AI generation behavior

## How to Create StackBlitz Projects

### Method 1: Manual Upload (Recommended)

1. Go to [stackblitz.com](https://stackblitz.com)
2. Click "New Project" → "Node.js"
3. Upload files from any template directory
4. Click "Share" → "Get shareable link"
5. Add the link to the main README.md

### Method 2: StackBlitz SDK (Programmatic)

```typescript
import sdk from '@stackblitz/sdk';

sdk.openProject({
  files: {
    'index.ts': '...',
    'package.json': '...',
    // ... other files
  },
  title: 'Torque Quick Start',
  description: 'Interactive Torque playground',
  template: 'node',
});
```

### Method 3: GitHub Integration

If you push these templates to a GitHub repo, users can open them directly:
```
https://stackblitz.com/github/your-org/torque/tree/main/stackblitz-templates/quick-start
```

## StackBlitz URL Format

Each template can be accessed with a URL like:
```
https://stackblitz.com/edit/torque-[example-name]
```

## Adding to Main README

Once projects are created on StackBlitz, add badges/links like:

```markdown
- [quick-start.ts](examples/quick-start.ts) - [▶️ Try in StackBlitz](https://stackblitz.com/edit/torque-quick-start)
```

## User Instructions

All templates include:
- ✅ Pre-configured package.json with all dependencies
- ✅ Ready-to-run TypeScript code
- ✅ Clear instructions for adding API key
- ✅ Helpful README with explanations

Users only need to:
1. Click the StackBlitz link
2. Add their OPENAI_API_KEY environment variable
3. Click "Run"

