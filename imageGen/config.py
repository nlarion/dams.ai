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
        "online streaming services",
        "real estate",
        "hotels and accommodations",
        "christmas and holiday sales",
        "fitness and gyms",
        "credit cards and banking",
        "education and courses",
        "entertainment streaming",
        "shoes and accessories"
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

    "ad_focus": [
        "with prominent call-to-action button",
        "brand-focused with logo and slogan",
        "product showcase without CTA",
        "lifestyle imagery with brand name",
        "minimalist with just brand logo"
    ],

    # Non-advertisement content parameters - realistic images people view online
    "content_type": [
        "news article photo of a person being interviewed",
        "sports action photo showing athletes competing",
        "celebrity photo from entertainment news",
        "product review image showing the item without promotional text",
        "social media photo of people and families",
        "meme image or popular internet humor",
        "cute animal photo (cat, dog, or wildlife)",
        "sports highlight moment (goal, touchdown, basket)",
        "Olympic athlete competing",
        "coach or sports figure interview photo",
        "product photo for e-commerce (electronics, guitar, book, car, etc.)",
        "cartoon or comic strip",
        "food photography from recipe or review",
        "travel photography showing destinations",
        "editorial photo from magazine article",
        "behind-the-scenes photo from movie or show",
        "musician or band performance photo",
        "nature and landscape photography",
        "tutorial or how-to image showing process",
        "infographic or data visualization"
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
# Generate just the ad image itself, not a webpage containing it
AD_TEMPLATE = """A {ad_type} image for {ad_industry}, {ad_focus}, featuring {ad_visual_style}. The design uses a {color_scheme} color scheme with {layout_style}. Designed for {device_context} in {theme_mode}. This should be ONLY the advertisement graphic itself - the actual banner/ad image with branding elements and visual appeal designed to attract attention. Do NOT include the surrounding webpage, browser chrome, or website UI - just the advertisement image itself as it would appear in an <img> tag."""

# Prompt templates for non-advertisements
# Generate realistic images people actually view online - NOT advertisements
NON_AD_TEMPLATE = """{content_type}. This is genuine content that people view online, NOT an advertisement. The image should be realistic and natural, showing ONLY the subject matter itself. NO promotional text overlays, NO "Buy Now" buttons, NO sale prices, NO marketing slogans, NO discount offers. Just a regular photograph or image that would appear in articles, social media, product reviews, or entertainment content. The key distinction: product photos should show just the item itself (like an e-commerce product photo or review image), while advertisements have promotional graphics and text overlaid on the product. This is content people want to see, not marketing material."""

# Image generation settings
IMAGE_RESOLUTION = 1024  # 1024x1024 pixels (will be resized for CNN input)
DEFAULT_DELAY = 2  # seconds between API calls
DEFAULT_BATCH_SIZE = 10

# CNN preprocessing settings (for later use in training)
CNN_INPUT_SIZE = 224  # ResNet, MobileNet standard input size
NORMALIZATION_MEAN = [0.485, 0.456, 0.406]  # ImageNet mean
NORMALIZATION_STD = [0.229, 0.224, 0.225]  # ImageNet std

# Invalid parameter combinations to avoid semantic inconsistencies
INVALID_COMBINATIONS = [
    # Example: popup ads shouldn't use footer placement
    {"ad_type": "popup advertisement", "ad_placement_context": "footer banner placement"},
    # Sidebar ads shouldn't be in modal overlay
    {"ad_type": "sidebar advertisement", "ad_placement_context": "modal overlay"},
    # Banner ads shouldn't float at bottom
    {"ad_type": "banner advertisement", "ad_placement_context": "floating bottom bar"},
    # Interstitial ads are full-screen, not sidebar
    {"ad_type": "interstitial advertisement", "ad_placement_context": "right sidebar placement"},
    # Native ads shouldn't be in modal overlay (they blend with content)
    {"ad_type": "native advertisement", "ad_placement_context": "modal overlay"},
]

# Industry weights for sampling (higher = more likely to be selected)
# Default weight is 1.0, adjust based on desired dataset distribution
INDUSTRY_WEIGHTS = {
    "e-commerce retail": 2.0,          # Common ad type
    "travel and tourism": 1.0,
    "financial services": 1.5,         # Important for detection
    "gaming": 1.5,                      # Common online ads
    "technology products": 1.5,
    "health and wellness": 1.0,
    "fashion and apparel": 1.2,
    "food delivery": 1.2,
    "automotive": 1.0,
    "insurance": 1.0,
    "online streaming services": 1.2,
    "real estate": 0.8,
    "hotels and accommodations": 0.8,
    "christmas and holiday sales": 0.5, # Seasonal
    "fitness and gyms": 0.8,
    "credit cards and banking": 1.0,
    "education and courses": 1.0,
    "entertainment streaming": 1.2,
    "shoes and accessories": 1.0
}

# Generation profiles configuration
GENERATION_PROFILES = {
    "balanced": {
        "description": "Balanced 50/50 split across all industries",
        "balanced": True,
        "use_weights": True
    },
    "finance_focus": {
        "description": "Focus on financial services ads",
        "industry": "financial services",
        "balanced": False
    },
    "ecommerce_focus": {
        "description": "Focus on e-commerce retail ads",
        "industry": "e-commerce retail",
        "balanced": False
    },
    "gaming_focus": {
        "description": "Focus on gaming industry ads",
        "industry": "gaming",
        "balanced": False
    },
    "high_volume": {
        "description": "Weight towards most common ad types",
        "balanced": True,
        "use_weights": True,
        "weight_multiplier": 1.5
    }
}
