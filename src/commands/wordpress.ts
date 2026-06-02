'use strict';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import fetch from 'node-fetch';

// ─── helpers ────────────────────────────────────────────────────────────────

function printHelp(): void {
  console.log('\n' + chalk.bold.blue('  WordPress Subcommands') + '\n');
  console.log('  ' + chalk.cyan('status <siteUrl>') + '              — Show site name, WP version, description');
  console.log('  ' + chalk.cyan('export <siteUrl> [appPasswordB64]') + ' — Export posts + pages to JSON file');
  console.log('  ' + chalk.cyan('new-theme <name>') + '              — Scaffold a new WordPress theme');
  console.log('  ' + chalk.cyan('new-plugin <name>') + '             — Scaffold a new WordPress plugin');
  console.log();
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

// ─── status ─────────────────────────────────────────────────────────────────

async function runStatus(siteUrl: string): Promise<void> {
  const url = `${siteUrl.replace(/\/$/, '')}/wp-json/`;
  console.log(chalk.dim(`\n  Fetching ${url} ...\n`));
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(chalk.red(`  Error: HTTP ${res.status} ${res.statusText}`));
      return;
    }
    const data = (await res.json()) as Record<string, unknown>;
    console.log('  ' + chalk.bold('Site Name:')   + '   ' + chalk.green(String(data.name ?? '(unknown)')));
    console.log('  ' + chalk.bold('Description:') + '   ' + chalk.white(String(data.description ?? '')));
    console.log('  ' + chalk.bold('WP Version:')  + '   ' + chalk.yellow(String((data as Record<string, unknown>).gmt_offset !== undefined ? '' : '') + String(data.generator ?? '')));
    const namespaces = data.namespaces as string[] | undefined;
    if (namespaces) {
      console.log('  ' + chalk.bold('Namespaces:') + '   ' + chalk.dim(namespaces.join(', ')));
    }
    console.log();
  } catch (err: unknown) {
    console.log(chalk.red('  Error: ' + (err as Error).message));
  }
}

// ─── export ─────────────────────────────────────────────────────────────────

async function runExport(siteUrl: string, auth?: string): Promise<void> {
  const base = siteUrl.replace(/\/$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) headers['Authorization'] = `Basic ${auth}`;

  console.log(chalk.dim('\n  Exporting posts and pages...\n'));

  async function fetchAll(endpoint: string): Promise<unknown[]> {
    const res = await fetch(`${base}${endpoint}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${endpoint}`);
    return (await res.json()) as unknown[];
  }

  try {
    const [posts, pages] = await Promise.all([
      fetchAll('/wp-json/wp/v2/posts?per_page=100'),
      fetchAll('/wp-json/wp/v2/pages?per_page=100'),
    ]);

    const timestamp = Date.now();
    const outPath = path.resolve(process.cwd(), `wp-export-${timestamp}.json`);
    const payload = { exported_at: new Date().toISOString(), site: base, posts, pages };
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(chalk.green(`  Export saved to: ${outPath}`));
    console.log(chalk.dim(`  Posts: ${posts.length}  |  Pages: ${pages.length}\n`));
  } catch (err: unknown) {
    console.log(chalk.red('  Export failed: ' + (err as Error).message));
  }
}

// ─── new-theme ───────────────────────────────────────────────────────────────

function runNewTheme(name: string): void {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const dir = path.resolve(process.cwd(), slug);

  if (fs.existsSync(dir)) {
    console.log(chalk.red(`  Directory already exists: ${dir}`));
    return;
  }

  console.log(chalk.dim(`\n  Scaffolding theme: ${slug}\n`));

  // style.css
  writeFile(path.join(dir, 'style.css'), `/*
Theme Name: ${name}
Theme URI:  https://example.com/${slug}
Author:     Your Name
Author URI: https://example.com
Description: A custom WordPress theme.
Version:    1.0.0
License:    GNU General Public License v2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html
Text Domain: ${slug}
*/

/* CSS Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #333;
  background: #fff;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

a {
  color: #0073aa;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}
`);

  // index.php
  writeFile(path.join(dir, 'index.php'), `<?php
/**
 * The main template file.
 *
 * @package ${name}
 */

get_header();
?>

<main id="main" class="site-main container">

<?php
if ( have_posts() ) :
  while ( have_posts() ) :
    the_post();
    ?>
    <article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
      <header class="entry-header">
        <?php the_title( '<h2 class="entry-title"><a href="' . esc_url( get_permalink() ) . '">', '</a></h2>' ); ?>
      </header>

      <div class="entry-content">
        <?php the_excerpt(); ?>
      </div>

      <footer class="entry-footer">
        <a href="<?php the_permalink(); ?>">Read more</a>
      </footer>
    </article>
    <?php
  endwhile;

  the_posts_navigation();

else :
  get_template_part( 'template-parts/content', 'none' );
endif;
?>

</main>

<?php
get_sidebar();
get_footer();
`);

  // functions.php
  writeFile(path.join(dir, 'functions.php'), `<?php
/**
 * ${name} functions and definitions.
 *
 * @package ${name}
 */

if ( ! defined( 'ABSPATH' ) ) {
  exit;
}

define( '${slug.toUpperCase().replace(/-/g, '_')}_VERSION', '1.0.0' );

/**
 * Enqueue scripts and styles.
 */
function ${slug.replace(/-/g, '_')}_scripts(): void {
  wp_enqueue_style(
    '${slug}-style',
    get_stylesheet_uri(),
    [],
    ${slug.toUpperCase().replace(/-/g, '_')}_VERSION
  );
}
add_action( 'wp_enqueue_scripts', '${slug.replace(/-/g, '_')}_scripts' );

/**
 * Theme setup.
 */
function ${slug.replace(/-/g, '_')}_setup(): void {
  add_theme_support( 'title-tag' );
  add_theme_support( 'post-thumbnails' );
  add_theme_support( 'html5', [
    'search-form',
    'comment-form',
    'comment-list',
    'gallery',
    'caption',
    'style',
    'script',
  ] );

  register_nav_menus( [
    'primary' => __( 'Primary Menu', '${slug}' ),
    'footer'  => __( 'Footer Menu', '${slug}' ),
  ] );
}
add_action( 'after_setup_theme', '${slug.replace(/-/g, '_')}_setup' );

/**
 * Register widget areas.
 */
function ${slug.replace(/-/g, '_')}_widgets_init(): void {
  register_sidebar( [
    'name'          => __( 'Primary Sidebar', '${slug}' ),
    'id'            => 'sidebar-1',
    'description'   => __( 'Add widgets here.', '${slug}' ),
    'before_widget' => '<section id="%1$s" class="widget %2$s">',
    'after_widget'  => '</section>',
    'before_title'  => '<h2 class="widget-title">',
    'after_title'   => '</h2>',
  ] );
}
add_action( 'widgets_init', '${slug.replace(/-/g, '_')}_widgets_init' );
`);

  // header.php
  writeFile(path.join(dir, 'header.php'), `<?php
/**
 * The header template.
 *
 * @package ${name}
 */
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo( 'charset' ); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="profile" href="https://gmpg.org/xfn/11">
  <?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<div id="page" class="site">
  <a class="skip-link screen-reader-text" href="#main"><?php esc_html_e( 'Skip to content', '${slug}' ); ?></a>

  <header id="masthead" class="site-header">
    <div class="container">
      <div class="site-branding">
        <?php if ( is_front_page() && is_home() ) : ?>
          <h1 class="site-title">
            <a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php bloginfo( 'name' ); ?></a>
          </h1>
        <?php else : ?>
          <p class="site-title">
            <a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php bloginfo( 'name' ); ?></a>
          </p>
        <?php endif; ?>
        <?php
        $description = get_bloginfo( 'description', 'display' );
        if ( $description ) :
          ?>
          <p class="site-description"><?php echo $description; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></p>
        <?php endif; ?>
      </div>

      <nav id="site-navigation" class="main-navigation" aria-label="<?php esc_attr_e( 'Primary Navigation', '${slug}' ); ?>">
        <?php
        wp_nav_menu( [
          'theme_location' => 'primary',
          'menu_id'        => 'primary-menu',
          'container'      => false,
        ] );
        ?>
      </nav>
    </div>
  </header>

  <div id="content" class="site-content">
`);

  // footer.php
  writeFile(path.join(dir, 'footer.php'), `<?php
/**
 * The footer template.
 *
 * @package ${name}
 */
?>

  </div><!-- #content -->

  <footer id="colophon" class="site-footer">
    <div class="container">
      <div class="site-info">
        <a href="<?php echo esc_url( __( 'https://wordpress.org/', '${slug}' ) ); ?>">
          <?php
          /* translators: %s: CMS name, i.e. WordPress. */
          printf( esc_html__( 'Proudly powered by %s', '${slug}' ), 'WordPress' );
          ?>
        </a>
        <span class="sep"> &middot; </span>
        <?php
        /* translators: 1: Theme name, 2: Theme author. */
        printf( esc_html__( 'Theme: %s', '${slug}' ), '<a href="https://example.com/${slug}">${name}</a>' );
        ?>
      </div>
    </div>
  </footer>

</div><!-- #page -->

<?php wp_footer(); ?>
</body>
</html>
`);

  // single.php
  writeFile(path.join(dir, 'single.php'), `<?php
/**
 * Single post template.
 *
 * @package ${name}
 */

get_header();
?>

<main id="main" class="site-main container">

<?php
while ( have_posts() ) :
  the_post();
  ?>
  <article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
    <header class="entry-header">
      <?php the_title( '<h1 class="entry-title">', '</h1>' ); ?>
      <div class="entry-meta">
        <time datetime="<?php echo esc_attr( get_the_date( DATE_W3C ) ); ?>">
          <?php echo esc_html( get_the_date() ); ?>
        </time>
        <?php the_author_posts_link(); ?>
      </div>
    </header>

    <?php if ( has_post_thumbnail() ) : ?>
      <div class="post-thumbnail">
        <?php the_post_thumbnail( 'large' ); ?>
      </div>
    <?php endif; ?>

    <div class="entry-content">
      <?php
      the_content();
      wp_link_pages( [
        'before' => '<div class="page-links">' . __( 'Pages:', '${slug}' ),
        'after'  => '</div>',
      ] );
      ?>
    </div>

    <footer class="entry-footer">
      <?php the_tags( '<span class="tags-links">', ', ', '</span>' ); ?>
      <?php the_category( ', ' ); ?>
    </footer>
  </article>

  <?php
  the_post_navigation( [
    'prev_text' => '&larr; %title',
    'next_text' => '%title &rarr;',
  ] );

  if ( comments_open() || get_comments_number() ) :
    comments_template();
  endif;

endwhile;
?>

</main>

<?php
get_sidebar();
get_footer();
`);

  // page.php
  writeFile(path.join(dir, 'page.php'), `<?php
/**
 * Page template.
 *
 * @package ${name}
 */

get_header();
?>

<main id="main" class="site-main container">

<?php
while ( have_posts() ) :
  the_post();
  ?>
  <article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
    <header class="entry-header">
      <?php the_title( '<h1 class="entry-title">', '</h1>' ); ?>
    </header>

    <?php if ( has_post_thumbnail() ) : ?>
      <div class="post-thumbnail">
        <?php the_post_thumbnail( 'large' ); ?>
      </div>
    <?php endif; ?>

    <div class="entry-content">
      <?php
      the_content();
      wp_link_pages( [
        'before' => '<div class="page-links">' . __( 'Pages:', '${slug}' ),
        'after'  => '</div>',
      ] );
      ?>
    </div>
  </article>

  <?php
  if ( comments_open() || get_comments_number() ) :
    comments_template();
  endif;

endwhile;
?>

</main>

<?php
get_sidebar();
get_footer();
`);

  // archive.php
  writeFile(path.join(dir, 'archive.php'), `<?php
/**
 * Archive template.
 *
 * @package ${name}
 */

get_header();
?>

<main id="main" class="site-main container">

  <header class="page-header">
    <?php
    the_archive_title( '<h1 class="page-title">', '</h1>' );
    the_archive_description( '<div class="archive-description">', '</div>' );
    ?>
  </header>

  <?php if ( have_posts() ) : ?>
    <div class="posts-grid">
      <?php
      while ( have_posts() ) :
        the_post();
        ?>
        <article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
          <header class="entry-header">
            <?php the_title( '<h2 class="entry-title"><a href="' . esc_url( get_permalink() ) . '">', '</a></h2>' ); ?>
            <div class="entry-meta">
              <time datetime="<?php echo esc_attr( get_the_date( DATE_W3C ) ); ?>">
                <?php echo esc_html( get_the_date() ); ?>
              </time>
            </div>
          </header>

          <div class="entry-content">
            <?php the_excerpt(); ?>
          </div>
        </article>
        <?php
      endwhile;

      the_posts_navigation();
      ?>
    </div>

  <?php else : ?>
    <p><?php esc_html_e( 'No posts found.', '${slug}' ); ?></p>
  <?php endif; ?>

</main>

<?php
get_sidebar();
get_footer();
`);

  // sidebar.php
  writeFile(path.join(dir, 'sidebar.php'), `<?php
/**
 * Sidebar template.
 *
 * @package ${name}
 */

if ( ! is_active_sidebar( 'sidebar-1' ) ) {
  return;
}
?>

<aside id="secondary" class="widget-area">
  <?php dynamic_sidebar( 'sidebar-1' ); ?>
</aside>
`);

  console.log(chalk.green(`  Theme scaffolded at: ./${slug}/`));
  console.log(chalk.dim('  Files created:'));
  const files = ['style.css', 'index.php', 'functions.php', 'header.php', 'footer.php', 'single.php', 'page.php', 'archive.php', 'sidebar.php'];
  for (const f of files) {
    console.log(chalk.dim(`    ${slug}/${f}`));
  }
  console.log(chalk.yellow('\n  Add a 1200x900 screenshot.png to your theme directory'));
  console.log();
}

// ─── new-plugin ──────────────────────────────────────────────────────────────

function runNewPlugin(name: string): void {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const className = name.replace(/(?:^|[-\s])(\w)/g, (_: string, c: string) => c.toUpperCase()).replace(/[\s-]/g, '');
  const dir = path.resolve(process.cwd(), slug);

  if (fs.existsSync(dir)) {
    console.log(chalk.red(`  Directory already exists: ${dir}`));
    return;
  }

  console.log(chalk.dim(`\n  Scaffolding plugin: ${slug}\n`));

  const constName = slug.toUpperCase().replace(/-/g, '_');
  const funcPrefix = slug.replace(/-/g, '_');

  // Main plugin file: <name>.php
  writeFile(path.join(dir, `${slug}.php`), `<?php
/**
 * Plugin Name:       ${name}
 * Plugin URI:        https://example.com/${slug}
 * Description:       A custom WordPress plugin.
 * Version:           1.0.0
 * Requires at least: 5.5
 * Requires PHP:      7.4
 * Author:            Your Name
 * Author URI:        https://example.com
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       ${slug}
 * Domain Path:       /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
  exit;
}

define( '${constName}_VERSION', '1.0.0' );
define( '${constName}_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( '${constName}_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// Autoload includes
require_once ${constName}_PLUGIN_DIR . 'includes/class-${slug}.php';

/**
 * Plugin activation hook.
 */
function ${funcPrefix}_activate(): void {
  // Create any necessary database tables or options here.
  add_option( '${slug}_version', ${constName}_VERSION );
}
register_activation_hook( __FILE__, '${funcPrefix}_activate' );

/**
 * Plugin deactivation hook.
 */
function ${funcPrefix}_deactivate(): void {
  // Flush rewrite rules, clear caches, etc.
  flush_rewrite_rules();
}
register_deactivation_hook( __FILE__, '${funcPrefix}_deactivate' );

/**
 * Initialize the plugin.
 */
function ${funcPrefix}_init(): void {
  $plugin = new ${className}();
  $plugin->init();
}
add_action( 'plugins_loaded', '${funcPrefix}_init' );

/**
 * Sample shortcode: [${slug}]
 */
function ${funcPrefix}_shortcode( array $atts ): string {
  $atts = shortcode_atts(
    [
      'message' => __( 'Hello from ${name}!', '${slug}' ),
    ],
    $atts,
    '${slug}'
  );

  return '<div class="${slug}-shortcode">' . esc_html( $atts['message'] ) . '</div>';
}
add_shortcode( '${slug}', '${funcPrefix}_shortcode' );
`);

  // includes/class-<name>.php
  writeFile(path.join(dir, 'includes', `class-${slug}.php`), `<?php
/**
 * Main plugin class.
 *
 * @package ${name}
 */

if ( ! defined( 'ABSPATH' ) ) {
  exit;
}

/**
 * Class ${className}
 */
class ${className} {

  /**
   * Constructor — register hooks.
   */
  public function __construct() {
    // Hook registration can happen here or in init().
  }

  /**
   * Initialize the plugin features.
   */
  public function init(): void {
    add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_assets' ] );
  }

  /**
   * Enqueue front-end assets.
   */
  public function enqueue_assets(): void {
    wp_enqueue_style(
      '${slug}-style',
      ${constName}_PLUGIN_URL . 'assets/css/${slug}.css',
      [],
      ${constName}_VERSION
    );
  }
}
`);

  // uninstall.php
  writeFile(path.join(dir, 'uninstall.php'), `<?php
/**
 * Uninstall ${name}
 *
 * Runs when the plugin is deleted via the WordPress admin.
 *
 * @package ${name}
 */

// Bail if not called from WordPress uninstall routine.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
  exit;
}

// Delete plugin options.
delete_option( '${slug}_version' );
delete_option( '${slug}_settings' );

// Remove any user meta added by the plugin.
// delete_metadata( 'user', 0, '${slug}_meta_key', '', true );

// Drop any custom database tables (if created on activation).
// global $wpdb;
// $wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}${funcPrefix}_data" );
`);

  console.log(chalk.green(`  Plugin scaffolded at: ./${slug}/`));
  console.log(chalk.dim('  Files created:'));
  const files = [`${slug}.php`, `includes/class-${slug}.php`, 'uninstall.php'];
  for (const f of files) {
    console.log(chalk.dim(`    ${slug}/${f}`));
  }
  console.log();
}

// ─── main export ─────────────────────────────────────────────────────────────

export async function runWordpressCommand(
  subcommand: string | undefined,
  args: string[]
): Promise<void> {
  switch (subcommand) {
    case 'status': {
      const siteUrl = args[0];
      if (!siteUrl) {
        console.log(chalk.red('  Usage: wordpress status <siteUrl>'));
        return;
      }
      await runStatus(siteUrl);
      break;
    }

    case 'export': {
      const siteUrl = args[0];
      if (!siteUrl) {
        console.log(chalk.red('  Usage: wordpress export <siteUrl> [appPasswordB64]'));
        return;
      }
      await runExport(siteUrl, args[1]);
      break;
    }

    case 'new-theme': {
      const themeName = args.join(' ').trim();
      if (!themeName) {
        console.log(chalk.red('  Usage: wordpress new-theme <name>'));
        return;
      }
      runNewTheme(themeName);
      break;
    }

    case 'new-plugin': {
      const pluginName = args.join(' ').trim();
      if (!pluginName) {
        console.log(chalk.red('  Usage: wordpress new-plugin <name>'));
        return;
      }
      runNewPlugin(pluginName);
      break;
    }

    default:
      printHelp();
      break;
  }
}
