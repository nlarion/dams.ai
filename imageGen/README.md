# Advertisement Detection Image Generator

A synthetic image generation pipeline for creating realistic advertisement vs non-advertisement training data using Google's Imagen API.

## Overview

This pipeline generates balanced datasets of website screenshots showing either advertisements or legitimate content. It's designed to create diverse training datasets for CNN models that detect advertisements by analyzing images.

## Features

- **Balanced Dataset Generation**: Automatically generates 50/50 split of ad vs non-ad images
- **Parameter Variation**: Randomizes 10+ parameters including ad types, industries, visual styles, and more
- **SQLite Metadata Storage**: Scalable database storage with full query support for 10k+ images
- **Industry-Based Organization**: Automatic folder structure organized by industry/content type
- **Weighted Industry Sampling**: Configurable weights to control industry distribution
- **Generation Profiles**: Predefined profiles for common generation scenarios
- **Parameter Validation**: Avoid invalid parameter combinations
- **Rate Limiting**: Built-in delays and retry logic to handle API rate limits
- **Crash Recovery**: Saves metadata after each image for resumability
- **Progress Tracking**: Live progress bars and detailed logging
- **Enhanced Metadata**: Tracks generation duration, retry count, file size, batch ID, and API version
- **Reproducible**: Optional random seed for deterministic generation

## Setup

### 1. Get Your API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the API key

### 2. Configure Environment

Create a `.env` file in the `imageGen` directory:

```bash
cp .env.example .env
```

Edit `.env` and add your API key:

```
GOOGLE_API_KEY=your_actual_api_key_here
```

### 3. Install Dependencies

From the `imageGen` directory:

```bash
# Activate your virtual environment first (recommended)
source /path/to/your/venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Or from the `dams.ai` root directory:

```bash
pip install -r imageGen/requirements.txt
```

## Usage

### Basic Usage

Generate 10 images (5 ads, 5 non-ads):

```bash
cd imageGen
python3 main.py
```

### Common Use Cases

**Generate 100 images for testing:**
```bash
python3 main.py --num-images 100
```

**Generate 1000 images with 3-second delay (slower, safer for rate limits):**
```bash
python3 main.py --num-images 1000 --delay 3
```

**Generate images with reproducible results:**
```bash
python3 main.py --num-images 50 --seed 42
```

**Generate only ad images (unbalanced):**
```bash
python3 main.py --num-images 100 --unbalanced
```

**Generate ads for a specific industry:**
```bash
python3 main.py --num-images 100 --industry "financial services"
```

**Use a generation profile:**
```bash
python3 main.py --num-images 100 --profile finance_focus
```

**Generate with parameter validation:**
```bash
python3 main.py --num-images 100 --validate
```

**Custom output directory:**
```bash
python3 main.py --num-images 100 --output-dir ./training_data
```

**List available industries:**
```bash
python3 main.py --list-industries
```

**List available profiles:**
```bash
python3 main.py --list-profiles
```

**Export statistics:**
```bash
python3 main.py --export-stats
```

### Command-Line Options

```
--num-images      Number of images to generate (default: 10)
--output-dir      Output directory path (default: output)
--delay           Seconds between API calls (default: 2)
--seed            Random seed for reproducibility (optional)
--unbalanced      Generate only ad images (default: balanced 50/50)
--industry        Generate ads for specific industry only
--profile         Use a predefined generation profile
--validate        Validate parameter combinations during generation
--export-stats    Export statistics and exit
--list-profiles   List available generation profiles
--list-industries List available industries
```

## Output Structure

Images are automatically organized into industry/content-type subfolders:

```
output/
├── ads/                        # Advertisement images by industry
│   ├── e_commerce/
│   │   ├── ad_00001.png
│   │   └── ...
│   ├── financial/
│   │   ├── ad_00015.png
│   │   └── ...
│   ├── gaming/
│   ├── technology/
│   ├── travel/
│   └── ... (other industries)
├── non_ads/                    # Non-advertisement images by content type
│   ├── news/
│   │   ├── non_ad_00001.png
│   │   └── ...
│   ├── sports/
│   ├── entertainment/
│   ├── social/
│   ├── products/
│   └── ... (other content types)
└── metadata.db                 # SQLite database with full metadata
```

## Database Schema

The system uses SQLite for scalable metadata storage. Key tables include:

### Images Table
Stores metadata for each generated image with enhanced tracking:

```sql
CREATE TABLE images (
    id INTEGER PRIMARY KEY,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    label TEXT NOT NULL,
    industry TEXT,              -- For ads
    content_type TEXT,          -- For non-ads
    parameters TEXT NOT NULL,   -- JSON of all parameters
    prompt TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    image_size TEXT NOT NULL,
    file_size_bytes INTEGER,    -- Actual file size
    generation_duration_ms INTEGER,  -- Time taken to generate
    retry_count INTEGER,        -- Number of retries needed
    batch_id TEXT,              -- Group generations together
    api_model_version TEXT,     -- Track API version used
    quality_score REAL          -- Optional quality metric
);
```

### Generation Stats Table
Tracks overall generation progress:

```sql
CREATE TABLE generation_stats (
    total_generated INTEGER,
    ads_count INTEGER,
    non_ads_count INTEGER,
    failed_count INTEGER,
    started_at TEXT,
    last_updated TEXT
);
```

### Profiles Table
Stores generation profiles for reusability:

```sql
CREATE TABLE profiles (
    name TEXT PRIMARY KEY,
    config TEXT NOT NULL,       -- JSON configuration
    description TEXT
);
```

## Export Statistics

View comprehensive statistics about your dataset:

```bash
python3 main.py --export-stats
```

Output:
```json
{
  "generation_stats": {
    "total_generated": 1000,
    "ads_count": 500,
    "non_ads_count": 500,
    "failed_count": 5,
    "started_at": "2025-01-15T10:00:00",
    "last_updated": "2025-01-15T14:30:00"
  },
  "industry_distribution": {
    "e-commerce retail": 85,
    "financial services": 72,
    "gaming": 68,
    "technology products": 65,
    ...
  },
  "content_type_distribution": {
    "news": 95,
    "sports": 82,
    "social": 78,
    ...
  },
  "total_images": 1000,
  "database_path": "output/metadata.db"
}
```

## Generation Profiles

Profiles provide predefined configurations for common generation scenarios:

**Default Profiles:**

- **balanced** - 50/50 split with weighted industry sampling
- **finance_focus** - Only financial services ads
- **ecommerce_focus** - Only e-commerce retail ads
- **gaming_focus** - Only gaming ads
- **high_volume** - Enhanced weights for most common ad types

**Using Profiles:**

```bash
# List available profiles
python3 main.py --list-profiles

# Use a profile
python3 main.py --num-images 100 --profile finance_focus
```

**Creating Custom Profiles:**

Profiles can be added programmatically via the database:

```python
from database import MetadataDB

db = MetadataDB("output/metadata.db")
db.save_profile(
    name="custom_profile",
    config={"industry": "gaming", "balanced": False},
    description="Custom gaming-focused profile"
)
```

## Industry Weighting

Industries can be weighted to control distribution. Higher weights mean more frequent selection:

```python
# In config.py
INDUSTRY_WEIGHTS = {
    "e-commerce retail": 2.0,      # 2x more likely
    "financial services": 1.5,     # 1.5x more likely
    "christmas and holiday sales": 0.5,  # Half as likely
    # ... other industries default to 1.0
}
```

## Testing Individual Components

### Test Prompt Generator

```bash
python3 prompt_generator.py
```

This will display example prompts for both ads and non-ads with weighted sampling.

### Test Image Generator

Create a `.env` file first, then:

```bash
python3 image_generator.py
```

This will generate a single test image to verify API connectivity.

## Parameter Variations

The pipeline randomizes these parameters for each image:

**Advertisement Images:**
- **Ad Types**: banner, sidebar, popup, native, video thumbnail, sponsored post
- **Industries**: e-commerce, travel, finance, gaming, tech, health, fashion, etc.
- **Visual Styles**: bright/colorful, minimalist, bold/flashy, professional, playful
- **CTA Buttons**: "Shop Now", "Buy Now", "Learn More", "Sign Up Free", etc.
- **Promo Text**: "50% OFF", "Limited Time", "Free Shipping", etc.
- **Placements**: top banner, sidebar, in-feed, footer, modal

**Non-Advertisement Images:**
- **Content Types**: article body, navigation, comments, author bio, footer
- **UI Elements**: buttons, forms, menus, search bars, checkboxes
- **Media Types**: editorial photos, infographics, video players, icons
- **Page Sections**: hero, features, testimonials, pricing, contact

**Common Parameters:**
- **Color Schemes**: blue/white, red/white, gradient, monochrome, etc.
- **Layout Styles**: centered, full-width, card-based, grid, stacked
- **Device Context**: desktop, mobile, tablet
- **Theme**: light mode, dark mode

## Cost Considerations

- Google Imagen charges per image generated
- Check current pricing at [Google AI Pricing](https://ai.google.dev/pricing)
- Start small (10-100 images) to estimate costs
- Use `--delay 2` or higher to avoid rate limit errors

## Recommended Workflow

1. **Initial Test** (10 images): Verify everything works
   ```bash
   python3 main.py --num-images 10
   ```

2. **Quality Check** (100 images): Review variation and realism
   ```bash
   python3 main.py --num-images 100
   ```

3. **Model Testing** (1000 images): Train initial model
   ```bash
   python3 main.py --num-images 1000 --delay 3
   ```

4. **Full Dataset** (5k-10k images): Production dataset
   ```bash
   python3 main.py --num-images 5000 --delay 2
   ```

## Logs

All operations are logged to:
- Console (stdout)
- `generation.log` file

Check the log file for detailed error messages and API responses.

## Interruption Handling

If generation is interrupted (Ctrl+C or crash):
- Progress is automatically saved to `metadata.db` (SQLite database)
- Simply run the command again
- The script will continue from where it left off (filenames increment automatically)
- Enhanced metadata (batch_id, retry_count, etc.) is preserved

## Troubleshooting

**API Key Error:**
```
GOOGLE_API_KEY not found in .env file
```
→ Ensure `.env` file exists in `imageGen/` directory with valid API key

**Import Errors:**
```
ModuleNotFoundError: No module named 'google.generativeai'
```
→ Install dependencies: `pip install -r ../requirements.txt`

**Rate Limit Errors:**
```
Error on attempt 1: Rate limit exceeded
```
→ Increase delay: `--delay 5`

**Image Generation Fails:**
→ Check `generation.log` for detailed error messages
→ Verify API key has proper permissions
→ Check your Google Cloud quota/billing

## Next Steps

After generating images:

1. **Validate Quality**: Manually review sample images from both classes
2. **Check Balance**: Verify equal distribution of ad/non-ad images
3. **Analyze Variation**: Ensure good diversity in parameters
4. **Train Model**: Use images with a CNN model (see `../training/`)
5. **Iterate**: Adjust parameters in `config.py` if needed

## Parameter Validation

Enable validation to avoid semantically invalid parameter combinations:

```bash
python3 main.py --num-images 100 --validate
```

Invalid combinations (defined in `config.py`) include:
- Popup ads in footer placements
- Sidebar ads in modal overlays
- Banner ads as floating bottom bars
- Native ads in modal overlays (they should blend with content)

When an invalid combination is detected, the system automatically regenerates with valid parameters.

## Configuration

To customize generation parameters, edit `config.py`:

- **PARAMETERS**: Define new parameter variations
- **AD_TEMPLATE**: Modify advertisement prompt template
- **NON_AD_TEMPLATE**: Modify non-ad content prompt template
- **IMAGE_RESOLUTION**: Change output image size (default: 1024)
- **DEFAULT_DELAY**: Change default API delay (default: 2 seconds)
- **INVALID_COMBINATIONS**: Define semantically invalid parameter pairs
- **INDUSTRY_WEIGHTS**: Control industry distribution weights
- **GENERATION_PROFILES**: Define reusable generation configurations

## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0).

See [../LICENSE.md](../LICENSE.md) for full license text.
