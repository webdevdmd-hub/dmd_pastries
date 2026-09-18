package dryrundb_test

import (
	"errors"
	"testing"

	"gorm.io/gorm"

	"pastries-pos/internal/testsupport/dryrundb"
)

// Regression: ISSUE-077 — delete guards had no way to be tested without a
// database; this is the harness the ISSUE-077/078/079/080/096 tests run on.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// The harness is only worth trusting if an unanswered statement behaves the
// way an empty table would. Otherwise a test could pass because its
// Responder forgot a case, not because the service is right.

type widget struct {
	ID     string `gorm:"primaryKey"`
	Status string
}

func TestUnansweredStatementsLookLikeAnEmptyTable(t *testing.T) {
	db, recorder := dryrundb.Open(t, nil)

	var found widget
	if err := db.Where("id = ?", "w1").First(&found).Error; !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("First with no answer = %v, want gorm.ErrRecordNotFound", err)
	}
	var count int64
	if err := db.Model(&widget{}).Count(&count).Error; err != nil || count != 0 {
		t.Fatalf("Count with no answer = %d, %v; want 0, nil", count, err)
	}
	result := db.Model(&widget{}).Where("id = ?", "w1").Update("status", "gone")
	if result.Error != nil || result.RowsAffected != 0 {
		t.Fatalf("Update with no answer = %d rows, %v; want 0 rows", result.RowsAffected, result.Error)
	}
	if got := len(recorder.Statements()); got != 3 {
		t.Fatalf("recorded %d statements, want 3", got)
	}
}

func TestAnswersAndTransactionsAreHonoured(t *testing.T) {
	db, recorder := dryrundb.Open(t, func(stmt dryrundb.Statement, db *gorm.DB) {
		switch stmt.Kind {
		case dryrundb.Query:
			if _, ok := db.Statement.Dest.(*widget); ok {
				dryrundb.Fill(db, widget{ID: "w1", Status: "held"})
			} else {
				dryrundb.SetCount(db, 4)
			}
		case dryrundb.Update:
			dryrundb.Matched(db, 1)
		}
	})

	tx := db.Begin()
	if tx.Error != nil {
		t.Fatalf("begin: %v", tx.Error)
	}
	var found widget
	if err := tx.First(&found, "id = ?", "w1").Error; err != nil || found.Status != "held" {
		t.Fatalf("First = %+v, %v; want the answered row", found, err)
	}
	var count int64
	if err := tx.Model(&widget{}).Count(&count).Error; err != nil || count != 4 {
		t.Fatalf("Count = %d, %v; want 4", count, err)
	}
	if rows := tx.Model(&widget{}).Where("id = ?", "w1").Update("status", "resumed").RowsAffected; rows != 1 {
		t.Fatalf("Update matched %d rows, want 1", rows)
	}
	if err := tx.Commit().Error; err != nil {
		t.Fatalf("commit: %v", err)
	}
	if recorder.Commits() != 1 || recorder.Rollbacks() != 0 {
		t.Fatalf("commits=%d rollbacks=%d, want 1 and 0", recorder.Commits(), recorder.Rollbacks())
	}
	if writes := recorder.Writes("widgets"); len(writes) != 1 {
		t.Fatalf("writes to widgets = %d, want 1", len(writes))
	}
}
