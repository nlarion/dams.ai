# ImageGen Improvement Tasks

## Metadata Storage & Organization
- [x] Implement SQLite metadata storage with proper schema
- [x] Add industry-based folder structure with auto-creation
- [x] Add enhanced metadata fields (generation_duration_ms, retry_count, file_size_bytes, batch_id, api_model_version)

## Generation Improvements
- [x] Add weighted industry sampling support
- [x] Implement parameter validation rules (avoid invalid combos)
- [x] Add generation profiles system (finance_focus, balanced, etc.)
- [x] Track quality scores (optional field for later - schema supports it)

## CLI Enhancements
- [x] Add --industry flag to generate specific industry only
- [x] Add --profile flag for predefined generation profiles
- [x] Add --export-stats flag to dump analytics
- [x] Add --validate flag to check for invalid parameter combinations
- [x] Add --list-profiles flag to list available profiles
- [x] Add --list-industries flag to list available industries

## Documentation
- [x] Update README with new features
- [x] Document SQLite schema
- [x] Add usage examples for new CLI flags
