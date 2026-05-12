package permissions

import apperrors "pastries-pos/internal/shared/errors"

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListPermissions() ([]PermissionGroupResponse, error) {
	permissions, err := s.repo.ListAll()
	if err != nil {
		return nil, apperrors.Internal("failed to list permissions")
	}

	groups := make([]PermissionGroupResponse, 0)
	groupIndex := map[string]int{}
	for _, permission := range permissions {
		if IsDeprecatedBroadPermission(permission.PermissionKey) {
			continue
		}

		item := PermissionResponse{
			ID:            permission.ID,
			ModuleName:    permission.ModuleName,
			PermissionKey: permission.PermissionKey,
			Description:   permission.Description,
			CreatedAt:     permission.CreatedAt,
			UpdatedAt:     permission.UpdatedAt,
		}

		index, exists := groupIndex[permission.ModuleName]
		if !exists {
			index = len(groups)
			groupIndex[permission.ModuleName] = index
			groups = append(groups, PermissionGroupResponse{
				ModuleName:  permission.ModuleName,
				Permissions: []PermissionResponse{},
			})
		}
		groups[index].Permissions = append(groups[index].Permissions, item)
	}

	return groups, nil
}
