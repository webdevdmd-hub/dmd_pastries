package inventory

import (
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// InventoryOwner is the catalogue column an inventory row hangs off.
//
// Creating an ingredient or a packaging item creates its inventory row on the
// spot, and stocking a product variant creates one for the variant. Deleting
// the catalogue record used to leave that row live: still in the inventory
// list, the stock valuation and the low-stock alerts, for an item nobody can
// open any more (ISSUE-083, ISSUE-084).
type InventoryOwner string

const (
	OwnedByIngredient     InventoryOwner = "ingredient_id"
	OwnedByPackaging      InventoryOwner = "packaging_item_id"
	OwnedByProductVariant InventoryOwner = "product_variant_id"
)

func (owner InventoryOwner) column() (string, error) {
	switch owner {
	case OwnedByIngredient, OwnedByPackaging, OwnedByProductVariant:
		return string(owner), nil
	default:
		return "", fmt.Errorf("inventory: unknown inventory owner %q", string(owner))
	}
}

// Purchase lines name an ingredient or packaging item directly rather than
// through its inventory row, so they are checked by the owner column.
var purchaseLineTables = []string{
	"purchase_order_items",
	"purchase_invoice_items",
	"purchase_receipt_items",
	"purchase_return_items",
}

// StockUses locks the live inventory rows one catalogue item owns and reports
// what the item's stock has been through, in words for a refusal message.
//
// Nothing to report means the rows are the empty shells creating the item
// made -- no stock, never moved, never bought -- and RetireInventoryRows can
// remove them with the item. Anything else is history the item must keep, so
// the caller refuses the delete.
//
// The lock is what makes check-then-delete safe: every stock movement locks
// its inventory row first (FindInventoryItemForUpdate), so none can land
// between this check and the delete in the same transaction.
func (r *Repository) StockUses(tx *gorm.DB, businessID string, owner InventoryOwner, ownerID string) ([]string, error) {
	column, err := owner.column()
	if err != nil {
		return nil, err
	}

	var rows []InventoryItem
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Select("id", "current_quantity", "reserved_quantity", "inventory_value").
		Where("business_id = ? AND "+column+" = ? AND deleted_at IS NULL", businessID, ownerID).
		Find(&rows).Error; err != nil {
		return nil, err
	}

	uses := make([]string, 0)
	for _, row := range rows {
		if !row.CurrentQuantity.IsZero() || !row.ReservedQuantity.IsZero() || !row.InventoryValue.IsZero() {
			uses = append(uses, "stock on hand")
			break
		}
	}

	// History is checked across every row the item ever owned, retired ones
	// included: a movement on an old row is still this item's history.
	for _, check := range []struct{ table, label string }{
		{"stock_movements", "stock movements"},
		{"expiry_batches", "expiry batches"},
		{"stock_transfers", "stock transfers"},
	} {
		owned := tx.Table("inventory_items").Select("id").Where("business_id = ? AND "+column+" = ?", businessID, ownerID)
		var count int64
		if err := tx.Table(check.table).
			Where("business_id = ? AND inventory_item_id IN (?)", businessID, owned).
			Count(&count).Error; err != nil {
			return nil, err
		}
		if count > 0 {
			uses = append(uses, check.label)
		}
	}

	// An open purchase order for the item would otherwise be received
	// against a record that no longer exists. Variants are not bought on
	// purchase documents, so they have nothing to check here.
	if owner != OwnedByProductVariant {
		var lines int64
		for _, table := range purchaseLineTables {
			var count int64
			if err := tx.Table(table).
				Where("business_id = ? AND "+column+" = ? AND deleted_at IS NULL", businessID, ownerID).
				Count(&count).Error; err != nil {
				return nil, err
			}
			lines += count
		}
		if lines > 0 {
			uses = append(uses, "purchase documents")
		}
	}
	return uses, nil
}

// RetireInventoryRows soft-deletes the live inventory rows one catalogue item
// owns, in the caller's transaction, so they leave the inventory list, the
// valuation and the low-stock alerts together with the item.
func (r *Repository) RetireInventoryRows(tx *gorm.DB, businessID string, owner InventoryOwner, ownerID string) error {
	column, err := owner.column()
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	return tx.Model(&InventoryItem{}).
		Where("business_id = ? AND "+column+" = ? AND deleted_at IS NULL", businessID, ownerID).
		Updates(map[string]interface{}{
			"status":     "inactive",
			"deleted_at": gorm.DeletedAt{Time: now, Valid: true},
			"updated_at": now,
		}).Error
}
