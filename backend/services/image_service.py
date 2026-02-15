import io

import requests
from PIL import Image

HF_API_URL = 'https://api-inference.huggingface.co/models/{model}'
DEFAULT_MODEL = 'black-forest-labs/FLUX.1-schnell'


def generate_image(api_key, prompt, width=1024, height=576):
    """Generate an image using HuggingFace Inference API.

    Args:
        api_key: HuggingFace API token.
        prompt: English image description prompt.
        width: Image width in pixels (default 1024).
        height: Image height in pixels (default 576, ~16:9).

    Returns:
        bytes: PNG image bytes ready for upload.

    Raises:
        ValueError: If the API fails to return a valid image.
    """
    url = HF_API_URL.format(model=DEFAULT_MODEL)

    resp = requests.post(
        url,
        headers={'Authorization': f'Bearer {api_key}'},
        json={
            'inputs': prompt,
            'parameters': {
                'width': width,
                'height': height,
            },
        },
        timeout=120,
    )
    resp.raise_for_status()

    content_type = resp.headers.get('Content-Type', '')
    if not content_type.startswith('image/'):
        raise ValueError(f'HuggingFace 回傳非圖片內容: {content_type} - {resp.text[:200]}')

    # Convert to PNG
    pil_img = Image.open(io.BytesIO(resp.content))
    buf = io.BytesIO()
    pil_img.save(buf, format='PNG')
    buf.seek(0)
    return buf.read()
