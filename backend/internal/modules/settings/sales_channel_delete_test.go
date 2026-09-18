package settings_test

import (
	"errors"
	"net/http"
	"regexp"
	"strings"
	"testing"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/settings"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/testsupport/dryrundb"
)

// Regression: ISSUE-080 — deleting a sales channel only deactivated it: the
// row stayed listed and its name stayed taken, under a dialog that said
// "This permanently deletes".
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
//
// The fake below is a sales_channels table. A row whose deleted_at an UPDATE
// has set is hidden from every query that excludes deleted rows, which is
// exactly what Postgres would do, and nothing more.

const salesChannelID = "5c2e7d10-7a57-4f0e-8b7e-2b0b8d6a1c10"

type salesChannelRow struct {
	channel settings.SalesChannel
	deleted bool
}

type salesChannelTable struct {
	rows []*salesChannelRow
}

func newSalesChannelTable(isDefault bool) *salesChannelTable {
	return &salesChannelTable{rows: []*salesChannelRow{{channel: settings.SalesChannel{
		ID:          salesChannelID,
		BusinessID:  taxGuardBusinessID,
		ChannelName: "Deliveroo",
		ChannelType: "platform",
		IsDefault:   isDefault,
		Status:      "active",
	}}}}
}

// byID spots a lookup by the row's own id, not business_id.
var byID = regexp.MustCompile(`\bid = `)

// matching returns the rows a statement can see, narrowed to those its
// bound values name when it names an id or a channel name.
func (table *salesChannelTable) matching(stmt dryrundb.Statement) []*salesChannelRow {
	where := stmt.Where()
	var rows []*salesChannelRow
	for _, row := range table.rows {
		if row.deleted && strings.Contains(where, "deleted_at IS NULL") {
			continue
		}
		named := func(value string) bool {
			for _, v := range stmt.Vars {
				if s, ok := v.(string); ok && strings.EqualFold(s, value) {
					return true
				}
			}
			return false
		}
		if byID.MatchString(where) && !named(row.channel.ID) {
			continue
		}
		if strings.Contains(where, "LOWER(channel_name)") && !named(row.channel.ChannelName) {
			continue
		}
		rows = append(rows, row)
	}
	return rows
}

func (table *salesChannelTable) respond(stmt dryrundb.Statement, db *gorm.DB) {
	if stmt.Table != "sales_channels" {
		return
	}
	rows := table.matching(stmt)
	switch stmt.Kind {
	case dryrundb.Query:
		switch dest := db.Statement.Dest.(type) {
		case *settings.SalesChannel:
			if len(rows) > 0 {
				dryrundb.Fill(db, rows[0].channel)
			}
		case *[]settings.SalesChannel:
			for _, row := range rows {
				*dest = append(*dest, row.channel)
			}
			db.RowsAffected = int64(len(rows))
		case *int64:
			dryrundb.SetCount(db, int64(len(rows)))
		}
	case dryrundb.Create:
		if created, ok := db.Statement.Dest.(*settings.SalesChannel); ok {
			table.rows = append(table.rows, &salesChannelRow{channel: *created})
		}
	case dryrundb.Update:
		dryrundb.Matched(db, int64(len(rows)))
		if strings.Contains(stmt.SQL, `"deleted_at"=`) {
			for _, row := range rows {
				row.deleted = true
			}
		}
	}
}

func TestDeletedSalesChannelLeavesTheListAndFreesItsName(t *testing.T) {
	table := newSalesChannelTable(false)
	service, recorder := settingsServiceWith(t, table.respond)
	listsChannel := func() bool {
		t.Helper()
		listed, err := service.ListSalesChannels(settingsUser(), "", "")
		if err != nil {
			t.Fatalf("list: %v", err)
		}
		for _, channel := range listed {
			if channel.ID == salesChannelID {
				return true
			}
		}
		return false
	}
	if !listsChannel() {
		t.Fatal("the channel is not listed before it is deleted; the fake table is wrong")
	}

	if err := service.DeleteSalesChannel(settingsUser(), salesChannelID, "127.0.0.1", "test"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if recorder.Commits() != 1 {
		t.Fatalf("delete committed %d transaction(s), want 1", recorder.Commits())
	}
	if listsChannel() {
		t.Fatal("the deleted channel is still listed")
	}

	_, err := service.CreateSalesChannel(settingsUser(), settings.CreateSalesChannelRequest{
		ChannelName: "Deliveroo",
		ChannelType: "platform",
	}, "127.0.0.1", "test")
	if err != nil {
		t.Fatalf("re-creating the deleted channel's name was refused: %v", err)
	}
	var inserted bool
	for _, write := range recorder.Writes("sales_channels") {
		inserted = inserted || write.Kind == dryrundb.Create
	}
	if !inserted {
		t.Fatal("re-creating the name wrote no new channel")
	}
}

// The settings screen hides Delete for the default channel; the server has
// to agree, or the till's no-channel sales move to whatever sorts first.
func TestDefaultSalesChannelIsNotDeleted(t *testing.T) {
	table := newSalesChannelTable(true)
	service, recorder := settingsServiceWith(t, table.respond)

	err := service.DeleteSalesChannel(settingsUser(), salesChannelID, "127.0.0.1", "test")
	var appErr *apperrors.AppError
	if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
		t.Fatalf("deleting the default channel returned %v, want 409", err)
	}
	if !strings.Contains(appErr.Message, "make another channel the default") {
		t.Errorf("409 message %q does not say what to do instead", appErr.Message)
	}
	if writes := recorder.Writes("sales_channels"); len(writes) > 0 {
		t.Errorf("the default channel was written: %s", writes[0].SQL)
	}
}
