package database

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

type MigrationResult struct {
	Applied []string
	Skipped []string
}

type schemaMigration struct {
	Version   string
	Name      string
	Checksum  string
	AppliedAt time.Time
}

func (schemaMigration) TableName() string {
	return "schema_migrations"
}

func RunMigrations(db *gorm.DB, migrationsPath string) (*MigrationResult, error) {
	if migrationsPath == "" {
		migrationsPath = "migrations"
	}

	if err := ensureMigrationTable(db); err != nil {
		return nil, err
	}

	files, err := filepath.Glob(filepath.Join(migrationsPath, "*.sql"))
	if err != nil {
		return nil, err
	}
	sort.Strings(files)

	result := &MigrationResult{
		Applied: []string{},
		Skipped: []string{},
	}

	for _, file := range files {
		name := filepath.Base(file)
		version := migrationVersion(name)
		if version == "" {
			return nil, fmt.Errorf("invalid migration filename: %s", name)
		}

		applied, err := isMigrationApplied(db, version)
		if err != nil {
			return nil, err
		}
		if applied {
			result.Skipped = append(result.Skipped, name)
			continue
		}

		sqlBytes, err := os.ReadFile(file)
		if err != nil {
			return nil, err
		}
		sqlText := strings.TrimSpace(string(sqlBytes))
		if sqlText == "" {
			return nil, fmt.Errorf("empty migration file: %s", name)
		}

		checksumBytes := sha256.Sum256(sqlBytes)
		checksum := hex.EncodeToString(checksumBytes[:])

		if err := db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Exec(sqlText).Error; err != nil {
				return fmt.Errorf("apply %s: %w", name, err)
			}
			return tx.Create(&schemaMigration{
				Version:   version,
				Name:      name,
				Checksum:  checksum,
				AppliedAt: time.Now().UTC(),
			}).Error
		}); err != nil {
			return nil, err
		}

		result.Applied = append(result.Applied, name)
	}

	return result, nil
}

func ensureMigrationTable(db *gorm.DB) error {
	return db.Exec(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  version varchar(20) PRIMARY KEY,
  name varchar(255) NOT NULL,
  checksum varchar(64) NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
)`).Error
}

func isMigrationApplied(db *gorm.DB, version string) (bool, error) {
	var count int64
	err := db.Table("schema_migrations").Where("version = ?", version).Count(&count).Error
	return count > 0, err
}

func migrationVersion(name string) string {
	parts := strings.SplitN(name, "_", 2)
	if len(parts) != 2 {
		return ""
	}
	return parts[0]
}
