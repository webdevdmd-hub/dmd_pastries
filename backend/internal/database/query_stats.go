package database

import (
	"gorm.io/gorm"

	"pastries-pos/internal/shared/telemetry"
)

// InstrumentQueries counts every SQL statement GORM issues.
//
// Registered as an "after" callback on each operation rather than wrapping the
// connection, so it sees the same statements the database does -- including the
// ones GORM generates on your behalf, which are exactly the ones nobody
// remembers when estimating how chatty a request is.
//
// The callbacks do an atomic increment and nothing else. Anything heavier here
// would be paid on every query in the hot path, which is the opposite of what
// this is for.
func InstrumentQueries(db *gorm.DB) error {
	register := func(name string, register func(string, func(*gorm.DB)) error) error {
		return register("telemetry:"+name, func(tx *gorm.DB) {
			telemetry.RecordStatement(tx.Error != nil)
		})
	}

	callbacks := db.Callback()
	if err := register("query", callbacks.Query().After("gorm:query").Register); err != nil {
		return err
	}
	if err := register("create", callbacks.Create().After("gorm:create").Register); err != nil {
		return err
	}
	if err := register("update", callbacks.Update().After("gorm:update").Register); err != nil {
		return err
	}
	if err := register("delete", callbacks.Delete().After("gorm:delete").Register); err != nil {
		return err
	}
	if err := register("row", callbacks.Row().After("gorm:row").Register); err != nil {
		return err
	}
	return register("raw", callbacks.Raw().After("gorm:raw").Register)
}
