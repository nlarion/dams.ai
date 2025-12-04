"""
SQLite database module for image generation metadata storage.
Provides scalable, queryable storage for 10k+ images with full parameter tracking.
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any


class MetadataDB:
    """SQLite-based metadata storage for generated images."""

    def __init__(self, db_path: Path):
        """
        Initialize database connection.

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = Path(db_path)
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        self._create_tables()

    def _create_tables(self):
        """Create database schema if not exists."""
        cursor = self.conn.cursor()

        # Main images table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                filepath TEXT NOT NULL,
                label TEXT NOT NULL,
                industry TEXT,
                content_type TEXT,
                parameters TEXT NOT NULL,
                prompt TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                image_size TEXT NOT NULL,
                file_size_bytes INTEGER,
                generation_duration_ms INTEGER,
                retry_count INTEGER DEFAULT 0,
                batch_id TEXT,
                api_model_version TEXT,
                quality_score REAL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create indexes for fast querying
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_label ON images(label)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_industry ON images(industry)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_content_type ON images(content_type)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_batch_id ON images(batch_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON images(timestamp)")

        # Generation stats table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS generation_stats (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                total_generated INTEGER DEFAULT 0,
                ads_count INTEGER DEFAULT 0,
                non_ads_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                started_at TEXT,
                last_updated TEXT
            )
        """)

        # Initialize stats if not exists
        cursor.execute("""
            INSERT OR IGNORE INTO generation_stats (id, started_at)
            VALUES (1, ?)
        """, (datetime.now().isoformat(),))

        # Generation profiles table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                name TEXT PRIMARY KEY,
                config TEXT NOT NULL,
                description TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        self.conn.commit()

    def add_image(self, metadata: Dict[str, Any]) -> int:
        """
        Add an image record to the database.

        Args:
            metadata: Image metadata dictionary

        Returns:
            ID of inserted record
        """
        cursor = self.conn.cursor()

        # Extract industry or content_type from parameters
        params = metadata.get("parameters", {})
        industry = params.get("ad_industry", None)
        content_type = params.get("content_type", None)

        cursor.execute("""
            INSERT INTO images (
                filename, filepath, label, industry, content_type,
                parameters, prompt, timestamp, image_size,
                file_size_bytes, generation_duration_ms, retry_count,
                batch_id, api_model_version, quality_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            metadata["filename"],
            metadata["filepath"],
            metadata["label"],
            industry,
            content_type,
            json.dumps(params),
            metadata["prompt"],
            metadata["timestamp"],
            metadata["image_size"],
            metadata.get("file_size_bytes"),
            metadata.get("generation_duration_ms"),
            metadata.get("retry_count", 0),
            metadata.get("batch_id"),
            metadata.get("api_model_version"),
            metadata.get("quality_score")
        ))

        self.conn.commit()
        return cursor.lastrowid

    def update_stats(self, label: str, success: bool = True):
        """
        Update generation statistics.

        Args:
            label: 'ad' or 'non_ad'
            success: Whether generation was successful
        """
        cursor = self.conn.cursor()

        if success:
            if label == "ad":
                cursor.execute("""
                    UPDATE generation_stats
                    SET total_generated = total_generated + 1,
                        ads_count = ads_count + 1,
                        last_updated = ?
                    WHERE id = 1
                """, (datetime.now().isoformat(),))
            else:
                cursor.execute("""
                    UPDATE generation_stats
                    SET total_generated = total_generated + 1,
                        non_ads_count = non_ads_count + 1,
                        last_updated = ?
                    WHERE id = 1
                """, (datetime.now().isoformat(),))
        else:
            cursor.execute("""
                UPDATE generation_stats
                SET failed_count = failed_count + 1,
                    last_updated = ?
                WHERE id = 1
            """, (datetime.now().isoformat(),))

        self.conn.commit()

    def get_stats(self) -> Dict[str, Any]:
        """Get current generation statistics."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM generation_stats WHERE id = 1")
        row = cursor.fetchone()
        return dict(row) if row else {}

    def get_count(self, label: str) -> int:
        """
        Get count of images by label.

        Args:
            label: 'ad' or 'non_ad'

        Returns:
            Count of images
        """
        stats = self.get_stats()
        if label == "ad":
            return stats.get("ads_count", 0)
        else:
            return stats.get("non_ads_count", 0)

    def get_images_by_industry(self, industry: str) -> List[Dict]:
        """Get all images for a specific industry."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM images WHERE industry = ?", (industry,))
        return [dict(row) for row in cursor.fetchall()]

    def get_industry_stats(self) -> Dict[str, int]:
        """Get count of images per industry."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT industry, COUNT(*) as count
            FROM images
            WHERE industry IS NOT NULL
            GROUP BY industry
            ORDER BY count DESC
        """)
        return {row["industry"]: row["count"] for row in cursor.fetchall()}

    def get_content_type_stats(self) -> Dict[str, int]:
        """Get count of images per content type."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT content_type, COUNT(*) as count
            FROM images
            WHERE content_type IS NOT NULL
            GROUP BY content_type
            ORDER BY count DESC
        """)
        return {row["content_type"]: row["count"] for row in cursor.fetchall()}

    def export_stats(self) -> Dict[str, Any]:
        """Export comprehensive statistics."""
        stats = self.get_stats()
        return {
            "generation_stats": stats,
            "industry_distribution": self.get_industry_stats(),
            "content_type_distribution": self.get_content_type_stats(),
            "total_images": stats.get("total_generated", 0),
            "database_path": str(self.db_path)
        }

    def save_profile(self, name: str, config: Dict, description: str = ""):
        """Save a generation profile."""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO profiles (name, config, description)
            VALUES (?, ?, ?)
        """, (name, json.dumps(config), description))
        self.conn.commit()

    def get_profile(self, name: str) -> Optional[Dict]:
        """Get a generation profile by name."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM profiles WHERE name = ?", (name,))
        row = cursor.fetchone()
        if row:
            result = dict(row)
            result["config"] = json.loads(result["config"])
            return result
        return None

    def list_profiles(self) -> List[str]:
        """List all available profile names."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT name FROM profiles ORDER BY name")
        return [row["name"] for row in cursor.fetchall()]

    def migrate_from_json(self, json_path: Path) -> int:
        """
        Migrate existing JSON metadata to SQLite.

        Args:
            json_path: Path to old metadata.json file

        Returns:
            Number of records migrated
        """
        if not json_path.exists():
            return 0

        with open(json_path, 'r') as f:
            old_data = json.load(f)

        count = 0
        for image in old_data.get("images", []):
            self.add_image(image)
            count += 1

        # Update stats
        old_stats = old_data.get("generation_stats", {})
        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE generation_stats
            SET total_generated = ?,
                ads_count = ?,
                non_ads_count = ?,
                failed_count = ?,
                started_at = ?,
                last_updated = ?
            WHERE id = 1
        """, (
            old_stats.get("total_generated", count),
            old_stats.get("ads_count", 0),
            old_stats.get("non_ads_count", 0),
            old_stats.get("failed_count", 0),
            old_stats.get("started_at", datetime.now().isoformat()),
            datetime.now().isoformat()
        ))
        self.conn.commit()

        return count

    def close(self):
        """Close database connection."""
        self.conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
