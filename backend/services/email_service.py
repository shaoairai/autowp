import requests
from html import escape as html_escape


def send_notification(resend_api_key, from_email, to_email, subject, html_body):
    """Send an email notification via Resend HTTP API.

    Returns:
        dict with 'monthly_remaining' and 'daily_remaining' from Resend headers.

    Raises:
        ValueError: If the API returns an error.
    """
    resp = requests.post(
        'https://api.resend.com/emails',
        headers={
            'Authorization': f'Bearer {resend_api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'from': from_email,
            'to': [to_email],
            'subject': subject,
            'html': html_body,
        },
        timeout=30,
    )

    if resp.status_code not in (200, 201):
        error = resp.json().get('message', resp.text)
        raise ValueError(f'Resend API 錯誤: {error}')

    monthly = resp.headers.get('x-resend-monthly-quota', '?')
    daily = resp.headers.get('x-resend-daily-quota', '?')

    return {'monthly_remaining': monthly, 'daily_remaining': daily}


def build_success_email(title, wp_link, seo_info):
    """Build HTML email body for successful article generation."""
    t = html_escape(title)
    link = html_escape(wp_link)
    seo_kw = html_escape(seo_info.get('focus_keyword', ''))
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">文章產生成功</h2>
        <p>您的文章已成功建立為 WordPress 草稿。</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">文章標題</td>
                <td style="padding: 8px; border: 1px solid #ddd;">{t}</td>
            </tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">WordPress 連結</td>
                <td style="padding: 8px; border: 1px solid #ddd;"><a href="{link}">{link}</a></td>
            </tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Focus Keyword</td>
                <td style="padding: 8px; border: 1px solid #ddd;">{seo_kw}</td>
            </tr>
        </table>
        <p style="color: #666;">此信由 AutoWP 自動發送。</p>
    </div>
    """


def build_failure_email(keyword, error_message, step):
    """Build HTML email body for failed article generation."""
    kw = html_escape(keyword)
    err = html_escape(error_message)
    s = html_escape(step)
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f44336;">文章產生失敗</h2>
        <p>關鍵字「{kw}」的文章產生過程中發生錯誤。</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">失敗步驟</td>
                <td style="padding: 8px; border: 1px solid #ddd;">{s}</td>
            </tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">錯誤訊息</td>
                <td style="padding: 8px; border: 1px solid #ddd;">{err}</td>
            </tr>
        </table>
        <p style="color: #666;">此信由 AutoWP 自動發送。</p>
    </div>
    """
