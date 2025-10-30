# Setting Up StackBlitz Interactive Playgrounds

This guide explains how to deploy the interactive playgrounds to StackBlitz.

## Quick Setup Steps

### 1. Create StackBlitz Account

Go to [stackblitz.com](https://stackblitz.com) and sign in with GitHub.

### 2. Create Projects for Each Template

For each directory in `stackblitz-templates/`:

1. Visit [stackblitz.com/fork/node](https://stackblitz.com/fork/node)
2. Delete the default files
3. Upload all files from the template directory:
   - `index.ts`
   - `package.json`
   - `README.md`
   - `tsconfig.json`
   - `.stackblitzrc`
4. Click "Save" (Ctrl/Cmd + S)
5. Click "Share" button → Copy the share URL
6. Save the URL for the README update

### 3. Naming Convention

Use these project names:
- `torque-quick-start`
- `torque-basic-conversation`
- `torque-composition-utilities`
- `torque-schema-composition`
- `torque-tool-calling`
- `torque-multiple-tool-variations`
- `torque-async-tools`
- `torque-custom-generation-context`

### 4. Alternative: GitHub Integration

**Recommended for easier maintenance:**

1. Push `stackblitz-templates/` to the repository
2. Users can open any example with:
   ```
   https://stackblitz.com/github/qforge-dev/torque/tree/main/stackblitz-templates/[example-name]
   ```

This approach auto-syncs with your repo - no manual updates needed!

## CodeSandbox Alternative

CodeSandbox also supports Node.js projects. Similar setup:

1. Go to [codesandbox.io/s](https://codesandbox.io/s)
2. Choose "Node.js" template
3. Upload template files
4. Share the URL

CodeSandbox URLs look like:
```
https://codesandbox.io/s/torque-quick-start-abc123
```

## Recommended Approach

**Best option: GitHub Integration**

Simply reference the stackblitz-templates in your repo:

```markdown
[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/qforge-dev/torque/tree/main/stackblitz-templates/quick-start)
```

This requires NO manual project creation and stays in sync with your code!

## Testing

Before publishing, test each template:
1. Open the StackBlitz project
2. Add a dummy `OPENAI_API_KEY` environment variable
3. Verify dependencies install correctly
4. Check that the code runs (may fail at API call without real key)

## Embedding in Documentation

You can also embed StackBlitz directly in docs:

```html
<iframe 
  src="https://stackblitz.com/edit/torque-quick-start?embed=1&file=index.ts"
  style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;">
</iframe>
```

