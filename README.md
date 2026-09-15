# `@nx/angular-rspack` Script Optimization Reproduction

Minimal reproduction for a production-only issue involving:

* Angular
* `@nx/angular-rspack`
* `@tanstack/angular-virtual@6.0.4`
* Angular signal inputs
* multiple component instances
* production script optimization

When Angular-Rspack script optimization is enabled, multiple instances using `injectVirtualizer()` can incorrectly evaluate the options callback belonging to the **last-created component instance**.

The same issue can also surface as Angular error `NG0950` when the data is provided through `input.required()`.

Development builds work correctly.

Wrapping the `injectVirtualizer()` call in an otherwise redundant IIFE also fixes the production build.

## Problem

Given several component instances:

```html
@for (column of columns(); track column.id) {
    <app-workorder-table
        [name]="column.id"
        [workorders]="column.workorders"
    />
}
```

with different item counts:

```text
Component 1 → 8 items
Component 2 → 7 items
Component 3 → 1 item
Component 4 → 1 item
Component 5 → 1 item
```

and a component using:

```ts
readonly items = input.required<Item[]>();

readonly virtualizer = injectVirtualizer(() => ({
    scrollElement: this.scrollElement(),
    count: this.items().length,
    estimateSize: () => 60,
    overscan: 10,
}));
```

the application behaves correctly in development.

In an optimized production build, however, every virtualizer options callback can execute against the final component instance.

Expected output:

```text
INPUT 1 8
VIRTUALIZER 1 8
INPUT 2 7
VIRTUALIZER 2 7
INPUT 3 1
VIRTUALIZER 3 1
INPUT 4 1
VIRTUALIZER 4 1
INPUT 5 1
VIRTUALIZER 5 1
```

Actual production output:

```text
INPUT 1 8
VIRTUALIZER 5 0
INPUT 2 7
VIRTUALIZER 5 0
INPUT 3 1
VIRTUALIZER 5 0
INPUT 4 1
VIRTUALIZER 5 0
INPUT 5 1
VIRTUALIZER 5 1
VIRTUALIZER 5 1
VIRTUALIZER 5 1
VIRTUALIZER 5 1
VIRTUALIZER 5 1
```

This means the component instances themselves are created correctly, but the lazy callback passed to `injectVirtualizer()` is no longer isolated per component instance after production script optimization.

## `NG0950`

When using:

```ts
readonly items = input.required<Item[]>();
```

the same issue may initially appear as:

```text
NG0950: Input is required but no value is available yet.
```

This appears to be another symptom of the same problem.

If the wrong component callback is evaluated before that instance has received its required input, the callback executes:

```ts
this.items()
```

before Angular has initialized that input.

## Workaround

Wrapping the exact same `injectVirtualizer()` call in an IIFE fixes both problems:

```ts
readonly items = input.required<Item[]>();

readonly virtualizer = (() =>
    injectVirtualizer(() => ({
        scrollElement: this.scrollElement(),
        count: this.items().length,
        estimateSize: () => 60,
        overscan: 10,
    }))
)();
```

This works correctly in optimized production builds.

The IIFE should be semantically equivalent to the direct class-field initializer, but the additional lexical boundary prevents the issue.

## Broken Version

```ts
readonly virtualizer = injectVirtualizer(() => ({
    scrollElement: this.scrollElement(),
    count: this.items().length,
    estimateSize: () => 60,
    overscan: 10,
}));
```

## Working Version

```ts
readonly virtualizer = (() =>
    injectVirtualizer(() => ({
        scrollElement: this.scrollElement(),
        count: this.items().length,
        estimateSize: () => 60,
        overscan: 10,
    }))
)();
```

## Reproduction

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
nx serve
```

The component instances should behave correctly.

Then create and serve a production build:

```bash
nx build
npx http-server -p 4200 -c-1 dist/nx-angular-tanstack-virtual-multi-instance-repo/browser/
```

The direct `injectVirtualizer()` initializer should reproduce the issue.

Check the browser console for the instance IDs and item counts.

## Diagnostic Logging

The reproduction assigns an ID to every component instance:

```ts
private static nextId = 0;

readonly instanceId = ++VirtualListComponent.nextId;
```

Input changes are logged independently:

```ts
effect(() => {
    console.log(
        'INPUT',
        this.instanceId,
        this.items().length,
    );
});
```

The virtualizer callback logs the instance it belongs to:

```ts
readonly virtualizer = injectVirtualizer(() => {
    console.log(
        'VIRTUALIZER',
        this.instanceId,
        this.items().length,
    );

    return {
        scrollElement: this.scrollElement(),
        count: this.items().length,
        estimateSize: () => 60,
        overscan: 10,
    };
});
```

In the broken production build, the inputs remain correct:

```text
INPUT 1 8
INPUT 2 7
INPUT 3 1
INPUT 4 1
INPUT 5 1
```

while the virtualizer callbacks resolve to the last component:

```text
VIRTUALIZER 5 1
VIRTUALIZER 5 1
VIRTUALIZER 5 1
VIRTUALIZER 5 1
VIRTUALIZER 5 1
```

This rules out shared component input state.

## Findings

The following configurations were tested.

| Configuration                                                | Result                          |
| ------------------------------------------------------------ | ------------------------------- |
| Development build                                            | ✅ Works                         |
| Production build                                             | ❌ Fails                         |
| `@tanstack/angular-virtual@4.0.13`                           | ✅ Works                         |
| `@tanstack/angular-virtual@6.0.4`                            | ❌ Fails in optimized production |
| `6.0.4` + IIFE around `injectVirtualizer()`                  | ✅ Works                         |
| Rspack `optimization: false`                                 | ✅ Works                         |
| Rspack `optimization.minimize: false`                        | ✅ Works                         |
| SWC minimizer                                                | ❌ Fails                         |
| SWC with `compress: false`                                   | ❌ Fails                         |
| SWC with `mangle: false`                                     | ❌ Fails                         |
| SWC with `compress: false`, `mangle: false`, `minify: false` | ❌ Fails                         |
| Terser minimizer                                             | ❌ Fails                         |
| CSS minimizer only                                           | ❌ Fails                         |
| No-op minimizer                                              | ❌ Fails                         |
| Angular-Rspack `optimization.scripts: false`                 | ✅ Works                         |

The most significant result is:

```ts
options: {
    optimization: {
        scripts: false,
        styles: true,
        fonts: true,
    },
},
rspackConfigOverrides: {
    optimization: {
        minimize: true,
    },
},
```

works correctly.

At the same time:

```ts
rspackConfigOverrides: {
    optimization: {
        minimize: true,
        minimizer: [new NoopMinimizerPlugin()],
    },
},
```

still fails when Angular-Rspack script optimization is enabled.

This indicates that the problem is not caused specifically by SWC, Terser, or another Rspack minimizer.

The issue appears to be triggered by the **Angular-Rspack script optimization path**.

## Comparison With TanStack Angular Virtual 4

`@tanstack/angular-virtual@4.0.13` does not exhibit the issue.

With version `4.0.13`, the expected instance isolation is preserved:

```text
VIRTUALIZER 1 8
VIRTUALIZER 2 7
VIRTUALIZER 3 1
VIRTUALIZER 4 1
VIRTUALIZER 5 1
```

The issue becomes reproducible with the newer Angular Virtual implementation used by `6.0.4`.

This does not necessarily mean that TanStack Virtual itself is incorrect. The newer implementation appears to produce a code shape that exposes the production optimization issue.

## Current Conclusion

The problem appears to require all of the following:

1. `@nx/angular-rspack` script optimization is enabled.
2. `@tanstack/angular-virtual@6.0.4` is used.
3. `injectVirtualizer()` is initialized directly as a class field.
4. Multiple component instances are created.
5. The options callback captures instance state through `this`.

The resulting optimized bundle can cause all virtualizer callbacks to resolve against the final component instance.

Introducing an additional lexical boundary with an IIFE prevents the problem:

```ts
readonly virtualizer = (() =>
    injectVirtualizer(() => ({
        count: this.items().length,
        // ...
    }))
)();
```

The preferred application workaround is therefore the IIFE rather than disabling script optimization globally.

## Expected Behavior

These two forms should behave equivalently:

```ts
readonly virtualizer = injectVirtualizer(() => ({
    count: this.items().length,
}));
```

and:

```ts
readonly virtualizer = (() =>
    injectVirtualizer(() => ({
        count: this.items().length,
    }))
)();
```

Each component instance should retain its own callback and its own instance state in both development and production builds.

## Actual Behavior

With Angular-Rspack script optimization enabled, the direct class-field initializer may cause multiple component instances to use the options callback/state of the last-created component.

Wrapping the call in an IIFE restores the expected behavior.
