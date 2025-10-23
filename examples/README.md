# CoFHE SDK Examples

This directory contains example applications demonstrating how to use the CoFHE SDK across different platforms and frameworks.

## Available Examples

### 📱 React Example (`./react/`)

Interactive React application showcasing all CoFHE SDK React components and hooks.

**Features:**
- Interactive component demonstrations
- Dark mode support
- Real-time encryption status
- Material-UI integration
- TypeScript support

**Get Started:**
```bash
cd react
pnpm install
pnpm dev
```

Visit `http://localhost:3000` to see the examples in action.

**Components Showcased:**
- EncryptionButton - Simple button for single value encryption
- EncryptionForm - Multi-field form for batch encryption
- FnxEncryptInput - Advanced input with type selection and progress
- CofheStatus - Connection status indicator
- React Hooks - Direct hook usage examples

See `./react/README.md` for detailed documentation.

---

## Future Examples

This directory is structured to support multiple example types:

- ✅ `react/` - React components and hooks (current)
- 🔜 `vue/` - Vue.js integration (planned)
- 🔜 `node/` - Node.js backend examples (planned)
- 🔜 `vanilla/` - Plain JavaScript examples (planned)

## Project Structure

```
examples/
├── react/              # React example application
│   ├── src/
│   ├── package.json
│   └── README.md
├── vue/                # (Future) Vue.js examples
├── node/               # (Future) Node.js examples
└── README.md           # This file
```

## Contributing

To add a new example:

1. Create a new directory: `examples/{framework}/`
2. Add a `README.md` describing the example
3. Update this file to list the new example
4. Update `pnpm-workspace.yaml` if needed

## Getting Help

- 📚 [SDK Documentation](../packages/sdk/README.md)
- 📘 [React Package Documentation](../packages/react/README.md)
- 💬 [GitHub Issues](https://github.com/your-org/cofhesdk/issues)
