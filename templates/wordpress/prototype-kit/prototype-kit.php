<?php
/**
 * Plugin Name:       Prototype Kit
 * Description:       Review tools of the prototype-kit on a WordPress site: the chrome (flow points, Desktop / Tablet / Mobile, ⌘\ to hide, system toasts, demo hints) and the inspector. Environments: Settings → Prototype Kit (default: all but production).
 * Version:           0.1.0
 * Requires at least: 6.5
 * Requires PHP:      8.1
 * Text Domain:       prototype-kit
 * Domain Path:       /languages
 *
 * Installed / updated by the prototype-kit: `kit.py wordpress <wp-content>` copies this folder and puts the kit's own
 * files into kit/ (proto-chrome.js/.css, inspector.js — never edit them here). This plugin only adds the WordPress glue. Settings → Prototype Kit: tools on / off + the panel's points.
 * Theme API: filters `prototype_kit_points` (suggested points) and `prototype_kit_config` (see README.md).
 *
 * @package prototype-kit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PROTOTYPE_KIT_VERSION', '0.1.0' );
define( 'PROTOTYPE_KIT_URL', plugin_dir_url( __FILE__ ) );
define( 'PROTOTYPE_KIT_DIR', plugin_dir_path( __FILE__ ) );

add_action(
	'init',
	static function () {
		load_plugin_textdomain( 'prototype-kit', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
	}
);

require_once PROTOTYPE_KIT_DIR . 'includes/class-settings.php';
Prototype_Kit_Settings::init();

/**
 * Whether a tool loads: this environment is ticked in Settings → Prototype Kit (default all but production) AND the tool
 * is switched on there. On WordPress the inspector may run on staging too (a review environment) — see README.md.
 *
 * @param string $tool chrome | inspector.
 * @return bool
 */
function prototype_kit_allowed( $tool ) {
	$settings = Prototype_Kit_Settings::get();
	$allowed  = in_array( wp_get_environment_type(), $settings['envs'], true ) && ! empty( $settings[ $tool ] );
	/**
	 * Filters whether a kit tool may load in this request.
	 *
	 * @param bool   $allowed Environment ticked and the tool switched on.
	 * @param string $tool    chrome | inspector.
	 */
	return (bool) apply_filters( 'prototype_kit_allowed', $allowed, $tool );
}

/**
 * Whether this request is the chrome's device iframe (?embed=1).
 *
 * @return bool
 */
function prototype_kit_is_embed() {
	// Read-only check of a public flag; it changes rendering only, never state.
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	return isset( $_GET['embed'] ) && '1' === $_GET['embed'];
}

/**
 * Config for assets/boot.js: `chrome` = ProtoChrome.init() options (from the theme's filter over the defaults; the
 * flows are built from the points), `points` = Settings → Prototype Kit (or the theme's suggestion).
 *
 * @return array
 */
function prototype_kit_config() {
	$slug     = sanitize_title( get_bloginfo( 'name' ) );
	$defaults = array(
		'id'      => $slug ? $slug : 'site',
		'title'   => get_bloginfo( 'name' ),
		'mode'    => 'web',
		'devices' => array(
			'desktop' => array( null, null ),
			'tablet'  => array( 768, null ),
			'mobile'  => array( 375, 812 ),
		),
	);
	/**
	 * Filters the chrome options (keys of ProtoChrome.init() except `flows`, which come from the points).
	 *
	 * @param array $config id, title, mode, devices, hints…
	 */
	$chrome = array_merge( $defaults, (array) apply_filters( 'prototype_kit_config', $defaults ) );
	unset( $chrome['flows'] );
	return array(
		'chrome' => $chrome,
		'points' => Prototype_Kit_Settings::points(),
		'i18n'   => array(
			/* translators: %s: element id of a section. */
			'noSection' => __( 'Section “%s” is not on this page — check the point in Settings → Prototype Kit', 'prototype-kit' ),
		),
	);
}

/**
 * Front end: the chrome (+ boot) in <head> as deferred classic scripts — they run before the theme's own scripts and
 * modules, so window.ProtoChrome and window.ProtoKitWP exist when the theme starts. The inspector in the footer.
 */
function prototype_kit_enqueue() {
	if ( prototype_kit_allowed( 'chrome' ) ) {
		$deferred_in_head = array(
			'in_footer' => false,
			'strategy'  => 'defer',
		);
		wp_enqueue_style( 'prototype-kit-chrome', PROTOTYPE_KIT_URL . 'kit/proto-chrome.css', array(), PROTOTYPE_KIT_VERSION );
		wp_enqueue_script( 'prototype-kit-chrome', PROTOTYPE_KIT_URL . 'kit/proto-chrome.js', array(), PROTOTYPE_KIT_VERSION, $deferred_in_head );
		wp_enqueue_script( 'prototype-kit-boot', PROTOTYPE_KIT_URL . 'assets/boot.js', array( 'prototype-kit-chrome' ), PROTOTYPE_KIT_VERSION, $deferred_in_head );
		wp_add_inline_script( 'prototype-kit-boot', 'window.ProtoKitConfig = ' . wp_json_encode( prototype_kit_config() ) . ';', 'before' );
	}
	if ( prototype_kit_allowed( 'inspector' ) ) {
		wp_enqueue_script( 'prototype-kit-inspector', PROTOTYPE_KIT_URL . 'kit/inspector.js', array(), PROTOTYPE_KIT_VERSION, true );
	}
}
add_action( 'wp_enqueue_scripts', 'prototype_kit_enqueue', 5 );

/**
 * WordPress core reserves `embed` as the oEmbed query var: on a singular page (a static front page too) ?embed=1
 * would render the embed card instead of the site. The chrome's value is "1"; real oEmbed uses /embed/ or
 * embed=true, so only "1" is dropped.
 *
 * @param array $query_vars Parsed request query vars.
 * @return array
 */
function prototype_kit_drop_embed_var( $query_vars ) {
	if ( prototype_kit_allowed( 'chrome' ) && prototype_kit_is_embed() ) {
		unset( $query_vars['embed'] );
	}
	return $query_vars;
}
add_filter( 'request', 'prototype_kit_drop_embed_var' );

/**
 * wp-admin and the login screen never stay inside the device frame (admin-bar links lead there): the chrome samples
 * the frame's document every 150ms for its glass tone, and heavy admin screens crashed Chrome that way. They break
 * out to the full window. Only when the parent is the chrome's stage (html.pc-host).
 */
function prototype_kit_leave_frame() {
	if ( ! prototype_kit_allowed( 'chrome' ) ) {
		return;
	}
	wp_print_inline_script_tag( 'try{if(window.top!==window&&window.top.document.documentElement.classList.contains("pc-host")){window.top.location.replace(location.href)}}catch(e){}' );
}
add_action( 'admin_head', 'prototype_kit_leave_frame', 1 );
add_action( 'login_head', 'prototype_kit_leave_frame', 1 );
