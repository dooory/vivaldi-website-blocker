No testing please

## JavaScript style

Condensed from the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript).

- Use two-space indentation, semicolons, single-quoted strings, and template literals for interpolation.
- Limit code to 100 columns, except long strings/templates. Remove trailing spaces; end files with one newline.
- Use trailing commas in multiline lists, operator/object-brace spacing, and blank lines after blocks.
- Default to `const`; use `let` for reassignment, never `var`. Declare variables separately near use.
- Use descriptive `camelCase` names, `PascalCase` for classes, and `UPPER_SNAKE_CASE` for fixed constants.
- Prefer literals, shorthand properties/methods, destructuring, spread, and dot access for fixed properties.
- Use named function expressions and arrow callbacks. Parenthesize arrow parameters; return explicitly in multiline callbacks. Define before use.
- Prefer array methods and `Object.entries()` over loops. Avoid parameter mutation; use defaults/rest.
- Use strict equality, braces for multiline blocks, early returns, and parentheses for mixed logical operators. Wrap long conditions with leading operators.
- Avoid `eval`, redundant `else`, nested ternaries, and `++`/`--`. Place `//` comments above code.

## Project conventions

- Separate listener registrations and independent setup or function steps with one blank line. Keep related statements together; do not add blank lines at block starts.
- Keep the Vivaldi mod as a standalone browser script inside its IIFE, with strict mode. Preserve the existing CommonJS exports; do not introduce ES modules, Babel, or build dependencies for style changes.
- Preserve browser API callbacks, validation, storage keys, error handling, and diagnostic console messages.
