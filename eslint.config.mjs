import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["tests/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: "Tests must use injected release responses.",
        },
        {
          name: "setInterval",
          message: "Tests must synchronize explicitly instead of polling.",
        },
        {
          name: "setTimeout",
          message: "Tests must not sleep for synchronization.",
        },
      ],
    },
  },
);
