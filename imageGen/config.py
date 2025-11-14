"""
Configuration file for advertisement detection image generation.
Contains all parameter variations for generating diverse synthetic training data.
"""

PARAMETERS = {
    # Advertisement-specific parameters
    "ad_type": [
        "banner advertisement",
        "sidebar advertisement",
        "popup advertisement",
        "native advertisement",
        "video thumbnail advertisement",
        "sponsored post advertisement",
        "display advertisement",
        "interstitial advertisement"
    ],

    "ad_industry": [
        "e-commerce retail",
        "travel and tourism",
        "financial services",
        "gaming",
        "technology products",
        "health and wellness",
        "fashion and apparel",
        "food delivery",
        "automotive",
        "insurance",
        "education and courses",
        "entertainment streaming"
    ],

    "ad_visual_style": [
        "bright and colorful with gradient backgrounds",
        "minimalist and modern with clean lines",
        "bold and flashy with multiple colors",
        "professional corporate style",
        "playful and casual illustration style",
        "photograph-based with real products",
        "dark mode themed",
        "vibrant with high contrast"
    ],

    "ad_cta_button": [
        "Shop Now",
        "Buy Now",
        "Learn More",
        "Get Started",
        "Sign Up Free",
        "Download Now",
        "Try It Free",
        "Order Today",
        "Book Now",
        "Get Offer",
        "Subscribe",
        "Join Now"
    ],

    "ad_promo_text": [
        "50% OFF",
        "Limited Time Offer",
        "Free Shipping",
        "New Arrival",
        "Best Seller",
        "Discount Code Inside",
        "Sale Ends Soon",
        "Buy One Get One",
        "Free Trial",
        "Special Deal"
    ],

    "ad_placement_context": [
        "top banner placement",
        "right sidebar placement",
        "in-feed native placement",
        "footer banner placement",
        "modal overlay",
        "floating bottom bar",
        "header strip"
    ],

    # Non-advertisement content parameters
    "content_type": [
        "article body text",
        "navigation menu",
        "user comment section",
        "author bio card",
        "footer information",
        "search bar",
        "login form",
        "product description",
        "news headline",
        "blog post excerpt",
        "social media post",
        "FAQ section"
    ],

    "ui_element_type": [
        "primary navigation button",
        "secondary action button",
        "text input field",
        "dropdown menu",
        "checkbox list",
        "radio button group",
        "profile avatar",
        "breadcrumb navigation",
        "pagination controls",
        "tab navigation",
        "card container",
        "accordion section"
    ],

    "media_type": [
        "editorial photograph",
        "infographic",
        "video player thumbnail",
        "social share icon set",
        "user profile picture",
        "logo image",
        "illustration graphic",
        "chart or graph",
        "map image",
        "gallery thumbnail"
    ],

    "page_section": [
        "hero section",
        "feature showcase",
        "testimonial card",
        "pricing table",
        "contact information",
        "about us section",
        "team member profile",
        "blog post grid",
        "category listing",
        "search results"
    ],

    "color_scheme": [
        "blue and white",
        "red and white",
        "green and white",
        "purple and white",
        "orange and white",
        "black and white",
        "multi-color gradient",
        "monochrome grayscale"
    ],

    "layout_style": [
        "centered with padding",
        "full-width edge-to-edge",
        "card-based with shadow",
        "bordered with rounded corners",
        "split-screen layout",
        "grid-based layout",
        "stacked vertical layout"
    ],

    "device_context": [
        "desktop website view",
        "mobile responsive view",
        "tablet landscape view"
    ],

    "theme_mode": [
        "light mode",
        "dark mode"
    ]
}

# Prompt templates for advertisements
AD_TEMPLATE = """A realistic screenshot of a {ad_type} on a website. The advertisement is for {ad_industry}, featuring {ad_visual_style}. The ad prominently displays a '{ad_cta_button}' call-to-action button and includes '{ad_promo_text}' promotional text. The ad appears as {ad_placement_context} on the page. The design uses a {color_scheme} color scheme with {layout_style}. The screenshot shows {device_context} in {theme_mode}. The image should look like an actual advertisement that would appear on a modern website, with clear branding elements, marketing copy, and visual appeal designed to attract clicks."""

# Prompt templates for non-advertisements
NON_AD_TEMPLATE = """A realistic screenshot of legitimate website content showing {content_type}. The image includes {ui_element_type} as part of the standard user interface. The content features {media_type} presented in a natural editorial context. This is part of the {page_section} of the website. The design uses a {color_scheme} color scheme with {layout_style}. The screenshot shows {device_context} in {theme_mode}. The image should look like genuine website content, NOT an advertisement - no promotional call-to-action buttons, no discount offers, no marketing language, just regular website functionality and content that users expect to see."""

# Image generation settings
IMAGE_RESOLUTION = 1024  # 1024x1024 pixels (will be resized for CNN input)
DEFAULT_DELAY = 2  # seconds between API calls
DEFAULT_BATCH_SIZE = 10

# CNN preprocessing settings (for later use in training)
CNN_INPUT_SIZE = 224  # ResNet, MobileNet standard input size
NORMALIZATION_MEAN = [0.485, 0.456, 0.406]  # ImageNet mean
NORMALIZATION_STD = [0.229, 0.224, 0.225]  # ImageNet std
