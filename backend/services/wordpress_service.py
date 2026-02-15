import base64
import re

import requests


class WordPressService:
    """Service for interacting with WordPress REST API v2."""

    def __init__(self, site_url, username, app_password):
        self.site_url = site_url.rstrip('/')
        self.base_url = f'{self.site_url}/wp-json/wp/v2'
        credentials = f'{username}:{app_password}'
        token = base64.b64encode(credentials.encode()).decode()
        self.auth_header = f'Basic {token}'

    def _headers(self, extra=None):
        headers = {'Authorization': self.auth_header}
        if extra:
            headers.update(extra)
        return headers

    def upload_media(self, image_bytes, filename, alt_text=''):
        """Upload an image to the WordPress media library.

        Args:
            image_bytes: Raw image bytes (PNG).
            filename: Filename for the uploaded image.
            alt_text: SEO alt text for the image.

        Returns:
            dict with 'id' (media ID) and 'source_url' (image URL).
        """
        response = requests.post(
            f'{self.base_url}/media',
            headers=self._headers({
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': 'image/png',
            }),
            data=image_bytes,
            timeout=60,
        )
        response.raise_for_status()
        media = response.json()
        media_id = media['id']

        # Update alt text
        if alt_text:
            requests.post(
                f'{self.base_url}/media/{media_id}',
                headers=self._headers(),
                json={'alt_text': alt_text},
                timeout=30,
            )

        return {
            'id': media_id,
            'source_url': media.get('source_url', ''),
        }

    def create_post(self, title, content, slug=None, excerpt=None,
                    status='draft', featured_media_id=None):
        """Create a WordPress post.

        Args:
            title: Post title.
            content: Post content (Gutenberg HTML).
            slug: URL slug.
            excerpt: Post excerpt.
            status: Post status (draft/publish/pending).
            featured_media_id: Featured image media ID.

        Returns:
            dict with post data including 'id' and 'link'.
        """
        data = {
            'title': title,
            'content': content,
            'status': status,
        }
        if slug:
            data['slug'] = slug
        if excerpt:
            data['excerpt'] = excerpt
        if featured_media_id:
            data['featured_media'] = featured_media_id

        response = requests.post(
            f'{self.base_url}/posts',
            headers=self._headers(),
            json=data,
            timeout=60,
        )
        response.raise_for_status()
        post = response.json()
        return {
            'id': post['id'],
            'link': post.get('link', ''),
            'status': post.get('status', ''),
        }

    def update_seo_meta(self, post_id, seo):
        """Update Rank Math SEO meta via Rank Math's native REST API.

        Uses rankmath/v1/updateMeta endpoint — part of Rank Math core,
        no extra plugins needed.

        Args:
            post_id: WordPress post ID.
            seo: Dict with SEO fields.

        Returns:
            API response dict.
        """
        meta = self._build_rank_math_meta(seo)
        if not meta:
            return {}

        response = requests.post(
            f'{self.site_url}/wp-json/rankmath/v1/updateMeta',
            headers=self._headers({'Content-Type': 'application/json'}),
            json={
                'objectType': 'post',
                'objectID': post_id,
                'meta': meta,
            },
            timeout=60,
        )
        response.raise_for_status()
        return response.json()

    @staticmethod
    def _build_rank_math_meta(seo):
        """Build Rank Math meta dict from SEO data.

        Rank Math stores SEO data as post meta with `rank_math_` prefix.
        These keys are registered with show_in_rest=true by Rank Math core.

        Args:
            seo: Dict with keys like title, description, focus_keyword, etc.

        Returns:
            Dict of rank_math_* meta keys ready for WP REST API.
        """
        if not seo:
            return {}

        meta = {}

        # Core SEO fields
        # Use %title% so Rank Math dynamically follows the post title
        meta['rank_math_title'] = '%title% %sep% %sitename%'
        if seo.get('description'):
            meta['rank_math_description'] = seo['description']

        # Focus keyword — single keyword only
        focus_kw = seo.get('focus_keyword', '')
        if focus_kw:
            meta['rank_math_focus_keyword'] = focus_kw

        # Robots meta — default to index,follow for SEO content
        meta['rank_math_robots'] = ['index', 'follow']

        # Open Graph — use dynamic title for social sharing
        meta['rank_math_facebook_title'] = '%title%'
        meta['rank_math_twitter_title'] = '%title%'
        if seo.get('description'):
            meta['rank_math_facebook_description'] = seo['description']
            meta['rank_math_twitter_description'] = seo['description']

        # Use Facebook OG data for Twitter Card
        meta['rank_math_twitter_use_facebook'] = 'on'

        return meta

    @staticmethod
    def insert_images_into_content(content, images):
        """Insert image blocks after the first 3 H2 sections.

        Args:
            content: Gutenberg HTML content string.
            images: List of dicts with 'source_url' and 'alt' keys.

        Returns:
            Modified content with image blocks inserted.
        """
        if not images:
            return content

        # Find positions of <!-- /wp:heading --> that follow H2 headings
        # We need to find the end of each H2 section (just before next H2 or at the end)
        h2_pattern = re.compile(
            r'(<!-- wp:heading \{"level":2\} -->.*?<!-- /wp:heading -->)',
            re.DOTALL,
        )
        h2_matches = list(h2_pattern.finditer(content))

        # Insert images after the content block following each H2 (up to 3)
        # We find the next H2 or end of content, and insert before it
        insertions = []
        for i, match in enumerate(h2_matches[:3]):
            if i >= len(images):
                break
            img = images[i]
            image_block = (
                f'\n<!-- wp:image {{"sizeSlug":"large"}} -->\n'
                f'<figure class="wp-block-image size-large">'
                f'<img src="{img["source_url"]}" alt="{img["alt"]}"/>'
                f'</figure>\n<!-- /wp:image -->\n'
            )
            # Find end of this section: just before the next H2 or end of content
            if i + 1 < len(h2_matches):
                insert_pos = h2_matches[i + 1].start()
            else:
                insert_pos = len(content)
            insertions.append((insert_pos, image_block))

        # Insert in reverse order to preserve positions
        for pos, block in reversed(insertions):
            content = content[:pos] + block + content[pos:]

        return content
