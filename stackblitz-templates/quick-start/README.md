# Torque Quick Start - Interactive Playground

Welcome to the Torque interactive playground! This is the simplest example to get started with Torque.

## 🎯 What This Example Does

- Generates 2 conversation examples
- Uses AI to create varied user greetings
- Randomly picks between static or AI-generated assistant responses
- Saves output to `data/quick-start.jsonl`

## 🔑 Setup Instructions

**You need an OpenAI API key to run this example.**

### Step 1: Add Your API Key

1. Click the **🔒 lock icon** in the bottom left corner of StackBlitz
2. Click "Add environment variable"
3. Name: `OPENAI_API_KEY`
4. Value: Your OpenAI API key (get one from [platform.openai.com](https://platform.openai.com))
5. Click "Add"

### Step 2: Run the Example

- Click the **"▶️ Run"** button at the top, or
- Press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac)

### Step 3: View Results

- Check the terminal output to see progress
- Open `data/quick-start.jsonl` in the file tree to see the generated dataset

## 📚 Learn More

- **Documentation**: [github.com/qforge-dev/torque](https://github.com/qforge-dev/torque)
- **More Examples**: Check out other interactive examples for advanced features
- **Install Locally**: `npm install @qforge/torque` or `bun add @qforge/torque`

## 💡 Try Modifying

- Change `count: 2` to generate more examples
- Modify the prompts to generate different types of messages
- Add more response variations in the `oneOf` array
- Try different seeds to see reproducible generation

## 🐛 Troubleshooting

- **"OPENAI_API_KEY not found"**: Make sure you added the environment variable (see Step 1)
- **Rate limits**: If you hit rate limits, reduce the `count` or wait a moment
- **Dependencies not installing**: Click "Install dependencies" in the terminal

