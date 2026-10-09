<?php
/**
 * Settings → Prototype Kit: in which environments the plugin works (default all but production), which tools to show
 * (chrome, inspector) and the chrome's points (label, page, section, sub). One option `prototype_kit_settings`.
 *
 * @package prototype-kit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Settings screen + accessors.
 */
final class Prototype_Kit_Settings {

	const OPTION = 'prototype_kit_settings';
	const PAGE   = 'prototype-kit';

	/** WordPress environment types (wp_get_environment_type()) => label. */
	const ENVIRONMENTS = array(
		'local'       => 'Local',
		'development' => 'Development',
		'staging'     => 'Staging',
		'production'  => 'Production',
	);

	/** On by default: everything but the live site. */
	const DEFAULT_ENVIRONMENTS = array( 'local', 'development', 'staging' );

	/**
	 * Hook everything up.
	 */
	public static function init() {
		add_action( 'admin_init', array( __CLASS__, 'register' ) );
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
	}

	/**
	 * Saved settings over the defaults (local + development + staging, both tools on, no own points = the theme's points).
	 *
	 * `source`: 'theme' = follow the theme's points (filter), 'own' = the saved list (may be empty = no points).
	 *
	 * @return array{envs:string[],chrome:bool,inspector:bool,source:string,points:array}
	 */
	public static function get() {
		$saved    = get_option( self::OPTION, array() );
		$saved    = is_array( $saved ) ? $saved : array();
		$settings = array_merge(
			array(
				'envs'      => self::DEFAULT_ENVIRONMENTS,
				'chrome'    => true,
				'inspector' => true,
				'source'    => 'theme',
				'points'    => array(),
			),
			$saved
		);
		// Saved before `source` existed: a non-empty list was the own one.
		if ( ! isset( $saved['source'] ) && ! empty( $saved['points'] ) ) {
			$settings['source'] = 'own';
		}
		return $settings;
	}

	/**
	 * Points the panel shows: the own list (even an empty one), or the theme's (filter `prototype_kit_points`).
	 *
	 * @return array[] [ label, url (site path), section (element id or ''), sub (bool) ]
	 */
	public static function points() {
		$settings = self::get();
		return 'own' === $settings['source'] ? $settings['points'] : self::theme_points();
	}

	/**
	 * The theme's suggested points.
	 *
	 * @return array[]
	 */
	public static function theme_points() {
		/**
		 * Filters the points a theme suggests for the chrome (used while none are saved in Settings → Prototype Kit).
		 *
		 * @param array[] $points [ 'label' => …, 'url' => '/', 'section' => 'price', 'sub' => false ].
		 */
		return self::sanitize_points( (array) apply_filters( 'prototype_kit_points', array() ) );
	}

	/**
	 * Register the setting.
	 */
	public static function register() {
		register_setting(
			self::OPTION,
			self::OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( __CLASS__, 'sanitize' ),
				'default'           => array(),
				'show_in_rest'      => false,
			)
		);
	}

	/**
	 * Sanitize the submitted settings.
	 *
	 * @param mixed $input Submitted value.
	 * @return array
	 */
	public static function sanitize( $input ) {
		$input  = is_array( $input ) ? $input : array();
		$points = self::sanitize_points( $input['points'] ?? array() ); // No rows left = an own, empty list.
		// "Reset to the theme's points", or saved unchanged (e.g. only a tool switched off) = follow the theme.
		$source = ( ! empty( $input['reset_points'] ) || $points === self::theme_points() ) ? 'theme' : 'own';
		return array(
			'source'    => $source,
			'envs'      => array_values( array_intersect( array_keys( self::ENVIRONMENTS ), array_map( 'strval', (array) ( $input['envs'] ?? array() ) ) ) ),
			'chrome'    => ! empty( $input['chrome'] ),
			'inspector' => ! empty( $input['inspector'] ),
			'points'    => 'own' === $source ? $points : array(),
		);
	}

	/**
	 * Points: label required; url = a path on this site (absolute URLs of this site become paths, other sites are
	 * dropped); section = an element id.
	 *
	 * @param mixed $points Raw rows.
	 * @return array[]
	 */
	public static function sanitize_points( $points ) {
		$clean = array();
		foreach ( (array) $points as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$label = sanitize_text_field( (string) ( $row['label'] ?? '' ) );
			$url   = self::site_path( (string) ( $row['url'] ?? '' ) );
			if ( '' === $label || null === $url ) {
				continue;
			}
			$clean[] = array(
				'label'   => $label,
				'url'     => $url,
				'section' => sanitize_html_class( (string) ( $row['section'] ?? '' ) ),
				'sub'     => ! empty( $row['sub'] ),
			);
		}
		return $clean;
	}

	/**
	 * A path on this site ('' → '/'), or null for another site.
	 *
	 * @param string $url URL or path.
	 * @return string|null
	 */
	private static function site_path( $url ) {
		$url = trim( $url );
		if ( '' === $url ) {
			return '/';
		}
		$parts = wp_parse_url( $url );
		if ( false === $parts ) {
			return null;
		}
		if ( isset( $parts['host'] ) && wp_parse_url( home_url(), PHP_URL_HOST ) !== $parts['host'] ) {
			return null;
		}
		$path = '/' . ltrim( (string) ( $parts['path'] ?? '/' ), '/' );
		return esc_url_raw( $path ) ? $path : null;
	}

	/**
	 * Settings → Prototype Kit.
	 */
	public static function menu() {
		add_options_page( 'Prototype Kit', 'Prototype Kit', 'manage_options', self::PAGE, array( __CLASS__, 'render' ) );
	}

	/**
	 * Row editor script on our screen only.
	 *
	 * @param string $hook_suffix Current admin page.
	 */
	public static function assets( $hook_suffix ) {
		if ( 'settings_page_' . self::PAGE !== $hook_suffix ) {
			return;
		}
		wp_enqueue_script( 'prototype-kit-admin', PROTOTYPE_KIT_URL . 'assets/admin.js', array(), PROTOTYPE_KIT_VERSION, true );
	}

	/**
	 * Render the screen.
	 */
	public static function render() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$settings = self::get();
		$own      = 'own' === $settings['source'];
		$by_theme = (bool) self::theme_points(); // The theme suggests points (filter) — only then "back to the theme's points" makes sense.
		$points   = self::points();
		$env      = wp_get_environment_type();
		$name     = self::OPTION;
		?>
		<div class="wrap">
			<h1>Prototype Kit</h1>
			<?php // No settings_errors() here: under Settings, core prints the "saved" notice itself (options-head.php). ?>
			<form method="post" action="options.php">
				<?php settings_fields( self::OPTION ); ?>
				<h2><?php esc_html_e( 'Environments', 'prototype-kit' ); ?></h2>
				<p class="description">
					<?php
					/* translators: %s: environment type of this site (local, staging…). */
					echo esc_html( sprintf( __( 'The plugin works only in the ticked environments. This site: %s (the WP_ENVIRONMENT_TYPE constant in wp-config.php).', 'prototype-kit' ), $env ) );
					?>
				</p>
				<fieldset>
					<?php foreach ( self::ENVIRONMENTS as $type => $label ) : ?>
					<p><label>
						<input type="checkbox" name="<?php echo esc_attr( $name ); ?>[envs][]" value="<?php echo esc_attr( $type ); ?>" <?php checked( in_array( $type, $settings['envs'], true ) ); ?>>
						<?php echo esc_html( $label ); ?>
						<?php if ( $type === $env ) : ?>
						<strong>— <?php esc_html_e( 'current', 'prototype-kit' ); ?></strong>
						<?php endif; ?>
						<?php if ( 'production' === $type ) : ?>
						<span class="description">— <?php esc_html_e( 'careful: every visitor of the live site would see the tools', 'prototype-kit' ); ?></span>
						<?php endif; ?>
					</label></p>
					<?php endforeach; ?>
				</fieldset>

				<h2><?php esc_html_e( 'Tools', 'prototype-kit' ); ?></h2>
				<fieldset>
					<p><label><input type="checkbox" name="<?php echo esc_attr( $name ); ?>[chrome]" value="1" <?php checked( $settings['chrome'] ); ?>> <?php esc_html_e( 'Panel: flow points, Desktop / Tablet / Mobile devices, ⌘\ to hide, system toasts', 'prototype-kit' ); ?></label></p>
					<p><label><input type="checkbox" name="<?php echo esc_attr( $name ); ?>[inspector]" value="1" <?php checked( $settings['inspector'] ); ?>> <?php esc_html_e( 'Inspector (key I): sizes, spacing, fonts, colours as in Figma', 'prototype-kit' ); ?></label></p>
				</fieldset>

				<h2><?php esc_html_e( 'Panel points', 'prototype-kit' ); ?></h2>
				<p class="description">
					<?php
					echo esc_html(
						$points
							? ( $own
								? __( 'A point on the page that is open scrolls to its section without a reload; on another page it opens that page.', 'prototype-kit' )
								: __( 'These are the points the theme suggests. Change and save them to have your own list.', 'prototype-kit' ) )
							: __( 'No points — the panel shows the devices only. Add points below.', 'prototype-kit' )
					);
					?>
				</p>
				<table class="widefat striped prototype-kit-points">
					<thead><tr>
						<th scope="col"><?php esc_html_e( 'Label', 'prototype-kit' ); ?></th>
						<th scope="col"><?php esc_html_e( 'Page (path on this site)', 'prototype-kit' ); ?></th>
						<th scope="col"><?php esc_html_e( 'Section (block id, optional)', 'prototype-kit' ); ?></th>
						<th scope="col"><?php esc_html_e( 'Sub-point', 'prototype-kit' ); ?></th>
						<th scope="col"><span class="screen-reader-text"><?php esc_html_e( 'Actions', 'prototype-kit' ); ?></span></th>
					</tr></thead>
					<tbody>
						<?php
						foreach ( $points as $i => $point ) {
							self::render_row( $i, $point );
						}
						?>
					</tbody>
				</table>
				<template id="prototype-kit-row"><?php self::render_row( '__i__', array() ); ?></template>
				<datalist id="prototype-kit-pages">
					<?php
					$pages = get_pages(
						array(
							'post_status' => 'publish',
							'number'      => 100,
						)
					);
					foreach ( $pages as $page ) {
						$path = wp_make_link_relative( get_permalink( $page ) );
						printf( '<option value="%1$s">%2$s</option>', esc_attr( $path ? $path : '/' ), esc_html( get_the_title( $page ) ) );
					}
					?>
				</datalist>
				<p class="description"><?php esc_html_e( 'Sub-point: shown indented under the point above it — for grouping, e.g. a page and its sections.', 'prototype-kit' ); ?></p>
				<p>
					<button type="button" class="button prototype-kit-add"><?php esc_html_e( 'Add point', 'prototype-kit' ); ?></button>
					<?php if ( $own && $by_theme ) : ?>
					<label style="margin-left:16px"><input type="checkbox" name="<?php echo esc_attr( $name ); ?>[reset_points]" value="1"> <?php esc_html_e( 'Reset to the theme\'s points', 'prototype-kit' ); ?></label>
					<?php endif; ?>
				</p>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}

	/**
	 * One point row.
	 *
	 * @param int|string $i     Row index (or the template placeholder).
	 * @param array      $point Point.
	 */
	private static function render_row( $i, $point ) {
		$base = self::OPTION . '[points][' . $i . ']';
		?>
		<tr>
			<td><input type="text" class="regular-text" name="<?php echo esc_attr( $base ); ?>[label]" value="<?php echo esc_attr( $point['label'] ?? '' ); ?>" aria-label="<?php esc_attr_e( 'Label', 'prototype-kit' ); ?>"></td>
			<td><input type="text" class="regular-text" list="prototype-kit-pages" name="<?php echo esc_attr( $base ); ?>[url]" value="<?php echo esc_attr( $point['url'] ?? '/' ); ?>" placeholder="/" aria-label="<?php esc_attr_e( 'Page', 'prototype-kit' ); ?>"></td>
			<td><input type="text" name="<?php echo esc_attr( $base ); ?>[section]" value="<?php echo esc_attr( $point['section'] ?? '' ); ?>" aria-label="<?php esc_attr_e( 'Section', 'prototype-kit' ); ?>"></td>
			<td><input type="checkbox" name="<?php echo esc_attr( $base ); ?>[sub]" value="1" <?php checked( ! empty( $point['sub'] ) ); ?> aria-label="<?php esc_attr_e( 'Sub-point', 'prototype-kit' ); ?>"></td>
			<td><button type="button" class="button-link prototype-kit-remove"><?php esc_html_e( 'Remove', 'prototype-kit' ); ?></button></td>
		</tr>
		<?php
	}
}
