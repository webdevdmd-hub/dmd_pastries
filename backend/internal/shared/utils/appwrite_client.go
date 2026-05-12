package utils

import (
	"fmt"
	"strings"

	appwriteAccount "github.com/appwrite/sdk-for-go/account"
	"github.com/appwrite/sdk-for-go/appwrite"
	"github.com/appwrite/sdk-for-go/id"
	appwriteUsers "github.com/appwrite/sdk-for-go/users"

	"pastries-pos/internal/config"
)

type AppwriteClient struct {
	endpoint  string
	projectID string
	apiKey    string
}

type AppwriteIdentity struct {
	ID            string
	Email         string
	Phone         string
	Name          string
	EmailVerified bool
}

func NewAppwriteClient(cfg config.Config) *AppwriteClient {
	return &AppwriteClient{
		endpoint:  cfg.AppwriteEndpoint,
		projectID: cfg.AppwriteProjectID,
		apiKey:    cfg.AppwriteAPIKey,
	}
}

func (c *AppwriteClient) CreateUser(email, password, name, phone string) (string, error) {
	client := appwrite.NewClient(
		appwrite.WithEndpoint(c.endpoint),
		appwrite.WithProject(c.projectID),
		appwrite.WithKey(c.apiKey),
	)

	service := appwriteUsers.New(client)
	options := []appwriteUsers.CreateOption{
		service.WithCreateEmail(email),
		service.WithCreatePassword(password),
		service.WithCreateName(name),
	}
	if strings.TrimSpace(phone) != "" {
		options = append(options, service.WithCreatePhone(phone))
	}

	user, err := service.Create(id.Unique(), options...)
	if err != nil {
		return "", err
	}

	return user.Id, nil
}

func (c *AppwriteClient) DeleteUser(userID string) error {
	client := appwrite.NewClient(
		appwrite.WithEndpoint(c.endpoint),
		appwrite.WithProject(c.projectID),
		appwrite.WithKey(c.apiKey),
	)

	service := appwriteUsers.New(client)
	_, err := service.Delete(userID)
	return err
}

type appwriteError interface {
	Error() string
	GetStatusCode() int
	GetResponse() string
}

func FriendlyAppwriteCreateUserError(err error) (string, map[string]interface{}) {
	if err == nil {
		return "failed to create Appwrite user", nil
	}

	details := map[string]interface{}{
		"appwrite_error": err.Error(),
	}

	if appErr, ok := err.(appwriteError); ok {
		details["appwrite_status_code"] = appErr.GetStatusCode()
		if appErr.GetResponse() != "" {
			details["appwrite_response"] = appErr.GetResponse()
		}
	}

	message := strings.ToLower(err.Error())
	switch {
	case strings.Contains(message, "already exists") || strings.Contains(message, "user_already_exists") || strings.Contains(message, "duplicate"):
		return "Appwrite user already exists for this email or phone", details
	case strings.Contains(message, "phone"):
		return "Appwrite rejected the phone number. Use international format like +971501234567 or leave phone empty", details
	case strings.Contains(message, "password"):
		return "Appwrite rejected the password. Use a stronger password with at least 8 characters", details
	case strings.Contains(message, "scope") || strings.Contains(message, "unauthorized") || strings.Contains(message, "401"):
		return "Appwrite API key is missing required user permissions", details
	case strings.Contains(message, "project") || strings.Contains(message, "404"):
		return "Appwrite project configuration is invalid", details
	default:
		return "failed to create Appwrite user", details
	}
}

func (c *AppwriteClient) SetUserStatus(userID string, enabled bool) error {
	client := appwrite.NewClient(
		appwrite.WithEndpoint(c.endpoint),
		appwrite.WithProject(c.projectID),
		appwrite.WithKey(c.apiKey),
	)

	service := appwriteUsers.New(client)
	_, err := service.UpdateStatus(userID, enabled)
	return err
}

func (c *AppwriteClient) DeleteUserSessions(userID string) error {
	client := appwrite.NewClient(
		appwrite.WithEndpoint(c.endpoint),
		appwrite.WithProject(c.projectID),
		appwrite.WithKey(c.apiKey),
	)

	service := appwriteUsers.New(client)
	_, err := service.DeleteSessions(userID)
	return err
}

func (c *AppwriteClient) CreatePasswordRecovery(email, redirectURL string) error {
	client := appwrite.NewClient(
		appwrite.WithEndpoint(c.endpoint),
		appwrite.WithProject(c.projectID),
	)

	service := appwriteAccount.New(client)
	_, err := service.CreateRecovery(email, redirectURL)
	return err
}

func (c *AppwriteClient) CompletePasswordRecovery(userID, secret, password string) error {
	client := appwrite.NewClient(
		appwrite.WithEndpoint(c.endpoint),
		appwrite.WithProject(c.projectID),
	)

	service := appwriteAccount.New(client)
	_, err := service.UpdateRecovery(userID, secret, password)
	return err
}

func (c *AppwriteClient) VerifyJWT(jwt string) (*AppwriteIdentity, error) {
	if jwt == "" {
		return nil, fmt.Errorf("missing jwt")
	}

	client := appwrite.NewClient(
		appwrite.WithEndpoint(c.endpoint),
		appwrite.WithProject(c.projectID),
		appwrite.WithJWT(jwt),
	)

	service := appwriteAccount.New(client)
	account, err := service.Get()
	if err != nil {
		return nil, err
	}

	return &AppwriteIdentity{
		ID:            account.Id,
		Email:         account.Email,
		Phone:         account.Phone,
		Name:          account.Name,
		EmailVerified: account.EmailVerification,
	}, nil
}
