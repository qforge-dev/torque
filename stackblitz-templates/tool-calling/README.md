# Torque Tool Calling - Interactive Playground

Learn how to define tools with Zod schemas and generate conversations with tool calls.

## 🎯 What This Example Does

- Defines two tools: calculator and weather
- Randomly selects one tool per example
- Generates user questions requiring the tool
- Creates tool calls and results with AI
- Saves output to `data/multi-tool-usage.jsonl`

## 🔑 Setup Instructions

1. Click the **🔒 lock icon** in the bottom left
2. Add: `OPENAI_API_KEY` = your OpenAI API key
3. Click **"▶️ Run"** or press `Ctrl+Enter`

## 📚 Learn More

- [Full Documentation](https://github.com/qforge-dev/torque)
- [Tool Calling Guide](https://github.com/qforge-dev/torque#tool-definitions)

## 💡 Try Modifying

- Add a new tool with `tool({ name, description, parameters, output })`
- Change the tool selection logic
- Add multiple tool calls in one conversation
- Try different generation prompts

