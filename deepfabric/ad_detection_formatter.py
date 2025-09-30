"""
Custom formatter for ad detection dataset generation.

This formatter extracts HTML snippets and ad classification labels
from conversational outputs into a structured format suitable for
training ad detection models.
"""

import json
import re
from typing import Any, Optional, Dict, List


class AdDetectionFormatter:
    """
    Formatter for creating ad detection training datasets.

    Extracts HTML snippets and classification labels from LLM responses
    and formats them into structured JSON suitable for ML training.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}

        # Compile regex patterns for HTML extraction
        self.html_pattern = re.compile(
            r'```html?\s*(.*?)```',
            re.DOTALL | re.IGNORECASE
        )
        self.classification_pattern = re.compile(
            r'(?:is_ad|Classification|Label)[:\s]*(?:`?)?(true|false|True|False)(?:`?)',
            re.IGNORECASE
        )
        self.ad_type_pattern = re.compile(
            r'(?:ad_type|Type|Ad Type)[:\s]*(?:`?)([a-z]+)(?:`?)',
            re.IGNORECASE
        )

    def format(self, dataset: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Transform dataset to ad detection format.

        Args:
            dataset: list of samples in conversational format

        Returns:
            list of samples in ad detection format
        """
        formatted_samples = []

        for sample in dataset:
            formatted = self._format_single_sample(sample)
            if formatted:
                formatted_samples.append(formatted)

        return formatted_samples

    def _format_single_sample(self, sample: dict) -> Optional[dict]:
        """
        Format a single sample from conversational format to structured ad detection format.

        Args:
            sample: Input sample in conversational format

        Returns:
            Formatted sample with html, is_ad, and ad_type fields
        """
        if "messages" not in sample:
            return None

        # Extract all assistant responses and combine them
        assistant_messages = []
        for message in sample["messages"]:
            if message.get("role") == "assistant":
                content = message.get("content", "")
                if content:
                    assistant_messages.append(content)

        if not assistant_messages:
            return None

        # For multi-turn conversations, check each message for HTML
        html_content = None
        classification_content = None

        for assistant_content in assistant_messages:
            # Look for HTML in this message
            if not html_content:
                html_matches = self.html_pattern.findall(assistant_content)
                if html_matches:
                    html_content = html_matches[0].strip()

            # Look for classification in this message
            if not classification_content:
                if self.classification_pattern.search(assistant_content) or self.ad_type_pattern.search(assistant_content):
                    classification_content = assistant_content

        # If we didn't find HTML or classification separately, use the combined content
        if not html_content or not classification_content:
            assistant_content = "\n".join(assistant_messages)
        else:
            # Use the message with classification info for extraction
            assistant_content = classification_content if classification_content else "\n".join(assistant_messages)

        # If we already found HTML, use it; otherwise extract from combined content
        if not html_content:
            html_matches = self.html_pattern.findall(assistant_content)
            if not html_matches:
                # Try to find any HTML-like content
                html_match = re.search(r'<[^>]+>.*?</[^>]+>', assistant_content, re.DOTALL)
                if html_match:
                    html_content = html_match.group(0).strip()
                else:
                    # Look for HTML without code blocks
                    if '<' in assistant_content and '>' in assistant_content:
                        # Extract the HTML portion
                        lines = assistant_content.split('\n')
                        html_lines = []
                        in_html = False
                        for line in lines:
                            if '<' in line:
                                in_html = True
                            if in_html:
                                html_lines.append(line)
                            if '>' in line and '</' in line:
                                in_html = False
                                if html_lines:
                                    break
                        if html_lines:
                            html_content = '\n'.join(html_lines).strip()
                        else:
                            return None
                    else:
                        return None
            else:
                html_content = html_matches[0].strip()

        # Clean up HTML
        html_content = html_content.strip()
        if not html_content:
            return None

        # Extract classification
        is_ad_match = self.classification_pattern.search(assistant_content)
        if is_ad_match:
            is_ad = is_ad_match.group(1).lower() == "true"
        else:
            # Try to infer from context
            ad_indicators = [
                'advertisement', 'this is an ad', 'sponsored', 'promotion',
                'banner ad', 'sidebar ad', 'google adsense', 'ad example'
            ]
            non_ad_indicators = [
                'navigation', 'menu', 'article', 'comment',
                'footer', 'regular content', 'non-ad', 'not an ad',
                'non-advertisement'
            ]

            content_lower = assistant_content.lower()
            ad_score = sum(1 for indicator in ad_indicators if indicator in content_lower)
            non_ad_score = sum(1 for indicator in non_ad_indicators if indicator in content_lower)

            if ad_score > non_ad_score:
                is_ad = True
            elif non_ad_score > ad_score:
                is_ad = False
            else:
                # Check HTML content itself
                html_lower = html_content.lower()
                if any(cls in html_lower for cls in ['class="ad', 'class="sponsor', 'adsense', 'doubleclick']):
                    is_ad = True
                elif any(cls in html_lower for cls in ['class="nav', 'class="menu', 'class="article', 'class="footer']):
                    is_ad = False
                else:
                    # Default to False if uncertain
                    is_ad = False

        # Extract ad type (optional)
        ad_type = None
        if is_ad:
            ad_type_match = self.ad_type_pattern.search(assistant_content)
            if ad_type_match:
                ad_type = ad_type_match.group(1).lower()
                # Validate ad type
                valid_types = ['banner', 'sidebar', 'inline', 'sponsored', 'native', 'popup', 'interstitial']
                if ad_type not in valid_types:
                    ad_type = 'generic'
            else:
                # Try to infer ad type from HTML classes/content
                html_lower = html_content.lower()
                if 'banner' in html_lower:
                    ad_type = 'banner'
                elif 'sidebar' in html_lower:
                    ad_type = 'sidebar'
                elif 'sponsored' in html_lower:
                    ad_type = 'sponsored'
                elif 'inline' in html_lower:
                    ad_type = 'inline'
                elif 'popup' in html_lower or 'modal' in html_lower:
                    ad_type = 'popup'
                else:
                    ad_type = 'generic'

        # Calculate confidence based on how clearly the classification was stated
        confidence = 0.95 if is_ad_match else 0.75

        # Build structured output
        return {
            "html": html_content,
            "is_ad": is_ad,
            "ad_type": ad_type,
            "confidence": confidence
        }

    def validate(self, entry: Dict[str, Any]) -> bool:
        """
        Validate that an entry can be formatted.

        Args:
            entry: Dataset entry to validate

        Returns:
            True if the entry contains messages and can be processed
        """
        if not isinstance(entry, dict):
            return False

        if "messages" not in entry:
            return False

        # Check for assistant message
        has_assistant = any(
            msg.get("role") == "assistant"
            for msg in entry.get("messages", [])
        )

        return has_assistant


# Test the formatter if run directly
if __name__ == "__main__":
    # Example usage
    sample_input = {
        "messages": [
            {"role": "system", "content": "Generate HTML examples"},
            {"role": "user", "content": "Create an HTML ad example"},
            {"role": "assistant", "content": """
            Here's an example of a banner ad:

            ```html
            <div class="ad-banner">
                <img src="promo.jpg" alt="Sale">
                <p>50% off today!</p>
            </div>
            ```

            Classification: is_ad: true
            Ad Type: banner
            """}
        ]
    }

    formatter = AdDetectionFormatter()
    result = formatter._format_single_sample(sample_input)
    print(json.dumps(result, indent=2))