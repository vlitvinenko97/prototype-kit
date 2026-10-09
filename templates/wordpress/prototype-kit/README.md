# Prototype Kit — WordPress plugin

The prototype-kit's review tools on a WordPress site: the **chrome** (flow points, Desktop / Tablet / Mobile, ⌘\ to
hide, system toasts, demo hints) and the **inspector** (key `I`). A packaging of the kit, not a rewrite: this folder
is the WordPress glue; `kit.py wordpress` adds the kit's own `proto-chrome.js/.css` and `inspector.js` into `kit/`.

```bash
python3 ~/.claude/skills/prototype-kit/scripts/kit.py wordpress <wp-content>      # install / update
python3 ~/.claude/skills/prototype-kit/scripts/kit.py wordpress --zip prototype-kit.zip   # for a server without the kit
```

Requirements: WordPress 6.5+, PHP 8.1+. Don't edit the installed copy: the next `kit.py wordpress` overwrites it.

## Files

| Path | What |
|---|---|
| `prototype-kit.php` | gate (environment + tool from the settings), enqueue, `?embed=1` fix, wp-admin leaves the device frame |
| `includes/class-settings.php` | Settings → Prototype Kit: environments, tools, points |
| `assets/boot.js` | `ProtoChrome.init()` with the config from PHP, the points (one-page scroll / other page), `window.ProtoKitWP = { pc }` |
| `assets/admin.js` | add / remove point rows on the settings screen |
| `languages/prototype-kit-uk.l10n.php` | Ukrainian (WordPress 6.5+ PHP translation file) |
| `kit/` | added by `kit.py`: the kit's chrome + inspector, `KIT_VERSION` = the kit commit |

## Settings → Prototype Kit

- **Environments** — `wp_get_environment_type()` (`WP_ENVIRONMENT_TYPE` in `wp-config.php`): Local, Development,
  Staging, Production. Default: all but Production; ticking Production shows the tools to every visitor.
- **Tools** — the chrome and the inspector, on / off. On WordPress the inspector may run on staging too.
- **Points** — label, page (a path on this site), section (an element id, optional), sub-point (indented under the
  point above). A point on the page that's open scrolls to its section without a reload; on another page it opens that
  page (keeps `?device` / `?size`) and scrolls there. `?screen=<section>` opens a page on a section. A missing section
  → the kit's toast. The list starts from the theme's suggestion (filter `prototype_kit_points`), if any; once
  changed it is the site's own list — also an empty one (= no points, the capsule shows the devices only).

Filter `prototype_kit_allowed( $allowed, $tool )` overrides the gate per request.

## Theme API (optional)

```php
add_filter( 'prototype_kit_config', function ( $config ) {   // ProtoChrome.init() options except flows
	$config['id']                = 'my-site';
	$config['devices']['mobile'] = array( 390, 844 );
	return $config;
} );
add_filter( 'prototype_kit_points', fn() => array(              // suggested points (the site can replace them)
	array( 'label' => 'Home', 'url' => '/', 'section' => 'top' ),
) );
```

JS: the chrome and `boot.js` are deferred classic scripts in `<head>` — they run before the theme's scripts and
modules. The theme reads `window.ProtoKitWP?.pc` (`pc.isHost` = the stage page around the device iframe: boot
nothing there) and calls `window.ProtoChrome ?? { no-op }` for toasts / hints. The site must work with the plugin off;
never depend on `pc-*` classes.

## WordPress glue — why

- `?embed=1` (the device iframe) is WordPress's oEmbed query var: on a singular page (a static front page too) it
  would render the embed card → dropped from the query vars while the chrome is on (value `1` only; real oEmbed uses
  `/embed/` or `embed=true`).
- wp-admin / login opened inside the device frame (admin-bar links) break out to the full window: the chrome samples
  the frame's document every 150ms, and heavy admin screens (Themes) crashed Chrome that way.
- The admin bar inside the frame is left as WordPress shows it.

## Tested

WordPress 7.1, PHP 8.3 (Playground): a custom classic theme with ES-module scripts, Twenty Twenty-One (classic),
Twenty Twenty-Five (block): the frame shows the site, points (page / section / missing section / missing page),
devices, inspector on / off, wp-admin leaving the frame, environments on / off, no JS errors, empty PHP debug log.
