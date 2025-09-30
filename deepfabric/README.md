# Ad Detection Dataset Generator

This folder contains a deepfabric-based system for generating synthetic training datasets for HTML ad detection models using GPT-4.

## Overview

The system generates balanced datasets containing both advertisement and non-advertisement HTML snippets, each labeled for binary classification. This is useful for training machine learning models to detect ads in web pages.

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

### Output Files

- **`dataset2.json`** - Final formatted dataset with structure:
  ```json
  {
    "html": "<div class='ad-banner'>...</div>",
    "is_ad": true,
    "ad_type": "banner",
    "confidence": 0.95
  }
  ```

- **`dataset2_raw.jsonl`** - Intermediate raw output from deepfabric (conversational format)

## Features

### Dataset Characteristics

- **Balanced Classes**: Generates both ad and non-ad examples
- **Diverse Ad Types**: Banner, sidebar, inline, sponsored, native ads
- **Non-Ad Content**: Navigation menus, articles, comments, forms, footers
- **Realistic HTML**: Includes proper classes, attributes, and structure
- **Confidence Scores**: Each sample includes a confidence rating

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

Run the generation script:
```bash
python generate_ad_dataset.py
```

This will:
1. Generate raw conversational data using deepfabric
2. Apply the custom formatter to extract structured data
3. Save the final dataset to `dataset2.json`

### Custom Generation

To modify the dataset size, edit `python-tutorial.yaml`:
```yaml
dataset:
  creation:
    num_steps: 10    # Number of generation iterations
    batch_size: 5    # Samples per iteration
```

Note: Total samples = num_steps × batch_size (must not exceed topic tree paths)

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

```json
[
  {
    "html": "<div class=\"ad-banner\" data-ad-id=\"12345\">\n  <img src=\"/ads/sale.jpg\" alt=\"50% off\">\n  <button>Shop Now</button>\n</div>",
    "is_ad": true,
    "ad_type": "banner",
    "confidence": 0.95
  },
  {
    "html": "<nav class=\"main-menu\">\n  <ul>\n    <li><a href=\"/home\">Home</a></li>\n    <li><a href=\"/about\">About</a></li>\n  </ul>\n</nav>",
    "is_ad": false,
    "ad_type": null,
    "confidence": 0.95
  }
]
```

## License

# Creative Commons Attribution-NonCommercial 4.0 
# See LICENSE.md in root folder.