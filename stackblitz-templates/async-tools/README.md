# Torque Async Tools - Interactive Playground

Learn how to model conversations with long-running tool operations.

## 🎯 What This Example Does

Models realistic async tool usage:
1. **Tool call** - Assistant calls the tool
2. **Acknowledgment** - Immediate `<tool_ack />` response
3. **Filler conversation** - User and assistant chat while waiting
4. **Final result** - Tool completes and returns real data

This pattern trains LLMs to handle async operations naturally.

## 🔑 Setup Instructions

1. Click the **🔒 lock icon** in the bottom left
2. Add: `OPENAI_API_KEY` = your OpenAI API key
3. Click **"▶️ Run"** or press `Ctrl+Enter`

## 📚 Learn More

- [Full Documentation](https://github.com/qforge-dev/torque)
- [Async Tools Example](https://github.com/qforge-dev/torque#async-tool-pattern)

## 💡 Try Modifying

- Change the filler conversation range (currently 1-3)
- Add more tool types (database queries, API calls, etc.)
- Create multi-stage async flows
- Add progress updates during filler conversation

