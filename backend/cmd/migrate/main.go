package main

import (
	"log"
	"os"
	_ "time/tzdata"

	"pastries-pos/internal/config"
	"pastries-pos/internal/database"
)

func main() {
	cfg := config.LoadDatabase()

	db, err := database.NewPostgres(cfg)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}

	migrationsPath := os.Getenv("MIGRATIONS_PATH")
	if migrationsPath == "" {
		migrationsPath = "migrations"
	}

	result, err := database.RunMigrations(db, migrationsPath)
	if err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	for _, name := range result.Applied {
		log.Printf("applied migration: %s", name)
	}
	for _, name := range result.Skipped {
		log.Printf("skipped migration: %s", name)
	}
	log.Printf("migration complete: %d applied, %d skipped", len(result.Applied), len(result.Skipped))
}
