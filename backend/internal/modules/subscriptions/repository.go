package subscriptions

import "gorm.io/gorm"

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(tx *gorm.DB, subscription *Subscription) error {
	return tx.Create(subscription).Error
}

func (r *Repository) FindByBusinessID(businessID string) (*Subscription, error) {
	var subscription Subscription
	err := r.db.Where("business_id = ?", businessID).First(&subscription).Error
	if err != nil {
		return nil, err
	}
	return &subscription, nil
}
