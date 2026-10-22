# Shared UI conventions

Use the controls in `components/ui.tsx` and the tokens in `theme/index.ts` across screens.

- `Button`: primary for the main action, secondary for supporting actions, ghost for quiet actions, destructive for removal. Avoid screen-level background, text-color, height or padding overrides; use `variant` and `size` instead.
- Control sizes come from `controls`: small is at least 44 px high, medium 48 px, large 54 px. Labels can wrap instead of overflowing or being clipped. All variants share typography, corner radius and icon spacing.
- Apply layout styles directly to a button: `style={{flex:1}}` creates equal-width actions in a row. On narrow screens, allow groups to wrap or stack. Confirmation actions use a minimum width so long labels stay readable.
- `IconButton` uses the same size and corner tokens. Give every icon-only action a descriptive `label`.
- `Input` includes its own background, border, padding, minimum height and focus state. Use `multiline` for notes. The `bare` variant is reserved for inputs embedded inside an already styled control, such as `SearchBar`.
- `FilterChip` uses the same minimum touch target. A removable chip makes the whole chip actionable rather than nesting a tiny close button inside it.
- Use semantic palette values for text, surfaces, borders and states. Avatar initials use theme surfaces to preserve contrast in light and dark themes. Circular avatars and slider thumbs are intentional; action controls use the shared rectangular radius.
- `PressableScale` animates the press target itself. Do not reintroduce a wrapper that intercepts flex, widths, margins or alignment. It provides web focus indicators, disabled-state hover suppression and reduced-motion support.

Check narrow mobile layouts as well as desktop, including long labels, disabled/loading controls, both themes and destructive confirmation dialogs. UI-only testing should use local mock data or configured emulators; it does not need live user writes or paid Cloud Storage.
