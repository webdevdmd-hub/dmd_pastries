package testdb_test

import (
	"testing"
	"time"

	"pastries-pos/internal/modules/expenses"
	"pastries-pos/internal/shared/money"
	"pastries-pos/internal/testsupport/testdb"
)

// The question the whole float64 -> decimal migration hangs on: does GORM
// route a model field through money.Amount's Scanner and Valuer?
//
// It could not be answered by a unit test. The failure modes are asymmetric
// and one of them is silent: if Valuer were bypassed the driver rejects a
// struct on write and the failure is loud, but if Scanner were bypassed
// Amount has no exported field for GORM to map, so every amount would read
// back as zero. Money silently reading as zero is the worst thing this
// migration could do, which is why it needed a real database.
func TestMoneyAmountRoundTripsThroughGorm(t *testing.T) {
	db := testdb.Tx(t)
	seed := seedBranch(t, db)

	// expenses carries CHECK (amount > 0), so the zero and negative cases are
	// covered separately against a table without it.
	for _, text := range []string{
		"1234.56", "0.01", "100.00", "99999999999.99",
	} {
		amount, err := money.FromString(text)
		if err != nil {
			t.Fatalf("parse %q: %v", text, err)
		}

		expense := newExpense(seed, amount)
		if err := db.Create(&expense).Error; err != nil {
			t.Fatalf("insert %s: %v", text, err)
		}

		var loaded expenses.Expense
		if err := db.Where("id = ?", expense.ID).First(&loaded).Error; err != nil {
			t.Fatalf("read back %s: %v", text, err)
		}
		if !loaded.Amount.Equal(amount) {
			t.Fatalf("amount %s read back as %s -- GORM is not routing through the Scanner",
				text, loaded.Amount)
		}
	}
}

// amountRow exercises the type mapping on its own, against a NUMERIC(14,2)
// column with no constraints, so zero and negative amounts can be covered
// without fighting an unrelated CHECK.
type amountRow struct {
	ID     string       `gorm:"type:uuid;primaryKey"`
	Amount money.Amount `gorm:"type:numeric(14,2);not null"`
}

func (amountRow) TableName() string { return "money_amount_probe" }

// Zero must survive as zero. It is the value the silent-Scanner failure would
// also produce, so it needs checking against the raw column rather than only
// through the model.
func TestZeroAndNegativeAmountsRoundTrip(t *testing.T) {
	db := testdb.Tx(t)
	if err := db.Exec(`CREATE TABLE money_amount_probe (id uuid PRIMARY KEY, amount numeric(14,2) NOT NULL)`).Error; err != nil {
		t.Fatalf("create probe table: %v", err)
	}

	for _, text := range []string{"0.00", "-45.75", "-0.01", "0.01"} {
		amount, err := money.FromString(text)
		if err != nil {
			t.Fatalf("parse %q: %v", text, err)
		}
		row := amountRow{ID: newUUID(), Amount: amount}
		if err := db.Create(&row).Error; err != nil {
			t.Fatalf("insert %s: %v", text, err)
		}

		var loaded amountRow
		if err := db.Where("id = ?", row.ID).First(&loaded).Error; err != nil {
			t.Fatalf("read back %s: %v", text, err)
		}
		if !loaded.Amount.Equal(amount) {
			t.Fatalf("amount %s read back as %s", text, loaded.Amount)
		}

		// Compare against the column itself, not just the model, so a
		// Scanner that quietly produced zero cannot pass by agreeing with a
		// Valuer that quietly wrote zero.
		var stored string
		if err := db.Raw("SELECT amount::text FROM money_amount_probe WHERE id = ?", row.ID).Scan(&stored).Error; err != nil {
			t.Fatalf("read raw %s: %v", text, err)
		}
		expected, err := money.FromString(stored)
		if err != nil {
			t.Fatalf("parse stored %q: %v", stored, err)
		}
		if !expected.Equal(amount) {
			t.Fatalf("amount %s is stored in the column as %q", text, stored)
		}
	}
}

// The column is NUMERIC(14,2). Writing more precision than it holds must not
// be silently accepted at a different value than the one read back -- Postgres
// rounds, and the code must agree about where.
func TestAmountIsStoredAtTheColumnScale(t *testing.T) {
	db := testdb.Tx(t)
	seed := seedBranch(t, db)

	amount, err := money.FromString("12.345")
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	expense := newExpense(seed, amount)
	if err := db.Create(&expense).Error; err != nil {
		t.Fatalf("insert: %v", err)
	}
	var loaded expenses.Expense
	if err := db.Where("id = ?", expense.ID).First(&loaded).Error; err != nil {
		t.Fatalf("read back: %v", err)
	}
	// Postgres rounds half away from zero for NUMERIC, matching Round2.
	if got, want := loaded.Amount.String(), amount.Round2().String(); got != want {
		t.Fatalf("stored 12.345 read back as %s, want %s", got, want)
	}
}

// Summing in the database and summing in Go must agree exactly. This is the
// property the migration exists to buy: with float64 the two drift, which is
// why the reports carry a 0.05 drift epsilon.
func TestGoAndPostgresSumsAgreeExactly(t *testing.T) {
	db := testdb.Tx(t)
	seed := seedBranch(t, db)

	texts := []string{"33.33", "33.33", "33.34", "0.01", "1234.56"}
	total := money.Zero
	for _, text := range texts {
		amount, err := money.FromString(text)
		if err != nil {
			t.Fatalf("parse %q: %v", text, err)
		}
		total = total.Add(amount)
		expense := newExpense(seed, amount)
		if err := db.Create(&expense).Error; err != nil {
			t.Fatalf("insert %s: %v", text, err)
		}
	}

	var summed money.Amount
	if err := db.Raw(
		"SELECT COALESCE(SUM(amount),0)::text FROM expenses WHERE branch_id = ?", seed.BranchID,
	).Scan(&summed).Error; err != nil {
		t.Fatalf("sum: %v", err)
	}
	if !summed.Equal(total) {
		t.Fatalf("Postgres summed %s, Go summed %s", summed, total)
	}
}

func newExpense(seed seededBranch, amount money.Amount) expenses.Expense {
	now := time.Now().UTC()
	return expenses.Expense{
		ID:                   newUUID(),
		BusinessID:           seed.BusinessID,
		BranchID:             seed.BranchID,
		ExpenseNumber:        "EXP-" + newUUID()[:8],
		ExpenseDate:          now,
		ExpenseAccountID:     seed.ExpenseAccountID,
		PaidThroughAccountID: seed.PaidThroughAccountID,
		Amount:               amount,
		Status:               "posted",
		CreatedByUserID:      seed.UserID,
		CreatedAt:            now,
		UpdatedAt:            now,
	}
}
