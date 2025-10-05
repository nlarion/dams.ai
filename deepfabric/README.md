# Ad Detection Dataset Generator

This folder contains a deepfabric-based system for generating synthetic training datasets for HTML ad detection models using GPT-4.

## 🎯 PRIMARY GOAL

**The main objective of this project is to generate realistic HTML, CSS, and JavaScript code snippets for training machine learning models to detect advertisements by analyzing HTML structure, CSS classes, and JavaScript patterns.**

**ALL synthetic training data is generated in HTML format only.** This ensures the ML model learns to detect ads by analyzing actual HTML/CSS/JavaScript code patterns.

The ML model will read raw HTML and identify ads based on:
- HTML structure and DOM patterns
- CSS class names and styling
- JavaScript ad network code
- Common ad container attributes
- Tracking and analytics markup

## Overview

The system generates balanced datasets containing both advertisement and non-advertisement HTML snippets, each labeled for binary classification. This is useful for training machine learning models to detect ads in web pages by analyzing the HTML/CSS/JavaScript code itself.

## Files

### Core Files

- **`python-tutorial.yaml`** - Main configuration file for deepfabric
  - Configured to use OpenAI's GPT-4o model
  - Generates HTML snippets with ad/non-ad classifications
  - Outputs to `dataset2.json`

- **`ad_detection_formatter.py`** - Custom formatter for extracting structured data
  - Parses HTML snippets from GPT-4 responses
  - Extracts classification labels (is_ad: true/false)
  - Identifies ad types (banner, sidebar, inline, sponsored, etc.)
  - Adds confidence scores

- **`generate_ad_dataset.py`** - Main execution script
  - Orchestrates the dataset generation process
  - Runs deepfabric and applies custom formatting
  - Handles error checking and validation

- **`convert_to_corpus.py`** - Dataset conversion utility
  - Converts ad detection datasets to NLP training corpus format
  - Reads all dataset files from `dataset/` folder
  - Outputs `sample_corpus.json` for use in training notebook
  - Compatible with TensorFlow NLP classification models

### Output Files

- **`dataset/dataset_{domain}_{timestamp}.json`** - Final formatted dataset with structure:
  ```json
  {
    "html": "<div class='ad-banner'>...</div>",
    "is_ad": true,
    "ad_type": "banner",
    "domain": "e-commerce",
    "confidence": 0.95
  }
  ```

- **`debug/dataset_{domain}_{timestamp}_raw.jsonl`** - Intermediate raw output from deepfabric (conversational format)

## Features

### Dataset Characteristics

- **Domain-Specific Generation**: Generate ads tailored to specific website types (e-commerce, news, gaming, finance, etc.)
- **Balanced Classes**: Generates both ad and non-ad examples
- **Diverse Ad Types**: Banner, sidebar, inline, sponsored, native ads
- **Non-Ad Content**: Navigation menus, articles, comments, forms, footers
- **Realistic HTML**: Includes proper classes, attributes, and structure
- **HTML Format Only**: All output is pure HTML/CSS/JavaScript for structural analysis
- **Confidence Scores**: Each sample includes a confidence rating

### Supported Domains

The system supports 30 different domain types, each with domain-specific ad patterns:

- **general** - Generic web ads and content
- **e-commerce** - Product cards, discount banners, shopping cart promos, "Buy Now" CTAs
- **news** - Native ads, sponsored articles, sidebar recommendations
- **social-media** - Promoted posts, sponsored stories, feed advertisements
- **gaming** - In-game offers, battle pass promos, currency purchases, loot box ads
- **finance** - Investment offers, credit card ads, loan promotions, trading platforms
- **travel** - Hotel deals, flight offers, vacation packages, "Book Now" CTAs
- **healthcare** - Medical services, insurance ads, wellness products, telemedicine promos
- **education** - Course promotions, webinar ads, certification programs, "Enroll Now" CTAs
- **entertainment** - Streaming service ads, movie promotions, event tickets, concert announcements
- **sports** - Merchandise, ticket sales, betting promotions, fantasy sports
- **automotive** - Car ads, dealership promotions, auto parts, test drive CTAs, financing offers
- **real-estate** - Property listings, mortgage ads, rental promotions, "Schedule Tour" CTAs
- **food-delivery** - Restaurant promos, meal kit ads, delivery service offers, "Order Now" CTAs
- **fashion** - Clothing sales, seasonal collections, "Shop the Look" CTAs, brand partnerships
- **beauty-cosmetics** - Makeup tutorials, skincare routines, product launches, "Try Now" CTAs
- **home-furnishing** - Furniture sales, room inspiration, "Design Your Space" CTAs
- **electronics** - Gadget launches, tech deals, "Pre-Order" CTAs, product comparisons
- **job-search** - Featured job listings, recruiter ads, resume services, "Apply Now" CTAs
- **dating** - Profile promotions, premium features, "Upgrade Now" CTAs, success stories
- **fitness-wellness** - Gym memberships, supplement ads, workout programs, "Start Free Trial" CTAs
- **pet-supplies** - Pet food ads, accessory promotions, vet services, "Subscribe & Save" CTAs
- **insurance** - Quote tools, coverage comparisons, "Get Quote" CTAs, policy explanations
- **streaming** - Free trial offers, content previews, "Watch Now" CTAs, subscription tiers
- **software-apps** - SaaS promotions, free trial CTAs, feature comparisons, pricing plans
- **telecommunications** - Phone plan ads, internet packages, "Switch & Save" CTAs
- **pharma-medication** - Drug ads, OTC promotions, prescription savings, "Ask Your Doctor" CTAs
- **toys-hobbies** - Toy launches, collectibles, "Pre-Order" CTAs, age recommendations
- **legal-services** - Law firm ads, consultation offers, "Free Case Review" CTAs
- **event-ticketing** - Concert promotions, sports tickets, "Buy Tickets" CTAs, presale codes

### Ad Examples Include

- Common ad container classes (`ad`, `advertisement`, `sponsored`, `promo`)
- Ad network placeholders (Google AdSense, DoubleClick)
- Promotional content with CTAs
- Tracking attributes (`data-ad-id`, `data-campaign`)

### Non-Ad Examples Include

- Navigation menus
- Article content
- User comments
- Product descriptions (non-promotional)
- Form elements
- Regular images and videos
- Footer sections

## Setup

### Prerequisites

1. Install deepfabric:
   ```bash
   pip install deepfabric
   ```

2. Set your OpenAI API key:
   ```bash
   export OPENAI_API_KEY=your-api-key-here
   ```

## Usage

### Quick Start

Generate HTML ads with default settings (general domain):
```bash
python generate_ad_dataset.py
```

This will:
1. Generate raw conversational data using deepfabric
2. Apply the custom formatter to extract structured HTML data
3. Save the final dataset to `dataset/dataset_general_{timestamp}.json`

### Domain-Specific Generation

Generate ads for a specific domain with custom parameters:

```bash
# Generate 9 e-commerce ads (default)
python generate_ad_dataset.py --domain e-commerce

# Generate 100 balanced samples (50% ads, 50% non-ads)
python generate_ad_dataset.py --domain gaming --samples 100 --temperature 1.0 \
  --tree-depth 3 --tree-degree 5

# Generate 1000 samples with 70% ads, 30% non-ads
python generate_ad_dataset.py --domain news --samples 1000 --temperature 1.2 \
  --tree-depth 4 --tree-degree 6 --ad-ratio 0.7

# Generate 500 samples with 30% ads, 70% non-ads (more non-ads for balance)
python generate_ad_dataset.py --domain finance --samples 500 --tree-depth 3 \
  --tree-degree 6 --ad-ratio 0.3
```

### Command-Line Options

```bash
python generate_ad_dataset.py [OPTIONS]

Options:
  --domain DOMAIN       Domain type for ad generation (default: general)
                        Choices: general, e-commerce, news, social-media, gaming,
                                 finance, travel, healthcare, education,
                                 entertainment, sports, automotive, real-estate,
                                 food-delivery, fashion, beauty-cosmetics,
                                 home-furnishing, electronics, job-search, dating,
                                 fitness-wellness, pet-supplies, insurance, streaming,
                                 software-apps, telecommunications, pharma-medication,
                                 toys-hobbies, legal-services, event-ticketing

  --samples N          Target number of samples to generate (default: 9)

  --temperature T      Generation variety/randomness (0.0-2.0, default: 0.8)
                       Higher values = more variety and creativity

  --tree-depth N       Topic tree depth (default: 2)
                       Increase for more diverse topics

  --tree-degree N      Topic tree branching factor (default: 3)
                       Increase for more topic paths

  --ad-ratio R         Ratio of ads to non-ads (0.0-1.0, default: 0.5)
                       0.5 = 50% ads, 50% non-ads (balanced)
                       0.7 = 70% ads, 30% non-ads

  --config PATH        Path to YAML configuration file
                       (default: python-tutorial.yaml)
```

**Understanding Topic Trees:**
- Topic tree paths ≈ `degree^depth` (e.g., depth=4, degree=5 = 625 paths)
- More paths = more variety in generated samples
- For 1000+ samples, use depth=4-5 with degree=4-6

### Converting to Training Corpus

After generating datasets, convert them to training corpus format:

```bash
python convert_to_corpus.py
```

This will:
1. Read all dataset files from the `dataset/` folder
2. Convert HTML ad samples to NLP training format
3. Save to `sample_corpus.json` for use in the training notebook

The output format is compatible with the NLP classification notebook in `../training/`

### Custom Configuration

#### Dataset Size

To modify the dataset size, edit `python-tutorial.yaml`:
```yaml
dataset:
  creation:
    num_steps: 10    # Number of generation iterations
    batch_size: 5    # Samples per iteration
```

Note: Total samples = num_steps × batch_size (must not exceed topic tree paths)

#### Domain Configuration

To change the default domain, edit `python-tutorial.yaml`:
```yaml
domain: "e-commerce"  # Change to any supported domain
```

This will be used when running the script without `--domain` flag.

### Using Only Deepfabric

If you want to generate just the raw conversational data:
```bash
deepfabric generate python-tutorial.yaml
```

Then format manually:
```python
from ad_detection_formatter import AdDetectionFormatter
import json

# Load raw data
with open('dataset2_raw.jsonl', 'r') as f:
    raw_data = [json.loads(line) for line in f]

# Format
formatter = AdDetectionFormatter()
formatted = formatter.format(raw_data)

# Save
with open('dataset2.json', 'w') as f:
    json.dump(formatted, f, indent=2)
```

## Configuration Details

### Topic Tree Settings

- **Degree**: 3 (branches per node)
- **Depth**: 2 (tree levels)
- **Total Paths**: ~9 (limits dataset size)

To generate larger datasets, increase degree or depth in `python-tutorial.yaml`.

### Model Settings

- **Provider**: OpenAI
- **Model**: gpt-4o
- **Temperature**: 0.8 (for variety)
- **Max Retries**: 3 (for failed generations)

## Troubleshooting

### Common Issues

1. **"Path validation failed" Error**
   - Reduce `num_steps` or `batch_size`
   - Or increase `degree` and `depth` in topic tree

2. **API Key Error**
   - Ensure `OPENAI_API_KEY` is set correctly
   - Check API key has sufficient credits

3. **Empty Output**
   - Check `dataset2_raw.jsonl` was generated
   - Verify GPT-4 responses follow the expected format
   - Review formatter regex patterns in `ad_detection_formatter.py`

## Output Example

### E-commerce Domain Example

```json
[
  {
    "html": "<div class=\"ad-banner\" data-ad-id=\"12345\">\n  <img src=\"/ads/sale.jpg\" alt=\"50% off\">\n  <button>Shop Now</button>\n</div>",
    "is_ad": true,
    "ad_type": "banner",
    "domain": "e-commerce",
    "confidence": 0.95
  },
  {
    "html": "<nav class=\"main-menu\">\n  <ul>\n    <li><a href=\"/home\">Home</a></li>\n    <li><a href=\"/about\">About</a></li>\n  </ul>\n</nav>",
    "is_ad": false,
    "ad_type": null,
    "domain": "e-commerce",
    "confidence": 0.95
  }
]
```

### Gaming Domain Example

```json
[
  {
    "html": "<div class=\"sponsored-offer\" data-campaign=\"battle-pass\">\n  <h3>Limited Edition Battle Pass</h3>\n  <p>Unlock exclusive rewards!</p>\n  <button class=\"cta-button\">Buy Now</button>\n  <script async src=\"https://ads.example.com/gaming.js\"></script>\n</div>",
    "is_ad": true,
    "ad_type": "sponsored",
    "domain": "gaming",
    "confidence": 0.95
  }
]
```

## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0).

See [LICENSE.md](../LICENSE.md) in the root folder for full license text.