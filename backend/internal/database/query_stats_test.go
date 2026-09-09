package database

import (
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// A callback registered under a name GORM does not recognise is accepted
// silently and never runs, which would leave the statement counter reading zero
// forever -- and a zero here reads as "this app barely touches the database",
// the exact wrong answer for the decision it feeds.
func TestQueryInstrumentationRegisters(t *testing.T) {
	db, err := gorm.Open(
		postgres.New(postgres.Config{DSN: "host=127.0.0.1 port=1 user=x dbname=x sslmode=disable"}),
		&gorm.Config{DisableAutomaticPing: true},
	)
	if err != nil {
		t.Skipf("cannot build a GORM instance without a server: %v", err)
	}

	if err := InstrumentQueries(db); err != nil {
		t.Fatalf("InstrumentQueries: %v", err)
	}

	for name, cb := range map[string]interface{ Get(string) func(*gorm.DB) }{
		"query":  db.Callback().Query(),
		"create": db.Callback().Create(),
		"update": db.Callback().Update(),
		"delete": db.Callback().Delete(),
		"row":    db.Callback().Row(),
		"raw":    db.Callback().Raw(),
	} {
		if cb.Get("telemetry:"+name) == nil {
			t.Errorf("no telemetry callback registered for %s; statements of that kind would go uncounted", name)
		}
	}
}
