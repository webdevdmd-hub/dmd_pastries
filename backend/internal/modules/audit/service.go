package audit

import (
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListActivityLogs(currentUser *utils.AuthContext, query ActivityLogQuery) (*ActivityLogListResponse, error) {
	limit, err := NormalizeActivityLogLimit(query.LimitValue)
	if err != nil {
		return nil, err
	}
	filter, err := s.repo.ResolveActivityLogFilter(currentUser.BusinessID, query, limit)
	if err != nil {
		return nil, err
	}
	branchID, allBranches, err := currentUser.ResolveBranchScope("", "")
	if err != nil {
		return nil, err
	}
	if !allBranches {
		filter.BranchID = branchID
	}
	logs, nextCursorValue, err := s.repo.ListActivity(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to list activity logs")
	}

	items, err := s.repo.BuildActivityResponses(currentUser.BusinessID, logs)
	if err != nil {
		return nil, apperrors.Internal("failed to enrich activity logs")
	}

	var nextCursor *string
	if nextCursorValue != "" {
		nextCursor = &nextCursorValue
	}

	return &ActivityLogListResponse{Items: items, NextCursor: nextCursor}, nil
}
